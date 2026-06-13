/**
 * AI PR 描述生成器 — Installation 存储服务
 *
 * P2-06: 持久化 InstallationRecord，支持生命周期事件。
 *
 * 当前实现：基于 Map 的内存存储（适合 MVP/开发）。
 * 后续可替换为 Drizzle ORM + PostgreSQL 实现。
 *
 * 存储接口（InstallationStore）设计为抽象层，便于无缝切换。
 */

import type { InstallationRecord, InstallationStatus } from '../../types/installation.js';

// ============================================================
// 存储接口
// ============================================================

export interface InstallationStore {
  /** 保存或覆盖安装记录 */
  save(record: InstallationRecord): Promise<void>;

  /** 根据 installationId 查询 */
  findById(installationId: number): Promise<InstallationRecord | null>;

  /** 更新安装状态（deleted / suspended / active） */
  updateStatus(installationId: number, status: InstallationStatus): Promise<void>;

  /** 列出所有活跃安装 */
  listActive(): Promise<InstallationRecord[]>;

  /** 列所有记录 */
  listAll(): Promise<InstallationRecord[]>;

  /** 删除记录 */
  delete(installationId: number): Promise<void>;
}

// ============================================================
// 内存实现（MVP）
// ============================================================

class InMemoryInstallationStore implements InstallationStore {
  private store = new Map<number, InstallationRecord>();

  async save(record: InstallationRecord): Promise<void> {
    this.store.set(record.installationId, { ...record, updatedAt: new Date().toISOString() });
  }

  async findById(installationId: number): Promise<InstallationRecord | null> {
    return this.store.get(installationId) ?? null;
  }

  async updateStatus(installationId: number, status: InstallationStatus): Promise<void> {
    const record = this.store.get(installationId);
    if (record) {
      record.status = status;
      record.updatedAt = new Date().toISOString();
      if (status === 'suspended') {
        record.suspendedAt = new Date().toISOString();
      }
    }
  }

  async listActive(): Promise<InstallationRecord[]> {
    return Array.from(this.store.values()).filter(r => r.status === 'active');
  }

  async listAll(): Promise<InstallationRecord[]> {
    return Array.from(this.store.values());
  }

  async delete(installationId: number): Promise<void> {
    this.store.delete(installationId);
  }
}

// ============================================================
// 单例
// ============================================================

let _store: InstallationStore | null = null;

/**
 * 获取 InstallationStore 单例。
 * 在应用启动时可调用 setInstallationStore() 切换到自定义实现（如 DB 版）。
 */
export function getInstallationStore(): InstallationStore {
  if (!_store) {
    _store = new InMemoryInstallationStore();
  }
  return _store;
}

/**
 * 替换存储实现（用于切换为数据库实现或单元测试 Mock）。
 */
export function setInstallationStore(store: InstallationStore): void {
  _store = store;
}

/**
 * 重置存储（仅用于测试）。
 */
export function resetInstallationStore(): void {
  _store = null;
}
