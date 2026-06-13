// ============================================================================
// InstallationStore 单元测试
// P2-06: 安装验证逻辑 — 存储层
// ============================================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getInstallationStore,
  setInstallationStore,
  resetInstallationStore,
  type InstallationStore,
} from '../services/installation-store.js';
import type { InstallationRecord, InstallationStatus } from '../../types/installation.js';

// ============================================================
// 辅助：创建测试记录
// ============================================================

function createTestRecord(overrides: Partial<InstallationRecord> = {}): InstallationRecord {
  return {
    installationId: 12345,
    account: { id: 789, login: 'test-org', type: 'Organization' },
    repositorySelection: 'selected',
    repositories: [
      { id: 1, fullName: 'test-org/repo-a', private: false },
      { id: 2, fullName: 'test-org/repo-b', private: true },
    ],
    status: 'active',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// ============================================================
// 测试套件
// ============================================================

describe('InstallationStore', () => {
  let store: InstallationStore;

  beforeEach(() => {
    resetInstallationStore();
    store = getInstallationStore();
  });

  afterEach(() => {
    resetInstallationStore();
  });

  // ── 基础 CRUD ──

  it('save + findById 应正确存取记录', async () => {
    const record = createTestRecord();
    await store.save(record);

    const found = await store.findById(12345);
    expect(found).not.toBeNull();
    expect(found!.installationId).toBe(12345);
    expect(found!.account.login).toBe('test-org');
    expect(found!.status).toBe('active');
  });

  it('findById 不存在时返回 null', async () => {
    const found = await store.findById(99999);
    expect(found).toBeNull();
  });

  // ── updateStatus ──

  it('updateStatus 应正确更新状态', async () => {
    const record = createTestRecord();
    await store.save(record);

    await store.updateStatus(12345, 'suspended');
    const updated = await store.findById(12345);
    expect(updated!.status).toBe('suspended');
    expect(updated!.suspendedAt).toBeDefined();
  });

  it('updateStatus 为 deleted 不应设置 suspendedAt', async () => {
    const record = createTestRecord();
    await store.save(record);

    await store.updateStatus(12345, 'deleted');
    const updated = await store.findById(12345);
    expect(updated!.status).toBe('deleted');
    expect(updated!.suspendedAt).toBeUndefined();
  });

  it('updateStatus 为 active 应清除 suspendedAt', async () => {
    const record = createTestRecord({ status: 'suspended', suspendedAt: '2026-03-01T00:00:00Z' });
    await store.save(record);

    await store.updateStatus(12345, 'active');
    const updated = await store.findById(12345);
    expect(updated!.status).toBe('active');
  });

  it('updateStatus 对不存在的记录不应抛异常', async () => {
    await expect(store.updateStatus(99999, 'deleted')).resolves.toBeUndefined();
  });

  // ── listActive ──

  it('listActive 只返回 status=active 的记录', async () => {
    await store.save(createTestRecord({ installationId: 1, status: 'active' }));
    await store.save(createTestRecord({ installationId: 2, status: 'suspended' }));
    await store.save(createTestRecord({ installationId: 3, status: 'deleted' }));
    await store.save(createTestRecord({ installationId: 4, status: 'active' }));

    const active = await store.listActive();
    expect(active).toHaveLength(2);
    expect(active.map(r => r.installationId).sort()).toEqual([1, 4]);
  });

  // ── listAll ──

  it('listAll 应返回所有记录', async () => {
    await store.save(createTestRecord({ installationId: 1 }));
    await store.save(createTestRecord({ installationId: 2 }));

    const all = await store.listAll();
    expect(all).toHaveLength(2);
  });

  it('空 store 的 listAll 应返回空数组', async () => {
    const all = await store.listAll();
    expect(all).toEqual([]);
  });

  // ── delete ──

  it('delete 应移除记录', async () => {
    const record = createTestRecord();
    await store.save(record);
    expect(await store.findById(12345)).not.toBeNull();

    await store.delete(12345);
    expect(await store.findById(12345)).toBeNull();
  });

  it('delete 不存在的记录不应抛异常', async () => {
    await expect(store.delete(99999)).resolves.toBeUndefined();
  });

  // ── save 覆盖 ──

  it('save 相同 id 应覆盖已有记录', async () => {
    await store.save(createTestRecord({ account: { id: 1, login: 'old-name', type: 'Organization' } }));
    await store.save(createTestRecord({ account: { id: 1, login: 'new-name', type: 'Organization' } }));

    const found = await store.findById(12345);
    expect(found!.account.login).toBe('new-name');
  });

  // ── setInstallationStore ──

  it('setInstallationStore 可替换为自定义实现', async () => {
    const customStore: InstallationStore = {
      save: async () => {},
      findById: async () => null,
      updateStatus: async () => {},
      listActive: async () => [],
      listAll: async () => [],
      delete: async () => {},
    };
    setInstallationStore(customStore);
    expect(await getInstallationStore().findById(1)).toBeNull();
  });

  // ── 生命周期场景（集成） ──

  it('生命周期：active → suspended → deleted', async () => {
    await store.save(createTestRecord());

    // active → suspended
    await store.updateStatus(12345, 'suspended');
    let record = await store.findById(12345);
    expect(record!.status).toBe('suspended');
    expect(record!.suspendedAt).toBeDefined();
    const suspendTime = record!.suspendedAt;

    // suspended → active (unsuspend)
    await store.updateStatus(12345, 'active');
    record = await store.findById(12345);
    expect(record!.status).toBe('active');

    // active → deleted
    await store.updateStatus(12345, 'deleted');
    record = await store.findById(12345);
    expect(record!.status).toBe('deleted');

    // deleted → listActive 不应包含
    const active = await store.listActive();
    expect(active.find(r => r.installationId === 12345)).toBeUndefined();
  });
});
