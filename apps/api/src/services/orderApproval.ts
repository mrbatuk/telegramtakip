// Order onaylama servisi. Manuel (panel) + otomatik (PayTR IPN) tetiklenir.
// YENİLEME DESTEĞİ: aynı kullanıcının aynı kanaldaki mevcut aktif üyeliği varsa,
// yeni üyelik oluşturmak yerine mevcut üyeliğin süresini uzatır.

import { prisma } from '@tt/db';
import { decrypt } from '../lib/crypto.js';
import { callTelegram } from '../lib/telegram.js';
import { getKickQueue, getExpiryWarningQueue } from '../queue/queues.js';
import type { FastifyBaseLogger } from 'fastify';

const WARNING_DAYS_BEFORE = 3;

export interface ApproveResult {
  ok: boolean;
  membershipId?: string;
  expiresAt?: Date;
  wasRenewal?: boolean;
  reason?: string;
}

export interface ApproveInput {
  orderId: string;
  approvedBy: string | null;
  tenantId?: string;
  logger?: FastifyBaseLogger;
}

export async function approveOrder(input: ApproveInput): Promise<ApproveResult> {
  const log = input.logger;

  const order = await prisma.order.findFirst({
    where: {
      id: input.orderId,
      ...(input.tenantId
        ? { joinRequest: { channel: { bot: { tenantId: input.tenantId } } } }
        : {}),
    },
    include: {
      package: true,
      joinRequest: {
        include: {
          channel: { include: { bot: true } },
        },
      },
    },
  });

  if (!order) return { ok: false, reason: 'order_not_found' };
  if (order.status === 'APPROVED') return { ok: true, reason: 'already_approved' };
  if (
    order.status !== 'AWAITING_APPROVAL' &&
    order.status !== 'AWAITING_PAYMENT'
  ) {
    return { ok: false, reason: `invalid_status:${order.status}` };
  }

  const channel = order.joinRequest.channel;
  const bot = channel.bot;
  const token = decrypt(bot.botToken);
  const userId = Number(order.joinRequest.telegramUserId);
  const now = new Date();
  const durationMs = order.package.durationDays * 24 * 60 * 60 * 1000;

  // Aynı user+channel'da mevcut membership var mı?
  const existing = await prisma.membership.findUnique({
    where: {
      channelId_telegramUserId: {
        channelId: channel.id,
        telegramUserId: order.joinRequest.telegramUserId,
      },
    },
  });

  const isRenewal = !!existing && existing.status !== 'REVOKED';
  const wasExpired = !!existing && existing.status === 'EXPIRED';
  const baseTime = existing && existing.status === 'ACTIVE' && existing.expiresAt > now
    ? existing.expiresAt // aktifse mevcut bitişe ekle
    : now;                // süresi dolmuşsa şimdiden başla
  const expiresAt = new Date(baseTime.getTime() + durationMs);

  // Telegram: kullanıcıyı kanala al (yenileme sırasında zaten kanaldaysa hata almaz)
  let joinRequestApproved = false;
  try {
    await callTelegram(token, 'approveChatJoinRequest', {
      chat_id: Number(channel.telegramChatId),
      user_id: userId,
    });
    joinRequestApproved = true;
  } catch (err) {
    // Zaten kanalda, veya join request yok — devam
    log?.debug({ err, orderId: order.id }, 'approveChatJoinRequest — muhtemelen zaten üye');
  }

  // Süresi bitmiş kullanıcı yeniden ödedi ve join request'i yoksa yeni davet link'i gönder
  let inviteLink: string | null = null;
  if (wasExpired && !joinRequestApproved) {
    try {
      const link = await callTelegram<{ invite_link: string }>(token, 'createChatInviteLink', {
        chat_id: Number(channel.telegramChatId),
        name: `Yenileme ${order.id.slice(-6)}`,
        creates_join_request: true,
        expire_date: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 gün
        member_limit: 1,
      });
      inviteLink = link.invite_link;
    } catch (err) {
      log?.warn({ err }, 'createChatInviteLink başarısız');
    }
  }

  // Eski kick + warning job'larını iptal et (yenilemede)
  if (isRenewal && existing) {
    if (existing.kickJobId) {
      try {
        const old = await getKickQueue().getJob(existing.kickJobId);
        if (old) await old.remove();
      } catch {
        /* yoksa sorun değil */
      }
    }
    if (existing.warningJobId) {
      try {
        const old = await getExpiryWarningQueue().getJob(existing.warningJobId);
        if (old) await old.remove();
      } catch {
        /* yoksa sorun değil */
      }
    }
  }

  // Atomik: membership upsert + order status + join request status
  const result = await prisma.$transaction(async (tx) => {
    const membership = await tx.membership.upsert({
      where: {
        channelId_telegramUserId: {
          channelId: channel.id,
          telegramUserId: order.joinRequest.telegramUserId,
        },
      },
      create: {
        channelId: channel.id,
        telegramUserId: order.joinRequest.telegramUserId,
        telegramUsername: order.joinRequest.telegramUsername,
        orderId: order.id,
        startedAt: now,
        expiresAt,
        status: 'ACTIVE',
      },
      update: {
        orderId: order.id,
        telegramUsername: order.joinRequest.telegramUsername,
        expiresAt,
        status: 'ACTIVE',
        kickedAt: null,
        // startedAt yenilemede güncellenmez — ilk katılma tarihi korunur
      },
    });

    await tx.order.update({
      where: { id: order.id },
      data: {
        status: 'APPROVED',
        paidAt: now,
        approvedBy: input.approvedBy,
      },
    });

    await tx.joinRequest.update({
      where: { id: order.joinRequest.id },
      data: { status: 'PAID', processedAt: now },
    });

    return membership;
  });

  // Kullanıcıya DM (yenileme + davet linki durumuna göre metin)
  const msgLines: string[] = [];
  const expiresStr = expiresAt.toLocaleDateString('tr-TR');

  if (isRenewal) {
    msgLines.push(`✅ Yenileme onaylandı!`, ``);
    if (wasExpired && joinRequestApproved) {
      // Kanala yeniden alındı (bekleyen join request'i vardı)
      msgLines.push(
        `*${channel.name}* kanalına yeniden eklendin.`,
        `Yeni bitiş tarihi: *${expiresStr}*`,
      );
    } else if (wasExpired && inviteLink) {
      // Kanala eklenemedi ama davet linki üretildi
      msgLines.push(
        `*${channel.name}* kanalı için üyeliğin yenilendi.`,
        `Yeni bitiş tarihi: *${expiresStr}*`,
        ``,
        `Kanala katılmak için aşağıdaki linke tıkla:`,
        inviteLink,
        ``,
        `_Bu link 7 gün geçerli, sadece 1 kez kullanılabilir._`,
      );
    } else if (wasExpired) {
      // Ne join request onaylandı ne link oluştu — nadir edge case
      msgLines.push(
        `*${channel.name}* kanalı için üyeliğin yenilendi.`,
        `Yeni bitiş tarihi: *${expiresStr}*`,
        ``,
        `⚠️ Kanala otomatik eklenemedi. Kanal davet linkine tıklayarak katılabilir veya kanal sahibiyle iletişime geç.`,
      );
    } else {
      // Aktif üyelik uzatıldı — kullanıcı zaten kanaldaydı
      msgLines.push(
        `*${channel.name}* kanalındaki üyeliğin uzatıldı.`,
        `Yeni bitiş tarihi: *${expiresStr}*`,
      );
    }
  } else {
    msgLines.push(
      `✅ Ödemen onaylandı!`,
      ``,
      `*${channel.name}* kanalına eklendin.`,
      `Üyeliğin *${expiresStr}* tarihine kadar geçerli.`,
    );
  }

  try {
    await callTelegram(token, 'sendMessage', {
      chat_id: userId,
      text: msgLines.join('\n'),
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    });
  } catch (err) {
    log?.info({ err }, 'onay DM gönderilemedi');
  }

  // Yeni kick + warning job'larını kuyruğa ekle
  const nowMs = Date.now();
  const kickDelay = Math.max(0, expiresAt.getTime() - nowMs);
  const warningDelay =
    expiresAt.getTime() - nowMs - WARNING_DAYS_BEFORE * 24 * 60 * 60 * 1000;

  let kickJobIdSaved: string | null = null;
  let warnJobIdSaved: string | null = null;

  try {
    const job = await getKickQueue().add(
      'kick',
      { membershipId: result.id },
      { delay: kickDelay, jobId: `kick:${result.id}:${order.id}` },
    );
    kickJobIdSaved = job.id ?? null;
  } catch (err) {
    log?.error({ err }, 'kick job kuyruğa eklenemedi');
  }

  if (warningDelay > 0) {
    try {
      const j = await getExpiryWarningQueue().add(
        'warn',
        { membershipId: result.id, daysBefore: WARNING_DAYS_BEFORE },
        { delay: warningDelay, jobId: `warn:${result.id}:${order.id}` },
      );
      warnJobIdSaved = j.id ?? null;
    } catch (err) {
      log?.error({ err }, 'warning job kuyruğa eklenemedi');
    }
  }

  await prisma.membership.update({
    where: { id: result.id },
    data: { kickJobId: kickJobIdSaved, warningJobId: warnJobIdSaved },
  });

  return {
    ok: true,
    membershipId: result.id,
    expiresAt,
    wasRenewal: isRenewal,
  };
}
