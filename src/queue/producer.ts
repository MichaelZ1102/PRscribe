import { Queue } from 'bullmq';
import { loadConfig } from '../config.js';
import type { QueueJobData } from '../types/index.js';

let descriptionQueue: Queue<QueueJobData> | null = null;

/**
 * 解析 Redis URL 为 BullMQ 兼容的连接配置
 * 支持 redis:// 和 rediss:// (TLS) 格式
 */
function parseRedisUrl(url: string) {
  const parsed = new URL(url);
  const isTls = parsed.protocol === 'rediss:';
  const port = parseInt(parsed.port || (isTls ? '6380' : '6379'), 10);

  return {
    host: parsed.hostname,
    port,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    ...(isTls ? { tls: {} } : {}),
    maxRetriesPerRequest: null,  // BullMQ 需要
    enableReadyCheck: false,
  };
}

export function createQueue(): Queue<QueueJobData> {
  if (descriptionQueue) return descriptionQueue;

  const config = loadConfig();
  const connection = parseRedisUrl(config.redis.url);

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
