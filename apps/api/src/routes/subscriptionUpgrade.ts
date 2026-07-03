// Tenant kendi paneli üzerinden plan yükseltme/yenileme başlatır.
// Ödeme sağlayıcıdan bir link üretir; başarılı ödemede tenant.plan güncellenir.

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@tt/db';
import { decrypt } from '../lib/crypto.js';
import { getProvider } from '../lib/payments/index.js';
import { getLimitsForPlan, calculateAmount } from '../lib/plans.js';
import { config } from '../config.js';

const startSchema = z.object({
  plan: z.string().min(1),
  billingMethodId: z.string().min(1),
  months: z.coerce.number().int().min(1).max(12).optional().default(1),
  couponCode: z.string().min(1).max(64).optional(),
});

function clientIp(req: { headers: Record<string, string | string[] | undefined>; ip: string }): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) return xff.split(',')[0]!.trim();
  return req.ip || '0.0.0.0';
}

export async function registerSubscriptionUpgradeRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  // GET /subscription/billing-methods — tenant'a görünen ödeme yöntemleri
  app.get('/subscription/billing-methods', async () => {
    const methods = await prisma.saasBillingMethod.findMany({
      where: { isActive: true },
      select: {
        id: true,
        type: true,
        label: true,
        ibanInfo: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    return { methods };
  });

  // POST /subscription/validate-coupon — kupon geçerli mi ve indirim ne kadar
  app.post<{ Body: { code: string; plan: string; months: number } }>(
    '/subscription/validate-coupon',
    async (request, reply) => {
      const body = z
        .object({ code: z.string().min(1), plan: z.string().min(1), months: z.coerce.number().int().min(1).max(12) })
        .safeParse(request.body);
      if (!body.success) return reply.status(400).send({ error: 'validation_error' });

      const planCfg = await getLimitsForPlan(body.data.plan);
      if (!planCfg) return reply.status(404).send({ error: 'plan_not_found' });
      const baseAmount = calculateAmount(planCfg, body.data.months);

      const cp = await prisma.coupon.findUnique({ where: { code: body.data.code } });
      if (!cp || !cp.isActive) {
        return reply.status(400).send({ error: 'invalid', message: 'Kupon geçersiz' });
      }
      if (cp.validUntil && cp.validUntil < new Date()) {
        return reply.status(400).send({ error: 'expired', message: 'Süresi dolmuş' });
      }
      if (cp.usageLimit !== null && cp.usageCount >= cp.usageLimit) {
        return reply.status(400).send({ error: 'used_up', message: 'Kullanım limiti dolmuş' });
      }
      if (cp.applicableToPlans.length > 0 && !cp.applicableToPlans.includes(body.data.plan)) {
        return reply.status(400).send({ error: 'not_applicable', message: 'Bu plan için geçerli değil' });
      }
      if (cp.perTenantLimit !== null) {
        const used = await prisma.couponRedemption.count({
          where: { couponId: cp.id, tenantId: request.tenant!.id },
        });
        if (used >= cp.perTenantLimit) {
          return reply.status(400).send({ error: 'already_used', message: 'Bu kuponu zaten kullandın' });
        }
      }
      let discount = 0;
      if (cp.discountPercent !== null) discount = Math.round(baseAmount * (cp.discountPercent / 100) * 100) / 100;
      else if (cp.discountAmount !== null) discount = Math.min(baseAmount, Number(cp.discountAmount));

      return {
        ok: true,
        baseAmount,
        discount,
        finalAmount: Math.max(0, Math.round((baseAmount - discount) * 100) / 100),
        description: cp.description ?? '',
      };
    },
  );

  // POST /subscription/start — yükseltme başlat
  app.post('/subscription/start', async (request, reply) => {
    const parsed = startSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'validation_error',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { plan, billingMethodId, months, couponCode } = parsed.data;
    const planCfg = await getLimitsForPlan(plan);
    if (!planCfg || !planCfg.isActive) {
      return reply.status(404).send({ error: 'plan_not_found' });
    }
    let amount = calculateAmount(planCfg, months);
    let appliedCoupon: { id: string; savedAmount: number } | null = null;

    // Kupon kontrolü (Seviye 3)
    if (couponCode) {
      const cp = await prisma.coupon.findUnique({ where: { code: couponCode } });
      if (!cp || !cp.isActive) {
        return reply.status(400).send({ error: 'invalid_coupon', message: 'Kupon geçersiz' });
      }
      if (cp.validUntil && cp.validUntil < new Date()) {
        return reply.status(400).send({ error: 'coupon_expired', message: 'Kupon süresi dolmuş' });
      }
      if (cp.usageLimit !== null && cp.usageCount >= cp.usageLimit) {
        return reply.status(400).send({ error: 'coupon_used_up', message: 'Kupon kullanım limiti dolmuş' });
      }
      if (cp.applicableToPlans.length > 0 && !cp.applicableToPlans.includes(plan)) {
        return reply.status(400).send({ error: 'coupon_not_applicable', message: 'Bu plan için geçerli değil' });
      }
      if (cp.perTenantLimit !== null) {
        const usedByMe = await prisma.couponRedemption.count({
          where: { couponId: cp.id, tenantId: request.tenant!.id },
        });
        if (usedByMe >= cp.perTenantLimit) {
          return reply.status(400).send({ error: 'coupon_already_used', message: 'Bu kuponu zaten kullandın' });
        }
      }
      let discount = 0;
      if (cp.discountPercent !== null) discount = Math.round(amount * (cp.discountPercent / 100) * 100) / 100;
      else if (cp.discountAmount !== null) discount = Math.min(amount, Number(cp.discountAmount));
      amount = Math.max(0, Math.round((amount - discount) * 100) / 100);
      appliedCoupon = { id: cp.id, savedAmount: discount };
    }

    const method = await prisma.saasBillingMethod.findFirst({
      where: { id: billingMethodId, isActive: true },
    });
    if (!method) {
      return reply.status(404).send({ error: 'billing_method_not_found' });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: request.tenant!.id },
      select: { email: true, fullName: true, subExpiresAt: true },
    });
    if (!tenant) return reply.status(404).send({ error: 'tenant_not_found' });

    const now = new Date();
    // Mevcut abonelik ileri tarihliyse üstüne ekle, değilse şimdiden başla
    const periodStart =
      tenant.subExpiresAt && tenant.subExpiresAt > now ? tenant.subExpiresAt : now;
    const periodEnd = new Date(periodStart.getTime() + months * 30 * 24 * 60 * 60 * 1000);

    // Pending subscription record oluştur
    const subscription = await prisma.subscription.create({
      data: {
        tenantId: request.tenant!.id,
        plan,
        amount,
        currency: 'TRY',
        method: method.type,
        status: 'PENDING',
        periodStart,
        periodEnd,
        billingMethodId: method.id,
        couponId: appliedCoupon?.id ?? null,
        couponSaved: appliedCoupon?.savedAmount ?? null,
      },
    });

    // IBAN ise ödeme sayfası yok, sadece bilgileri döndür
    if (method.type === 'IBAN') {
      return {
        ok: true,
        type: 'IBAN',
        subscriptionId: subscription.id,
        amount,
        ibanInfo: method.ibanInfo ?? 'Kanal sahibiyle iletişime geç',
        message:
          'Aşağıdaki IBAN\'a ödeme yaptıktan sonra kanal sahibine bilgi ver — abonelik manuel aktifleştirilecek.',
      };
    }

    // Otomatik ödeme: PayTR / Iyzico
    const credentials = JSON.parse(decrypt(method.credentials)) as Record<string, string>;
    const provider = getProvider(method.type);

    const name = tenant.fullName ?? tenant.email.split('@')[0]!;
    const baseUrl = config.TELEGRAM_WEBHOOK_BASE_URL.replace(/\/$/, '');
    const callbackUrl =
      method.type === 'PAYTR'
        ? `${baseUrl}/subscription-payment/paytr/ipn/${method.id}/${subscription.id}`
        : `${baseUrl}/subscription-payment/iyzico/callback/${method.id}/${subscription.id}`;

    try {
      const init = await provider.initPayment(credentials, {
        orderId: subscription.id,
        amount,
        currency: 'TRY',
        userIp: clientIp(request as { headers: Record<string, string | string[] | undefined>; ip: string }),
        userEmail: tenant.email,
        userName: name,
        productName: `${plan} Aboneliği (${months} ay)`,
        successUrl: `${config.PUBLIC_WEB_URL}/dashboard/subscription?paid=1`,
        failUrl: `${config.PUBLIC_WEB_URL}/dashboard/subscription?paid=0`,
        callbackUrl,
      });

      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { providerRef: init.providerRef },
      });

      return {
        ok: true,
        type: method.type,
        subscriptionId: subscription.id,
        paymentUrl: init.paymentUrl,
      };
    } catch (err) {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: 'FAILED' },
      });
      return reply.status(500).send({
        error: 'payment_init_failed',
        message: err instanceof Error ? err.message : 'Ödeme başlatılamadı',
      });
    }
  });
}
