import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import { z } from 'zod';

// Monorepo root .env'i bul (apps/api/src/config.ts → ../../../.env)
const __dirname = dirname(fileURLToPath(import.meta.url));
const candidates = [
  join(__dirname, '..', '..', '..', '.env'),
  join(__dirname, '..', '..', '.env'),
  join(process.cwd(), '.env'),
];
for (const p of candidates) {
  if (existsSync(p)) {
    loadEnv({ path: p });
    break;
  }
}

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(3001),
  PUBLIC_API_URL: z.string().url().default('http://localhost:3001'),
  PUBLIC_WEB_URL: z.string().url().default('http://localhost:3000'),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET en az 32 karakter olmalı'),
  JWT_EXPIRES_IN: z.string().default('7d'),

  ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, 'ENCRYPTION_KEY 64 hex karakter olmalı (32 byte)'),

  TELEGRAM_WEBHOOK_BASE_URL: z.string().url(),

  R2_ACCOUNT_ID: z.string().optional().default(''),
  R2_ACCESS_KEY_ID: z.string().optional().default(''),
  R2_SECRET_ACCESS_KEY: z.string().optional().default(''),
  R2_BUCKET: z.string().optional().default(''),
  R2_PUBLIC_URL: z.string().optional().default(''),

  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),

  // Email (SMTP) — boş bırakılırsa dev modunda konsola yazılır
  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z
    .string()
    .transform((v) => v === 'true' || v === '1')
    .default('false'),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  EMAIL_FROM_NAME: z.string().default('TelegramTakip'),
  EMAIL_FROM_ADDRESS: z.string().email().default('noreply@example.com'),

  ADMIN_NOTIFICATION_EMAIL: z
    .string()
    .email()
    .optional()
    .or(z.literal(''))
    .default(''),

  // Frontend admin panel URL slug'ı (email link'lerinde kullanılır)
  // Frontend'deki apps/web/src/lib/admin-path.ts ile aynı olmalı
  ADMIN_URL_PATH: z.string().default('/k9m-x7f2-avq'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('Geçersiz ortam değişkenleri:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;

export const isProd = config.NODE_ENV === 'production';
export const isDev = config.NODE_ENV === 'development';
