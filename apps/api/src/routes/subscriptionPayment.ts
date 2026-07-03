// SaaS aboneliği ödeme callback endpoint'leri.
// Auth gerektirmez (Iyzico / PayTR dış dünyadan gelir).

import type { FastifyInstance } from 'fastify';
import { prisma } from '@tt/db';
import { decrypt } from '../lib/crypto.js';
import { getProvider } from '../lib/payments/index.js';
import { config } from '../config.js';

async function markSubscriptionPaid(
  subscriptionId: string,
): Promise<{ ok: boolean; reason?: string }> {
  const sub = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
  });
  if (!sub) return { ok: false, reason: 'not_found' };
  if (sub.status === 'PAID') return { ok: true };

  await prisma.$transaction(async (tx) => {
    await tx.subscription.update({
      where: { id: sub.id },
      data: { status: 'PAID', paidAt: new Date() },
    });

    const tenant = await tx.tenant.findUnique({ where: { id: sub.tenantId } });
    const currentEnd = tenant?.subExpiresAt;
    const newEnd = new Date(sub.periodEnd);
    await tx.tenant.update({
      where: { id: sub.tenantId },
      data: {
        plan: sub.plan,
        subExpiresAt: currentEnd && currentEnd > newEnd ? currentEnd : newEnd,
      },
    });

    // Kupon kullanımı kaydet
    if (sub.couponId) {
      await tx.couponRedemption.create({
        data: {
          couponId: sub.couponId,
          tenantId: sub.tenantId,
          subscriptionId: sub.id,
          amountSaved: sub.couponSaved ?? 0,
        },
      });
      await tx.coupon.update({
        where: { id: sub.couponId },
        data: { usageCount: { increment: 1 } },
      });
    }
  });

  return { ok: true };
}

export async function registerSubscriptionPaymentRoutes(app: FastifyInstance) {
  // ============================================================
  // Iyzico callback (subscription)
  // ============================================================
  app.post<{ Params: { methodId: string; subscriptionId: string } }>(
    '/subscription-payment/iyzico/callback/:methodId/:subscriptionId',
    async (request, reply) => {
      const method = await prisma.saasBillingMethod.findUnique({
        where: { id: request.params.methodId },
      });
      if (!method || method.type !== 'IYZICO') {
        return reply.redirect(`${config.PUBLIC_WEB_URL}/dashboard/subscription?paid=0`);
      }

      const credentials = JSON.parse(decrypt(method.credentials)) as Record<string, string>;
      const provider = getProvider(method.type);
      const body = request.body as Record<string, string>;
      const verify = await provider.verifyIpn(credentials, { body });

      const successUrl = `${config.PUBLIC_WEB_URL}/dashboard/subscription?paid=1`;
      const failUrl = `${config.PUBLIC_WEB_URL}/dashboard/subscription?paid=0`;

      if (!verify.ok || verify.status !== 'success') {
        await prisma.subscription.update({
          where: { id: request.params.subscriptionId },
          data: { status: 'FAILED' },
        }).catch(() => {});
        return reply.redirect(failUrl);
      }

      await markSubscriptionPaid(request.params.subscriptionId);
      return reply.redirect(successUrl);
    },
  );

  // ============================================================
  // PayTR IPN (subscription)
  // ============================================================
  app.post<{ Params: { methodId: string; subscriptionId: string } }>(
    '/subscription-payment/paytr/ipn/:methodId/:subscriptionId',
    async (request, reply) => {
      const method = await prisma.saasBillingMethod.findUnique({
        where: { id: request.params.methodId },
      });
      if (!method || method.type !== 'PAYTR') {
        return reply.type('text/plain').send('NOT_FOUND');
      }

      const credentials = JSON.parse(decrypt(method.credentials)) as Record<string, string>;
      const provider = getProvider(method.type);
      const body = request.body as Record<string, string>;
      const verify = await provider.verifyIpn(credentials, { body });

      if (!verify.ok) {
        return reply.type('text/plain').send(verify.ackResponse);
      }
      if (verify.status === 'success') {
        await markSubscriptionPaid(request.params.subscriptionId);
      } else {
        await prisma.subscription.update({
          where: { id: request.params.subscriptionId },
          data: { status: 'FAILED' },
        }).catch(() => {});
      }
      return reply.type('text/plain').send('OK');
    },
  );
}
