/**
 * AI PR 描述生成器 — 安装事件类型定义
 *
 * 用于处理 GitHub App installation 生命周期事件：
 * - installation.created
 * - installation.deleted
 * - installation.suspend / unsuspend
 * - installation.new_permissions_accepted
 */

/** 安装授权仓库模式 */
export type RepositorySelection = 'selected' | 'all';

/** 安装状态 */
export type InstallationStatus =
  | 'active'
  | 'suspended'
  | 'deleted';

/** 安装账户信息 */
export interface InstallationAccount {
  id: number;
  login: string;
  type: 'User' | 'Organization';
  avatarUrl?: string;
}

/** 授权仓库信息 */
export interface InstallationRepo {
  id: number;
  fullName: string;
  private: boolean;
}

/** 持久化的安装记录 */
export interface InstallationRecord {
  /** GitHub 分配的 Installation ID */
  installationId: number;
  /** 安装的账户信息 */
  account: InstallationAccount;
  /** 仓库选择方式 */
  repositorySelection: RepositorySelection;
  /** 被授权的仓库列表（仅 selected 模式） */
  repositories?: InstallationRepo[];
  /** 安装状态 */
  status: InstallationStatus;
  /** 安装时间 (ISO) */
  createdAt: string;
  /** 暂停时间 (ISO) */
  suspendedAt?: string;
  /** 最后更新时间 (ISO) */
  updatedAt: string;
}

// ──────────────────────────────────────────
// GitHub Webhook 事件 Payload 类型
// ──────────────────────────────────────────

/** installation.created Webhook 载荷 */
export interface InstallationCreatedPayload {
  action: 'created';
  installation: {
    id: number;
    account: {
      id: number;
      login: string;
      type: 'User' | 'Organization';
      avatar_url?: string;
    };
    repository_selection: RepositorySelection;
    repositories?: Array<{
      id: number;
      full_name: string;
      private: boolean;
    }>;
    /** 安装事件发生时间 */
    created_at: string;
  };
  sender: {
    id: number;
    login: string;
    type: string;
  };
}

/** installation.deleted / suspended / unsuspend Webhook 载荷 */
export interface InstallationLifecyclePayload {
  action: 'deleted' | 'suspend' | 'unsuspend' | 'new_permissions_accepted';
  installation: {
    id: number;
    account: {
      id: number;
      login: string;
      type: string;
    };
    repository_selection: RepositorySelection;
    suspended_by?: {
      id: number;
      login: string;
    } | null;
    suspended_at?: string | null;
  };
  sender: {
    id: number;
    login: string;
  };
}

/** 统一的 Installation Webhook 事件类型（联合类型） */
export type InstallationWebhookPayload =
  | InstallationCreatedPayload
  | InstallationLifecyclePayload;

// ──────────────────────────────────────────
// 处理器返回类型
// ──────────────────────────────────────────

export interface InstallationHandlerResult {
  success: boolean;
  message: string;
  installationId?: number;
  accountLogin?: string;
  [key: string]: unknown;
}
