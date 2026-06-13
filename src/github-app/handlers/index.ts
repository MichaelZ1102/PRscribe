// ============================================================================
// Event Handler 注册入口
// P2-04: 注册/覆盖事件处理器到 eventRouter 单例
// ============================================================================
//
// eventRouter 已经内置了 pull_request / installation / ping 的默认处理。
// 如果需要在运行时注册额外处理器或覆盖默认行为，从这里统一管理。
// ============================================================================

import { eventRouter } from '../services/event-router.js';
import {
  handlePROpened,
  handlePRSynchronize,
  handlePREdited,
} from './pull-request-handler.js';
import {
  handleInstallationCreated,
  handleInstallationDeleted,
} from './installation-handler.js';

/**
 * 在 eventRouter 上注册细粒度处理器
 *
 * 注意：eventRouter 内置已经处理了 pull_request / installation / ping。
 * 这些额外处理器可在需要更细粒度 action 分发时通过 delegate_task 的方式调用。
 */
export function setupCustomHandlers(): void {
  // 例：
  // eventRouter.register('pull_request', handlePROpened, new Set(['opened']));
  // eventRouter.register('installation', handleInstallationCreated);
}

export { eventRouter } from '../services/event-router.js';
export type { EventHandler, RouteResult } from '../services/event-router.js';
