// Tenant kendi profil ayarlarını yönetir
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import argon2 from 'argon2';
import { prisma } from '@tt/db';
import { generateToken, hashToken } from '../lib/token.js';
import { sendEmail } from '../lib/email/index.js';
import { verifyEmailTemplate } from '../lib/email/templates.js';
import { config } from '../config.js';

const profileSchema = z.object({
  fullName: z.string().min(1).max(80).nullable().optional(),
  notifyOnNewReceipt: z.boolean().optional(),
  notifyOnSubExpiry: z.boolean().optional(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'En az 8 karakter'),
});

const emailChangeSchema = z.object({
  newEmail: z.string().email().toLowerCase(),
  currentPassword: z.string().min(1),
});

const deleteSchema = z.object({
  password: z.string().min(1),
  confirmation: z.literal('SIL'),
});

export async function registerProfileRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  // Profil güncelle (ad + bildirim tercihleri)
  app.patch('/profile', async (request, reply) => {
    const parsed = profileSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'validation_error',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const data: Record<string, unknown> = {};
    if (parsed.data.fullName !== undefined) data.fullName = parsed.data.fullName;
    if (parsed.data.notifyOnNewReceipt !== undefined)
      data.notifyOnNewReceipt = parsed.data.notifyOnNewReceipt;
    if (parsed.data.notifyOnSubExpiry !== undefined)
      data.notifyOnSubExpiry = parsed.data.notifyOnSubExpiry;

    await prisma.tenant.update({
      where: { id: request.tenant!.id },
      data,
    });

    return { ok: true };
  });

  // Şifre değiştir
  app.post(
    '/profile/change-password',
    { config: { rateLimit: { max: 5, timeWindow: '5 minutes' } } },
    async (request, reply) => {
      const parsed = passwordSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'validation_error',
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const tenant = await prisma.tenant.findUnique({
        where: { id: request.tenant!.id },
        select: { passwordHash: true },
      });
      if (!tenant) return reply.status(404).send({ error: 'not_found' });

      const ok = await argon2.verify(tenant.passwordHash, parsed.data.currentPassword);
      if (!ok) {
        return reply.status(401).send({
          error: 'invalid_password',
          message: 'Mevcut şifre hatalı',
        });
      }

      const newHash = await argon2.hash(parsed.data.newPassword, {
        type: argon2.argon2id,
        memoryCost: 19456,
        timeCost: 2,
        parallelism: 1,
      });

      await prisma.tenant.update({
        where: { id: request.tenant!.id },
        data: { passwordHash: newHash },
      });

      return { ok: true };
    },
  );

  // E-posta değiştir (yeni e-posta için tekrar doğrulama gerek)
  app.post(
    '/profile/change-email',
    { config: { rateLimit: { max: 3, timeWindow: '15 minutes' } } },
    async (request, reply) => {
      const parsed = emailChangeSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'validation_error',
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const tenant = await prisma.tenant.findUnique({
        where: { id: request.tenant!.id },
        select: { passwordHash: true, email: true, fullName: true },
      });
      if (!tenant) return reply.status(404).send({ error: 'not_found' });

      const ok = await argon2.verify(tenant.passwordHash, parsed.data.currentPassword);
      if (!ok) {
        return reply.status(401).send({
          error: 'invalid_password',
          message: 'Şifre hatalı',
        });
      }

      if (parsed.data.newEmail === tenant.email) {
        return reply.status(400).send({
          error: 'same_email',
          message: 'Yeni e-posta mevcut olanla aynı',
        });
      }

      const existing = await prisma.tenant.findUnique({
        where: { email: parsed.data.newEmail },
      });
      if (existing) {
        return reply.status(409).send({
          error: 'email_exists',
          message: 'Bu e-posta başka bir hesapta kullanılıyor',
        });
      }

      // E-postayı hemen değiştir + tekrar doğrulama iste
      const verify = generateToken();
      await prisma.$transaction([
        prisma.tenant.update({
          where: { id: request.tenant!.id },
          data: { email: parsed.data.newEmail, emailVerifiedAt: null },
        }),
        prisma.emailVerificationToken.create({
          data: {
            tenantId: request.tenant!.id,
            tokenHash: verify.hash,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        }),
      ]);

      void sendEmail(
        verifyEmailTemplate({
          to: parsed.data.newEmail,
          fullName: tenant.fullName,
          verifyUrl: `${config.PUBLIC_WEB_URL}/verify-email?token=${verify.raw}`,
        }),
      ).catch(() => {});

      return { ok: true, requiresVerification: true };
    },
  );

  // Hesap silme talebi
  app.post(
    '/profile/delete-account',
    { config: { rateLimit: { max: 3, timeWindow: '30 minutes' } } },
    async (request, reply) => {
      const parsed = deleteSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'validation_error',
          message: 'Onay için "SIL" yaz',
        });
      }

      const tenant = await prisma.tenant.findUnique({
        where: { id: request.tenant!.id },
        select: { passwordHash: true, isSuperAdmin: true },
      });
      if (!tenant) return reply.status(404).send({ error: 'not_found' });

      if (tenant.isSuperAdmin) {
        return reply.status(400).send({
          error: 'super_admin',
          message: 'Süper admin hesabı silinemez',
        });
      }

      const ok = await argon2.verify(tenant.passwordHash, parsed.data.password);
      if (!ok) {
        return reply.status(401).send({
          error: 'invalid_password',
          message: 'Şifre hatalı',
        });
      }

      // Tüm ilişkili veriler cascade siler (schema'da onDelete: Cascade)
      await prisma.tenant.delete({ where: { id: request.tenant!.id } });

      return { ok: true };
    },
  );
}
