/**
 * 事件路由器 — routes incoming webhook events to the correct handler
 *
 * P2-04: 按 x-github-event 分发：pull_request, installation, ping 等
 *
 * 职责:
 *   1. 维护事件 → 处理器的注册表
 *   2. 事件层 action 过滤（如 pull_request 只处理 opened/synchronize/reopened）
 *   3. 统一错误捕获和日志
 *   4. 提供结构化路由结果
 *
 * 流程位置: Signature Verify → Rate Limiter → Event Router → Queue / Handler
 */

import { processPullRequest } from './pr-description.js';
import {
  verifyInstallation,
} from '../handlers/installation-handler.js';
import { getInstallationStore } from './installation-store.js';

// ========================================================================
// Types
// ========================================================================

interface EventPayload {
  action: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

/** 路由结果 */
export interface RouteResult {
  handled: boolean;
  event: string;
  action: string;
  success: boolean;
  durationMs: number;
  error?: string;
}

export type EventHandler = (payload: EventPayload) => Promise<void> | void;

// ========================================================================
// Router
// ========================================================================

class EventRouter {
  private handlers: Map<string, { handler: EventHandler; allowedActions?: Set<string> }> = new Map();

  constructor() {
    this.register('pull_request', this.handlePullRequest.bind(this), new Set(['opened', 'synchronize', 'reopened']));
    this.register('installation', this.handleInstallation.bind(this));
    this.register('ping', this.handlePing.bind(this));
  }

  /**
   * 注册一个事件处理器
   * @param event         事件名（x-github-event）
   * @param handler       处理函数
   * @param allowedActions 可选，仅处理指定的 action（空 = 所有 action 都处理）
   */
  register(event: string, handler: EventHandler, allowedActions?: Set<string>): void {
    this.handlers.set(event, { handler, allowedActions });
  }

  /**
   * 路由事件到对应处理器
   * @returns 路由结果（含处理耗时和错误信息）
   */
  async handle(event: string, payload: EventPayload): Promise<RouteResult> {
    const start = performance.now();
    const action = payload.action ?? '';

    const entry = this.handlers.get(event);
    if (!entry) {
      return {
        handled: false,
        event,
        action,
        success: true,
        durationMs: Math.round(performance.now() - start),
      };
    }

    // action 过滤
    if (entry.allowedActions && !entry.allowedActions.has(action)) {
      console.log(`⏭️ [EventRouter] Skipping ${event}.${action} (not in allowed actions)`);
      return {
        handled: false,
        event,
        action,
        success: true,
        durationMs: Math.round(performance.now() - start),
      };
    }

    try {
      await entry.handler(payload);
      return {
        handled: true,
        event,
        action,
        success: true,
        durationMs: Math.round(performance.now() - start),
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`❌ [EventRouter] ${event}.${action} handler error:`, msg);
      return {
        handled: true,
        event,
        action,
        success: false,
        error: msg,
        durationMs: Math.round(performance.now() - start),
      };
    }
  }

  /** 列出所有已注册的事件 */
  listEvents(): string[] {
    return Array.from(this.handlers.keys());
  }

  /** 检查某事件是否可处理（可选检查 action） */
  canHandle(event: string, action?: string): boolean {
    const entry = this.handlers.get(event);
    if (!entry) return false;
    if (!action || !entry.allowedActions) return true;
    return entry.allowedActions.has(action);
  }

  // ========================================================================
  // 默认处理器
  // ========================================================================

  private async handlePullRequest(payload: EventPayload): Promise<void> {
    const { action, pull_request, repository, installation } = payload;

    if (!pull_request || !repository) {
      console.warn('⚠️ [EventRouter] Invalid pull_request payload: missing pull_request or repository');
      return;
    }

    console.log(
      `[EventRouter] pull_request.${action} — ${repository.full_name ?? repository.name}#${pull_request.number}`,
    );

    await processPullRequest({
      installationId: installation?.id,
      owner: repository.owner?.login || repository.owner?.name,
      repo: repository.name,
      pullNumber: pull_request.number,
      action,
    });
  }

  private async handleInstallation(payload: EventPayload): Promise<void> {
    const { action, installation, repositories } = payload;
    const account = installation?.account?.login ?? 'unknown';

    if (action === 'created') {
      // 调用 P2-06 安装验证逻辑
      const result = await verifyInstallation({
        action: 'created',
        installation,
        repositories,
        sender: payload.sender,
      } as any);
      console.log(
        `[EventRouter] installation.created — account=${account}` +
        ` | verified=${result.success}` +
        ` | id=${installation?.id}`,
      );
    } else if (action === 'deleted') {
      const store = getInstallationStore();
      if (installation?.id) {
        await store.updateStatus(installation.id, 'deleted');
      }
      console.log(`[EventRouter] installation.deleted — account=${account} | id=${installation?.id}`);
    } else {
      const store = getInstallationStore();
      if (installation?.id && (action === 'suspend' || action === 'unsuspend')) {
        await store.updateStatus(
          installation.id,
          action === 'suspend' ? 'suspended' : 'active',
        );
      }
      console.log(`[EventRouter] installation.${action} — account=${account} | id=${installation?.id}`);
    }
  }

  private async handlePing(_payload: EventPayload): Promise<void> {
    console.log('[EventRouter] ping — Webhook connection verified');
  }
}

/** 全局单例 */
export const eventRouter = new EventRouter();
