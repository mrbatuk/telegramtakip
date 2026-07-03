import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@tt/db';
import { invalidatePlanCache } from '../../lib/plans.js';

const upsertSchema = z.object({
  key: z.string().min(1).max(32).regex(/^[A-Z0-9_-]+$/, 'Sadece büyük harf, rakam, - ve _'),
  name: z.string().min(1).max(80),
  description: z.string().max(500).nullable().optional(),
  monthlyPriceTRY: z.coerce.number().nonnegative(),
  maxBots: z.coerce.number().int().min(1),
  maxChannelsPerBot: z.coerce.number().int().min(1),
  maxActiveMembers: z.coerce.number().int().min(1),
  allowedPaymentMethods: z.array(z.string()).default([]),
  features: z.array(z.string().min(1).max(200)).default([]),
  isActive: z.boolean().default(true),
  isPublic: z.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0),
  quarterlyMultiplier: z.coerce.number().min(0).max(1).nullable().optional(),
  yearlyMultiplier: z.coerce.number().min(0).max(1).nullable().optional(),
});

export async function registerAdminPlansRoutes(app: FastifyInstance) {
  app.get('/admin/plans', async () => {
    const plans = await prisma.planConfig.findMany({ orderBy: { sortOrder: 'asc' } });
    return { plans };
  });

  app.post('/admin/plans', async (request, reply) => {
    const parsed = upsertSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'validation_error',
        details: parsed.error.flatten().fieldErrors,
      });
    }
    const existing = await prisma.planConfig.findUnique({
      where: { key: parsed.data.key },
    });
    if (existing) {
      return reply.status(409).send({ error: 'key_exists', message: 'Bu key zaten var' });
    }
    const created = await prisma.planConfig.create({ data: parsed.data });
    invalidatePlanCache();
    return reply.status(201).send({ plan: created });
  });

  app.patch<{ Params: { id: string } }>(
    '/admin/plans/:id',
    async (request, reply) => {
      const plan = await prisma.planConfig.findUnique({
        where: { id: request.params.id },
      });
      if (!plan) return reply.status(404).send({ error: 'not_found' });

      const parsed = upsertSchema.partial().safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'validation_error',
          details: parsed.error.flatten().fieldErrors,
        });
      }

      // key değiştiriliyorsa mevcut tenant/subscription referanslarını da güncelle
      if (parsed.data.key && parsed.data.key !== plan.key) {
        await prisma.$transaction([
          prisma.tenant.updateMany({
            where: { plan: plan.key },
            data: { plan: parsed.data.key },
          }),
          prisma.subscription.updateMany({
            where: { plan: plan.key },
            data: { plan: parsed.data.key },
          }),
        ]);
      }

      const updated = await prisma.planConfig.update({
        where: { id: plan.id },
        data: parsed.data,
      });
      invalidatePlanCache();
      return { plan: updated };
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/admin/plans/:id',
    async (request, reply) => {
      const plan = await prisma.planConfig.findUnique({
        where: { id: request.params.id },
      });
      if (!plan) return reply.status(404).send({ error: 'not_found' });

      const inUse = await prisma.tenant.count({ where: { plan: plan.key } });
      if (inUse > 0) {
        return reply.status(400).send({
          error: 'in_use',
          message: `${inUse} kullanıcı bu planda — silmek yerine "isActive" veya "isPublic"'i kapat.`,
        });
      }

      await prisma.planConfig.delete({ where: { id: plan.id } });
      invalidatePlanCache();
      return { ok: true };
    },
  );
}
