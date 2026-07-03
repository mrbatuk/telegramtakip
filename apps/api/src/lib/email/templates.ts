// Uygulama email şablonları. Her fonksiyon EmailPayload döner.

import type { EmailPayload } from './index.js';
import {
  emailLayout,
  paragraph,
  heading,
  button,
  code,
  warningBox,
  infoBox,
} from './layout.js';
import { config } from '../../config.js';

// ============================================================
// E-posta doğrulama
// ============================================================
export function verifyEmailTemplate(params: {
  to: string;
  fullName: string | null;
  verifyUrl: string;
}): EmailPayload {
  const name = params.fullName ?? params.to.split('@')[0];
  const html = emailLayout(
    heading(`Merhaba ${name},`) +
      paragraph(
        `${config.EMAIL_FROM_NAME}'e hoş geldin! Hesabını kullanmaya başlamadan önce e-posta adresini doğrulaman gerekiyor.`,
      ) +
      button('E-posta Adresimi Doğrula', params.verifyUrl) +
      paragraph(
        'Buton çalışmıyorsa aşağıdaki bağlantıyı tarayıcına kopyalayabilirsin:',
      ) +
      `<p style="word-break:break-all;font-size:12px;color:#64748b;">${params.verifyUrl}</p>` +
      infoBox('Bu bağlantı 24 saat geçerli. Sen istemediysen görmezden gel.'),
    { preheader: 'E-posta adresini doğrula' },
  );

  return {
    to: params.to,
    subject: `${config.EMAIL_FROM_NAME} — E-posta doğrulama`,
    html,
    text:
      `${config.EMAIL_FROM_NAME} — E-posta doğrulama\n\n` +
      `Merhaba ${name},\n\n` +
      `Hesabını doğrulamak için şu bağlantıyı aç:\n${params.verifyUrl}\n\n` +
      `Bu bağlantı 24 saat geçerli.`,
  };
}

// ============================================================
// Şifre sıfırlama
// ============================================================
export function passwordResetTemplate(params: {
  to: string;
  fullName: string | null;
  resetUrl: string;
}): EmailPayload {
  const name = params.fullName ?? params.to.split('@')[0];
  const html = emailLayout(
    heading('Şifre sıfırlama isteği') +
      paragraph(`Merhaba ${name},`) +
      paragraph(
        `Hesabın için şifre sıfırlama talebi aldık. Yeni şifre belirlemek için aşağıdaki butona tıkla:`,
      ) +
      button('Şifreyi Sıfırla', params.resetUrl) +
      warningBox(
        'Bu bağlantı 30 dakika geçerli. Şifre sıfırlama talebini sen göndermediysen bu maili görmezden gel — hesabın güvende.',
      ),
    { preheader: 'Şifreni sıfırla' },
  );

  return {
    to: params.to,
    subject: `${config.EMAIL_FROM_NAME} — Şifre sıfırlama`,
    html,
    text:
      `Şifre sıfırlama\n\n` +
      `Merhaba ${name},\n\n` +
      `Şifreni sıfırlamak için:\n${params.resetUrl}\n\n` +
      `Bu bağlantı 30 dakika geçerli.`,
  };
}

// ============================================================
// Yeni dekont geldi (tenant'a bildirim)
// ============================================================
export function newReceiptTemplate(params: {
  to: string;
  channelName: string;
  userDisplay: string;
  amount: string;
  packageName: string;
  panelUrl: string;
}): EmailPayload {
  const html = emailLayout(
    heading('📥 Yeni Dekont') +
      paragraph(
        `<strong>${escape(params.userDisplay)}</strong> kullanıcısı <strong>${escape(params.channelName)}</strong> kanalı için dekont yükledi.`,
      ) +
      `<table role="presentation" cellpadding="8" cellspacing="0" style="width:100%;margin:16px 0;border-radius:10px;background:#f8fafc;">
        <tr><td style="color:#64748b;font-size:13px;">Paket</td><td style="text-align:right;font-weight:600;">${escape(params.packageName)}</td></tr>
        <tr><td style="color:#64748b;font-size:13px;">Tutar</td><td style="text-align:right;font-weight:600;">${escape(params.amount)}</td></tr>
      </table>` +
      button('Panelde İncele', params.panelUrl),
    { preheader: `${params.userDisplay} — ${params.amount}` },
  );

  return {
    to: params.to,
    subject: `📥 Yeni dekont: ${params.userDisplay} — ${params.amount}`,
    html,
  };
}

// ============================================================
// Abonelik yaklaşıyor (tenant'a — 7 gün kala)
// ============================================================
export function subExpiringTemplate(params: {
  to: string;
  fullName: string | null;
  daysLeft: number;
  expiresAt: Date;
  subscriptionUrl: string;
}): EmailPayload {
  const name = params.fullName ?? params.to.split('@')[0];
  const html = emailLayout(
    heading(`Aboneliğin ${params.daysLeft} gün sonra bitiyor`) +
      paragraph(`Merhaba ${name},`) +
      paragraph(
        `${config.EMAIL_FROM_NAME} aboneliğin <strong>${params.expiresAt.toLocaleDateString('tr-TR')}</strong> tarihinde sona eriyor. ` +
          'Kesinti yaşamamak için yenilemeni öneririz.',
      ) +
      button('Aboneliğim Sayfası', params.subscriptionUrl) +
      infoBox(
        'Yenileme yapmazsan botların çalışmaya devam eder ama zamanla sistem devre dışı bırakabilir. Yenileme için sisteme kayıtlı e-posta üzerinden iletişime geçebilirsin.',
      ),
    { preheader: `Abonelik ${params.daysLeft} gün sonra bitiyor` },
  );

  return {
    to: params.to,
    subject: `⏰ Aboneliğin ${params.daysLeft} gün sonra bitiyor`,
    html,
  };
}

// ============================================================
// Yeni tenant kaydı (admin'e bildirim)
// ============================================================
export function newTenantAdminTemplate(params: {
  to: string;
  tenantEmail: string;
  fullName: string | null;
  createdAt: Date;
  adminUrl: string;
}): EmailPayload {
  const html = emailLayout(
    heading('🆕 Yeni Kullanıcı Kaydı') +
      paragraph(
        `Bir yeni kullanıcı ${config.EMAIL_FROM_NAME}'e kayıt oldu.`,
      ) +
      `<table role="presentation" cellpadding="8" cellspacing="0" style="width:100%;margin:16px 0;border-radius:10px;background:#f8fafc;">
        <tr><td style="color:#64748b;font-size:13px;">E-posta</td><td style="text-align:right;font-weight:600;">${escape(params.tenantEmail)}</td></tr>
        <tr><td style="color:#64748b;font-size:13px;">Ad</td><td style="text-align:right;font-weight:600;">${escape(params.fullName ?? '—')}</td></tr>
        <tr><td style="color:#64748b;font-size:13px;">Tarih</td><td style="text-align:right;font-weight:600;">${params.createdAt.toLocaleString('tr-TR')}</td></tr>
      </table>` +
      button('Admin Panelinde Aç', params.adminUrl),
    { preheader: `${params.tenantEmail} kayıt oldu` },
  );

  return {
    to: params.to,
    subject: `🆕 Yeni kayıt: ${params.tenantEmail}`,
    html,
  };
}

function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
