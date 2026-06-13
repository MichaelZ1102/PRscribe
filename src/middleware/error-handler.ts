import type { Context } from 'hono';
import type { StatusCode } from 'hono/utils/http-status';

// 统一错误响应格式
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    status: number;
  };
}

// 全局错误处理中间件
export async function errorHandler(c: Context, next: () => Promise<void>) {
  try {
    await next();
  } catch (err) {
    const error = err as Error;
    console.error(`[ERROR] ${error.message}`, error.stack);

    const response: ErrorResponse = {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        status: 500,
      },
    };

    c.status(500 as StatusCode);
    return c.json(response);
  }
}
