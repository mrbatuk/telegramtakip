import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import argon2 from 'argon2';
import { prisma } from '@tt/db';
import { config } from '../config.js';
import { generateToken, hashToken } from '../lib/token.js';
import { sendEmail } from '../lib/email/index.js';
import {
  verifyEmailTemplate,
  passwordResetTemplate,
} from '../lib/email/templates.js';
import { notifyAdminNewTenant } from '../services/notifications.js';

const registerSchema = z.object({
  email: z.string().email('Geçersiz e-posta').toLowerCase(),
  password: z.string().min(8, 'Şifre en az 8 karakter olmalı'),
  fullName: z.string().min(2).max(80).optional(),
  acceptTerms: z.boolean().refine((v) => v === true, {
    message: 'Kullanım sözleşmesini kabul etmelisin',
  }),
});

const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1),
});

const forgotSchema = z.object({
  email: z.string().email().toLowerCase(),
});

const resetSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8),
});

async function hashPassword(pw: string) {
  return argon2.hash(pw, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}

function buildVerifyUrl(rawToken: string): string {
  return `${config.PUBLIC_WEB_URL}/verify-email?token=${rawToken}`;
}

function buildResetUrl(rawToken: string): string {
  return `${config.PUBLIC_WEB_URL}/reset-password?token=${rawToken}`;
}

// Auth endpoint'lerine özel sıkı rate limit
const authLimit = { rateLimit: { max: 5, timeWindow: '1 minute' } };
const forgotLimit = { rateLimit: { max: 3, timeWindow: '5 minutes' } };

export async function registerAuthRoutes(app: FastifyInstance) {
  // ============================================================
  // Register
  // ============================================================
  app.post('/auth/register', { config: authLimit }, async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'validation_error',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { email, password, fullName } = parsed.data;

    const existing = await prisma.tenant.findUnique({ where: { email } });
    if (existing) {
      return reply.status(409).send({
        error: 'email_exists',
        message: 'Bu e-posta zaten kayıtlı',
      });
    }

    const passwordHash = await hashPassword(password);

    // Trial ayarlarını AppSettings'den oku
    const settings = await prisma.appSettings.findUnique({ where: { id: 'global' } });
    const trialEnabled = settings?.trialEnabled ?? true;
    const trialDays = settings?.trialDays ?? 14;
    const trialPlan = settings?.trialDefaultPlan ?? 'PRO';

    const trialData = trialEnabled
      ? {
          plan: trialPlan,
          isOnTrial: true,
          trialEndsAt: new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000),
          subExpiresAt: new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000),
        }
      : {};

    const tenant = await prisma.tenant.create({
      data: { email, passwordHash, fullName: fullName ?? null, ...trialData },
      select: { id: true, email: true, fullName: true, plan: true, createdAt: true, trialEndsAt: true },
    });

    // Doğrulama token'ı oluştur + email gönder
    const verify = generateToken();
    await prisma.emailVerificationToken.create({
      data: {
        tenantId: tenant.id,
        tokenHash: verify.hash,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    // Email gönderimi arka planda (register akışını bloklamasın)
    void sendEmail(
      verifyEmailTemplate({
        to: tenant.email,
        fullName: tenant.fullName,
        verifyUrl: buildVerifyUrl(verify.raw),
      }),
    ).catch((err) => request.log.error({ err }, 'verify email gönderilemedi'));

    // Admin'e bildirim
    void notifyAdminNewTenant(tenant).catch((err) =>
      request.log.error({ err }, 'admin new-tenant bildirimi gönderilemedi'),
    );

    // Kayıt anında JWT vermiyoruz — kullanıcı önce e-postasını doğrulasın
    return reply.status(201).send({
      ok: true,
      requiresVerification: true,
      tenant,
    });
  });

  // ============================================================
  // Login
  // ============================================================
  app.post('/auth/login', { config: authLimit }, async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'validation_error',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { email, password } = parsed.data;

    const tenant = await prisma.tenant.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        fullName: true,
        plan: true,
        passwordHash: true,
        isSuperAdmin: true,
        isSuspended: true,
        suspendedReason: true,
        emailVerifiedAt: true,
      },
    });

    if (!tenant) {
      return reply.status(401).send({
        error: 'invalid_credentials',
        message: 'E-posta veya şifre hatalı',
      });
    }

    const ok = await argon2.verify(tenant.passwordHash, password);
    if (!ok) {
      return reply.status(401).send({
        error: 'invalid_credentials',
        message: 'E-posta veya şifre hatalı',
      });
    }

    if (tenant.isSuspended) {
      return reply.status(403).send({
        error: 'suspended',
        message: tenant.suspendedReason
          ? `Hesabın askıya alındı: ${tenant.suspendedReason}`
          : 'Hesabın askıya alındı. İletişime geç.',
      });
    }

    if (!tenant.emailVerifiedAt) {
      return reply.status(403).send({
        error: 'email_not_verified',
        message: 'Önce e-posta adresini doğrulaman gerekiyor. Kayıt e-postanı kontrol et.',
      });
    }

    prisma.tenant
      .update({ where: { id: tenant.id }, data: { lastLoginAt: new Date() } })
      .catch(() => {});

    const token = app.jwt.sign({ sub: tenant.id, email: tenant.email });

    return {
      token,
      tenant: {
        id: tenant.id,
        email: tenant.email,
        fullName: tenant.fullName,
        plan: tenant.plan,
        isSuperAdmin: tenant.isSuperAdmin,
      },
    };
  });

  // ============================================================
  // E-posta doğrulama
  // ============================================================
  app.post<{ Body: { token: string } }>(
    '/auth/verify-email',
    async (request, reply) => {
      const body = z.object({ token: z.string().min(10) }).safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({ error: 'validation_error' });
      }

      const tokenHash = hashToken(body.data.token);
      const record = await prisma.emailVerificationToken.findUnique({
        where: { tokenHash },
        include: { tenant: true },
      });

      if (!record) {
        return reply.status(400).send({
          error: 'invalid_token',
          message: 'Geçersiz veya kullanılmış doğrulama linki',
        });
      }
      if (record.usedAt) {
        return reply.status(400).send({
          error: 'already_used',
          message: 'Bu doğrulama linki zaten kullanılmış',
        });
      }
      if (record.expiresAt < new Date()) {
        return reply.status(400).send({
          error: 'expired',
          message: 'Doğrulama linkinin süresi dolmuş. Yenisini almak için giriş yapmayı dene.',
        });
      }
      if (record.tenant.emailVerifiedAt) {
        return { ok: true, message: 'E-posta zaten doğrulanmış' };
      }

      await prisma.$transaction([
        prisma.tenant.update({
          where: { id: record.tenantId },
          data: { emailVerifiedAt: new Date() },
        }),
        prisma.emailVerificationToken.update({
          where: { id: record.id },
          data: { usedAt: new Date() },
        }),
      ]);

      return { ok: true, message: 'E-posta doğrulandı — artık giriş yapabilirsin' };
    },
  );

  // ============================================================
  // Yeniden doğrulama linki iste
  // ============================================================
  app.post<{ Body: { email: string } }>(
    '/auth/resend-verification',
    { config: forgotLimit },
    async (request, reply) => {
      const body = z
        .object({ email: z.string().email().toLowerCase() })
        .safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({ error: 'validation_error' });
      }

      const tenant = await prisma.tenant.findUnique({
        where: { email: body.data.email },
      });
      // Enumeration engeli: her zaman ok döneriz
      if (!tenant || tenant.emailVerifiedAt) {
        return { ok: true };
      }

      const verify = generateToken();
      await prisma.emailVerificationToken.create({
        data: {
          tenantId: tenant.id,
          tokenHash: verify.hash,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      void sendEmail(
        verifyEmailTemplate({
          to: tenant.email,
          fullName: tenant.fullName,
          verifyUrl: buildVerifyUrl(verify.raw),
        }),
      ).catch((err) => request.log.error({ err }, 'resend verify email hatası'));

      return { ok: true };
    },
  );

  // ============================================================
  // Şifre sıfırlama iste
  // ============================================================
  app.post('/auth/forgot-password', { config: forgotLimit }, async (request, reply) => {
    const parsed = forgotSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'validation_error' });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { email: parsed.data.email },
    });
    // Her zaman ok — enumeration engeli
    if (tenant) {
      const reset = generateToken();
      await prisma.passwordResetToken.create({
        data: {
          tenantId: tenant.id,
          tokenHash: reset.hash,
          expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 dk
        },
      });

      void sendEmail(
        passwordResetTemplate({
          to: tenant.email,
          fullName: tenant.fullName,
          resetUrl: buildResetUrl(reset.raw),
        }),
      ).catch((err) => request.log.error({ err }, 'reset email gönderilemedi'));
    }

    return { ok: true };
  });

  // ============================================================
  // Şifre sıfırla
  // ============================================================
  app.post('/auth/reset-password', async (request, reply) => {
    const parsed = resetSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'validation_error',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const tokenHash = hashToken(parsed.data.token);
    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (!record) {
      return reply.status(400).send({
        error: 'invalid_token',
        message: 'Geçersiz veya kullanılmış sıfırlama linki',
      });
    }
    if (record.usedAt) {
      return reply.status(400).send({
        error: 'already_used',
        message: 'Bu link zaten kullanılmış',
      });
    }
    if (record.expiresAt < new Date()) {
      return reply.status(400).send({
        error: 'expired',
        message: 'Sıfırlama linkinin süresi dolmuş — yenisini iste',
      });
    }

    const passwordHash = await hashPassword(parsed.data.password);

    await prisma.$transaction([
      prisma.tenant.update({
        where: { id: record.tenantId },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      // Bu tenant'ın diğer aktif reset token'larını iptal et
      prisma.passwordResetToken.updateMany({
        where: { tenantId: record.tenantId, usedAt: null, id: { not: record.id } },
        data: { usedAt: new Date() },
      }),
    ]);

    return { ok: true, message: 'Şifre güncellendi — artık giriş yapabilirsin' };
  });

  // ============================================================
  // Me
  // ============================================================
  app.get(
    '/auth/me',
    { onRequest: [app.authenticate] },
    async (request) => {
      const full = await prisma.tenant.findUnique({
        where: { id: request.tenant!.id },
        select: {
          id: true,
          email: true,
          fullName: true,
          plan: true,
          subExpiresAt: true,
          isSuperAdmin: true,
          emailVerifiedAt: true,
          createdAt: true,
          notifyOnNewReceipt: true,
          notifyOnSubExpiry: true,
          isOnTrial: true,
          trialEndsAt: true,
        },
      });
      return { tenant: full };
    },
  );
}
