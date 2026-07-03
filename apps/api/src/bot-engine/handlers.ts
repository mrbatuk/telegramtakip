// Tüm tenant botlarının paylaştığı event handler'lar.
// Her gelen update'te tenantId + botRecordId context'te hazır (registry.ts'ten).

import { Bot, type Context, InlineKeyboard } from 'grammy';
import { prisma } from '@tt/db';
import { uploadFile } from '../lib/storage.js';
import { config } from '../config.js';
import { notifyTenantNewReceipt } from '../services/notifications.js';

export interface TenantBotContext extends Context {
  tenantId: string;
  botRecordId: string;
}

// Yenileme paketlerini gösterir. /yenile → 1 üyelik veya renew:X callback
async function showRenewalOptions(
  ctx: TenantBotContext,
  membership: {
    id: string;
    channelId: string;
    expiresAt: Date;
    status: string;
    channel: {
      name: string;
      currency: string;
      packages: Array<{
        id: string;
        name: string;
        price: { toString(): string };
        durationDays: number;
      }>;
    };
  },
) {
  if (membership.channel.packages.length === 0) {
    await ctx.reply(
      `${membership.channel.name} kanalında paket tanımlı değil. Kanal sahibi ile iletişime geç.`,
    );
    return;
  }

  const joinRequest = await prisma.joinRequest.findUnique({
    where: {
      channelId_telegramUserId: {
        channelId: membership.channelId,
        telegramUserId: BigInt(ctx.from!.id),
      },
    },
  });
  if (!joinRequest) return;

  const isExpired = membership.status === 'EXPIRED';
  const daysLeft = Math.ceil(
    (membership.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000),
  );

  const kb = new InlineKeyboard();
  const lines: string[] = [
    `🔄 *${membership.channel.name}* — Yenileme`,
    ``,
  ];

  if (isExpired) {
    lines.push(
      `Üyeliğin sona ermiş ve kanaldan çıkarılmışsın. Ödeme sonrası kanala tekrar dönmen için sana özel bir davet linki gönderilecek.`,
      ``,
    );
  } else {
    lines.push(
      `Mevcut üyeliğin *${daysLeft} gün* sonra bitiyor.`,
      `Aşağıdaki paketlerden birini seçerek süreyi uzatabilirsin:`,
      ``,
    );
  }

  for (const pkg of membership.channel.packages) {
    lines.push(`• ${pkg.name} — ${pkg.price.toString()} ${membership.channel.currency} (+${pkg.durationDays} gün)`);
    kb
      .text(
        `${pkg.name} — ${pkg.price.toString()} ${membership.channel.currency}`,
        `pkg:${joinRequest.id}:${pkg.id}`,
      )
      .row();
  }

  await ctx.reply(lines.join('\n'), {
    parse_mode: 'Markdown',
    reply_markup: kb,
  });
}

