import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@tt/db';

const upsertSchema = z.object({
  code: z.string().min(3).max(64).regex(/^[A-Z0-9_-]+$/i, 'Harfler, rakamlar, - ve _'),
  description: z.string().max(300).nullable().optional(),
  discountPercent: z.coerce.number().int().min(1).max(100).nullable().optional(),
  discountAmount: z.coerce.number().nonnegative().nullable().optional(),
  validUntil: z.string().datetime().nullable().optional(),
  usageLimit: z.coerce.number().int().min(1).nullable().optional(),
  perTenantLimit: z.coerce.number().int().min(1).nullable().optional(),
  applicableToPlans: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
});

export async function registerAdminCouponsRoutes(app: FastifyInstance) {
  app.get('/admin/coupons', async () => {
    const coupons = await prisma.coupon.findMany({
      include: { _count: { select: { redemptions: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return { coupons };
  });

  app.post('/admin/coupons', async (request, reply) => {
    const parsed = upsertSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'validation_error',
        details: parsed.error.flatten().fieldErrors,
      });
    }
    const code = parsed.data.code.toUpperCase();
    const existing = await prisma.coupon.findUnique({ where: { code } });
    if (existing) {
      return reply.status(409).send({ error: 'code_exists' });
    }
    const created = await prisma.coupon.create({
      data: {
        ...parsed.data,
        code,
        validUntil: parsed.data.validUntil ? new Date(parsed.data.validUntil) : null,
      },
    });
    return reply.status(201).send({ coupon: created });
  });

  app.patch<{ Params: { id: string } }>(
    '/admin/coupons/:id',
    async (request, reply) => {
      const cp = await prisma.coupon.findUnique({ where: { id: request.params.id } });
      if (!cp) return reply.status(404).send({ error: 'not_found' });
      const parsed = upsertSchema.partial().safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'validation_error',
          details: parsed.error.flatten().fieldErrors,
        });
      }
      const data: Record<string, unknown> = { ...parsed.data };
      if (data.code) data.code = String(data.code).toUpperCase();
      if (parsed.data.validUntil !== undefined) {
        data.validUntil = parsed.data.validUntil ? new Date(parsed.data.validUntil) : null;
      }
      const updated = await prisma.coupon.update({ where: { id: cp.id }, data });
      return { coupon: updated };
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/admin/coupons/:id',
    async (request, reply) => {
      const cp = await prisma.coupon.findUnique({ where: { id: request.params.id } });
      if (!cp) return reply.status(404).send({ error: 'not_found' });
      await prisma.coupon.delete({ where: { id: cp.id } });
      return { ok: true };
    },
  );
}
