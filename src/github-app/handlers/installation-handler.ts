/**
 * AI PR 描述生成器 — Installation 事件处理器（安装验证逻辑）
 *
 * P2-06: 监听 installation.created 事件，验证安装有效性。
 *
 * 职责：
 * 1. 验证 installation payload 的完整性
 * 2. 创建 InstallationRecord 并持久化
 * 3. 可选：调用 GitHub API 获取 Installation Token 做端到端验证（依赖 P2-03）
 * 4. 处理 deleted/suspend/unsuspend 生命周期
 */

import type { EventHandler, HandlerContext, InstallationPayload } from '../../types/github-events.js';
import type { InstallationRecord, InstallationHandlerResult } from '../../types/installation.js';
import { getAuthService } from '../services/auth.js';
import { getInstallationStore, type InstallationStore } from '../services/installation-store.js';

// ──────────────────────────────────────────
// 验证逻辑
// ──────────────────────────────────────────

/**
 * 验证 installation.created 事件并记录安装信息。
 *
 * @returns 验证结果摘要（用于日志 / 告警）
 */
export async function verifyInstallation(
  payload: InstallationPayload,
): Promise<InstallationHandlerResult> {
  const { installation, repositories, sender } = payload;

  // 1. 基础校验
  if (!installation?.id || !installation?.account?.login) {
    return {
      success: false,
      message: 'Invalid payload: missing installation.id or account.login',
    };
  }

  // 2. 构建记录
  const record: InstallationRecord = {
    installationId: installation.id,
    account: {
      id: installation.account.id,
      login: installation.account.login,
      type: installation.account.type as 'User' | 'Organization',
      avatarUrl: undefined, // InstallationPayload 不含 avatar_url
    },
    repositorySelection: installation.repository_selection,
    repositories: repositories?.map(r => ({
      id: r.id,
      fullName: r.full_name,
      private: r.private,
    })),
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // 3. 持久化
  await getInstallationStore().save(record);

  // 4. 端到端验证：尝试获取 Installation Token
  //    （这是验证安装是否真的可用的关键步骤 — 需要 P2-03 完整配置）
  let tokenVerified = false;
  try {
    const auth = getAuthService();
    const result = await auth.fetchInstallationToken(installation.id);
    tokenVerified = result.success;
    if (!result.success) {
      console.warn(
        `[P2-06] ⚠️  Token verification failed for installation ${installation.id}: ${result.error}`,
      );
    }
  } catch {
    // P2-03 环境变量未配全时静默降级
    console.warn(
      `[P2-06] ⚠️  Token verification skipped for installation ${installation.id} ` +
      `(GitHub credentials not fully configured)`,
    );
  }

  // 5. 日志
  const repoCount = record.repositories?.length ?? 0;
  const repoInfo = record.repositorySelection === 'all' ? '所有仓库' : `${repoCount} 个仓库`;
  const tokenMark = tokenVerified ? '🔑 Token OK' : '🔑 Token 未验证';

  console.log(
    `[P2-06] ✅ installation.created` +
    ` | account=${installation.account.login} (${installation.account.type})` +
    ` | id=${installation.id}` +
    ` | repos=${repoInfo}` +
    ` | ${tokenMark}` +
    ` | sender=${sender.login}`,
  );

  return {
    success: true,
    message: `Installation verified for ${installation.account.login} (id: ${installation.id})`,
    installationId: installation.id,
    accountLogin: installation.account.login,
    tokenVerified,
  };
}

// ──────────────────────────────────────────
// Webhook 事件处理器
// ──────────────────────────────────────────

/**
 * installation.created 处理器
 * App 被安装到仓库/组织时触发 → 验证并记录
 */
export const handleInstallationCreated: EventHandler = async (payload, context) => {
  const inst = payload as unknown as InstallationPayload;
  const result = await verifyInstallation(inst);

  if (!result.success) {
    console.error(`[P2-06] ❌ Verification failed: ${result.message}`);
  }

  // 验证结果记录到 context 供下游中间件/日志使用
  (context as unknown as Record<string, unknown>)._installationVerification = result;
};

/**
 * installation.deleted 处理器
 * App 被卸载时触发 → 标记为 deleted
 */
export const handleInstallationDeleted: EventHandler = async (payload, context) => {
  const inst = payload as unknown as InstallationPayload;
  const store = getInstallationStore();

  await store.updateStatus(inst.installation.id, 'deleted');

  console.log(
    `[P2-06] ❌ installation.deleted` +
    ` | account=${inst.installation.account.login}` +
    ` | id=${inst.installation.id}`,
  );
};

/**
 * installation.suspend / unsuspend / new_permissions_accepted 处理器
 */
export const handleInstallationLifecycle: EventHandler = async (payload, context) => {
  const inst = payload as unknown as InstallationPayload;
  const store = getInstallationStore();
  const action = context.action;

  switch (action) {
    case 'suspend': {
      await store.updateStatus(inst.installation.id, 'suspended');
      console.log(`[P2-06] ⏸️ installation.suspend | id=${inst.installation.id}`);
      break;
    }
    case 'unsuspend': {
      await store.updateStatus(inst.installation.id, 'active');
      console.log(`[P2-06] ▶️ installation.unsuspend | id=${inst.installation.id}`);
      break;
    }
    case 'new_permissions_accepted': {
      console.log(`[P2-06] 🔄 installation.new_permissions_accepted | id=${inst.installation.id}`);
      break;
    }
    default: {
      console.log(`[P2-06] ❓ installation.${action} | id=${inst.installation.id}`);
    }
  }
};
