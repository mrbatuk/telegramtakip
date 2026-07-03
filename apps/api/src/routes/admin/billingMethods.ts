// SaaS tahsilat yöntemleri — SaaS sahibinin tenant'lardan tahsilat için kullandığı
// PayTR/Iyzico/IBAN vs. Sadece süper admin.

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma, type PaymentType } from '@tt/db';
import { encrypt, decrypt } from '../../lib/crypto.js';
import { getProvider } from '../../lib/payments/index.js';

const createSchema = z.object({
  type: z.enum(['PAYTR', 'IYZICO', 'IBAN']),
  label: z.string().min(1).max(80),
  credentials: z.record(z.string()).optional().default({}),
  ibanInfo: z.string().max(500).optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

const updateSchema = z.object({
  label: z.string().min(1).max(80).optional(),
  credentials: z.record(z.string()).optional(),
  ibanInfo: z.string().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
});

function safeCredentials(type: PaymentType, decrypted: Record<string, string>): Record<string, string> {
  const mask = (v: string) =>
    v.length <= 4 ? '****' : `${'*'.repeat(Math.max(4, v.length - 4))}${v.slice(-4)}`;
  if (type === 'PAYTR') {
    return {
      merchant_id: decrypted.merchant_id ?? '',
      merchant_key: mask(decrypted.merchant_key ?? ''),
      merchant_salt: mask(decrypted.merchant_salt ?? ''),
      test_mode: decrypted.test_mode ?? '1',
    };
  }
  if (type === 'IYZICO') {
    return {
      apiKey: mask(decrypted.apiKey ?? ''),
      secretKey: mask(decrypted.secretKey ?? ''),
      sandbox: decrypted.sandbox ?? '1',
    };
  }
  return {};
}

export async function registerAdminBillingMethodsRoutes(app: FastifyInstance) {
  app.get('/admin/billing-methods', async () => {
    const methods = await prisma.saasBillingMethod.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return {
      methods: methods.map((m) => {
        const decrypted = m.credentials ? (JSON.parse(decrypt(m.credentials)) as Record<string, string>) : {};
        return {
          id: m.id,
          type: m.type,
          label: m.label,
          isActive: m.isActive,
          ibanInfo: m.ibanInfo,
          createdAt: m.createdAt,
          credentialsPreview: safeCredentials(m.type, decrypted),
        };
      }),
    };
  });

  app.post('/admin/billing-methods', async (request, reply) => {
    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'validation_error',
        details: parsed.error.flatten().fieldErrors,
      });
    }
    const { type, label, credentials, ibanInfo, isActive } = parsed.data;

    // IBAN dışında credentials + provider doğrulaması gerek
    let encCreds: string = encrypt('{}');
    if (type !== 'IBAN') {
      try {
        const provider = getProvider(type);
        const validation = await provider.validateCredentials(credentials);
        if (!validation.ok) {
          return reply.status(400).send({
            error: 'invalid_credentials',
            message: validation.error ?? 'Credentials geçersiz',
          });
        }
      } catch (err) {
        return reply.status(400).send({
          error: 'unsupported_provider',
          message: err instanceof Error ? err.message : 'Desteklenmeyen',
        });
      }
      encCreds = encrypt(JSON.stringify(credentials));
    }

    const created = await prisma.saasBillingMethod.create({
      data: {
        type,
        label,
        credentials: encCreds,
        ibanInfo: ibanInfo ?? null,
        isActive,
      },
    });

    return reply.status(201).send({
      method: {
        id: created.id,
        type: created.type,
        label: created.label,
        isActive: created.isActive,
      },
    });
  });

  app.patch<{ Params: { id: string } }>(
    '/admin/billing-methods/:id',
    async (request, reply) => {
      const method = await prisma.saasBillingMethod.findUnique({
        where: { id: request.params.id },
      });
      if (!method) return reply.status(404).send({ error: 'not_found' });

      const parsed = updateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'validation_error',
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const data: Record<string, unknown> = {};
      if (parsed.data.label !== undefined) data.label = parsed.data.label;
      if (parsed.data.isActive !== undefined) data.isActive = parsed.data.isActive;
      if (parsed.data.ibanInfo !== undefined) data.ibanInfo = parsed.data.ibanInfo;
      if (parsed.data.credentials) {
        if (method.type !== 'IBAN') {
          const provider = getProvider(method.type);
          const validation = await provider.validateCredentials(parsed.data.credentials);
          if (!validation.ok) {
            return reply.status(400).send({
              error: 'invalid_credentials',
              message: validation.error,
            });
          }
        }
        data.credentials = encrypt(JSON.stringify(parsed.data.credentials));
      }

      await prisma.saasBillingMethod.update({ where: { id: method.id }, data });
      return { ok: true };
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/admin/billing-methods/:id',
    async (request, reply) => {
      const method = await prisma.saasBillingMethod.findUnique({
        where: { id: request.params.id },
      });
      if (!method) return reply.status(404).send({ error: 'not_found' });
      await prisma.saasBillingMethod.delete({ where: { id: method.id } });
      return { ok: true };
    },
  );
}
