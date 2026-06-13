/**
 * LLM Client — OpenAI SDK 接入模块
 *
 * 封装 OpenAI Chat Completions API 调用，提供：
 * - GPT-4o-mini 模型调用（默认）
 * - 20 秒超时控制
 * - 分类错误处理（超时/限流/认证/API 错误/空响应）
 * - Token 用量统计
 *
 * 相比 callOpenAI() 函数式 API，LLMClient 提供：
 * - 面向对象接口，注入式配置
 * - 更丰富的响应（含 token 用量）
 * - 统一配置管理
 *
 * @example
 * ```typescript
 * import { LLMClient } from './llm-client/index.js';
 *
 * const client = new LLMClient({ apiKey: process.env.OPENAI_API_KEY! });
 *
 * const result = await client.generate({
 *   systemPrompt: '你是一个专业的 PR 描述生成器。',
 *   userPrompt: '请根据以下 diff 生成 PR 描述：\n...',
 * });
 * console.log(result.content);
 * ```
 */

import OpenAI from 'openai';
import type { LLMClientConfig, LLMClientRequest, LLMClientResponse } from './types.js';
import {
  LLMError,
  LLMTimeoutError,
  LLMRateLimitError,
  LLMAuthError,
} from './errors.js';

/** 默认配置 */
const DEFAULTS = {
  model: 'gpt-4o-mini',
  temperature: 0.3,
  maxTokens: 2000,
  timeout: 20_000, // 20 秒
} as const;

/**
 * LLM 客户端
 *
 * 创建实例后调用 `generate()` 方法来生成文本。
 * 每个实例持有独立的 OpenAI 客户端连接，适合用于非降级场景。
 */
export class LLMClient {
  private readonly client: OpenAI;
  private readonly config: Required<LLMClientConfig>;

  /**
   * @param config - 客户端配置（至少需要 apiKey）
   */
  constructor(config: LLMClientConfig) {
    this.config = {
      apiKey: config.apiKey,
      model: config.model ?? DEFAULTS.model,
      temperature: config.temperature ?? DEFAULTS.temperature,
      maxTokens: config.maxTokens ?? DEFAULTS.maxTokens,
      timeout: config.timeout ?? DEFAULTS.timeout,
    };

    // OpenAI SDK 构造，设置超时并关闭 SDK 内部重试（由上层 Orchestrator 控制）
    this.client = new OpenAI({
      apiKey: this.config.apiKey,
      timeout: this.config.timeout,
      maxRetries: 0,
    });
  }

  /** 获取当前配置（只读副本） */
  getConfig(): Readonly<Required<LLMClientConfig>> {
    return { ...this.config };
  }

  /**
   * 调用 LLM 生成内容
   *
   * @param request - 包含 systemPrompt 和 userPrompt 的请求
   * @returns 生成的文本内容及模型/用量信息
   * @throws {LLMTimeoutError} 请求超时
   * @throws {LLMRateLimitError} API 限流
   * @throws {LLMAuthError} API Key 无效
   * @throws {LLMError} 其他 API 或解析错误
   */
  async generate(request: LLMClientRequest): Promise<LLMClientResponse> {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: request.systemPrompt },
      { role: 'user', content: request.userPrompt },
    ];

    try {
      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages,
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
      });

      return this.parseResponse(response);
    } catch (error) {
      // 如果已经是我们的自定义错误，直接透传
      if (error instanceof LLMError) {
        throw error;
      }

      this.handleAPIError(error);
    }
  }

  // ============================================================
  // 私有方法
  // ============================================================

  /** 解析 OpenAI API 成功响应 */
  private parseResponse(
    response: OpenAI.Chat.Completions.ChatCompletion,
  ): {
    content: string;
    model: string;
    usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  } {
    const choice = response.choices?.[0];
    const content = choice?.message?.content;

    if (!content || content.trim().length === 0) {
      throw new LLMError(
        'LLM 返回内容为空，请检查输入或重试',
        'INVALID_RESPONSE',
      );
    }

    return {
      content,
      model: response.model,
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : undefined,
    };
  }

  /** 将 OpenAI SDK 抛出的错误映射为结构化自定义错误 */
  private handleAPIError(error: unknown): never {
    // OpenAI SDK 的 APIError
    if (error instanceof OpenAI.APIError) {
      switch (error.status) {
        case 401:
          throw new LLMAuthError();
        case 429: {
          const retryAfter = error.headers?.['retry-after-ms']
            ? Number(error.headers['retry-after-ms']) / 1000
            : error.headers?.['retry-after']
              ? Number(error.headers['retry-after'])
              : undefined;
          throw new LLMRateLimitError(retryAfter);
        }
        default: {
          const status = error.status ?? 0;
          throw new LLMError(
            `OpenAI API 返回错误 [${status}]: ${error.message}`,
            'API_ERROR',
            status,
          );
        }
      }
    }

    // 网络/超时错误
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();

      if (
        msg.includes('timeout') ||
        msg.includes('timed out') ||
        msg.includes('etimedout') ||
        msg.includes('abort')
      ) {
        throw new LLMTimeoutError(this.config.timeout);
      }

      if (
        msg.includes('econnrefused') ||
        msg.includes('enotfound') ||
        msg.includes('econnreset') ||
        msg.includes('network')
      ) {
        throw new LLMError(
          `网络连接失败: ${error.message}`,
          'API_ERROR',
        );
      }
    }

    // 兜底未知错误
    throw new LLMError(
      `LLM 调用发生未知错误: ${error instanceof Error ? error.message : String(error)}`,
      'API_ERROR',
    );
  }
}
