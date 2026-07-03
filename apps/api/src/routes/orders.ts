import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@tt/db';
import { decrypt } from '../lib/crypto.js';
import { callTelegram } from '../lib/telegram.js';
import { approveOrder } from '../services/orderApproval.js';

const rejectSchema = z.object({
  reason: z.string().min(1).max(500).optional(),
});

export async function registerOrderRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  // GET /orders — tenant'ın siparişleri (filtreli)
  app.get<{
    Querystring: {
      status?: string;
      channelId?: string;
      limit?: string;
      offset?: string;
    };
  }>('/orders', async (request) => {
    const status = request.query.status;
    const channelId = request.query.channelId;
    const limit = Math.min(parseInt(request.query.limit ?? '50', 10), 200);
    const offset = parseInt(request.query.offset ?? '0', 10);

    const orders = await prisma.order.findMany({
      where: {
        joinRequest: {
          channel: { bot: { tenantId: request.tenant!.id } },
        },
        ...(status ? { status: status as never } : {}),
        ...(channelId
          ? { joinRequest: { channelId } }
          : {}),
      },
      include: {
        package: { select: { name: true, durationDays: true } },
        joinRequest: {
          include: {
            channel: { select: { id: true, name: true, currency: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    return {
      orders: orders.map((o) => ({
        ...o,
        amount: o.amount.toString(),
        joinRequest: {
          ...o.joinRequest,
          telegramUserId: o.joinRequest.telegramUserId.toString(),
          channel: {
            ...o.joinRequest.channel,
            telegramChatId: undefined, // gizle
          },
        },
      })),
    };
  });

  // POST /orders/:id/approve — manuel onay
  app.post<{ Params: { id: string } }>(
    '/orders/:id/approve',
    async (request, reply) => {
      const result = await approveOrder({
        orderId: request.params.id,
        approvedBy: request.tenant!.id,
        tenantId: request.tenant!.id,
        logger: request.log,
      });

      if (!result.ok) {
        if (result.reason === 'order_not_found') {
          return reply.status(404).send({ error: 'order_not_found' });
        }
        return reply.status(400).send({
          error: 'invalid_status',
          message: `Sipariş onaylanamadı: ${result.reason}`,
        });
      }

      return {
        ok: true,
        membershipId: result.membershipId,
        expiresAt: result.expiresAt,
      };
    },
  );

  // POST /orders/:id/reject
  app.post<{ Params: { id: string } }>(
    '/orders/:id/reject',
    async (request, reply) => {
      const parsed = rejectSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'validation_error',
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const order = await prisma.order.findFirst({
        where: {
          id: request.params.id,
          joinRequest: {
            channel: { bot: { tenantId: request.tenant!.id } },
          },
        },
        include: {
          joinRequest: {
            include: { channel: { include: { bot: true } } },
          },
        },
      });

      if (!order) {
        return reply.status(404).send({ error: 'order_not_found' });
      }

      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'REJECTED',
          rejectionReason: parsed.data.reason ?? null,
        },
      });

      // Kullanıcıya DM
      try {
        const token = decrypt(order.joinRequest.channel.bot.botToken);
        const reasonText = parsed.data.reason
          ? `\n\nNeden: ${parsed.data.reason}`
          : '';
        await callTelegram(token, 'sendMessage', {
          chat_id: Number(order.joinRequest.telegramUserId),
          text: `❌ Ödemen onaylanmadı.${reasonText}\n\nLütfen kanal sahibi ile iletişime geç.`,
        });
      } catch (err) {
        request.log.info({ err }, 'red DM gönderilemedi');
      }

      return { ok: true };
    },
  );
}
