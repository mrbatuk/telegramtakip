// Sistem ayarları (SMTP + admin bildirim adresi) — sadece süper admin
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@tt/db';
import { encrypt } from '../../lib/crypto.js';
import {
  invalidateEmailConfig,
  resetEmailTransporter,
  verifyEmailConnection,
  sendTestEmail,
} from '../../lib/email/index.js';

// Şifre için özel bir sentinel — form'da eski şifreyi göstermek istemiyoruz.
// UI boş bıraktığında dokunmuyoruz. "SET_PASSWORD" gibi bir sentinel gelirse update.
const smtpSchema = z.object({
  smtpHost: z.string().max(200).optional().nullable(),
  smtpPort: z.coerce.number().int().min(1).max(65535).optional().nullable(),
  smtpSecure: z.boolean().optional(),
  smtpUser: z.string().max(200).optional().nullable(),
  smtpPass: z.string().max(500).optional(), // boş: dokunma; dolu: güncelle
  emailFromName: z.string().max(120).optional().nullable(),
  emailFromAddress: z.string().email().optional().nullable(),
  adminNotificationEmail: z.string().email().optional().nullable().or(z.literal('')),
  trialEnabled: z.boolean().optional(),
  trialDays: z.coerce.number().int().min(0).max(365).optional(),
  trialDefaultPlan: z.string().min(1).max(32).optional(),
});

const testEmailSchema = z.object({
  to: z.string().email(),
});

function maskPass(v: string | null): string {
  if (!v) return '';
  return '****' + v.slice(-4);
}

export async function registerAdminSettingsRoutes(app: FastifyInstance) {
  // GET /admin/settings — mevcut ayarları getir (şifre gizli)
  app.get('/admin/settings', async () => {
    const settings = await prisma.appSettings.findUnique({ where: { id: 'global' } });
    return {
      settings: {
        smtpHost: settings?.smtpHost ?? '',
        smtpPort: settings?.smtpPort ?? 587,
        smtpSecure: settings?.smtpSecure ?? false,
        smtpUser: settings?.smtpUser ?? '',
        smtpPassPreview: maskPass(settings?.smtpPassEncrypted ?? null), // maskeli göster
        smtpPassSet: !!settings?.smtpPassEncrypted,
        emailFromName: settings?.emailFromName ?? '',
        emailFromAddress: settings?.emailFromAddress ?? '',
        adminNotificationEmail: settings?.adminNotificationEmail ?? '',
        lastTestAt: settings?.lastTestAt,
        lastTestOk: settings?.lastTestOk,
        lastTestMessage: settings?.lastTestMessage,
        trialEnabled: settings?.trialEnabled ?? true,
        trialDays: settings?.trialDays ?? 14,
        trialDefaultPlan: settings?.trialDefaultPlan ?? 'PRO',
      },
    };
  });

  // PUT /admin/settings — ayarları güncelle
  app.put('/admin/settings', async (request, reply) => {
    const parsed = smtpSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'validation_error',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const data: Record<string, unknown> = {};
    if (parsed.data.smtpHost !== undefined) data.smtpHost = parsed.data.smtpHost || null;
    if (parsed.data.smtpPort !== undefined) data.smtpPort = parsed.data.smtpPort ?? 587;
    if (parsed.data.smtpSecure !== undefined) data.smtpSecure = parsed.data.smtpSecure;
    if (parsed.data.smtpUser !== undefined) data.smtpUser = parsed.data.smtpUser || null;
    if (parsed.data.smtpPass !== undefined && parsed.data.smtpPass !== '') {
      data.smtpPassEncrypted = encrypt(parsed.data.smtpPass);
    }
    if (parsed.data.emailFromName !== undefined)
      data.emailFromName = parsed.data.emailFromName || null;
    if (parsed.data.emailFromAddress !== undefined)
      data.emailFromAddress = parsed.data.emailFromAddress || null;
    if (parsed.data.adminNotificationEmail !== undefined)
      data.adminNotificationEmail = parsed.data.adminNotificationEmail || null;
    if (parsed.data.trialEnabled !== undefined) data.trialEnabled = parsed.data.trialEnabled;
    if (parsed.data.trialDays !== undefined) data.trialDays = parsed.data.trialDays;
    if (parsed.data.trialDefaultPlan !== undefined) data.trialDefaultPlan = parsed.data.trialDefaultPlan;

    data.updatedBy = request.tenant!.id;

    await prisma.appSettings.upsert({
      where: { id: 'global' },
      create: { id: 'global', ...data },
      update: data,
    });

    invalidateEmailConfig();
    resetEmailTransporter();

    return { ok: true };
  });

  // POST /admin/settings/test-connection — SMTP bağlanabiliyor mu
  app.post('/admin/settings/test-connection', async () => {
    const result = await verifyEmailConnection();
    await prisma.appSettings.upsert({
      where: { id: 'global' },
      create: {
        id: 'global',
        lastTestAt: new Date(),
        lastTestOk: result.ok,
        lastTestMessage: result.error ?? null,
      },
      update: {
        lastTestAt: new Date(),
        lastTestOk: result.ok,
        lastTestMessage: result.error ?? null,
      },
    });
    return result;
  });

  // POST /admin/settings/test-send — belirtilen adrese test e-posta
  app.post('/admin/settings/test-send', async (request, reply) => {
    const parsed = testEmailSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'validation_error' });
    }
    const result = await sendTestEmail(parsed.data.to);
    return result;
  });
}
