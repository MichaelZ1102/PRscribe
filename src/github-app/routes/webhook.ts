// ============================================================================
// GitHub Webhook 接收端点
// ============================================================================
// P2-01: POST /api/webhook — 接收 GitHub 发出的 Webhook 事件
// ============================================================================

import { Hono } from 'hono';
import { webhookSignature } from '../middleware/index.js';
import { eventRouter } from '../services/event-router.js';

export const webhookRoute = new Hono();

/**
 * POST /api/webhook
 * 接收 GitHub Webhook 事件。
 *
 * 中间件链:
 *   1. webhookSignature — 验证 x-hub-signature-256 (P2-02)
 *
 * Headers:
 *   x-github-event       事件类型（如 pull_request）
 *   x-github-delivery    事件唯一 ID
 *   x-hub-signature-256  Webhook 签名（SHA256），验证用（P2-02）
 *
 * Body: GitHub Webhook 事件 payload（JSON）
 */
webhookRoute.post('/webhook', webhookSignature, async (c) => {
  const githubEvent = c.req.header('x-github-event') || 'unknown';
  const deliveryId = c.req.header('x-github-delivery') || 'unknown';

  // 复用中间件已解析的 body（避免重复读取）
  let payload: Record<string, unknown>;
  const parsedBody = (c as any).get("parsedBody") as Record<string, unknown> | undefined;
  if (parsedBody) {
    payload = parsedBody;
  } else {
    try {
      payload = await c.req.json();
    } catch {
      return c.json(
        { error: { code: 'INVALID_JSON', message: '请求体必须是有效的 JSON', status: 400 } },
        400,
      );
    }
  }

  // 记录接收日志
  console.log(
    `[Webhook] 收到事件 | event=${githubEvent} | delivery=${deliveryId} | repo=${(payload as any)?.repository?.full_name || 'unknown'}`,
  );

  // P2-04: 事件路由器（按 x-github-event 分发）
  // 异步处理，不阻塞 200 响应
  eventRouter.handle(githubEvent, payload as any).then((result) => {
    if (!result.handled) {
      console.log(`[Webhook] 未找到处理器 | event=${githubEvent}`);
    } else if (!result.success) {
      console.error(`[Webhook] 处理失败 | event=${githubEvent} | error=${result.error}`);
    }
  }).catch((err) => {
    console.error(`[Webhook] 异步处理异常 | event=${githubEvent} | error=${(err as Error).message}`);
  });

  // 返回 200 — GitHub 期望迅速收到成功响应
  return c.json({
    status: 'accepted',
    event: githubEvent,
    delivery: deliveryId,
    message: 'Webhook 已接收，处理中',
  });
});
