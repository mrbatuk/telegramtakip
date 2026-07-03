import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@tt/db';
import { getKickQueue, getExpiryWarningQueue } from '../queue/queues.js';
import { isDev } from '../config.js';
import { decrypt } from '../lib/crypto.js';
import { callTelegram } from '../lib/telegram.js';

const shrinkSchema = z.object({
  minutes: z.coerce.number().int().min(1).max(60),
});

const extendSchema = z.object({
  days: z.coerce.number().int().min(1).max(3650),
});

const revokeSchema = z.object({
  kick: z.boolean().default(true), // true: kanaldan da at
  reason: z.string().max(300).optional(),
});

export async function registerMembershipRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  app.get<{
    Querystring: { status?: string; channelId?: string; limit?: string };
  }>('/memberships', async (request) => {
    const limit = Math.min(parseInt(request.query.limit ?? '100', 10), 500);

    const memberships = await prisma.membership.findMany({
      where: {
        channel: { bot: { tenantId: request.tenant!.id } },
        ...(request.query.status ? { status: request.query.status as never } : {}),
        ...(request.query.channelId ? { channelId: request.query.channelId } : {}),
      },
      include: {
        channel: { select: { id: true, name: true } },
        order: {
          include: {
            package: { select: { name: true, durationDays: true } },
            joinRequest: {
              select: { firstName: true, lastName: true },
            },
          },
        },
      },
      orderBy: { expiresAt: 'asc' },
      take: limit,
    });

    return {
      memberships: memberships.map((m) => ({
        ...m,
        telegramUserId: m.telegramUserId.toString(),
        firstName: m.order.joinRequest.firstName,
        lastName: m.order.joinRequest.lastName,
      })),
    };
  });

  // ============================================================
  // POST /memberships/:id/extend — N gün uzat (manuel hediye/kampanya)
  // ============================================================
  app.post<{ Params: { id: string } }>(
    '/memberships/:id/extend',
    async (request, reply) => {
      const parsed = extendSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'validation_error',
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const membership = await prisma.membership.findFirst({
        where: {
          id: request.params.id,
          channel: { bot: { tenantId: request.tenant!.id } },
        },
      });
      if (!membership) return reply.status(404).send({ error: 'not_found' });

      const now = new Date();
      const baseTime = membership.expiresAt > now ? membership.expiresAt : now;
      const newExpiresAt = new Date(baseTime.getTime() + parsed.data.days * 24 * 60 * 60 * 1000);

      const kickQueue = getKickQueue();
      const warnQueue = getExpiryWarningQueue();

      // Eski job'ları temizle
      if (membership.kickJobId) {
        try {
          const j = await kickQueue.getJob(membership.kickJobId);
          if (j) await j.remove();
        } catch { /* yoksa sorun değil */ }
      }
      if (membership.warningJobId) {
        try {
          const j = await warnQueue.getJob(membership.warningJobId);
          if (j) await j.remove();
        } catch { /* yoksa sorun değil */ }
      }

      // Yeni delayed job
      const kickDelay = newExpiresAt.getTime() - Date.now();
      let newKickJobId: string | null = null;
      try {
        const job = await kickQueue.add(
          'kick',
          { membershipId: membership.id },
          { delay: kickDelay, jobId: `kick:${membership.id}:${Date.now()}` },
        );
        newKickJobId = job.id ?? null;
      } catch (err) {
        request.log.error({ err }, 'kick job kuyruğa eklenemedi');
      }

      await prisma.membership.update({
        where: { id: membership.id },
        data: {
          expiresAt: newExpiresAt,
          status: 'ACTIVE',
          kickedAt: null,
          kickJobId: newKickJobId,
          warningJobId: null,
        },
      });

      return { ok: true, expiresAt: newExpiresAt };
    },
  );

  // ============================================================
  // POST /memberships/:id/revoke — üyeliği iptal et (opsiyonel: kanaldan at)
  // ============================================================
  app.post<{ Params: { id: string } }>(
    '/memberships/:id/revoke',
    async (request, reply) => {
      const parsed = revokeSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'validation_error',
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const membership = await prisma.membership.findFirst({
        where: {
          id: request.params.id,
          channel: { bot: { tenantId: request.tenant!.id } },
        },
        include: {
          channel: { include: { bot: true } },
        },
      });
      if (!membership) return reply.status(404).send({ error: 'not_found' });

      // Kick job'unu iptal et
      if (membership.kickJobId) {
        try {
          const j = await getKickQueue().getJob(membership.kickJobId);
          if (j) await j.remove();
        } catch { /* yoksa sorun değil */ }
      }
      if (membership.warningJobId) {
        try {
          const j = await getExpiryWarningQueue().getJob(membership.warningJobId);
          if (j) await j.remove();
        } catch { /* yoksa sorun değil */ }
      }

      // Kanaldan at (opsiyonel)
      if (parsed.data.kick) {
        try {
          const token = decrypt(membership.channel.bot.botToken);
          await callTelegram(token, 'banChatMember', {
            chat_id: Number(membership.channel.telegramChatId),
            user_id: Number(membership.telegramUserId),
            revoke_messages: false,
          });
          await callTelegram(token, 'unbanChatMember', {
            chat_id: Number(membership.channel.telegramChatId),
            user_id: Number(membership.telegramUserId),
            only_if_banned: true,
          });

          // Kullanıcıya bildir (best-effort)
          const reasonText = parsed.data.reason ? `\n\nSebep: ${parsed.data.reason}` : '';
          try {
            await callTelegram(token, 'sendMessage', {
              chat_id: Number(membership.telegramUserId),
              text:
                `Üyeliğin *${membership.channel.name}* kanalında iptal edildi ve kanaldan çıkarıldın.${reasonText}`,
              parse_mode: 'Markdown',
            });
          } catch { /* DM kapalı olabilir */ }
        } catch (err) {
          request.log.warn({ err }, 'kanaldan atma başarısız');
        }
      }

      await prisma.membership.update({
        where: { id: membership.id },
        data: {
          status: 'REVOKED',
          kickedAt: parsed.data.kick ? new Date() : null,
          kickJobId: null,
          warningJobId: null,
        },
      });

      return { ok: true };
    },
  );

  // ============================================================
  // TEST: Üyeliğin süresini N dakika sonraya çek + atma job'unu yeniden zamanla
  // Sadece development modunda aktif. Production'da 404 döner.
  // ============================================================
  app.post<{ Params: { id: string } }>(
    '/memberships/:id/test-shrink-expiry',
    async (request, reply) => {
      if (!isDev) {
        return reply.status(404).send({ error: 'not_found' });
      }

      const parsed = shrinkSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'validation_error',
          details: parsed.error.flatten().fieldErrors,
        });
      }
      const minutes = parsed.data.minutes;

      const membership = await prisma.membership.findFirst({
        where: {
          id: request.params.id,
          channel: { bot: { tenantId: request.tenant!.id } },
        },
      });
      if (!membership) {
        return reply.status(404).send({ error: 'membership_not_found' });
      }
      if (membership.status !== 'ACTIVE') {
        return reply
          .status(400)
          .send({ error: 'not_active', message: 'Sadece aktif üyelikte kullanılabilir' });
      }

      const newExpiresAt = new Date(Date.now() + minutes * 60 * 1000);

      // Eski job'ları iptal et
      const kickQueue = getKickQueue();
      const warnQueue = getExpiryWarningQueue();
      if (membership.kickJobId) {
        try {
          const old = await kickQueue.getJob(membership.kickJobId);
          if (old) await old.remove();
        } catch {
          /* yoksa sorun değil */
        }
      }
      if (membership.warningJobId) {
        try {
          const old = await warnQueue.getJob(membership.warningJobId);
          if (old) await old.remove();
        } catch {
          /* yoksa sorun değil */
        }
      }

      // Yeni delayed kick job (idempotent jobId koruyoruz)
      let newKickJobId: string | null = null;
      try {
        const job = await kickQueue.add(
          'kick',
          { membershipId: membership.id },
          {
            delay: minutes * 60 * 1000,
            jobId: `kick:${membership.id}:test-${Date.now()}`,
          },
        );
        newKickJobId = job.id ?? null;
      } catch (err) {
        request.log.error({ err }, 'test kick job kuyruğa eklenemedi');
      }

      await prisma.membership.update({
        where: { id: membership.id },
        data: {
          expiresAt: newExpiresAt,
          kickJobId: newKickJobId,
          warningJobId: null, // uyarı testte gereksiz
        },
      });

      return {
        ok: true,
        expiresAt: newExpiresAt,
        message: `Süre ${minutes} dakikaya çekildi. Kick yaklaşık ${minutes} dk sonra tetiklenir.`,
      };
    },
  );
}
