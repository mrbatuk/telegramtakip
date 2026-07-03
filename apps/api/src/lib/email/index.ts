// Email gönderim adapter'ı.
// Konfigürasyon: önce DB (AppSettings), yoksa .env fallback.

import { createTransport, type Transporter } from 'nodemailer';
import { logger } from '../../logger.js';
import { getEmailConfig, invalidateEmailConfig } from './config-source.js';

export { invalidateEmailConfig };

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

// Transporter cache — konfigürasyon değişince invalidate edilir
let transporter: Transporter | null = null;
let transporterFor: string | null = null;

async function getTransporter(): Promise<{ transporter: Transporter | null; from: string; adminEmail: string }> {
  const cfg = await getEmailConfig();
  const from = `"${cfg.fromName}" <${cfg.fromAddress}>`;
  const adminEmail = cfg.adminNotificationEmail;

  if (!cfg.host || !cfg.user || !cfg.pass) {
    return { transporter: null, from, adminEmail };
  }

  const fingerprint = `${cfg.host}|${cfg.port}|${cfg.user}|${cfg.secure}`;
  if (transporter && transporterFor === fingerprint) {
    return { transporter, from, adminEmail };
  }

  transporter = createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
  });
  transporterFor = fingerprint;
  return { transporter, from, adminEmail };
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
  const { transporter: t, from } = await getTransporter();

  if (!t) {
    logger.info(
      { to: payload.to, subject: payload.subject, from },
      '[EMAIL — SMTP yok, dev mode] ' + payload.subject,
    );
    if (payload.text) logger.debug({ text: payload.text }, '[EMAIL text preview]');
    return;
  }

  try {
    await t.sendMail({
      from,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
      replyTo: payload.replyTo,
    });
    logger.info({ to: payload.to, subject: payload.subject }, 'Email gönderildi');
  } catch (err) {
    logger.error({ err, to: payload.to }, 'Email gönderilemedi');
    throw err;
  }
}

export async function verifyEmailConnection(): Promise<{ ok: boolean; error?: string }> {
  const cfg = await getEmailConfig();
  if (!cfg.host || !cfg.user || !cfg.pass) {
    return { ok: false, error: 'SMTP yapılandırılmamış' };
  }
  try {
    const { transporter: t } = await getTransporter();
    if (!t) return { ok: false, error: 'Transporter oluşturulamadı' };
    await t.verify();
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Bilinmeyen hata',
    };
  }
}

// Test amaçlı: verilen adrese test email gönder
export async function sendTestEmail(to: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const cfg = await getEmailConfig();
    await sendEmail({
      to,
      subject: `${cfg.fromName} — Test E-postası`,
      html: `<div style="font-family:sans-serif;padding:20px;background:#f8fafc;">
        <h2 style="color:#0f172a;">SMTP çalışıyor 🎉</h2>
        <p style="color:#475569;">
          Bu bir test e-postasıdır. SMTP ayarların doğru yapılandırılmış ve email
          gönderimi başarılı.
        </p>
        <p style="color:#64748b;font-size:12px;margin-top:24px;">
          ${new Date().toLocaleString('tr-TR')}
        </p>
      </div>`,
      text: `SMTP çalışıyor. Bu bir test e-postasıdır. ${new Date().toISOString()}`,
    });
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Gönderim başarısız',
    };
  }
}

// Transporter cache'i sıfırla (ayar değişince)
export function resetEmailTransporter(): void {
  transporter = null;
  transporterFor = null;
}
