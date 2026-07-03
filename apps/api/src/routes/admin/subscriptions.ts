import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@tt/db';

const createSubSchema = z.object({
  tenantId: z.string().min(1),
  plan: z.string().min(1),
  amount: z.coerce.number().positive(),
  currency: z.string().length(3).default('TRY'),
  method: z.enum(['IBAN_TRANSFER', 'MANUAL_CASH', 'PAYTR', 'IYZICO', 'OTHER']),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  note: z.string().max(500).optional(),
  // Bu kayıt aynı zamanda tenant.subExpiresAt'i güncellesin mi?
  extendTenantSub: z.boolean().default(true),
  // Tenant.plan'i de değiştirsin mi?
  upgradePlan: z.boolean().default(true),
});

export async function registerAdminSubscriptionRoutes(app: FastifyInstance) {
  // GET /admin/subscriptions — son ödemeler
  app.get<{
    Querystring: { tenantId?: string; limit?: string; offset?: string };
  }>('/admin/subscriptions', async (request) => {
    const limit = Math.min(parseInt(request.query.limit ?? '100', 10), 500);
    const offset = parseInt(request.query.offset ?? '0', 10);

    const where: Record<string, unknown> = {};
    if (request.query.tenantId) where.tenantId = request.query.tenantId;

    const [subs, total, sumAll] = await Promise.all([
      prisma.subscription.findMany({
        where,
        include: {
          tenant: { select: { id: true, email: true, fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.subscription.count({ where }),
      prisma.subscription.aggregate({ where, _sum: { amount: true } }),
    ]);

    return {
      subscriptions: subs.map((s) => ({
        ...s,
        amount: s.amount.toString(),
      })),
      total,
      totalAmount: Number(sumAll._sum.amount ?? 0),
    };
  });

  // POST /admin/subscriptions — yeni ödeme kaydı
  app.post('/admin/subscriptions', async (request, reply) => {
    const parsed = createSubSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'validation_error',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const data = parsed.data;

    const tenant = await prisma.tenant.findUnique({ where: { id: data.tenantId } });
    if (!tenant) return reply.status(404).send({ error: 'tenant_not_found' });

    const subscription = await prisma.$transaction(async (tx) => {
      const sub = await tx.subscription.create({
        data: {
          tenantId: data.tenantId,
          plan: data.plan,
          amount: data.amount,
          currency: data.currency,
          method: data.method,
          periodStart: new Date(data.periodStart),
          periodEnd: new Date(data.periodEnd),
          note: data.note,
          recordedBy: request.tenant!.id,
        },
      });

      const tenantUpdate: Record<string, unknown> = {};
      if (data.upgradePlan) tenantUpdate.plan = data.plan;
      if (data.extendTenantSub) {
        const newEnd = new Date(data.periodEnd);
        const currentEnd = tenant.subExpiresAt;
        // Uzat: mevcut bitiş ileri tarihliyse onun üstüne, değilse direkt set et
        tenantUpdate.subExpiresAt =
          currentEnd && currentEnd > newEnd ? currentEnd : newEnd;
      }
      if (Object.keys(tenantUpdate).length > 0) {
        await tx.tenant.update({
          where: { id: data.tenantId },
          data: tenantUpdate,
        });
      }

      return sub;
    });

    await prisma.adminAuditLog.create({
      data: {
        actorId: request.tenant!.id,
        targetId: data.tenantId,
        action: 'subscription.create',
        details: {
          plan: data.plan,
          amount: data.amount,
          periodEnd: data.periodEnd,
        },
      },
    });

    return reply.status(201).send({
      subscription: {
        ...subscription,
        amount: subscription.amount.toString(),
      },
    });
  });

  // DELETE /admin/subscriptions/:id
  app.delete<{ Params: { id: string } }>(
    '/admin/subscriptions/:id',
    async (request, reply) => {
      const sub = await prisma.subscription.findUnique({
        where: { id: request.params.id },
      });
      if (!sub) return reply.status(404).send({ error: 'not_found' });

      await prisma.subscription.delete({ where: { id: sub.id } });

      await prisma.adminAuditLog.create({
        data: {
          actorId: request.tenant!.id,
          targetId: sub.tenantId,
          action: 'subscription.delete',
          details: { subId: sub.id, amount: sub.amount.toString() },
        },
      });

      return { ok: true };
    },
  );
}
