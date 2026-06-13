// 核心类型定义 — Discriminated Union

// ===== PR 事件类型 =====
export interface PullRequestEvent {
  installationId: number;
  owner: string;
  repo: string;
  pullNumber: number;
  action: 'opened' | 'synchronize';
  deliveryId: string;
}

// ===== PR 描述生成结果 =====
export type PRDescriptionResult =
  | {
      success: true;
      title: string;
      description: string;
      summary: string;
      changeDetails: Array<{
        file: string;
        type: 'added' | 'modified' | 'deleted';
        description: string;
      }>;
      testSuggestions: string[];
      impactScope: string[];
    }
  | {
      success: false;
      error: string;
      errorCode: 'DIFF_TOO_LARGE' | 'LLM_ERROR' | 'EMPTY_RESULT' | 'GITHUB_API_ERROR';
    };

// ===== Diff 相关 =====
export interface DiffFile {
  path: string;
  type: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  content: string;
  language?: string;
}

export interface ParsedDiff {
  files: DiffFile[];
  totalAdditions: number;
  totalDeletions: number;
  totalFiles: number;
  isTooLarge: boolean;
  repoFullName: string;
  pullNumber: number;
}

// ===== 配置类型 =====
export interface AppConfig {
  port: number;
  nodeEnv: string;

  github: {
    appId: string;
    privateKey: string;
    webhookSecret: string;
  };

  llm: {
    apiKey: string;
    baseUrl: string;       // 支持任意 OpenAI 兼容 API
    model: string;
    temperature: number;
    maxTokens: number;
    timeout: number;
  };

  redis: {
    url: string;
  };

  sentry?: {
    dsn: string;
  };
}

// ===== 队列任务类型 =====
export interface QueueJobData {
  installationId: number;
  owner: string;
  repo: string;
  pullNumber: number;
  action: 'opened' | 'synchronize';
  deliveryId: string;
  attempt: number;
}

// ===== 安装信息 =====
export interface InstallationInfo {
  id: number;
  account: string;
  accountType: 'User' | 'Organization';
  repositorySelection: 'selected' | 'all';
  createdAt: string;
  permissions: Record<string, string>;
}
