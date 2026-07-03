import type { FastifyInstance } from 'fastify';
import { prisma } from '@tt/db';

export async function registerAdminStatsRoutes(app: FastifyInstance) {
  app.get('/admin/stats', async () => {
    const now = new Date();
    const start30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      tenantTotal,
      tenantNew30,
      tenantSuspended,
      tenantActiveSub,
      botCount,
      channelCount,
      activeMemberships,
      pendingOrders,
      approvedOrdersThisMonth,
      revenueThisMonth,
      subRevenueThisMonth,
    ] = await Promise.all([
      prisma.tenant.count({ where: { isSuperAdmin: false } }),
      prisma.tenant.count({ where: { isSuperAdmin: false, createdAt: { gte: start30 } } }),
      prisma.tenant.count({ where: { isSuperAdmin: false, isSuspended: true } }),
      prisma.tenant.count({
        where: {
          isSuperAdmin: false,
          subExpiresAt: { gt: now },
        },
      }),
      prisma.bot.count(),
      prisma.channel.count(),
      prisma.membership.count({ where: { status: 'ACTIVE' } }),
      prisma.order.count({ where: { status: 'AWAITING_APPROVAL' } }),
      prisma.order.count({
        where: { status: 'APPROVED', paidAt: { gte: startOfMonth } },
      }),
      prisma.order.aggregate({
        where: { status: 'APPROVED', paidAt: { gte: startOfMonth } },
        _sum: { amount: true },
      }),
      prisma.subscription.aggregate({
        where: { createdAt: { gte: startOfMonth } },
        _sum: { amount: true },
      }),
    ]);

    // Son 7 günlük yeni kayıt grafiği
    const last7Days: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now);
      dayStart.setDate(dayStart.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      const count = await prisma.tenant.count({
        where: {
          isSuperAdmin: false,
          createdAt: { gte: dayStart, lt: dayEnd },
        },
      });
      last7Days.push({
        date: dayStart.toISOString().slice(0, 10),
        count,
      });
    }

    return {
      tenants: {
        total: tenantTotal,
        new30Days: tenantNew30,
        suspended: tenantSuspended,
        activeSubscription: tenantActiveSub,
      },
      usage: {
        bots: botCount,
        channels: channelCount,
        activeMemberships,
        pendingOrders,
      },
      revenue: {
        // Tenant'ların kendi son kullanıcılarından bu ay aldığı toplam (raporlama)
        tenantsThisMonth: Number(revenueThisMonth._sum.amount ?? 0),
        approvedOrdersThisMonth,
        // SaaS olarak SİZİN tenant'larınızdan bu ay aldığınız
        saasThisMonth: Number(subRevenueThisMonth._sum.amount ?? 0),
      },
      newTenantsLast7Days: last7Days,
    };
  });
}
