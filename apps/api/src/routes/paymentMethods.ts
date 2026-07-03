import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma, type PaymentType } from '@tt/db';
import { encrypt, decrypt } from '../lib/crypto.js';
import { getProvider } from '../lib/payments/index.js';
import { isPaymentMethodAllowed } from '../lib/plans.js';

const createSchema = z.object({
  type: z.enum(['PAYTR', 'IYZICO', 'STRIPE']),
  label: z.string().min(1).max(80),
  credentials: z.record(z.string()),
  isActive: z.boolean().optional().default(true),
});

const updateSchema = z.object({
  label: z.string().min(1).max(80).optional(),
  credentials: z.record(z.string()).optional(),
  isActive: z.boolean().optional(),
});

function safeCredentials(type: PaymentType, decrypted: Record<string, string>): Record<string, string> {
  // Hassas alanları maskeli döndür (sadece son 4)
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
  if (type === 'STRIPE') {
    return {
      secretKey: mask(decrypted.secretKey ?? ''),
      webhookSecret: mask(decrypted.webhookSecret ?? ''),
      currency: decrypted.currency ?? 'try',
    };
  }
  // Diğer tipler için generic mask
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(decrypted)) {
    out[k] = mask(v);
  }
  return out;
}

export async function registerPaymentMethodRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  // GET /payment-methods
  app.get('/payment-methods', async (request) => {
    const methods = await prisma.paymentMethod.findMany({
      where: { tenantId: request.tenant!.id },
      orderBy: { createdAt: 'desc' },
    });

    return {
      methods: methods.map((m) => {
        const decrypted = JSON.parse(decrypt(m.credentials)) as Record<string, string>;
        return {
          id: m.id,
          type: m.type,
          label: m.label,
          isActive: m.isActive,
          createdAt: m.createdAt,
          credentialsPreview: safeCredentials(m.type, decrypted),
        };
      }),
    };
  });

  // POST /payment-methods — yeni ekle
  app.post('/payment-methods', async (request, reply) => {
    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'validation_error',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { type, label, credentials, isActive } = parsed.data;

    // Plan limit: bu tip bu planda izinli mi?
    const tenant = await prisma.tenant.findUnique({
      where: { id: request.tenant!.id },
      select: { plan: true },
    });
    if (!(await isPaymentMethodAllowed(tenant!.plan, type))) {
      return reply.status(403).send({
        error: 'plan_limit',
        message: `${tenant!.plan} planında ${type} ödeme yöntemi kullanılamaz. Planı yükselt.`,
      });
    }

    // Credentials doğrula
    let provider;
    try {
      provider = getProvider(type);
    } catch (err) {
      return reply.status(400).send({
        error: 'unsupported_provider',
        message: err instanceof Error ? err.message : 'Desteklenmeyen sağlayıcı',
      });
    }

    const validation = await provider.validateCredentials(credentials);
    if (!validation.ok) {
      return reply.status(400).send({
        error: 'invalid_credentials',
        message: validation.error ?? 'Credentials geçersiz',
      });
    }

    // Aynı tip+label çakışmasın
    const existing = await prisma.paymentMethod.findFirst({
      where: { tenantId: request.tenant!.id, type, label },
    });
    if (existing) {
      return reply.status(409).send({
        error: 'already_exists',
        message: 'Aynı sağlayıcı + etiket zaten var',
      });
    }

    const encrypted = encrypt(JSON.stringify(credentials));

    const created = await prisma.paymentMethod.create({
      data: {
        tenantId: request.tenant!.id,
        type,
        label,
        credentials: encrypted,
        isActive,
      },
    });

    return reply.status(201).send({
      method: {
        id: created.id,
        type: created.type,
        label: created.label,
        isActive: created.isActive,
        createdAt: created.createdAt,
      },
    });
  });

  // PATCH /payment-methods/:id
  app.patch<{ Params: { id: string } }>(
    '/payment-methods/:id',
    async (request, reply) => {
      const method = await prisma.paymentMethod.findFirst({
        where: { id: request.params.id, tenantId: request.tenant!.id },
      });
      if (!method) {
        return reply.status(404).send({ error: 'not_found' });
      }

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
      if (parsed.data.credentials) {
        const provider = getProvider(method.type);
        const validation = await provider.validateCredentials(parsed.data.credentials);
        if (!validation.ok) {
          return reply.status(400).send({
            error: 'invalid_credentials',
            message: validation.error,
          });
        }
        data.credentials = encrypt(JSON.stringify(parsed.data.credentials));
      }

      await prisma.paymentMethod.update({
        where: { id: method.id },
        data,
      });

      return { ok: true };
    },
  );

  // DELETE /payment-methods/:id
  app.delete<{ Params: { id: string } }>(
    '/payment-methods/:id',
    async (request, reply) => {
      const method = await prisma.paymentMethod.findFirst({
        where: { id: request.params.id, tenantId: request.tenant!.id },
      });
      if (!method) {
        return reply.status(404).send({ error: 'not_found' });
      }
      await prisma.paymentMethod.delete({ where: { id: method.id } });
      return { ok: true };
    },
  );
}
