/**
 * AI PR 描述生成器 — Vercel Serverless Function 入口
 *
 * 完整布线:
 *   POST /api/webhook  →  GitHub Webhook 接收
 *   GET  /api/health   →  健康检查
 *
 * 数据流:
 *   Webhook → Signature Verify → Event Router
 *    → Diff Fetcher → LLM Client → Comment Publisher
 */
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { handle } from 'hono/vercel'
import { webhookRoute } from '../src/github-app/routes/webhook.js'
import { healthRoute } from '../src/github-app/routes/health.js'

const app = new Hono()

// Middleware
app.use('*', cors())

// Mount routes
app.route('/api', webhookRoute)  // POST /api/webhook
app.route('/api', healthRoute)   // GET  /api/health

// 404 handler
app.notFound((c) => {
  return c.json({
    error: { code: 'NOT_FOUND', message: 'Route not found', status: 404 },
  }, 404)
})

// Error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err)
  return c.json({
    error: { code: 'INTERNAL_ERROR', message: 'Internal server error', status: 500 },
  }, 500)
})

// Export Vercel handler
export default handle(app)
