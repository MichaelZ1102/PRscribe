import { Hono } from 'hono';
import { handleWebhook } from './webhook-handler.js';

const webhook = new Hono();

// POST /api/v1/webhook
webhook.post('/webhook', async (c) => {
  return handleWebhook(c);
});

export { webhook as webhookRoute };
