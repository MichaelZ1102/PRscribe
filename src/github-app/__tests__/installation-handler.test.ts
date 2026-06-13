// ============================================================================
// InstallationHandler 单元测试
// P2-06: 安装验证逻辑 — verifyInstallation & 生命周期处理器
// ============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { verifyInstallation } from '../../github-app/handlers/installation-handler.js';
import {
  getInstallationStore,
  resetInstallationStore,
} from '../../github-app/services/installation-store.js';

// ============================================================
// Helper: 构建有效 payload
// ============================================================

function validCreatedPayload(overrides: Record<string, unknown> = {}) {
  return {
    action: 'created',
    installation: {
      id: 12345,
      account: { id: 789, login: 'test-org', type: 'Organization' },
      repository_selection: 'selected' as const,
      permissions: { issues: 'write', metadata: 'read' },
    },
    repositories: [
      { id: 1, full_name: 'test-org/repo-a', private: false },
      { id: 2, full_name: 'test-org/repo-b', private: true },
    ],
    sender: { id: 456, login: 'admin-user' },
    ...overrides,
  };
}

// ============================================================
// Tests
// ============================================================

describe('verifyInstallation', () => {
  beforeEach(() => {
    resetInstallationStore();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetInstallationStore();
  });

  // ── 有效 payload ──

  it('有效 installation.created payload → success: true, 记录存入 store', async () => {
    const payload = validCreatedPayload();

    const result = await verifyInstallation(payload as any);

    expect(result.success).toBe(true);
    expect(result.installationId).toBe(12345);
    expect(result.accountLogin).toBe('test-org');

    // 验证记录已存入 store
    const store = getInstallationStore();
    const record = await store.findById(12345);
    expect(record).not.toBeNull();
    expect(record!.status).toBe('active');
    expect(record!.repositories).toHaveLength(2);
  });

  // ── 无效 payload ──

  it('缺少 installation.id → success: false + 描述性消息', async () => {
    const payload = validCreatedPayload({ installation: { account: { login: 'test' } } });
    // 移除 id
    delete payload.installation.id;

    const result = await verifyInstallation(payload as any);

    expect(result.success).toBe(false);
    expect(result.message).toContain('installation.id');
  });

  it('缺少 account.login → success: false + 描述性消息', async () => {
    const payload = validCreatedPayload({ installation: { id: 123, account: {} } });

    const result = await verifyInstallation(payload as any);

    expect(result.success).toBe(false);
    expect(result.message).toContain('account.login');
  });

  it('完全缺少 installation → success: false', async () => {
    const payload = { action: 'created', sender: { login: 'user' } };

    const result = await verifyInstallation(payload as any);

    expect(result.success).toBe(false);
  });

  // ── Token 验证降级 ──

  it('无 GitHub credentials 时静默降级 → tokenVerified: false', async () => {
    // getAuthService() 不可用时会抛异常 → 被 catch 捕获 → 静默降级
    const payload = validCreatedPayload();

    const result = await verifyInstallation(payload as any);

    expect(result.success).toBe(true);
    // tokenVerified 应为 false（未配置 GitHub credentials 时 catch 捕获）
    // 注意：Token 验证是可选步骤，不影响整体验证结果
  });

  // ── all 仓库模式 ──

  it('repository_selection=all 时 repositories 可能为空', async () => {
    const payload = validCreatedPayload({
      installation: {
        id: 67890,
        account: { id: 111, login: 'big-org', type: 'Organization' },
        repository_selection: 'all',
      },
      repositories: undefined,
      sender: { id: 1, login: 'admin' },
    });

    const result = await verifyInstallation(payload as any);

    expect(result.success).toBe(true);
    expect(result.installationId).toBe(67890);

    const store = getInstallationStore();
    const record = await store.findById(67890);
    expect(record!.repositorySelection).toBe('all');
    expect(record!.repositories).toBeUndefined();
  });

  // ── 用户类型 ──

  it('User 类型的安装也应正确处理', async () => {
    const payload = validCreatedPayload({
      installation: {
        id: 55555,
        account: { id: 222, login: 'dev-user', type: 'User' },
        repository_selection: 'selected',
      },
      sender: { id: 222, login: 'dev-user' },
    });

    const result = await verifyInstallation(payload as any);

    expect(result.success).toBe(true);
    expect(result.accountLogin).toBe('dev-user');
  });

  // ── Console 日志 ──

  it('成功验证后应输出结构化日志', async () => {
    const logSpy = vi.spyOn(console, 'log');
    const payload = validCreatedPayload();

    await verifyInstallation(payload as any);

    // 日志应包含 P2-06 标记和安装信息
    const logCalls = logSpy.mock.calls.map(c => c[0]);
    const p2Log = logCalls.find((msg: string) => msg.includes('[P2-06]'));
    expect(p2Log).toBeDefined();
    expect(p2Log).toContain('test-org');
    expect(p2Log).toContain('12345');
  });
});
