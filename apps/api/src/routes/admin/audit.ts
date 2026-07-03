import type { FastifyInstance } from 'fastify';
import { prisma } from '@tt/db';

export async function registerAdminAuditRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { limit?: string; offset?: string; targetId?: string } }>(
    '/admin/audit',
    async (request) => {
      const limit = Math.min(parseInt(request.query.limit ?? '100', 10), 500);
      const offset = parseInt(request.query.offset ?? '0', 10);

      const logs = await prisma.adminAuditLog.findMany({
        where: {
          ...(request.query.targetId ? { targetId: request.query.targetId } : {}),
        },
        include: {
          actor: { select: { email: true, fullName: true } },
          target: { select: { email: true, fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      });

      return { logs };
    },
  );
}
