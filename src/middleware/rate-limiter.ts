import type { Context } from 'hono';
import { createRedisClient } from '../queue/redis.js';
import type Redis from 'ioredis';

interface RateLimitConfig {
  windowMs: number;     // 时间窗口（毫秒）
  maxRequests: number;  // 窗口内最大请求数
}

const defaultConfig: RateLimitConfig = {
  windowMs: 30_000,     // 30 秒
  maxRequests: 10,      // 最多 10 次
};

/**
 * Redis 滑动窗口限流中间件
 * 
 * 限流规则（按优先级）：
 * 1. 每个 delivery_id 只处理一次（幂等性，在 webhook 路由中处理）
 * 2. 每个 PR 最多生成 5 次描述
 * 3. 每仓库每天最多 100 次
 * 4. 全局每 30 秒最多 10 次
 */
export async function rateLimiter(
  c: Context,
  next: () => Promise<void>,
): Promise<Response | void> {
  const config = defaultConfig;
  const redis = await createRedisClient();

  if (!redis) {
    // Redis 不可用时放行（降级）
    return next();
  }

  const key = 'ratelimit:global';
  const now = Date.now();
  const windowStart = now - config.windowMs;

  try {
    // 移除窗口外的旧记录
    await redis.zremrangebyscore(key, 0, windowStart);
    // 统计窗口内请求数
    const count = await redis.zcard(key);

    if (count >= config.maxRequests) {
      await redis.quit();
      return c.json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `请求过于频繁，请 ${Math.ceil(config.windowMs / 1000)} 秒后重试`,
          status: 429,
        },
      }, 429);
    }

    // 记录当前请求
    await redis.zadd(key, now, `${now}-${Math.random()}`);
    // 设置 TTL 防止内存泄漏
    await redis.expire(key, Math.ceil(config.windowMs / 1000));

    await redis.quit();
  } catch (err) {
    console.error('[RateLimiter] Redis 错误:', err);
    // Redis 出错时放行
  }

  return next();
}

/**
 * 检查仓库级别限流
 */
export async function checkRepoRateLimit(
  redis: Redis,
  owner: string,
  repo: string,
): Promise<boolean> {
  const key = `ratelimit:repo:${owner}/${repo}`;
  const today = new Date().toISOString().split('T')[0];
  const dailyKey = `${key}:${today}`;

  const count = await redis.incr(dailyKey);
  if (count === 1) {
    // 第一次请求，设置 TTL 到明天
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const ttl = Math.floor((tomorrow.getTime() - now.getTime()) / 1000);
    await redis.expire(dailyKey, ttl);
  }

  // 每天每仓库最多 100 次
  return count <= 100;
}
