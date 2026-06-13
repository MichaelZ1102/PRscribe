import type { Context } from 'hono';
import type { Redis } from 'ioredis';

/**
 * 事件处理器接口
 * 返回 true = 已处理，false = 跳过
 */
export interface EventHandler {
  event: string;
  actions?: string[];
  handle(payload: any, deliveryId: string, redis: Redis | null): Promise<boolean>;
}

// 处理器注册表
const handlers: EventHandler[] = [];

/**
 * 注册事件处理器
 */
export function registerHandler(handler: EventHandler): void {
  handlers.push(handler);
}

/**
 * 路由事件到对应的处理器
 */
export async function routeEvent(
  eventType: string,
  payload: any,
  deliveryId: string,
  redis: Redis | null,
): Promise<boolean> {
  const action = payload.action as string | undefined;

  for (const handler of handlers) {
    if (handler.event !== eventType) continue;

    // 如果指定了 actions，检查是否匹配
    if (handler.actions && action) {
      if (!handler.actions.includes(action)) continue;
    }

    const handled = await handler.handle(payload, deliveryId, redis);
    if (handled) return true;
  }

  return false;
}

/**
 * 获取已注册的所有事件类型
 */
export function getRegisteredEvents(): string[] {
  return [...new Set(handlers.map((h) => h.event))];
}
