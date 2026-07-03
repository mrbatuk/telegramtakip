// Tüm email template'lerini saran ortak HTML iskeleti.
// Modern SaaS mail'leri gibi: bold, temiz, mobil dostu.

import { config } from '../../config.js';

export interface LayoutOptions {
  preheader?: string; // Mail listesinde konu satırının yanında görünen kısa özet
}

export function emailLayout(bodyHtml: string, options: LayoutOptions = {}): string {
  const brand = config.EMAIL_FROM_NAME;
  const preheader = options.preheader ?? '';
  const webUrl = config.PUBLIC_WEB_URL;

  return `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>${escapeHtml(brand)}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <span style="display:none!important;opacity:0;visibility:hidden;height:0;width:0;overflow:hidden;mso-hide:all">
    ${escapeHtml(preheader)}
  </span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(15,23,42,0.06);">
          <tr>
            <td style="padding:24px 32px;border-bottom:1px solid #e2e8f0;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width:36px;padding-right:10px;vertical-align:middle;">
                    <div style="width:36px;height:36px;border-radius:10px;background:#2563eb;color:#ffffff;font-weight:700;font-size:16px;line-height:36px;text-align:center;">
                      TT
                    </div>
                  </td>
                  <td style="vertical-align:middle;font-weight:600;font-size:16px;color:#0f172a;">
                    ${escapeHtml(brand)}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;font-size:15px;line-height:1.6;color:#0f172a;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;text-align:center;">
              Bu e-posta ${escapeHtml(brand)} tarafından gönderildi.<br>
              <a href="${escapeHtml(webUrl)}" style="color:#2563eb;text-decoration:none;">${escapeHtml(webUrl.replace(/^https?:\/\//, ''))}</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function button(label: string, href: string): string {
  return `<div style="text-align:center;margin:28px 0;">
    <a href="${escapeHtml(href)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:600;font-size:15px;">
      ${escapeHtml(label)}
    </a>
  </div>`;
}

export function paragraph(text: string): string {
  return `<p style="margin:0 0 16px;color:#334155;">${escapeHtml(text)}</p>`;
}

export function heading(text: string): string {
  return `<h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#0f172a;">${escapeHtml(text)}</h1>`;
}

export function code(text: string): string {
  return `<div style="margin:20px 0;padding:14px 18px;background:#f1f5f9;border-radius:10px;font-family:'Courier New',monospace;font-size:14px;letter-spacing:2px;text-align:center;font-weight:600;color:#0f172a;">
    ${escapeHtml(text)}
  </div>`;
}

export function warningBox(text: string): string {
  return `<div style="margin:20px 0;padding:14px 18px;background:#fef3c7;border-left:3px solid #f59e0b;border-radius:6px;color:#78350f;font-size:14px;">
    ⚠️ ${escapeHtml(text)}
  </div>`;
}

export function infoBox(text: string): string {
  return `<div style="margin:20px 0;padding:14px 18px;background:#dbeafe;border-left:3px solid #3b82f6;border-radius:6px;color:#1e40af;font-size:14px;">
    ${escapeHtml(text)}
  </div>`;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
