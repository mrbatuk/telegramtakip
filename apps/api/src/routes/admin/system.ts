import type { FastifyInstance } from 'fastify';
import { prisma } from '@tt/db';
import { getKickQueue, getExpiryWarningQueue } from '../../queue/queues.js';
import { config } from '../../config.js';
import { getCachedBotCount } from '../../bot-engine/registry.js';
import { getAllPlans } from '../../lib/plans.js';
import { verifyEmailConnection } from '../../lib/email/index.js';

export async function registerAdminSystemRoutes(app: FastifyInstance) {
  // GET /admin/system/health — alt sistemler ayakta mı?
  app.get('/admin/system/health', async () => {
    const [dbCheck, queues, emailStatus] = await Promise.all([
      prisma.$queryRaw`SELECT 1 as ok`.then(() => true).catch(() => false),
      Promise.all([getKickQueue(), getExpiryWarningQueue()].map(async (q) => {
        try {
          const counts = await q.getJobCounts(
            'waiting',
            'active',
            'delayed',
            'completed',
            'failed',
          );
          return { name: q.name, ...counts };
        } catch (err) {
          return {
            name: q.name,
            error: err instanceof Error ? err.message : 'unknown',
          };
        }
      })),
      verifyEmailConnection(),
    ]);

    return {
      database: { ok: dbCheck },
      queues,
      botEngine: { cachedBots: getCachedBotCount() },
      email: emailStatus,
      config: {
        nodeEnv: config.NODE_ENV,
        webhookBaseUrl: config.TELEGRAM_WEBHOOK_BASE_URL,
        publicApiUrl: config.PUBLIC_API_URL,
        publicWebUrl: config.PUBLIC_WEB_URL,
        smtpConfigured: !!config.SMTP_HOST,
        adminNotificationEmail: config.ADMIN_NOTIFICATION_EMAIL || '—',
      },
    };
  });

  // GET /admin/system/plans — plan limit konfigürasyonu (UI'da göstermek için)
  app.get('/admin/system/plans', async () => {
    return { plans: await getAllPlans() };
  });
}