export function setupBotHandlers(bot: Bot<TenantBotContext>) {
  // ============================================================
  // Her etkileşimde username/isim güncelle (kullanıcı değiştirirse senkron kalsın)
  // ============================================================
  bot.use(async (ctx, next) => {
    const user = ctx.from;
    if (user && !user.is_bot) {
      // Bu bot'a ait kanal(lar)daki bu kullanıcıya ait kayıtları güncelle
      try {
        await prisma.$transaction([
          prisma.joinRequest.updateMany({
            where: {
              telegramUserId: BigInt(user.id),
              channel: { botId: ctx.botRecordId },
            },
            data: {
              telegramUsername: user.username ?? null,
              firstName: user.first_name ?? null,
              lastName: user.last_name ?? null,
            },
          }),
          prisma.membership.updateMany({
            where: {
              telegramUserId: BigInt(user.id),
              channel: { botId: ctx.botRecordId },
            },
            data: { telegramUsername: user.username ?? null },
          }),
        ]);
      } catch (err) {
        // Sessizce geç — username senkronu kritik değil
      }
    }
    await next();
  });

  // ============================================================
  // /start — kullanıcı bot'a doğrudan yazdığında
  // ============================================================
  bot.command('start', async (ctx) => {
    await ctx.reply(
      'Merhaba! Bir kanala katılma isteği gönderdiğinde sana ödeme bilgileri ' +
        'burada iletilecek.\n\n' +
        'Aktif üyeliğin varsa /yenile komutuyla uzatabilirsin.\n' +
        'Eğer kanal sahibiysen panele giriş yap.',
    );
  });

  // ============================================================
  // /yenile — mevcut üyeliği uzat
  // ============================================================
  bot.command(['yenile', 'renew'], async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    // ACTIVE + son 30 gün içinde EXPIRED (yenileyebilsin)
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const memberships = await prisma.membership.findMany({
      where: {
        telegramUserId: BigInt(userId),
        channel: { botId: ctx.botRecordId, isActive: true },
        OR: [
          { status: 'ACTIVE' },
          { status: 'EXPIRED', kickedAt: { gte: cutoff } },
        ],
      },
      include: {
        channel: {
          include: {
            packages: {
              where: { isActive: true },
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
      },
    });

    if (memberships.length === 0) {
      await ctx.reply(
        'Aktif veya yakın zamanda süresi dolan üyeliğin yok. ' +
          'Bir kanala katılmak istiyorsan invite linki ile ' +
          'katılma isteği gönderebilirsin.',
      );
      return;
    }

    // Kanal(lar) için bir join request kaydı olmayabilir — yenileme için join request'e
    // ihtiyacımız var (order.joinRequestId zorunlu). Yoksa oluştur.
    for (const m of memberships) {
      await prisma.joinRequest.upsert({
        where: {
          channelId_telegramUserId: {
            channelId: m.channelId,
            telegramUserId: BigInt(userId),
          },
        },
        update: {}, // varsa dokunma
        create: {
          channelId: m.channelId,
          telegramUserId: BigInt(userId),
          telegramUsername: ctx.from?.username ?? null,
          firstName: ctx.from?.first_name ?? null,
          lastName: ctx.from?.last_name ?? null,
          status: 'PAID', // zaten üye
          processedAt: new Date(),
        },
      });
    }

    if (memberships.length === 1) {
      // Tek üyelik varsa direkt paketleri göster
      const m = memberships[0]!;
      await showRenewalOptions(ctx, m);
      return;
    }

    // Birden çok üyelik varsa önce kanal seç
    const kb = new InlineKeyboard();
    const lines: string[] = ['Üyeliklerin — hangisini yenilemek istiyorsun?', ''];
    for (const m of memberships) {
      if (m.status === 'ACTIVE') {
        const daysLeft = Math.ceil(
          (m.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000),
        );
        lines.push(`• *${m.channel.name}* — ${daysLeft} gün kaldı`);
      } else {
        lines.push(`• *${m.channel.name}* — süresi dolmuş (yenile ve tekrar katıl)`);
      }
      kb.text(m.channel.name, `renew:${m.id}`).row();
    }
    await ctx.reply(lines.join('\n'), {
      parse_mode: 'Markdown',
      reply_markup: kb,
    });
  });

  // Yenileme kanal seçildi (birden çok üyelik durumunda)
  bot.callbackQuery(/^renew:([^:]+)$/, async (ctx) => {
    const membershipId = ctx.match[1];
    if (!membershipId) {
      await ctx.answerCallbackQuery({ text: 'Geçersiz seçim' });
      return;
    }
    const membership = await prisma.membership.findFirst({
      where: {
        id: membershipId,
        channel: { botId: ctx.botRecordId },
      },
      include: {
        channel: {
          include: {
            packages: {
              where: { isActive: true },
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
      },
    });
    if (!membership) {
      await ctx.answerCallbackQuery({ text: 'Üyelik bulunamadı' });
      return;
    }
    await ctx.answerCallbackQuery();
    await showRenewalOptions(ctx, membership);
  });

  // ============================================================
  // Bot bir kanala/gruba eklendi veya yetkisi değişti
  // → Otomatik kanal tespiti (kullanıcı Chat ID elle girmek zorunda kalmasın)
  // ============================================================
  bot.on('my_chat_member', async (ctx) => {
    const update = ctx.myChatMember;
    const chat = update.chat;

    if (chat.type !== 'channel' && chat.type !== 'supergroup') return;

    const newStatus = update.new_chat_member.status;
    const isAdmin = newStatus === 'administrator';
    const isMember = newStatus === 'member';

    if (!isAdmin && !isMember) {
      // Bot çıkarıldı veya yetkisi alındı
      await prisma.channel.updateMany({
        where: {
          botId: ctx.botRecordId,
          telegramChatId: BigInt(chat.id),
        },
        data: { isActive: false },
      });
      return;
    }

    // Bot kanala eklendi/promote edildi → otomatik kayıt (henüz aktif değil, paket lazım)
    const name = 'title' in chat && chat.title ? chat.title : `Kanal ${chat.id}`;
    await prisma.channel.upsert({
      where: {
        botId_telegramChatId: {
          botId: ctx.botRecordId,
          telegramChatId: BigInt(chat.id),
        },
      },
      update: {
        name,
        isActive: false, // Panel'den paket ekleyince aktif olur
      },
      create: {
        botId: ctx.botRecordId,
        telegramChatId: BigInt(chat.id),
        name,
        isActive: false,
      },
    });

    console.log(
      `[auto-discover] Bot ${ctx.botRecordId} -> chat ${chat.id} (${name}) - status: ${newStatus}`,
    );
  });

  // ============================================================
  // Kanal katılma isteği — join request akışı (Task #8)
  // ============================================================
  bot.on('chat_join_request', async (ctx) => {
    const chatId = ctx.chatJoinRequest.chat.id;
    const user = ctx.chatJoinRequest.from;

    const channel = await prisma.channel.findFirst({
      where: {
        botId: ctx.botRecordId,
        telegramChatId: BigInt(chatId),
        isActive: true,
      },
      include: {
        packages: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!channel) {
      console.warn(
        `Bilinmeyen kanal join request: bot=${ctx.botRecordId} chat=${chatId}`,
      );
      return;
    }

    // Aktif üyelik varsa (yenileme sonrası tekrar katılma) otomatik onay
    const existingActive = await prisma.membership.findUnique({
      where: {
        channelId_telegramUserId: {
          channelId: channel.id,
          telegramUserId: BigInt(user.id),
        },
      },
    });

    if (existingActive && existingActive.status === 'ACTIVE' && existingActive.expiresAt > new Date()) {
      try {
        await ctx.api.approveChatJoinRequest(chatId, user.id);
        try {
          await ctx.api.sendMessage(
            user.id,
            `✅ *${channel.name}* kanalına tekrar hoş geldin! ` +
              `Aktif üyeliğin *${existingActive.expiresAt.toLocaleDateString('tr-TR')}* tarihine kadar geçerli.`,
            { parse_mode: 'Markdown' },
          );
        } catch {
          /* DM kapalı olabilir */
        }
      } catch (err) {
        console.error('[auto-approve existing member]', err);
      }
      return;
    }

    // Join request kaydı
    const joinRequest = await prisma.joinRequest.upsert({
      where: {
        channelId_telegramUserId: {
          channelId: channel.id,
          telegramUserId: BigInt(user.id),
        },
      },
      update: {
        requestedAt: new Date(),
        status: 'PENDING',
        telegramUsername: user.username ?? null,
        firstName: user.first_name ?? null,
        lastName: user.last_name ?? null,
      },
      create: {
        channelId: channel.id,
        telegramUserId: BigInt(user.id),
        telegramUsername: user.username ?? null,
        firstName: user.first_name ?? null,
        lastName: user.last_name ?? null,
      },
    });

    // Kullanıcıya hoş geldin + paketler
    if (channel.packages.length === 0) {
      try {
        await ctx.api.sendMessage(
          user.id,
          channel.welcomeMessage +
            '\n\n⚠️ Henüz paket tanımlanmamış. Lütfen kanal sahibi ile iletişime geç.',
        );
      } catch (err) {
        // DM kapalı olabilir
      }
      return;
    }

    const lines: string[] = [
      `*${channel.name}* kanalına hoş geldin! 👋`,
      '',
      channel.welcomeMessage,
      '',
      '*Paketler:*',
    ];

    const keyboard = new InlineKeyboard();
    for (const pkg of channel.packages) {
      const priceText = `${pkg.price.toString()} ${channel.currency}`;
      lines.push(`• ${pkg.name} — ${priceText} (${pkg.durationDays} gün)`);
      keyboard
        .text(`${pkg.name} — ${priceText}`, `pkg:${joinRequest.id}:${pkg.id}`)
        .row();
    }

    if (channel.ibanInfo) {
      lines.push('', '*Ödeme bilgileri:*', channel.ibanInfo);
      lines.push(
        '',
        '_Ödemeyi yaptıktan sonra paket butonuna tıkla ve dekontu bu sohbete gönder._',
      );
    }

    try {
      await ctx.api.sendMessage(user.id, lines.join('\n'), {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
    } catch (err) {
      // Kullanıcı bot'u block etmiş veya DM açık değil olabilir
      console.warn(
        `[join-request DM error] user=${user.id} channel=${channel.id}:`,
        err instanceof Error ? err.message : err,
      );
    }
  });

  // ============================================================
  // Paket seçimi — kullanıcı paket butonuna tıkladı
  // ============================================================
  bot.callbackQuery(/^pkg:([^:]+):([^:]+)$/, async (ctx) => {
    const [, joinRequestId, packageId] = ctx.match;
    if (!joinRequestId || !packageId) {
      await ctx.answerCallbackQuery({ text: 'Geçersiz seçim' });
      return;
    }

    const joinRequest = await prisma.joinRequest.findFirst({
      where: {
        id: joinRequestId,
        channel: { botId: ctx.botRecordId },
      },
      include: { channel: true },
    });

    if (!joinRequest) {
      await ctx.answerCallbackQuery({ text: 'İstek bulunamadı' });
      return;
    }

    const pkg = await prisma.package.findFirst({
      where: { id: packageId, channelId: joinRequest.channelId },
    });

    if (!pkg) {
      await ctx.answerCallbackQuery({ text: 'Paket bulunamadı' });
      return;
    }

    // Order oluştur veya mevcut olanı güncelle (aynı joinRequest için tek aktif order)
    const existing = await prisma.order.findFirst({
      where: {
        joinRequestId: joinRequest.id,
        status: { in: ['AWAITING_PAYMENT', 'AWAITING_APPROVAL'] },
      },
    });

    if (existing) {
      await prisma.order.update({
        where: { id: existing.id },
        data: {
          packageId: pkg.id,
          amount: pkg.price,
          status: 'AWAITING_PAYMENT',
        },
      });
    } else {
      await prisma.order.create({
        data: {
          joinRequestId: joinRequest.id,
          packageId: pkg.id,
          amount: pkg.price,
          paymentMethod: 'IBAN',
          status: 'AWAITING_PAYMENT',
        },
      });
    }

    await ctx.answerCallbackQuery({ text: `${pkg.name} seçildi ✓` });

    // Tenant'ın aktif kart ödeme yöntemleri var mı?
    const channelWithTenant = await prisma.channel.findUnique({
      where: { id: joinRequest.channelId },
      include: { bot: { include: { tenant: true } } },
    });
    const tenantId = channelWithTenant?.bot.tenantId;

    const hasPaytr = tenantId
      ? !!(await prisma.paymentMethod.findFirst({
          where: { tenantId, type: 'PAYTR', isActive: true },
        }))
      : false;

    const hasIyzico = tenantId
      ? !!(await prisma.paymentMethod.findFirst({
          where: { tenantId, type: 'IYZICO', isActive: true },
        }))
      : false;

    const hasIban = !!joinRequest.channel.ibanInfo;

    const lines: string[] = [
      `✅ Paket seçildi: *${pkg.name}* — ${pkg.price.toString()} ${joinRequest.channel.currency}`,
      '',
    ];

    const kb = new InlineKeyboard();

    let orderIdForUrl: string | undefined = existing?.id;
    if ((hasPaytr || hasIyzico) && !orderIdForUrl) {
      const o = await prisma.order.findFirst({
        where: { joinRequestId: joinRequest.id, packageId: pkg.id, status: 'AWAITING_PAYMENT' },
        orderBy: { createdAt: 'desc' },
      });
      orderIdForUrl = o?.id;
    }

    const base = config.TELEGRAM_WEBHOOK_BASE_URL.replace(/\/$/, '');

    if (hasPaytr && orderIdForUrl) {
      kb.url('💳 Kart ile Öde (PayTR)', `${base}/pay/${orderIdForUrl}?type=PAYTR`).row();
    }
    if (hasIyzico && orderIdForUrl) {
      kb.url('💳 Kart ile Öde (Iyzico)', `${base}/pay/${orderIdForUrl}?type=IYZICO`).row();
    }

    if (hasPaytr || hasIyzico) {
      lines.push('💳 *Kartla öde:* aşağıdaki butonlardan biriyle ödeme yap, otomatik kanala alınırsın.');
      if (hasIban) lines.push('');
    }

    if (hasIban) {
      lines.push('📤 *IBAN ile öde:*');
      lines.push('```');
      lines.push(joinRequest.channel.ibanInfo!);
      lines.push('```');
      lines.push('Yukarıdaki bilgilere ödeme yap, sonra *dekontunu bu sohbete gönder* (foto/PDF).');
      lines.push('Onay manuel — kanal sahibi onayladığında kanala alınırsın.');
    }

    if (!hasPaytr && !hasIban) {
      lines.push('⚠️ Henüz ödeme yöntemi tanımlanmamış. Kanal sahibi ile iletişime geç.');
    }

    const msg = lines.join('\n');

    try {
      if (kb.inline_keyboard.length > 0) {
        await ctx.editMessageText(msg, { parse_mode: 'Markdown', reply_markup: kb });
      } else {
        await ctx.editMessageText(msg, { parse_mode: 'Markdown' });
      }
    } catch {
      if (kb.inline_keyboard.length > 0) {
        await ctx.reply(msg, { parse_mode: 'Markdown', reply_markup: kb });
      } else {
        await ctx.reply(msg, { parse_mode: 'Markdown' });
      }
    }
  });

  // ============================================================
  // Dekont yükleme (foto veya belge)
  // ============================================================
  bot.on(['message:photo', 'message:document'], async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    // Kullanıcının bu botun kanallarında bekleyen siparişini bul
    const order = await prisma.order.findFirst({
      where: {
        status: 'AWAITING_PAYMENT',
        joinRequest: {
          telegramUserId: BigInt(userId),
          channel: { botId: ctx.botRecordId },
        },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        joinRequest: { include: { channel: true } },
        package: true,
      },
    });

    if (!order) {
      await ctx.reply(
        'Önce bir paket seç. Eğer bir kanala katılma isteği attıysan ve ' +
          'paket butonlarını göremiyorsan, kanal sahibi henüz paket tanımlamamış olabilir.',
      );
      return;
    }

    // En büyük photo (son eleman) veya document
    let fileId: string;
    let originalName: string;
    let contentType: string;

    if (ctx.message?.photo && ctx.message.photo.length > 0) {
      const largest = ctx.message.photo[ctx.message.photo.length - 1];
      if (!largest) {
        await ctx.reply('Foto işlenemedi.');
        return;
      }
      fileId = largest.file_id;
      originalName = `dekont-${order.id}.jpg`;
      contentType = 'image/jpeg';
    } else if (ctx.message?.document) {
      const doc = ctx.message.document;
      fileId = doc.file_id;
      originalName = doc.file_name ?? `dekont-${order.id}`;
      contentType = doc.mime_type ?? 'application/octet-stream';

      // PDF veya resim dışı dosyaları reddet
      const ok =
        contentType.startsWith('image/') || contentType === 'application/pdf';
      if (!ok) {
        await ctx.reply(
          'Sadece resim veya PDF dekontu kabul edilir. Lütfen uygun bir dosya yolla.',
        );
        return;
      }
    } else {
      return;
    }

    try {
      const file = await ctx.api.getFile(fileId);
      if (!file.file_path) throw new Error('file_path yok');

      // grammY'nin file.download() helper'ı yok varsayılan olarak,
      // doğrudan Telegram file URL'inden indir.
      const fileUrl = `https://api.telegram.org/file/bot${ctx.api.token}/${file.file_path}`;
      const res = await fetch(fileUrl);
      if (!res.ok) throw new Error(`İndirme başarısız: ${res.status}`);
      const buffer = Buffer.from(await res.arrayBuffer());

      const upload = await uploadFile(buffer, originalName, contentType);

      await prisma.order.update({
        where: { id: order.id },
        data: {
          receiptUrl: upload.url,
          receiptUploadedAt: new Date(),
          status: 'AWAITING_APPROVAL',
        },
      });

      // Tenant'a e-posta bildirimi (arka planda)
      try {
        const owner = await prisma.tenant.findFirst({
          where: {
            bots: {
              some: {
                id: ctx.botRecordId,
              },
            },
          },
          select: { email: true },
        });
        if (owner) {
          const display =
            [order.joinRequest.firstName, order.joinRequest.lastName]
              .filter(Boolean)
              .join(' ') ||
            ctx.from?.username ||
            `TG#${ctx.from?.id}`;
          void notifyTenantNewReceipt({
            tenantEmail: owner.email,
            channelName: order.joinRequest.channel.name,
            userDisplay: display,
            amount: `${order.amount.toString()} ${order.joinRequest.channel.currency}`,
            packageName: order.package.name,
          });
        }
      } catch (err) {
        console.error('[receipt notify]', err);
      }

      await ctx.reply(
        `📥 Dekontun alındı.\n\n` +
          `Paket: *${order.package.name}*\n` +
          `Tutar: *${order.amount.toString()} ${order.joinRequest.channel.currency}*\n\n` +
          `Kanal sahibi kontrol edip onayladığında *${order.joinRequest.channel.name}* ` +
          `kanalına alınacaksın. Onay genelde kısa sürer.`,
        { parse_mode: 'Markdown' },
      );
    } catch (err) {
      console.error('[receipt upload]', err);
      await ctx.reply(
        'Dekont yüklenirken bir sorun oluştu. Lütfen tekrar dene ya da ' +
          'kanal sahibi ile iletişime geç.',
      );
    }
  });

  // ============================================================
  // Hata yakalayıcı
  // ============================================================
  bot.catch((err) => {
    console.error('[bot-engine error]', err.error, 'update:', err.ctx?.update);
  });
}
