import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma, Prisma } from '@tt/db';

const updateTenantSchema = z.object({
  plan: z.string().min(1).optional(),
  subExpiresAt: z.string().datetime().nullable().optional(),
  isSuspended: z.boolean().optional(),
  suspendedReason: z.string().max(500).nullable().optional(),
  adminNotes: z.string().max(2000).nullable().optional(),
  planOverride: z.record(z.union([z.number(), z.string(), z.array(z.string()), z.null()])).nullable().optional(),
});

const extendSchema = z.object({
  days: z.coerce.number().int().min(1).max(3650),
});

async function logAudit(
  actorId: string,
  targetId: string | null,
  action: string,
  details?: Record<string, unknown>,
): Promise<void> {
  await prisma.adminAuditLog.create({
    data: {
      actorId,
      targetId,
      action,
      details: (details as Prisma.InputJsonValue) ?? Prisma.JsonNull,
    },
  });
}

export async function registerAdminTenantRoutes(app: FastifyInstance) {
  // GET /admin/tenants — liste, arama, filtre
  app.get<{
    Querystring: {
      q?: string;
      plan?: string;
      status?: 'active' | 'suspended' | 'expired';
      limit?: string;
      offset?: string;
    };
  }>('/admin/tenants', async (request) => {
    const q = request.query.q?.trim() ?? '';
    const planFilter = request.query.plan;
    const statusFilter = request.query.status;
    const limit = Math.min(parseInt(request.query.limit ?? '50', 10), 200);
    const offset = parseInt(request.query.offset ?? '0', 10);

    const now = new Date();

    const where: Record<string, unknown> = { isSuperAdmin: false };

    if (q) {
      where.OR = [
        { email: { contains: q, mode: 'insensitive' } },
        { fullName: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (planFilter) where.plan = planFilter;
    if (statusFilter === 'suspended') where.isSuspended = true;
    if (statusFilter === 'active') {
      where.isSuspended = false;
      where.subExpiresAt = { gt: now };
    }
    if (statusFilter === 'expired') {
      where.OR = [
        ...((where.OR as unknown[]) ?? []),
        { subExpiresAt: null },
        { subExpiresAt: { lte: now } },
      ];
    }

    const [tenants, total] = await Promise.all([
      prisma.tenant.findMany({
        where,
        select: {
          id: true,
          email: true,
          fullName: true,
          plan: true,
          subExpiresAt: true,
          isSuspended: true,
          lastLoginAt: true,
          createdAt: true,
          _count: {
            select: {
              bots: true,
              subscriptions: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.tenant.count({ where }),
    ]);

    return { tenants, total };
  });

  // GET /admin/tenants/:id — detay
  app.get<{ Params: { id: string } }>(
    '/admin/tenants/:id',
    async (request, reply) => {
      const tenant = await prisma.tenant.findUnique({
        where: { id: request.params.id },
        include: {
          bots: {
            include: {
              _count: { select: { channels: true } },
              channels: {
                include: { _count: { select: { memberships: true, joinRequests: true } } },
              },
            },
          },
          paymentMethods: {
            select: { id: true, type: true, label: true, isActive: true, createdAt: true },
          },
          subscriptions: {
            orderBy: { periodEnd: 'desc' },
            take: 10,
          },
          _count: { select: { subscriptions: true } },
        },
      });

      if (!tenant) {
        return reply.status(404).send({ error: 'not_found' });
      }

      // Hassas alanları sil
      const { passwordHash, ...safe } = tenant;
      void passwordHash;

      // Toplam gelir (tenant'ın son kullanıcılarından)
      const totalRevenue = await prisma.order.aggregate({
        where: {
          status: 'APPROVED',
          joinRequest: { channel: { bot: { tenantId: tenant.id } } },
        },
        _sum: { amount: true },
      });

      // Aktif üye sayısı
      const activeMemberships = await prisma.membership.count({
        where: {
          status: 'ACTIVE',
          channel: { bot: { tenantId: tenant.id } },
        },
      });

      // BigInt'leri string'e çevir (JSON serileştirilebilir olsun)
      return {
        tenant: {
          ...safe,
          bots: safe.bots.map((b) => ({
            ...b,
            channels: b.channels.map((c) => ({
              ...c,
              telegramChatId: c.telegramChatId.toString(),
            })),
          })),
        },
        stats: {
          totalRevenue: Number(totalRevenue._sum.amount ?? 0),
          activeMemberships,
        },
      };
    },
  );

  // PATCH /admin/tenants/:id — plan, abonelik, askı, not güncelle
  app.patch<{ Params: { id: string } }>(
    '/admin/tenants/:id',
    async (request, reply) => {
      const tenant = await prisma.tenant.findUnique({
        where: { id: request.params.id },
      });
      if (!tenant) return reply.status(404).send({ error: 'not_found' });
      if (tenant.isSuperAdmin) {
        return reply
          .status(400)
          .send({ error: 'cannot_modify_admin', message: 'Süper admin hesabı düzenlenemez' });
      }

      const parsed = updateTenantSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'validation_error',
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const data: Record<string, unknown> = {};
      const changes: Record<string, unknown> = {};

      if (parsed.data.plan !== undefined && parsed.data.plan !== tenant.plan) {
        data.plan = parsed.data.plan;
        changes.plan = { from: tenant.plan, to: parsed.data.plan };
      }
      if (parsed.data.subExpiresAt !== undefined) {
        const newDate = parsed.data.subExpiresAt
          ? new Date(parsed.data.subExpiresAt)
          : null;
        data.subExpiresAt = newDate;
        changes.subExpiresAt = {
          from: tenant.subExpiresAt?.toISOString() ?? null,
          to: newDate?.toISOString() ?? null,
        };
      }
      if (
        parsed.data.isSuspended !== undefined &&
        parsed.data.isSuspended !== tenant.isSuspended
      ) {
        data.isSuspended = parsed.data.isSuspended;
        changes.isSuspended = {
          from: tenant.isSuspended,
          to: parsed.data.isSuspended,
        };
      }
      if (parsed.data.suspendedReason !== undefined) {
        data.suspendedReason = parsed.data.suspendedReason;
      }
      if (parsed.data.adminNotes !== undefined) {
        data.adminNotes = parsed.data.adminNotes;
      }
      if (parsed.data.planOverride !== undefined) {
        data.planOverride = parsed.data.planOverride === null ? Prisma.JsonNull : (parsed.data.planOverride as Prisma.InputJsonValue);
      }

      const updated = await prisma.tenant.update({
        where: { id: tenant.id },
        data,
        select: {
          id: true,
          email: true,
          plan: true,
          subExpiresAt: true,
          isSuspended: true,
          suspendedReason: true,
          adminNotes: true,
        },
      });

      if (Object.keys(changes).length > 0) {
        await logAudit(request.tenant!.id, tenant.id, 'tenant.update', changes);
      }

      return { tenant: updated };
    },
  );

  // POST /admin/tenants/:id/extend — N gün uzat
  app.post<{ Params: { id: string } }>(
    '/admin/tenants/:id/extend',
    async (request, reply) => {
      const tenant = await prisma.tenant.findUnique({
        where: { id: request.params.id },
      });
      if (!tenant) return reply.status(404).send({ error: 'not_found' });

      const parsed = extendSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'validation_error',
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const now = new Date();
      const base =
        tenant.subExpiresAt && tenant.subExpiresAt > now ? tenant.subExpiresAt : now;
      const newExpires = new Date(
        base.getTime() + parsed.data.days * 24 * 60 * 60 * 1000,
      );

      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { subExpiresAt: newExpires },
      });

      await logAudit(request.tenant!.id, tenant.id, 'tenant.extend', {
        days: parsed.data.days,
        from: tenant.subExpiresAt?.toISOString() ?? null,
        to: newExpires.toISOString(),
      });

      return { subExpiresAt: newExpires };
    },
  );

  // DELETE /admin/tenants/:id — tamamen sil (tüm verisi cascade siler)
  app.delete<{ Params: { id: string } }>(
    '/admin/tenants/:id',
    async (request, reply) => {
      const tenant = await prisma.tenant.findUnique({
        where: { id: request.params.id },
      });
      if (!tenant) return reply.status(404).send({ error: 'not_found' });
      if (tenant.isSuperAdmin) {
        return reply
          .status(400)
          .send({ error: 'cannot_delete_admin', message: 'Süper admin silinemez' });
      }

      await logAudit(request.tenant!.id, tenant.id, 'tenant.delete', {
        email: tenant.email,
      });

      await prisma.tenant.delete({ where: { id: tenant.id } });

      return { ok: true };
    },
  );
}
