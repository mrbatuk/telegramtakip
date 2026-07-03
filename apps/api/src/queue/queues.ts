// Tüm BullMQ queue tanımları tek dosyada.

import { Queue } from 'bullmq';
import { getConnectionOptions } from './connection.js';

export const QUEUE_NAMES = {
  KICK_EXPIRED: 'kick-expired-member',
  EXPIRE_ORDER: 'expire-pending-order',
  EXPIRY_WARNING: 'expiry-warning',
} as const;

export interface KickExpiredJobData {
  membershipId: string;
}

export interface ExpireOrderJobData {
  orderId: string;
}

export interface ExpiryWarningJobData {
  membershipId: string;
  daysBefore: number;
}

let kickQueue: Queue<KickExpiredJobData> | null = null;
let expireOrderQueue: Queue<ExpireOrderJobData> | null = null;
let expiryWarningQueue: Queue<ExpiryWarningJobData> | null = null;

export function getKickQueue(): Queue<KickExpiredJobData> {
  if (kickQueue) return kickQueue;
  kickQueue = new Queue<KickExpiredJobData>(QUEUE_NAMES.KICK_EXPIRED, {
    connection: getConnectionOptions(),
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: 'exponential', delay: 30_000 },
      removeOnComplete: { age: 7 * 24 * 3600, count: 1000 },
      removeOnFail: { age: 30 * 24 * 3600 },
    },
  });
  return kickQueue;
}

export function getExpireOrderQueue(): Queue<ExpireOrderJobData> {
  if (expireOrderQueue) return expireOrderQueue;
  expireOrderQueue = new Queue<ExpireOrderJobData>(QUEUE_NAMES.EXPIRE_ORDER, {
    connection: getConnectionOptions(),
    defaultJobOptions: {
      attempts: 3,
      removeOnComplete: { age: 7 * 24 * 3600 },
      removeOnFail: { age: 30 * 24 * 3600 },
    },
  });
  return expireOrderQueue;
}

export function getExpiryWarningQueue(): Queue<ExpiryWarningJobData> {
  if (expiryWarningQueue) return expiryWarningQueue;
  expiryWarningQueue = new Queue<ExpiryWarningJobData>(QUEUE_NAMES.EXPIRY_WARNING, {
    connection: getConnectionOptions(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 60_000 },
      removeOnComplete: { age: 30 * 24 * 3600, count: 1000 },
      removeOnFail: { age: 30 * 24 * 3600 },
    },
  });
  return expiryWarningQueue;
}

export async function closeQueues(): Promise<void> {
  if (kickQueue) await kickQueue.close();
  if (expireOrderQueue) await expireOrderQueue.close();
  if (expiryWarningQueue) await expiryWarningQueue.close();
  kickQueue = null;
  expireOrderQueue = null;
  expiryWarningQueue = null;
}
