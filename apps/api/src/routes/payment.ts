// Ödeme akışı endpoint'leri (auth gerektirmez — kullanıcılar dışarıdan erişir)
// GET  /pay/:orderId               → ödeme iframe sayfası (PayTR vs.)
// POST /pay/paytr/ipn/:methodId     → PayTR IPN webhook

import type { FastifyInstance, FastifyRequest } from 'fastify';
import { prisma } from '@tt/db';
import { decrypt } from '../lib/crypto.js';
import { getProvider } from '../lib/payments/index.js';
import { approveOrder } from '../services/orderApproval.js';
import { config, isProd } from '../config.js';

function clientIp(req: FastifyRequest): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) {
    return xff.split(',')[0]!.trim();
  }
  return req.ip || '0.0.0.0';
}

export async function registerPaymentRoutes(app: FastifyInstance) {
  // Stripe webhook: JSON'a çevirmeden önce ham gövdeyi request.rawBody'de tut.
  // Sadece /pay/stripe/webhook/... rotalarına uygulanır (URL kontrolü ile).
  app.addContentTypeParser<Buffer>(
    'application/json',
    { parseAs: 'buffer' },
    (req, body, done) => {
      const raw = Buffer.isBuffer(body) ? body.toString('utf8') : String(body);
      const url = req.raw.url ?? '';
      if (url.startsWith('/pay/stripe/webhook/')) {
        (req as unknown as { rawBody?: string }).rawBody = raw;
        try {
          done(null, raw.length ? JSON.parse(raw) : {});
        } catch (err) {
          done(err as Error, undefined);
        }
      } else {
        try {
          done(null, raw.length ? JSON.parse(raw) : {});
        } catch (err) {
          done(err as Error, undefined);
        }
      }
    },
  );

  // ============================================================
  // GET /pay/:orderId — kullanıcı kartla ödemek için bot DM'inden gelir
  // Query: ?method=<paymentMethodId> — belirli bir yöntem seçili gelirse
  //        ?type=PAYTR|IYZICO — sağlayıcı zorla; yoksa aktif olan ilk yöntem
  // ============================================================
  app.get<{
    Params: { orderId: string };
    Querystring: { method?: string; type?: 'PAYTR' | 'IYZICO' | 'STRIPE' };
  }>('/pay/:orderId', async (request, reply) => {
    const order = await prisma.order.findUnique({
      where: { id: request.params.orderId },
      include: {
        package: true,
        joinRequest: {
          include: {
            channel: { include: { bot: { include: { tenant: true } } } },
          },
        },
      },
    });

    if (!order) {
      return reply
        .type('text/html')
        .send(renderError('Sipariş bulunamadı', 'Bu link geçersiz.'));
    }

    if (order.status === 'APPROVED') {
      return reply
        .type('text/html')
        .send(renderError('Ödeme zaten tamamlandı', 'Telegram\'da botu kontrol et.'));
    }

    if (order.status === 'CANCELLED' || order.status === 'REJECTED') {
      return reply
        .type('text/html')
        .send(renderError('Sipariş iptal/red edilmiş', 'Yeniden başlatmak için kanala tekrar istek at.'));
    }

    const tenant = order.joinRequest.channel.bot.tenant;

    let method;
    if (request.query.method) {
      method = await prisma.paymentMethod.findFirst({
        where: { id: request.query.method, tenantId: tenant.id, isActive: true },
      });
    } else if (request.query.type) {
      method = await prisma.paymentMethod.findFirst({
        where: { tenantId: tenant.id, type: request.query.type, isActive: true },
        orderBy: { createdAt: 'desc' },
      });
    } else {
      // Öncelik: PAYTR → IYZICO → STRIPE
      method =
        (await prisma.paymentMethod.findFirst({
          where: { tenantId: tenant.id, type: 'PAYTR', isActive: true },
          orderBy: { createdAt: 'desc' },
        })) ??
        (await prisma.paymentMethod.findFirst({
          where: { tenantId: tenant.id, type: 'IYZICO', isActive: true },
          orderBy: { createdAt: 'desc' },
        })) ??
        (await prisma.paymentMethod.findFirst({
          where: { tenantId: tenant.id, type: 'STRIPE', isActive: true },
          orderBy: { createdAt: 'desc' },
        }));
    }

    if (!method) {
      return reply
        .type('text/html')
        .send(
          renderError(
            'Ödeme yöntemi yok',
            'Kanal sahibi henüz kartla ödeme yöntemini etkinleştirmemiş.',
          ),
        );
    }

    const provider = getProvider(method.type);
    const credentials = JSON.parse(decrypt(method.credentials)) as Record<string, string>;

    const name =
      [order.joinRequest.firstName, order.joinRequest.lastName]
        .filter(Boolean)
        .join(' ') || 'Müşteri';

    const baseUrl = config.TELEGRAM_WEBHOOK_BASE_URL.replace(/\/$/, '');

    // Sağlayıcıya göre callback + success URL farklı
    let callbackUrl: string;
    let successUrl: string;
    if (method.type === 'PAYTR') {
      callbackUrl = `${baseUrl}/pay/paytr/ipn/${method.id}`;
      successUrl = `${baseUrl}/pay/${order.id}/success`;
    } else if (method.type === 'IYZICO') {
      callbackUrl = `${baseUrl}/pay/iyzico/callback/${method.id}/${order.id}`;
      successUrl = `${baseUrl}/pay/${order.id}/success`;
    } else if (method.type === 'STRIPE') {
      // Stripe: webhook async gelir; success_url'e {CHECKOUT_SESSION_ID} eklenir
      callbackUrl = `${baseUrl}/pay/stripe/webhook/${method.id}`;
      successUrl = `${baseUrl}/pay/stripe/return/${method.id}/${order.id}`;
    } else {
      callbackUrl = `${baseUrl}/pay/${order.id}/fail`;
      successUrl = `${baseUrl}/pay/${order.id}/success`;
    }

    try {
      const init = await provider.initPayment(credentials, {
        orderId: order.id,
        amount: Number(order.amount),
        currency: 'TRY',
        userIp: clientIp(request),
        userEmail: `tg${order.joinRequest.telegramUserId}@customer.example.com`,
        userName: name,
        productName: `${order.joinRequest.channel.name} - ${order.package.name}`,
        successUrl,
        failUrl: `${baseUrl}/pay/${order.id}/fail`,
        callbackUrl,
      });

      await prisma.order.update({
        where: { id: order.id },
        data: { providerRef: init.providerRef, paymentMethod: method.type },
      });

      // Stripe & Iyzico: hosted page (redirect); PayTR: iframe
      if (method.type === 'IYZICO' || method.type === 'STRIPE') {
        return reply.redirect(init.paymentUrl);
      }
      return reply
        .type('text/html')
        .send(renderIframe(init.paymentUrl, order.amount.toString(), order.joinRequest.channel.name));
    } catch (err) {
      request.log.error({ err, orderId: order.id }, 'Payment init failed');
      return reply
        .type('text/html')
        .send(
          renderError(
            'Ödeme başlatılamadı',
            err instanceof Error ? err.message : 'Bilinmeyen hata',
          ),
        );
    }
  });

  app.get<{ Params: { orderId: string } }>('/pay/:orderId/success', async (_req, reply) => {
    return reply
      .type('text/html')
      .send(
        renderResult(
          'success',
          'Ödeme alındı',
          'Birkaç saniye içinde kanala otomatik eklenirsin. Telegram\'da botu kontrol et.',
        ),
      );
  });

  app.get<{ Params: { orderId: string } }>('/pay/:orderId/fail', async (_req, reply) => {
    return reply
      .type('text/html')
      .send(
        renderResult(
          'fail',
          'Ödeme tamamlanamadı',
          'Telegram\'da bot ile konuşmaya geri dön, yeni bir ödeme deneyebilirsin.',
        ),
      );
  });

  // ============================================================
  // POST /pay/iyzico/callback/:methodId/:orderId — Iyzico callback
  // Iyzico bu URL'e POST atar; token ile ödemeyi retrieve edip onayla
  // ============================================================
  app.post<{ Params: { methodId: string; orderId: string } }>(
    '/pay/iyzico/callback/:methodId/:orderId',
    async (request, reply) => {
      const method = await prisma.paymentMethod.findUnique({
        where: { id: request.params.methodId },
      });
      if (!method || method.type !== 'IYZICO') {
        return reply.redirect(
          `${config.TELEGRAM_WEBHOOK_BASE_URL.replace(/\/$/, '')}/pay/${request.params.orderId}/fail`,
        );
      }

      const credentials = JSON.parse(decrypt(method.credentials)) as Record<string, string>;
      const provider = getProvider(method.type);

      const body = request.body as Record<string, string>;

      const verify = await provider.verifyIpn(credentials, { body });

      const successUrl = `${config.TELEGRAM_WEBHOOK_BASE_URL.replace(/\/$/, '')}/pay/${request.params.orderId}/success`;
      const failUrl = `${config.TELEGRAM_WEBHOOK_BASE_URL.replace(/\/$/, '')}/pay/${request.params.orderId}/fail`;

      if (!verify.ok) {
        request.log.warn({ orderId: verify.orderId, reason: verify.reason }, 'Iyzico verify failed');
        return reply.redirect(failUrl);
      }

      if (verify.status === 'success') {
        // Iyzico basketId = order.id (cleanupped)
        // Bulmak için orderId parametresini kullanıyoruz (URL'den)
        const result = await approveOrder({
          orderId: request.params.orderId,
          approvedBy: null,
          logger: request.log,
        });
        if (!result.ok && result.reason !== 'already_approved') {
          request.log.warn({ result }, 'Iyzico approve failed');
          return reply.redirect(failUrl);
        }
        return reply.redirect(successUrl);
      }

      request.log.info(
        { orderId: request.params.orderId, reason: verify.reason },
        'Iyzico ödeme başarısız',
      );
      return reply.redirect(failUrl);
    },
  );

  // ============================================================
  // GET /pay/stripe/return/:methodId/:orderId — Stripe success redirect
  // Kullanıcı checkout tamamlayınca Stripe buraya session_id ile döner.
  // Webhook async gelirse yakalar; race olursa approveOrder idempotent.
  // ============================================================
  app.get<{
    Params: { methodId: string; orderId: string };
    Querystring: { session_id?: string };
  }>('/pay/stripe/return/:methodId/:orderId', async (request, reply) => {
    const baseUrl = config.TELEGRAM_WEBHOOK_BASE_URL.replace(/\/$/, '');
    const successUrl = `${baseUrl}/pay/${request.params.orderId}/success`;
    const failUrl = `${baseUrl}/pay/${request.params.orderId}/fail`;

    const method = await prisma.paymentMethod.findUnique({
      where: { id: request.params.methodId },
    });
    if (!method || method.type !== 'STRIPE') {
      return reply.redirect(failUrl);
    }

    const sessionId = request.query.session_id;
    if (!sessionId) return reply.redirect(failUrl);

    const credentials = JSON.parse(decrypt(method.credentials)) as Record<string, string>;
    const provider = getProvider(method.type);

    const verify = await provider.verifyIpn(credentials, { body: { session_id: sessionId } });

    if (!verify.ok) {
      request.log.warn({ reason: verify.reason }, 'Stripe return verify failed');
      return reply.redirect(failUrl);
    }

    if (verify.status === 'success') {
      const result = await approveOrder({
        orderId: request.params.orderId,
        approvedBy: null,
        logger: request.log,
      });
      if (!result.ok && result.reason !== 'already_approved') {
        request.log.warn({ result }, 'Stripe approve failed');
        return reply.redirect(failUrl);
      }
      return reply.redirect(successUrl);
    }

    return reply.redirect(failUrl);
  });

  // ============================================================
  // POST /pay/stripe/webhook/:methodId — Stripe webhook (async)
  // İmza doğrulama için ham gövde gerekli — Fastify raw body content-parser'ı
  // JSON'a çevirmeden önce yakalar (aşağıda addContentTypeParser).
  // ============================================================
  app.post<{ Params: { methodId: string } }>(
    '/pay/stripe/webhook/:methodId',
    async (request, reply) => {
      const method = await prisma.paymentMethod.findUnique({
        where: { id: request.params.methodId },
      });
      if (!method || method.type !== 'STRIPE') {
        return reply.status(404).send('NOT_FOUND');
      }

      const credentials = JSON.parse(decrypt(method.credentials)) as Record<string, string>;
      const provider = getProvider(method.type);

      const rawBody = (request as unknown as { rawBody?: string | Buffer }).rawBody;
      const stripeSig = request.headers['stripe-signature'];

      const verify = await provider.verifyIpn(credentials, {
        body: { _rawBody: typeof rawBody === 'string' ? rawBody : rawBody?.toString('utf8') ?? '' },
        headers: { 'stripe-signature': stripeSig },
      });

      if (!verify.ok) {
        request.log.warn({ reason: verify.reason }, 'Stripe webhook verify failed');
        return reply.status(400).type('text/plain').send(verify.ackResponse);
      }

      if (verify.status === 'success' && verify.orderId) {
        const result = await approveOrder({
          orderId: verify.orderId,
          approvedBy: null,
          logger: request.log,
        });
        if (!result.ok && result.reason !== 'already_approved') {
          request.log.warn({ result }, 'Stripe webhook approve failed');
        }
      }

      return reply.type('text/plain').send('OK');
    },
  );

  // ============================================================
  // POST /pay/paytr/ipn/:methodId — PayTR IPN webhook
  // ============================================================
  app.post<{ Params: { methodId: string } }>(
    '/pay/paytr/ipn/:methodId',
    async (request, reply) => {
      const method = await prisma.paymentMethod.findUnique({
        where: { id: request.params.methodId },
      });
      if (!method || method.type !== 'PAYTR') {
        return reply.status(404).send('NOT_FOUND');
      }

      const credentials = JSON.parse(decrypt(method.credentials)) as Record<string, string>;
      const provider = getProvider(method.type);

      // PayTR form-urlencoded gönderir
      const body = request.body as Record<string, string>;

      const verify = await provider.verifyIpn(credentials, { body });

      if (!verify.ok) {
        request.log.warn({ orderId: verify.orderId, reason: verify.reason }, 'IPN verify failed');
        return reply.type('text/plain').send(verify.ackResponse);
      }

      // PayTR merchant_oid = order.id (alphanumeric, biz orderId'yi temizleyip gönderdik)
      if (!verify.orderId) {
        return reply.type('text/plain').send('OK');
      }

      if (verify.status === 'success') {
        const result = await approveOrder({
          orderId: verify.orderId,
          approvedBy: null, // otomatik
          logger: request.log,
        });
        if (!result.ok && result.reason !== 'already_approved') {
          request.log.warn({ result }, 'IPN approve failed');
        }
      } else {
        // Başarısız ödeme — order'ı AWAITING_PAYMENT'ta bırak (kullanıcı yeniden deneyebilir)
        request.log.info({ orderId: verify.orderId, reason: verify.reason }, 'PayTR ödeme başarısız');
      }

      return reply.type('text/plain').send('OK');
    },
  );
}

