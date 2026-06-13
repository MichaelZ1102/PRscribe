import { Queue } from 'bullmq';
import { loadConfig } from '../config.js';
import { createRedisClient } from './redis.js';
import type { QueueJobData } from '../types/index.js';

let descriptionQueue: Queue<QueueJobData> | null = null;

export function createQueue(): Queue<QueueJobData> {
  if (descriptionQueue) return descriptionQueue;

  const config = loadConfig();
  const connection = {
    url: config.redis.url,
  };

  descriptionQueue = new Queue<QueueJobData>('pr-description', {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 3000,
      },
      removeOnComplete: 100,
      removeOnFail: 50,
    },
  });

  return descriptionQueue;
}

export async function closeQueue(): Promise<void> {
  if (descriptionQueue) {
    await descriptionQueue.close();
    descriptionQueue = null;
  }
}
