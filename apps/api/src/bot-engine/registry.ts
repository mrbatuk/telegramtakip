// Multi-tenant Telegram Bot kayıt defteri.
// Bot instance'larını bot_id'ye göre cache'ler. Bot silinince invalidate.

import { Bot, type Context } from 'grammy';
import { prisma } from '@tt/db';
import { decrypt } from '../lib/crypto.js';
import { setupBotHandlers, type TenantBotContext } from './handlers.js';

interface CachedBot {
  bot: Bot<TenantBotContext>;
  botRecordId: string;
  botUsername: string;
  webhookSecret: string;
}

const cache = new Map<string, CachedBot>();

export async function getBot(botId: string): Promise<CachedBot | null> {
  const cached = cache.get(botId);
  if (cached) return cached;

  const record = await prisma.bot.findUnique({
    where: { id: botId, isActive: true },
    select: {
      id: true,
      botToken: true,
      botUsername: true,
      webhookSecret: true,
      tenantId: true,
    },
  });

  if (!record) return null;

  const token = decrypt(record.botToken);
  const bot = new Bot<TenantBotContext>(token);

  bot.use(async (ctx, next) => {
    ctx.botRecordId = record.id;
    ctx.tenantId = record.tenantId;
    await next();
  });

  setupBotHandlers(bot);

  // grammY init (botInfo dahili — daha sonra getMe yerine cache'ten)
  await bot.init();

  const entry: CachedBot = {
    bot,
    botRecordId: record.id,
    botUsername: record.botUsername,
    webhookSecret: record.webhookSecret,
  };

  cache.set(botId, entry);
  return entry;
}

export function invalidateBot(botId: string): void {
  cache.delete(botId);
}

export function clearBotCache(): void {
  cache.clear();
}

// Test/debug için
export function getCachedBotCount(): number {
  return cache.size;
}
