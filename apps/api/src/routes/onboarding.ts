// Yeni tenant için "başlangıç adımları" durumu.
// Client bu duruma bakıp checklist'te tamamlanmış/tamamlanmamış olarak gösterir.

import type { FastifyInstance } from 'fastify';
import { prisma } from '@tt/db';

export async function registerOnboardingRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  app.get('/onboarding', async (request) => {
    const tenantId = request.tenant!.id;

    const [botCount, channelCount, packageCount, activeMembers] = await Promise.all([
      prisma.bot.count({ where: { tenantId } }),
      prisma.channel.count({ where: { bot: { tenantId } } }),
      prisma.package.count({ where: { channel: { bot: { tenantId } } } }),
      prisma.membership.count({
        where: { status: 'ACTIVE', channel: { bot: { tenantId } } },
      }),
    ]);

    const hasBot = botCount > 0;
    const hasChannel = channelCount > 0;
    const hasPackage = packageCount > 0;
    const hasActiveChannel = await prisma.channel.count({
      where: { bot: { tenantId }, isActive: true },
    }).then((n) => n > 0);
    const hasFirstMember = activeMembers > 0;

    const steps = [
      { key: 'bot', label: 'BotFather\'dan bot oluştur ve panele ekle', done: hasBot },
      { key: 'channel', label: 'Botu kanalına admin yap (otomatik tespit)', done: hasChannel },
      { key: 'package', label: 'Kanala en az bir paket ekle', done: hasPackage },
      { key: 'activate', label: 'Kanalı aktifleştir', done: hasActiveChannel },
      { key: 'firstMember', label: 'İlk üyeni ekle (test bir hesapla dene)', done: hasFirstMember },
    ];

    const doneCount = steps.filter((s) => s.done).length;
    const allDone = doneCount === steps.length;

    return {
      steps,
      doneCount,
      totalCount: steps.length,
      allDone,
    };
  });
}
