import { z } from 'zod';
import type { AppConfig } from './types/index.js';

// 环境变量 Zod Schema
const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // GitHub（允许开发环境为空，启动时提示但不退出）
  GITHUB_APP_ID: z.string().optional(),
  GITHUB_PRIVATE_KEY: z.string().optional(),
  GITHUB_WEBHOOK_SECRET: z.string().optional(),

  // LLM
  LLM_API_KEY: z.string().optional(),
  LLM_BASE_URL: z.string().default('https://api.openai.com/v1'),
  LLM_MODEL: z.string().default('gpt-4o-mini'),
  LLM_TEMPERATURE: z.coerce.number().default(0.3),
  LLM_MAX_TOKENS: z.coerce.number().default(2000),

  // Redis（允许为空，降级运行）
  REDIS_URL: z.string().optional(),

  // Sentry
  SENTRY_DSN: z.string().optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function loadConfig(): AppConfig {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.warn('⚠️  部分环境变量缺失，将以降级模式运行:');
    for (const issue of result.error.issues) {
      console.warn(`  - ${issue.path.join('.')}: ${issue.message}`);
    }
    // 使用部分配置继续运行
    return buildConfig(envSchema.parse({}));
  }

  return buildConfig(result.data);
}

function buildConfig(env: EnvConfig): AppConfig {
  return {
    port: env.PORT,
    nodeEnv: env.NODE_ENV,

    github: {
      appId: env.GITHUB_APP_ID || '',
      privateKey: (env.GITHUB_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      webhookSecret: env.GITHUB_WEBHOOK_SECRET || '',
    },

    llm: {
      apiKey: env.LLM_API_KEY || '',
      baseUrl: env.LLM_BASE_URL,
      model: env.LLM_MODEL,
      temperature: env.LLM_TEMPERATURE,
      maxTokens: env.LLM_MAX_TOKENS,
      timeout: 15_000,
    },

    redis: {
      url: env.REDIS_URL || '',
    },

    sentry: env.SENTRY_DSN ? { dsn: env.SENTRY_DSN } : undefined,
  };
}
