// Telegram webhook endpoint - tek bir endpoint tüm tenant botlarını handle eder.
// URL pattern: /tg/:botId
// Telegram, setWebhook çağrısında verdiğimiz secret_token'ı
// X-Telegram-Bot-Api-Secret-Token header'ında geri gönderir.

import type { FastifyInstance } from 'fastify';
import { getBot } from '../bot-engine/registry.js';

const SECRET_HEADER = 'x-telegram-bot-api-secret-token';

export async function registerWebhookRoutes(app: FastifyInstance) {
  app.post<{ Params: { botId: string } }>(
    '/tg/:botId',
    async (request, reply) => {
      const { botId } = request.params;
      const cached = await getBot(botId);

      if (!cached) {
        return reply.status(404).send({ error: 'bot_not_found' });
      }

      const providedSecret = request.headers[SECRET_HEADER];
      if (providedSecret !== cached.webhookSecret) {
        request.log.warn({ botId }, 'webhook secret uyuşmadı');
        return reply.status(401).send({ error: 'invalid_secret' });
      }

      try {
        await cached.bot.handleUpdate(request.body as Parameters<typeof cached.bot.handleUpdate>[0]);
      } catch (err) {
        request.log.error({ err, botId }, 'webhook işlem hatası');
        // Telegram retry yapmasın - 200 dön
      }

      return reply.status(200).send({ ok: true });
    },
  );
}
