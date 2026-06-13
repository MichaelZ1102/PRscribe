import { Hono } from 'hono';
import { handleWebhook } from './webhook-handler.js';
import { rateLimiter } from '../middleware/rate-limiter.js';

const webhook = new Hono();

// POST /api/v1/webhook — 限流 + Webhook 处理
webhook.post('/webhook', rateLimiter, async (c) => {
  return handleWebhook(c);
});

export { webhook as webhookRoute };
