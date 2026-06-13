import { Hono } from 'hono';
import { createRedisClient } from '../queue/redis.js';
import { createAppJWT } from '../github/auth.js';
import { loadConfig } from '../config.js';

const health = new Hono();

// GET /api/v1/health
health.get('/health', async (c) => {
  const config = loadConfig();
  const checks: Record<string, string> = {};

  // Redis 检查
  try {
    const redis = await createRedisClient();
    if (redis) {
      await redis.ping();
      checks.redis = 'connected';
    } else {
      checks.redis = 'disconnected';
    }
  } catch (e) {
    checks.redis = 'disconnected';
  }

  // GitHub App JWT 检查
  try {
    const token = createAppJWT({
      appId: config.github.appId,
      privateKey: config.github.privateKey,
    });
    // JWT 应包含三个用点分隔的部分
    checks.github_app = token && token.split('.').length === 3 ? 'valid' : 'invalid';
  } catch (e: any) {
    checks.github_app = `error: ${e.message}`;
  }

  const allOk = Object.values(checks).every((v) => v === 'connected' || v === 'valid');

  return c.json({
    status: allOk ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    version: '0.1.0',
    checks,
  }, allOk ? 200 : 503);
});

export { health as healthRoute };
