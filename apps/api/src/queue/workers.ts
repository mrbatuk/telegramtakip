// Worker'lar: süresi dolan üyeleri kanaldan atma vb.

import { Worker, type Job } from 'bullmq';
import { prisma } from '@tt/db';
import { getConnectionOptions } from './connection.js';
import {
  QUEUE_NAMES,
  type KickExpiredJobData,
  type ExpireOrderJobData,
  type ExpiryWarningJobData,
} from './queues.js';
import { decrypt } from '../lib/crypto.js';
import { callTelegram, TelegramError } from '../lib/telegram.js';
import { logger } from '../logger.js';

let kickWorker: Worker<KickExpiredJobData> | null = null;
let expireOrderWorker: Worker<ExpireOrderJobData> | null = null;
let warningWorker: Worker<ExpiryWarningJobData> | null = null;

export function startWorkers(): void {
  if (kickWorker || expireOrderWorker) {
    logger.warn('Worker zaten başlamış');
    return;
  }

  // ============================================================
  // Süresi dolan üyeyi kanaldan at
  // ============================================================
  kickWorker = new Worker<KickExpiredJobData>(
    QUEUE_NAMES.KICK_EXPIRED,
    async (job: Job<KickExpiredJobData>) => {
      const { membershipId } = job.data;

      const membership = await prisma.membership.findUnique({
        where: { id: membershipId },
        include: {
          channel: { include: { bot: true } },
        },
      });

      if (!membership) {
        logger.warn({ membershipId }, 'Membership bulunamadı, skip');
        return { skipped: 'not_found' };
      }

      if (membership.status !== 'ACTIVE') {
        logger.info({ membershipId, status: membership.status }, 'Üyelik zaten aktif değil');
        return { skipped: 'already_inactive' };
      }

      // Süresi henüz dolmadıysa (job erken tetiklendi) — yeniden ertele
      if (membership.expiresAt.getTime() > Date.now() + 5000) {
        const delay = membership.expiresAt.getTime() - Date.now();
        throw new Error(`Erken tetiklendi, ${delay}ms bekle`);
      }

      const token = decrypt(membership.channel.bot.botToken);
      const chatId = Number(membership.channel.telegramChatId);
      const userId = Number(membership.telegramUserId);

      try {
        // banChatMember + hemen unbanChatMember = kalıcı ban değil, sadece çıkarma
        await callTelegram(token, 'banChatMember', {
          chat_id: chatId,
          user_id: userId,
          revoke_messages: false,
        });
        await callTelegram(token, 'unbanChatMember', {
          chat_id: chatId,
          user_id: userId,
          only_if_banned: true,
        });
      } catch (err) {
        if (err instanceof TelegramError) {
          // Kullanıcı zaten kanalda yoksa hata atar - sorun değil
          if (
            err.message.includes('not found') ||
            err.message.includes('user not found') ||
            err.message.includes('USER_NOT_PARTICIPANT')
          ) {
            logger.info({ membershipId }, 'Kullanıcı zaten kanalda değil');
          } else {
            throw err;
          }
        } else {
          throw err;
        }
      }

      // Kullanıcıya bilgi DM'i (best-effort)
      try {
        await callTelegram(token, 'sendMessage', {
          chat_id: userId,
          text:
            `Üyelik süren doldu ve *${membership.channel.name}* kanalından çıkarıldın.\n\n` +
            `Yeniden katılmak için kanala tekrar istek atabilirsin.`,
          parse_mode: 'Markdown',
        });
      } catch {
        // DM kapalı olabilir
      }

      await prisma.membership.update({
        where: { id: membership.id },
        data: { status: 'EXPIRED', kickedAt: new Date() },
      });

      logger.info({ membershipId }, 'Üye çıkarıldı');
      return { kicked: true };
    },
    {
      connection: getConnectionOptions(),
      concurrency: 5,
    },
  );

  kickWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, 'kick-expired-member başarısız');
  });

  // ============================================================
  // Ödeme yapmadan süresi dolan order'ı iptal et
  // ============================================================
  expireOrderWorker = new Worker<ExpireOrderJobData>(
    QUEUE_NAMES.EXPIRE_ORDER,
    async (job: Job<ExpireOrderJobData>) => {
      const order = await prisma.order.findUnique({
        where: { id: job.data.orderId },
      });
      if (!order) return { skipped: 'not_found' };
      if (order.status !== 'AWAITING_PAYMENT') return { skipped: 'not_awaiting' };

      await prisma.order.update({
        where: { id: order.id },
        data: { status: 'CANCELLED' },
      });

      return { cancelled: true };
    },
    {
      connection: getConnectionOptions(),
      concurrency: 5,
    },
  );

  // ============================================================
  // Süre dolmadan N gün önce uyarı DM
  // ============================================================
  warningWorker = new Worker<ExpiryWarningJobData>(
    QUEUE_NAMES.EXPIRY_WARNING,
    async (job: Job<ExpiryWarningJobData>) => {
      const { membershipId, daysBefore } = job.data;

      const membership = await prisma.membership.findUnique({
        where: { id: membershipId },
        include: { channel: { include: { bot: true } } },
      });

      if (!membership) return { skipped: 'not_found' };
      if (membership.status !== 'ACTIVE') return { skipped: 'not_active' };

      const msLeft = membership.expiresAt.getTime() - Date.now();
      const daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000));

      // Üyelik bu arada uzatıldıysa veya zaten geçtiysa atla
      if (msLeft <= 0) return { skipped: 'already_expired' };

      const token = decrypt(membership.channel.bot.botToken);
      const userId = Number(membership.telegramUserId);
      const expiresStr = membership.expiresAt.toLocaleString('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      try {
        await callTelegram(token, 'sendMessage', {
          chat_id: userId,
          text:
            `⏰ *Üyelik Hatırlatması*\n\n` +
            `*${membership.channel.name}* kanalındaki üyeliğin ` +
            `**${daysLeft > 1 ? `${daysLeft} gün` : '1 gün veya daha az'}** sonra (${expiresStr}) sona eriyor.\n\n` +
            `Süresi dolduğunda kanaldan otomatik çıkarılacaksın.\n\n` +
            `💡 *Yenilemek için:* Bu sohbete /yenile yaz — paket seçip ödeme yapınca üyeliğin uzatılır.`,
          parse_mode: 'Markdown',
        });
        logger.info({ membershipId, daysLeft }, 'Uyarı DM gönderildi');
        return { warned: true, daysLeft };
      } catch (err) {
        if (err instanceof TelegramError) {
          // Kullanıcı bot'u bloklamış olabilir - sessizce geç
          if (err.message.toLowerCase().includes('blocked')) {
            logger.info({ membershipId }, 'Kullanıcı bot\'u blokladı');
            return { skipped: 'blocked' };
          }
        }
        throw err;
      }
    },
    {
      connection: getConnectionOptions(),
      concurrency: 5,
    },
  );

  warningWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, 'expiry-warning başarısız');
  });

  logger.info('BullMQ worker\'lar başladı');
}

export async function stopWorkers(): Promise<void> {
  if (kickWorker) {
    await kickWorker.close();
    kickWorker = null;
  }
  if (expireOrderWorker) {
    await expireOrderWorker.close();
    expireOrderWorker = null;
  }
  if (warningWorker) {
    await warningWorker.close();
    warningWorker = null;
  }
}
