import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@tt/db';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireSuperAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    tenant?: {
      id: string;
      email: string;
      plan: string;
      isSuperAdmin: boolean;
      isSuspended: boolean;
    };
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; email: string };
    user: { sub: string; email: string };
  }
}

export async function registerAuth(app: FastifyInstance) {
  app.decorate(
    'authenticate',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await request.jwtVerify();
      } catch {
        return reply.status(401).send({
          error: 'unauthorized',
          message: 'Geçersiz veya eksik token',
        });
      }

      const { sub } = request.user;
      const tenant = await prisma.tenant.findUnique({
        where: { id: sub },
        select: {
          id: true,
          email: true,
          plan: true,
          isSuperAdmin: true,
          isSuspended: true,
        },
      });

      if (!tenant) {
        return reply.status(401).send({
          error: 'unauthorized',
          message: 'Kullanıcı bulunamadı',
        });
      }

      if (tenant.isSuspended) {
        return reply.status(403).send({
          error: 'suspended',
          message: 'Hesabın askıya alındı. Detay için iletişime geç.',
        });
      }

      request.tenant = tenant;
    },
  );

  // SuperAdmin gereken endpoint'lerde authenticate sonrası bunu da ekleyin
  app.decorate(
    'requireSuperAdmin',
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.tenant) {
        return reply.status(401).send({ error: 'unauthorized' });
      }
      if (!request.tenant.isSuperAdmin) {
        return reply.status(403).send({
          error: 'forbidden',
          message: 'Bu işlem için yönetici yetkisi gerekiyor',
        });
      }
    },
  );
}
