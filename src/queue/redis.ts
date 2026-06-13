/**
 * Redis 连接管理
 * 
 * 使用模块级单例，保持长连接。所有模块共享同一个 Redis 连接。
 * 不要在请求处理中频繁调用 closeRedis()，除非应用即将退出。
 */
import Redis from 'ioredis';
import { loadConfig } from '../config.js';

let redisClient: Redis | null = null;

export async function createRedisClient(): Promise<Redis | null> {
  if (redisClient) {
    if (redisClient.status === 'ready' || redisClient.status === 'connecting') {
      return redisClient;
    }
    // 连接异常断开，重建
    redisClient = null;
  }

  try {
    const config = loadConfig();
    redisClient = new Redis(config.redis.url, {
      maxRetriesPerRequest: 2,
      retryStrategy(times) {
        if (times > 2) return null;
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
      connectTimeout: 5000,
      keepAlive: 10000,         // 保持长连接
      enableReadyCheck: true,
    });

    redisClient.on('error', (err) => {
      console.error('[Redis] 连接错误:', err.message);
    });

    await redisClient.connect();
    console.log('[Redis] 长连接已建立');
    return redisClient;
  } catch (err) {
    console.error('[Redis] 连接失败:', err);
    return null;
  }
}

export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    console.log('[Redis] 连接已关闭');
  }
}
