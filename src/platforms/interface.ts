/**
 * Platform adapter interface
 * 
 * 定义统一的平台抽象层，后续可支持 GitLab、Bitbucket 等
 */
export interface PlatformAdapter {
  /** 平台名称 */
  readonly name: string;

  /** 验证 Webhook 签名 */
  verifyWebhook(payload: string, signature: string): Promise<boolean>;

  /** 获取 Merge Request / Pull Request 的 diff */
  fetchDiff(
    installationId: number,
    owner: string,
    repo: string,
    pullNumber: number,
  ): Promise<{
    files: Array<{
      path: string;
      type: 'added' | 'modified' | 'deleted';
      additions: number;
      deletions: number;
      content: string;
    }>;
    totalAdditions: number;
    totalDeletions: number;
    totalFiles: number;
  }>;

  /** 发布评论 */
  postComment(
    installationId: number,
    owner: string,
    repo: string,
    pullNumber: number,
    body: string,
  ): Promise<void>;
}
