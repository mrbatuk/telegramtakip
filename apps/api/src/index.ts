import { buildServer } from './server.js';
import { config } from './config.js';
import { startWorkers, stopWorkers } from './queue/workers.js';
import { closeQueues } from './queue/queues.js';
import { closeRedisConnection } from './queue/connection.js';

async function main() {
  const app = await buildServer();

  // BullMQ worker'larını başlat (Faz 1: API ile aynı process)
  startWorkers();

  try {
    await app.listen({ port: config.API_PORT, host: '0.0.0.0' });
    app.log.info(`API ${config.API_PORT} portunda dinleniyor (${config.NODE_ENV})`);
  } catch (err) {
    app.log.error({ err }, 'Sunucu başlatılamadı');
    process.exit(1);
  }

  const shutdown = async (signal: string) => {
    app.log.info(`${signal} sinyali alındı, kapatılıyor...`);
    try {
      await stopWorkers();
      await app.close();
      await closeQueues();
      await closeRedisConnection();
      process.exit(0);
    } catch (err) {
      app.log.error({ err }, 'Kapatma sırasında hata');
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
