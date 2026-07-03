// Email konfigürasyonu — önce DB (AppSettings), yoksa .env fallback.
// Küçük bir cache (30 sn) ile DB hit'ini azalt.

import { prisma } from '@tt/db';
import { config } from '../../config.js';
import { decrypt } from '../crypto.js';

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromName: string;
  fromAddress: string;
  adminNotificationEmail: string;
}

let cache: { config: EmailConfig; expiresAt: number } | null = null;
const CACHE_MS = 30_000;

export async function getEmailConfig(): Promise<EmailConfig> {
  if (cache && cache.expiresAt > Date.now()) return cache.config;

  const settings = await prisma.appSettings.findUnique({ where: { id: 'global' } });

  const resolved: EmailConfig = {
    host: settings?.smtpHost || config.SMTP_HOST || '',
    port: settings?.smtpPort ?? config.SMTP_PORT ?? 587,
    secure: settings?.smtpSecure ?? config.SMTP_SECURE ?? false,
    user: settings?.smtpUser || config.SMTP_USER || '',
    pass: settings?.smtpPassEncrypted
      ? tryDecrypt(settings.smtpPassEncrypted)
      : config.SMTP_PASS || '',
    fromName:
      settings?.emailFromName || config.EMAIL_FROM_NAME || 'TelegramTakip',
    fromAddress:
      settings?.emailFromAddress || config.EMAIL_FROM_ADDRESS || 'noreply@example.com',
    adminNotificationEmail:
      settings?.adminNotificationEmail || config.ADMIN_NOTIFICATION_EMAIL || '',
  };

  cache = { config: resolved, expiresAt: Date.now() + CACHE_MS };
  return resolved;
}

// Cache'i invalide et (ayar güncellenince çağrılır)
export function invalidateEmailConfig(): void {
  cache = null;
}

function tryDecrypt(encrypted: string): string {
  try {
    return decrypt(encrypted);
  } catch {
    return '';
  }
}
