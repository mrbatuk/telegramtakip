import Fastify, { type FastifyInstance, type FastifyError } from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import sensible from '@fastify/sensible';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import formbody from '@fastify/formbody';
import rateLimit from '@fastify/rate-limit';
import { Redis } from 'ioredis';
import { config, isDev } from './config.js';
import { getLocalUploadsDir } from './lib/storage.js';
import { registerAuth } from './plugins/auth.js';
import { registerAuthRoutes } from './routes/auth.js';
import {
  registerBotRoutes,
  registerChannelRoutes,
  registerPackageRoutes,
} from './routes/bots.js';
import { registerWebhookRoutes } from './routes/webhook.js';
import { registerOrderRoutes } from './routes/orders.js';
import { registerMembershipRoutes } from './routes/memberships.js';
import { registerPaymentMethodRoutes } from './routes/paymentMethods.js';
import { registerPaymentRoutes } from './routes/payment.js';
import { registerAdminRoutes } from './routes/admin/index.js';
import { registerSubscriptionRoutes } from './routes/subscription.js';
import { registerSubscriptionUpgradeRoutes } from './routes/subscriptionUpgrade.js';
import { registerProfileRoutes } from './routes/profile.js';
import { registerOnboardingRoutes } from './routes/onboarding.js';
import { registerSubscriptionPaymentRoutes } from './routes/subscriptionPayment.js';
import { registerPublicPlansRoutes } from './routes/publicPlans.js';

export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: isDev
      ? {
          level: config.LOG_LEVEL,
          transport: {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss',
              ignore: 'pid,hostname',
            },
          },
        }
      : { level: config.LOG_LEVEL },
    trustProxy: true,
    bodyLimit: 10 * 1024 * 1024,
  });

  await app.register(sensible);

  // Rate limit — Redis backend (multi-instance güvenli, restart-persistent).
  // Redis'e bağlanamazsa in-memory'e düşer.
  const rateLimitRedis = (() => {
    try {
      const u = new URL(config.REDIS_URL);
      return new Redis({
        host: u.hostname,
        port: u.port ? parseInt(u.port, 10) : 6379,
        ...(u.password && { password: decodeURIComponent(u.password) }),
        ...(u.username && { username: decodeURIComponent(u.username) }),
        connectTimeout: 500,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        // Rate limit için özel anahtar prefix
        keyPrefix: 'ratelimit:',
      });
    } catch {
      return undefined;
    }
  })();

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    hook: 'preHandler',
    redis: rateLimitRedis,
    errorResponseBuilder: (_req, context) => ({
      statusCode: 429,
      error: 'rate_limit',
      message: `Çok fazla istek — ${context.after} sonra tekrar dene`,
    }),
  });

  await app.register(cors, {
    origin: [config.PUBLIC_WEB_URL],
    credentials: true,
  });

  await app.register(jwt, {
    secret: config.JWT_SECRET,
    sign: { expiresIn: config.JWT_EXPIRES_IN },
  });

  // PayTR IPN form-urlencoded gönderir
  await app.register(formbody);

  await app.register(multipart, {
    limits: {
      fileSize: 8 * 1024 * 1024,
      files: 1,
    },
  });

  // Lokal upload klasörünü serve et (R2 yoksa fallback)
  await app.register(fastifyStatic, {
    root: getLocalUploadsDir(),
    prefix: '/uploads/',
    decorateReply: false,
  });

  await registerAuth(app);

  app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: config.NODE_ENV,
  }));

  await app.register(async (api) => {
    await registerAuthRoutes(api);
    await api.register(registerPublicPlansRoutes);
    await api.register(registerBotRoutes);
    await api.register(registerChannelRoutes);
    await api.register(registerPackageRoutes);
    await api.register(registerOrderRoutes);
    await api.register(registerMembershipRoutes);
    await api.register(registerPaymentMethodRoutes);
    await api.register(registerSubscriptionRoutes);
    await api.register(registerSubscriptionUpgradeRoutes);
    await api.register(registerProfileRoutes);
    await api.register(registerOnboardingRoutes);
    await api.register(registerAdminRoutes);
  }, { prefix: '/api/v1' });

  // Telegram webhook (auth gerektirmez; secret header ile doğrulanır)
  await app.register(registerWebhookRoutes);

  // Ödeme akış URL'leri (auth yok — kullanıcılar dışarıdan erişir)
  await app.register(registerPaymentRoutes);
  await app.register(registerSubscriptionPaymentRoutes);

  app.setErrorHandler((error: FastifyError, request, reply) => {
    request.log.error({ err: error }, 'request failed');

    if (error.validation) {
      return reply.status(400).send({
        error: 'validation_error',
        message: error.message,
        details: error.validation,
      });
    }

    const statusCode = error.statusCode ?? 500;
    return reply.status(statusCode).send({
      error: statusCode >= 500 ? 'internal_error' : 'request_error',
      message: statusCode >= 500 ? 'Sunucu hatası' : error.message,
    });
  });

  return app;
}
