// Tenant'ın kendi aboneliğini gördüğü endpoint
import type { FastifyInstance } from 'fastify';
import { prisma } from '@tt/db';
import { getLimitsForTenant, getPublicPlans } from '../lib/plans.js';

export async function registerSubscriptionRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  app.get('/subscription', async (request) => {
    const tenant = await prisma.tenant.findUnique({
      where: { id: request.tenant!.id },
      select: {
        id: true,
        plan: true,
        subExpiresAt: true,
        planOverride: true,
        isOnTrial: true,
        trialEndsAt: true,
        createdAt: true,
        _count: { select: { bots: true } },
      },
    });

    if (!tenant) return { error: 'not_found' };

    // Trial süresi doldu ama isOnTrial hala true ise senkronize et
    if (tenant.isOnTrial && tenant.trialEndsAt && tenant.trialEndsAt <= new Date()) {
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { isOnTrial: false },
      });
      tenant.isOnTrial = false;
    }

    const limits = await getLimitsForTenant(tenant.plan, tenant.planOverride);
    if (!limits) return { error: 'plan_config_not_found' };

    const [channelCount, activeMembers, allPlans] = await Promise.all([
      prisma.channel.count({
        where: { bot: { tenantId: tenant.id } },
      }),
      prisma.membership.count({
        where: {
          status: 'ACTIVE',
          channel: { bot: { tenantId: tenant.id } },
        },
      }),
      getPublicPlans(),
    ]);

    const now = new Date();
    const daysLeft =
      tenant.subExpiresAt && tenant.subExpiresAt > now
        ? Math.ceil(
            (tenant.subExpiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
          )
        : 0;

    const trialDaysLeft = tenant.isOnTrial && tenant.trialEndsAt && tenant.trialEndsAt > now
      ? Math.ceil((tenant.trialEndsAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
      : 0;

    return {
      plan: tenant.plan,
      subExpiresAt: tenant.subExpiresAt,
      daysLeft,
      isActive: !!(tenant.subExpiresAt && tenant.subExpiresAt > now),
      isOnTrial: tenant.isOnTrial,
      trialDaysLeft,
      limits: {
        name: limits.name,
        maxBots: limits.maxBots,
        maxChannelsPerBot: limits.maxChannelsPerBot,
        maxActiveMembers: limits.maxActiveMembers,
        allowedPaymentMethods: limits.allowedPaymentMethods,
        monthlyPriceTRY: limits.monthlyPriceTRY,
      },
      usage: {
        bots: tenant._count.bots,
        channels: channelCount,
        activeMembers,
      },
      allPlans,
    };
  });
}
