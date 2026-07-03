// BullMQ bağlantı parametreleri.
// BullMQ kendi içinde ioredis instance'ı oluşturur — biz sadece bağlantı bilgisi veriyoruz.

import type { ConnectionOptions } from 'bullmq';
import { config } from '../config.js';

let parsed: { host: string; port: number; password?: string; username?: string; db?: number } | null =
  null;

function parseRedisUrl() {
  if (parsed) return parsed;
  const u = new URL(config.REDIS_URL);
  parsed = {
    host: u.hostname,
    port: u.port ? parseInt(u.port, 10) : 6379,
    ...(u.password && { password: decodeURIComponent(u.password) }),
    ...(u.username && { username: decodeURIComponent(u.username) }),
    ...(u.pathname && u.pathname.length > 1 && {
      db: parseInt(u.pathname.slice(1), 10),
    }),
  };
  return parsed;
}

export function getConnectionOptions(): ConnectionOptions {
  return {
    ...parseRedisUrl(),
    maxRetriesPerRequest: null, // BullMQ gerektirir
    enableReadyCheck: false,
  };
}

// Eski API uyumluluğu için stub (artık kullanılmıyor)
export async function closeRedisConnection(): Promise<void> {
  // BullMQ kendi bağlantısını yönetiyor
}
