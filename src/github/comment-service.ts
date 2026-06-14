import { App } from 'octokit';
import { loadConfig } from '../config.js';

let appInstance: App | null = null;

function getApp(): App {
  if (!appInstance) {
    const config = loadConfig();
    appInstance = new App({
      appId: config.github.appId,
      privateKey: config.github.privateKey,
    });
  }
  return appInstance;
}

/**
 * 评论服务 — 负责所有 PR/MR 评论的发布
 * 
 * 职责单一：只做一件事——把内容发到 PR 评论。
 * 与平台无关，通过 Octokit 抽象底层差异。
 */
export class CommentService {
  /**
   * 在 PR 上发布评论
   */
  static async post(
    installationId: number,
    owner: string,
    repo: string,
    pullNumber: number,
    body: string,
  ): Promise<void> {
    const app = getApp();
    const octokit = await app.getInstallationOctokit(installationId);

    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: pullNumber,
      body,
    });

    console.log(`[CommentService] 评论已发布到 ${owner}/${repo}#${pullNumber}`);
  }

  /**
   * 发布错误通知
   */
  static async postError(
    installationId: number,
    owner: string,
    repo: string,
    pullNumber: number,
    errorMsg: string,
  ): Promise<void> {
    const body = `❌ AI 生成 PR 描述失败：${errorMsg}\n\n请手动编写 PR 描述。`;
    await this.post(installationId, owner, repo, pullNumber, body);
  }

  /**
   * 发布成功描述
   */
  static async postDescription(
    installationId: number,
    owner: string,
    repo: string,
    pullNumber: number,
    description: string,
  ): Promise<void> {
    const body = `## 📋 PR 描述\n\n${description}\n\n---\n> 🤖 此描述由 AI 自动生成，请审核后使用。`;
    await this.post(installationId, owner, repo, pullNumber, body);
  }
}
