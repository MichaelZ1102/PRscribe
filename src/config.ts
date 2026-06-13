import { z } from 'zod';
import type { AppConfig } from './types/index.js';

// 环境变量 Zod Schema
const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // GitHub
  GITHUB_APP_ID: z.string().min(1),
  GITHUB_PRIVATE_KEY: z.string().min(1),
  GITHUB_WEBHOOK_SECRET: z.string().min(1),

  // LLM — 支持任何 OpenAI 兼容 API
  LLM_API_KEY: z.string().min(1, '需要 LLM_API_KEY（OpenAI / OpenRouter / DeepSeek 等）'),
  LLM_BASE_URL: z.string().default('https://api.openai.com/v1'),  // 可换 OpenRouter / DeepSeek
  LLM_MODEL: z.string().default('gpt-4o-mini'),
  LLM_TEMPERATURE: z.coerce.number().default(0.3),
  LLM_MAX_TOKENS: z.coerce.number().default(2000),

  // Redis
  REDIS_URL: z.string().min(1),

  // Sentry (optional)
  SENTRY_DSN: z.string().optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function loadConfig(): AppConfig {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ 环境变量验证失败:');
    for (const issue of result.error.issues) {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }

  const env = result.data;

  return {
    port: env.PORT,
    nodeEnv: env.NODE_ENV,

    github: {
      appId: env.GITHUB_APP_ID,
      privateKey: env.GITHUB_PRIVATE_KEY.replace(/\\n/g, '\n'),
      webhookSecret: env.GITHUB_WEBHOOK_SECRET,
    },

    llm: {
      apiKey: env.LLM_API_KEY,
      baseUrl: env.LLM_BASE_URL,
      model: env.LLM_MODEL,
      temperature: env.LLM_TEMPERATURE,
      maxTokens: env.LLM_MAX_TOKENS,
      timeout: 15_000,
    },

    redis: {
      url: env.REDIS_URL,
    },

    sentry: env.SENTRY_DSN ? { dsn: env.SENTRY_DSN } : undefined,
  };
}
