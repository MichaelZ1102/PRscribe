import { Worker } from 'bullmq';
import { loadConfig } from '../config.js';
import { fetchPRDiff } from '../github/diff-fetcher.js';
import { generatePRDescription } from '../llm/client.js';
import { formatPRComment } from '../github/format.js';
import type { QueueJobData } from '../types/index.js';
import { App } from 'octokit';

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
 * 解析 Redis URL 为 BullMQ 兼容的连接配置
 */
function parseRedisUrl(url: string) {
  const parsed = new URL(url);
  const isTls = parsed.protocol === 'rediss:';
  const port = parseInt(parsed.port || (isTls ? '6380' : '6379'), 10);

  return {
    host: parsed.hostname,
    port,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    ...(isTls ? { tls: {} } : {}),
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };
}

export function startConsumer(): Worker {
  const config = loadConfig();
  const connection = parseRedisUrl(config.redis.url);

  const worker = new Worker<QueueJobData>(
    'pr-description',
    async (job) => {
      const { installationId, owner, repo, pullNumber, action, deliveryId } = job.data;
      console.log(`[Worker] 处理 PR #${pullNumber} (${owner}/${repo})`);

      const diff = await fetchPRDiff(installationId, owner, repo, pullNumber);

      if (diff.isTooLarge) {
        await postComment(installationId, owner, repo, pullNumber,
          '⚠️ 此 PR 变更过大（超过 500 个文件），无法自动生成描述，请手动编写。');
        return;
      }

      console.log('[Worker] 调用 LLM...');
      const result = await generatePRDescription(diff);

      if (result.success === false) {
        console.error(`[Worker] 生成失败: ${result.error}`);
        await postComment(installationId, owner, repo, pullNumber,
          `❌ AI 生成 PR 描述失败：${result.error}\n\n请手动编写 PR 描述。`);
        return;
      }

      console.log('[Worker] 发布评论...');
      const commentBody = formatPRComment(result.description);
      await postComment(installationId, owner, repo, pullNumber, commentBody);
      console.log(`[Worker] ✅ PR #${pullNumber} 描述已发布`);
    },
    {
      connection,
      concurrency: 3,
      lockDuration: 60_000,
      maxStalledCount: 2,
    },
  );

  worker.on('completed', (job) => console.log(`[Worker] 任务 ${job.id} 完成`));
  worker.on('failed', (job, err) => console.error(`[Worker] 任务 ${job?.id} 失败:`, err.message));

  console.log('[Worker] 队列消费者已启动');
  return worker;
}

async function postComment(
  installationId: number, owner: string, repo: string,
  pullNumber: number, body: string,
): Promise<void> {
  const app = getApp();
  const octokit = await app.getInstallationOctokit(installationId);
  await octokit.rest.issues.createComment({
    owner, repo, issue_number: pullNumber, body,
  });
}
