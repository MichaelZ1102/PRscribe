import type { Context } from 'hono';
import { Webhooks } from '@octokit/webhooks';
import { loadConfig } from '../config.js';
import { createRedisClient } from '../queue/redis.js';
import { createQueue } from '../queue/producer.js';
import { registerHandler, routeEvent } from './event-router.js';
import { checkRepoRateLimit } from '../middleware/rate-limiter.js';
import type { QueueJobData } from '../types/index.js';

// 延迟初始化，确保 dotenv 已加载
let webhooksInstance: Webhooks | null = null;

function getWebhooks(): Webhooks {
  if (!webhooksInstance) {
    const config = loadConfig();
    webhooksInstance = new Webhooks({ secret: config.github.webhookSecret });
  }
  return webhooksInstance;
}

// ===== 事件处理器注册 =====

registerHandler({
  event: 'pull_request',
  actions: ['opened', 'synchronize'],
  async handle(payload, _deliveryId, redis) {
    const owner = payload.repository.owner.login;
    const repo = payload.repository.name;
    const pullNumber = payload.pull_request.number;
    const deliveryId = _deliveryId;

    // 仓库级别限流
    if (redis) {
      const ok = await checkRepoRateLimit(redis, owner, repo);
      if (!ok) {
        console.log(`[RateLimit] ${owner}/${repo} 已达到每日上限`);
        return true;
      }
    }

    // 入队
    const queue = createQueue();
    await queue.add('generate-pr-description', {
      installationId: payload.installation?.id,
      owner,
      repo,
      pullNumber,
      action: payload.action,
      deliveryId,
      attempt: 1,
    } as QueueJobData);

    console.log(`[Webhook] PR #${pullNumber} ${payload.action} → 已入队列`);

    // 标记 delivery_id（TTL 24h）
    if (redis) {
      await redis.set(`delivery:${deliveryId}`, '1', 'EX', 86400);
    }

    return true;
  },
});

registerHandler({
  event: 'installation',
  actions: ['created', 'deleted'],
  async handle(payload, _deliveryId, redis) {
    const installationId = payload.installation?.id;
    const account = payload.installation?.account?.login;
    const action = payload.action;
    const deliveryId = _deliveryId;

    console.log(`[Webhook] App ${action}: installation=${installationId}, account=${account}`);

    if (redis && action === 'created') {
      await redis.hset(`installation:${installationId}`, {
        account: account || 'unknown',
        created_at: new Date().toISOString(),
      });
    } else if (redis && action === 'deleted') {
      await redis.del(`installation:${installationId}`);
    }

    if (redis) {
      await redis.set(`delivery:${deliveryId}`, '1', 'EX', 86400);
    }

    return true;
  },
});

// ===== Webhook 端点 =====

export async function handleWebhook(c: Context): Promise<Response> {
  const body = await c.req.text();
  const signature = c.req.header('x-hub-signature-256');
  const eventType = c.req.header('x-github-event');
  const deliveryId = c.req.header('x-github-delivery');

  // 1. 签名验证
  if (!signature) {
    return c.json({ error: { code: 'INVALID_SIGNATURE', message: 'Missing signature', status: 400 } }, 400);
  }

  try {
    await getWebhooks().verify(body, signature);
  } catch {
    return c.json({ error: { code: 'INVALID_SIGNATURE', message: 'Signature verification failed', status: 400 } }, 400);
  }

  if (!eventType || !deliveryId) {
    return c.json({ error: { code: 'MISSING_HEADER', message: 'Missing x-github-event or x-github-delivery', status: 400 } }, 400);
  }

  // 2. 幂等性检查（复用长连接）
  const redis = await createRedisClient();
  if (redis) {
    const alreadyProcessed = await redis.get(`delivery:${deliveryId}`);
    if (alreadyProcessed) {
      return c.json({ error: { code: 'IDEMPOTENCY_REPLAY', message: 'Event already processed', status: 200 } }, 200);
    }
  }

  // 3. 路由事件（注意：不再 closeRedis，保持长连接）
  try {
    const payload = JSON.parse(body);
    const handled = await routeEvent(eventType, payload, deliveryId, redis);

    if (!handled) {
      console.log(`[Webhook] 未处理的事件: ${eventType}/${payload.action}`);
    }
  } catch (err) {
    console.error('[Webhook] payload 解析失败:', err);
    return c.json({ error: { code: 'INVALID_PAYLOAD', message: 'Invalid JSON payload', status: 400 } }, 400);
  }

  return c.json({ status: 'accepted', message: 'Webhook received', deliveryId }, 202);
}
