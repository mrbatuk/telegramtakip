import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@tt/db';
import { encrypt, decrypt, generateWebhookSecret } from '../lib/crypto.js';
import {
  getBotInfo,
  setBotWebhook,
  deleteBotWebhook,
  TelegramError,
} from '../lib/telegram.js';
import { config } from '../config.js';
import { invalidateBot } from '../bot-engine/registry.js';
import { getLimitsForTenant } from '../lib/plans.js';

const createBotSchema = z.object({
  botToken: z
    .string()
    .regex(/^\d+:[A-Za-z0-9_-]{30,}$/, 'Geçersiz bot token formatı'),
});

function buildWebhookUrl(botId: string): string {
  return `${config.TELEGRAM_WEBHOOK_BASE_URL.replace(/\/$/, '')}/tg/${botId}`;
}

export async function registerBotRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  // GET /bots — tenant'ın botları
  app.get('/bots', async (request) => {
    const bots = await prisma.bot.findMany({
      where: { tenantId: request.tenant!.id },
      select: {
        id: true,
        botUsername: true,
        botName: true,
        isActive: true,
        createdAt: true,
        _count: { select: { channels: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return { bots };
  });

  // POST /bots — yeni bot ekle
  app.post('/bots', async (request, reply) => {
    const parsed = createBotSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'validation_error',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { botToken } = parsed.data;

    // Plan limit kontrolü
    const tenant = await prisma.tenant.findUnique({
      where: { id: request.tenant!.id },
      select: { plan: true, subExpiresAt: true, planOverride: true, _count: { select: { bots: true } } },
    });
    if (!tenant) {
      return reply.status(401).send({ error: 'unauthorized' });
    }
    const limits = await getLimitsForTenant(tenant.plan, tenant.planOverride);
    if (!limits) {
      return reply.status(500).send({ error: 'plan_config_not_found' });
    }
    if (tenant._count.bots >= limits.maxBots) {
      return reply.status(403).send({
        error: 'plan_limit',
        message: `${tenant.plan} planında en fazla ${limits.maxBots} bot ekleyebilirsin. Planı yükselt.`,
      });
    }
    if (tenant.subExpiresAt && tenant.subExpiresAt < new Date()) {
      return reply.status(403).send({
        error: 'subscription_expired',
        message: 'Aboneliğinin süresi dolmuş. Yenilemen gerekiyor.',
      });
    }

    // Token Telegram'da gerçekten geçerli mi + bot bilgilerini al
    let info;
    try {
      info = await getBotInfo(botToken);
    } catch (err) {
      const msg =
        err instanceof TelegramError
          ? err.message
          : 'Bot token doğrulanamadı';
      return reply.status(400).send({
        error: 'invalid_bot_token',
        message: msg,
      });
    }

    // Aynı bot daha önce eklenmiş mi
    const existing = await prisma.bot.findFirst({
      where: {
        tenantId: request.tenant!.id,
        botUsername: info.username,
      },
    });
    if (existing) {
      return reply.status(409).send({
        error: 'bot_already_added',
        message: 'Bu bot zaten ekli',
      });
    }

    const webhookSecret = generateWebhookSecret();
    const encryptedToken = encrypt(botToken);

    const bot = await prisma.bot.create({
      data: {
        tenantId: request.tenant!.id,
        botToken: encryptedToken,
        botUsername: info.username,
        botName: info.first_name,
        webhookSecret,
      },
      select: {
        id: true,
        botUsername: true,
        botName: true,
        isActive: true,
        createdAt: true,
      },
    });

    // Telegram webhook'unu ayarla
    try {
      await setBotWebhook(botToken, buildWebhookUrl(bot.id), webhookSecret);
    } catch (err) {
      // Webhook ayarlanamadıysa bot kaydını silmek yerine uyarı dön
      request.log.warn({ err, botId: bot.id }, 'webhook ayarlanamadı');
      return reply.status(201).send({
        bot,
        warning:
          'Bot kaydedildi ama webhook ayarlanamadı. ' +
          'TELEGRAM_WEBHOOK_BASE_URL doğru mu ve dış dünyaya açık mı?',
      });
    }

    return reply.status(201).send({ bot });
  });

  // DELETE /bots/:id
  app.delete<{ Params: { id: string } }>('/bots/:id', async (request, reply) => {
    const bot = await prisma.bot.findFirst({
      where: { id: request.params.id, tenantId: request.tenant!.id },
    });
    if (!bot) {
      return reply.status(404).send({ error: 'not_found' });
    }

    // Webhook'u temizle
    try {
      const token = decrypt(bot.botToken);
      await deleteBotWebhook(token);
    } catch (err) {
      request.log.warn({ err, botId: bot.id }, 'webhook silinemedi');
    }

    await prisma.bot.delete({ where: { id: bot.id } });
    invalidateBot(bot.id);
    return { ok: true };
  });
}

const createChannelSchema = z.object({
  telegramChatId: z.coerce.number().int(),
  name: z.string().min(1).max(120),
  welcomeMessage: z.string().min(1).max(2000).optional(),
  ibanInfo: z.string().max(500).optional(),
  currency: z.string().length(3).optional(),
});

export async function registerChannelRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  app.get<{ Params: { botId: string } }>(
    '/bots/:botId/channels',
    async (request, reply) => {
      const bot = await prisma.bot.findFirst({
        where: {
          id: request.params.botId,
          tenantId: request.tenant!.id,
        },
      });
      if (!bot) {
        return reply.status(404).send({ error: 'bot_not_found' });
      }
      const channels = await prisma.channel.findMany({
        where: { botId: bot.id },
        include: {
          packages: { orderBy: { sortOrder: 'asc' } },
          _count: {
            select: { joinRequests: true, memberships: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      return {
        channels: channels.map((c) => ({
          ...c,
          telegramChatId: c.telegramChatId.toString(),
        })),
      };
    },
  );

  // Kanal güncelle (welcome mesajı, IBAN, aktif/pasif)
  app.patch<{ Params: { channelId: string } }>(
    '/channels/:channelId',
    async (request, reply) => {
      const channel = await prisma.channel.findFirst({
        where: {
          id: request.params.channelId,
          bot: { tenantId: request.tenant!.id },
        },
      });
      if (!channel) {
        return reply.status(404).send({ error: 'channel_not_found' });
      }

      const parsed = updateChannelSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'validation_error',
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const updated = await prisma.channel.update({
        where: { id: channel.id },
        data: parsed.data,
      });

      return {
        channel: {
          ...updated,
          telegramChatId: updated.telegramChatId.toString(),
        },
      };
    },
  );

  // Kanal sil
  app.delete<{ Params: { channelId: string } }>(
    '/channels/:channelId',
    async (request, reply) => {
      const channel = await prisma.channel.findFirst({
        where: {
          id: request.params.channelId,
          bot: { tenantId: request.tenant!.id },
        },
      });
      if (!channel) {
        return reply.status(404).send({ error: 'channel_not_found' });
      }
      await prisma.channel.delete({ where: { id: channel.id } });
      return { ok: true };
    },
  );

  app.post<{ Params: { botId: string } }>(
    '/bots/:botId/channels',
    async (request, reply) => {
      const bot = await prisma.bot.findFirst({
        where: {
          id: request.params.botId,
          tenantId: request.tenant!.id,
        },
        include: { _count: { select: { channels: true } } },
      });
      if (!bot) {
        return reply.status(404).send({ error: 'bot_not_found' });
      }

      // Plan limit
      const tenant = await prisma.tenant.findUnique({
        where: { id: request.tenant!.id },
        select: { plan: true, planOverride: true },
      });
      const limits = await getLimitsForTenant(tenant!.plan, tenant!.planOverride);
      if (!limits) {
        return reply.status(500).send({ error: 'plan_config_not_found' });
      }
      if (bot._count.channels >= limits.maxChannelsPerBot) {
        return reply.status(403).send({
          error: 'plan_limit',
          message: `${tenant!.plan} planında bot başına en fazla ${limits.maxChannelsPerBot} kanal eklenebilir.`,
        });
      }

      const parsed = createChannelSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'validation_error',
          details: parsed.error.flatten().fieldErrors,
        });
      }

      try {
        const channel = await prisma.channel.create({
          data: {
            botId: bot.id,
            telegramChatId: BigInt(parsed.data.telegramChatId),
            name: parsed.data.name,
            welcomeMessage: parsed.data.welcomeMessage ?? undefined,
            ibanInfo: parsed.data.ibanInfo ?? null,
            currency: parsed.data.currency ?? 'TRY',
          },
        });

        return reply.status(201).send({
          channel: {
            ...channel,
            telegramChatId: channel.telegramChatId.toString(),
          },
        });
      } catch (err: unknown) {
        if (
          err instanceof Error &&
          'code' in err &&
          (err as { code: string }).code === 'P2002'
        ) {
          return reply.status(409).send({
            error: 'channel_exists',
            message: 'Bu kanal bu bot için zaten ekli',
          });
        }
        throw err;
      }
    },
  );
}

const updateChannelSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  welcomeMessage: z.string().min(1).max(2000).optional(),
  ibanInfo: z.string().max(500).nullable().optional(),
  currency: z.string().length(3).optional(),
  isActive: z.boolean().optional(),
});

const createPackageSchema = z.object({
  name: z.string().min(1).max(80),
  price: z.coerce.number().positive(),
  durationDays: z.coerce.number().int().positive().max(3650),
  sortOrder: z.coerce.number().int().min(0).optional(),
});

export async function registerPackageRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  app.post<{ Params: { channelId: string } }>(
    '/channels/:channelId/packages',
    async (request, reply) => {
      const channel = await prisma.channel.findFirst({
        where: {
          id: request.params.channelId,
          bot: { tenantId: request.tenant!.id },
        },
      });
      if (!channel) {
        return reply.status(404).send({ error: 'channel_not_found' });
      }

      const parsed = createPackageSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'validation_error',
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const pkg = await prisma.package.create({
        data: {
          channelId: channel.id,
          name: parsed.data.name,
          price: parsed.data.price,
          durationDays: parsed.data.durationDays,
          sortOrder: parsed.data.sortOrder ?? 0,
        },
      });

      return reply.status(201).send({ package: pkg });
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/packages/:id',
    async (request, reply) => {
      const pkg = await prisma.package.findFirst({
        where: {
          id: request.params.id,
          channel: { bot: { tenantId: request.tenant!.id } },
        },
      });
      if (!pkg) {
        return reply.status(404).send({ error: 'not_found' });
      }
      await prisma.package.delete({ where: { id: pkg.id } });
      return { ok: true };
    },
  );
}
