import { Worker } from 'bullmq';
import { loadConfig } from '../config.js';
import { fetchPRDiff } from '../github/diff-fetcher.js';
import { generatePRDescription } from '../llm/client.js';
import { formatPRComment } from '../github/format.js';
import type { QueueJobData } from '../types/index.js';
import { App } from 'octokit';

// 缓存 Octokit App 实例（避免每次评论都重新加载私钥）
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
 * 启动队列消费者
 */
export function startConsumer(): Worker {
  const config = loadConfig();

  const worker = new Worker<QueueJobData>(
    'pr-description',
    async (job) => {
      const { installationId, owner, repo, pullNumber, action, deliveryId } = job.data;

      console.log(`[Worker] 处理 PR #${pullNumber} (${owner}/${repo}) [${deliveryId}]`);

      // 1. 获取 PR diff
      console.log('[Worker] 获取 diff...');
      const diff = await fetchPRDiff(installationId, owner, repo, pullNumber);

      if (diff.isTooLarge) {
        console.log('[Worker] diff 过大，跳过');
        await postComment(installationId, owner, repo, pullNumber,
          '⚠️ 此 PR 变更过大（超过 500 个文件），无法自动生成描述，请手动编写。');
        return;
      }

      // 2. 生成 PR 描述
      console.log('[Worker] 调用 LLM 生成描述...');
      const result = await generatePRDescription(diff);

      if (!result.success) {
        console.error(`[Worker] 生成失败: ${result.error}`);
        await postComment(installationId, owner, repo, pullNumber,
          `❌ AI 生成 PR 描述失败：${result.error}\n\n请手动编写 PR 描述。`);
        return;
      }

      // 3. 发布评论
      console.log('[Worker] 发布评论...');
      const commentBody = formatPRComment(result.description);
      await postComment(installationId, owner, repo, pullNumber, commentBody);

      console.log(`[Worker] ✅ PR #${pullNumber} 描述已发布`);
    },
    {
      connection: { url: config.redis.url },
      concurrency: 3,
      lockDuration: 60_000,
      maxStalledCount: 2,
    },
  );

  worker.on('completed', (job) => {
    console.log(`[Worker] 任务 ${job.id} 完成`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Worker] 任务 ${job?.id} 失败:`, err.message);
  });

  console.log('[Worker] 队列消费者已启动');
  return worker;
}

/**
 * 发布 PR 评论（复用缓存的 App 实例）
 */
async function postComment(
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
}