// ============================================================
// HTML render helpers
// ============================================================

function renderIframe(url: string, amount: string, channelName: string): string {
  return `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Güvenli Ödeme</title>
  <style>
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; }
    .header { padding: 16px; background: #fff; border-bottom: 1px solid #e2e8f0; text-align: center; }
    .header h1 { margin: 0; font-size: 18px; color: #0f172a; }
    .header p { margin: 4px 0 0; font-size: 13px; color: #64748b; }
    .frame-wrap { padding: 16px; }
    iframe { width: 100%; min-height: 700px; border: 1px solid #e2e8f0; border-radius: 12px; background: #fff; }
    .secure { text-align: center; padding: 8px 16px 16px; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${escapeHtml(channelName)}</h1>
    <p>Tutar: <strong>${escapeHtml(amount)} TL</strong></p>
  </div>
  <div class="frame-wrap">
    <iframe src="${escapeHtml(url)}" frameborder="0" scrolling="no" allowtransparency="true"></iframe>
  </div>
  <p class="secure">🔒 Güvenli ödeme PayTR ile sağlanır</p>
</body>
</html>`;
}

function renderError(title: string, message: string): string {
  return renderResult('error', title, message);
}

function renderResult(kind: 'success' | 'fail' | 'error', title: string, message: string): string {
  const colors = {
    success: { bg: '#ecfdf5', icon: '✅', accent: '#059669' },
    fail: { bg: '#fef2f2', icon: '❌', accent: '#dc2626' },
    error: { bg: '#fef2f2', icon: '⚠️', accent: '#dc2626' },
  }[kind];

  return `<!doctype html>
<html lang="tr"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: ${colors.bg}; padding: 24px; }
.card { background: #fff; border-radius: 16px; padding: 40px 28px; max-width: 420px; text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,.06); }
.icon { font-size: 56px; margin-bottom: 16px; }
h1 { margin: 0 0 12px; font-size: 22px; color: ${colors.accent}; }
p { margin: 0; color: #475569; line-height: 1.55; }
</style></head><body>
<div class="card">
<div class="icon">${colors.icon}</div>
<h1>${escapeHtml(title)}</h1>
<p>${escapeHtml(message)}</p>
</div></body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Silence prod-only warning if unused (kept for future use)
void isProd;
