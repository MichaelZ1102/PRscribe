import 'dotenv/config';
import * as Sentry from '@sentry/node';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { loadConfig } from './config.js';
import { healthRoute } from './routes/health.js';
import { webhookRoute } from './routes/webhook.js';
import { errorHandler } from './middleware/error-handler.js';
import { startConsumer } from './queue/consumer.js';
import { createQueue } from './queue/producer.js';
import { closeRedis } from './queue/redis.js';

const config = loadConfig();

// 预初始化队列（避免 Webhook 请求时创建连接导致超时）
createQueue();
console.log('[Queue] 队列已预初始化');

// Sentry 初始化
if (config.sentry?.dsn) {
  Sentry.init({
    dsn: config.sentry.dsn,
    environment: config.nodeEnv,
    tracesSampleRate: config.nodeEnv === 'production' ? 0.1 : 0,
  });
}

const app = new Hono();

// 全局中间件
app.use('/api/*', cors());
app.use(errorHandler);

// 路由
app.route('/api/v1', webhookRoute);
app.route('/api/v1', healthRoute);

// 启动队列消费者
const worker = startConsumer();

// 启动
serve(
  {
    fetch: app.fetch,
    port: config.port,
  },
  (info) => {
    console.log(`🚀 PR 描述生成器已启动: http://localhost:${info.port}`);
    console.log(`📋 环境: ${config.nodeEnv}`);
    console.log(`🤖 模型: ${config.llm.model}`);
    console.log(`🔗 LLM API: ${config.llm.baseUrl}`);
    console.log(`⚙️  队列消费者: 运行中`);
  },
);

// 优雅关闭
process.on('SIGTERM', async () => {
  console.log('正在关闭...');
  await worker.close();
  await closeRedis();
  process.exit(0);
});

export default app;
