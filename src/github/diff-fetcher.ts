import { App } from 'octokit';
import type { App as AppType } from 'octokit';
import { loadConfig } from '../config.js';
import type { ParsedDiff, DiffFile } from '../types/index.js';

const MAX_FILES = 500;

let appInstance: AppType | null = null;

function getApp(): AppType {
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
 * 通过 GitHub API 获取 PR diff
 * 使用缓存的 Octokit App 实例，避免重复加载私钥
 */
export async function fetchPRDiff(
  installationId: number,
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<ParsedDiff> {
  const app = getApp();
  const octokit = await app.getInstallationOctokit(installationId);

  // 获取 PR 文件列表（自动分页）
  const files = await octokit.paginate(octokit.rest.pulls.listFiles, {
    owner,
    repo,
    pull_number: pullNumber,
    per_page: 100,
  });

  const totalFiles = files.length;
  const totalAdditions = files.reduce((sum, f) => sum + (f.additions || 0), 0);
  const totalDeletions = files.reduce((sum, f) => sum + (f.deletions || 0), 0);
  const isTooLarge = totalFiles > MAX_FILES;

  const diffFiles: DiffFile[] = files.slice(0, MAX_FILES).map((f) => ({
    path: f.filename,
    type: f.status as DiffFile['type'],
    additions: f.additions || 0,
    deletions: f.deletions || 0,
    content: f.patch || '',
    language: guessLanguage(f.filename),
  }));

  return {
    files: diffFiles,
    totalAdditions,
    totalDeletions,
    totalFiles,
    isTooLarge,
    repoFullName: `${owner}/${repo}`,
    pullNumber,
  };
}

const LANG_MAP: Record<string, string> = {
  ts: 'TypeScript', tsx: 'TypeScript', js: 'JavaScript', jsx: 'JavaScript',
  py: 'Python', rs: 'Rust', go: 'Go', java: 'Java',
  rb: 'Ruby', php: 'PHP', c: 'C', cpp: 'C++', cs: 'C#',
  swift: 'Swift', kt: 'Kotlin', scala: 'Scala',
  vue: 'Vue', svelte: 'Svelte', html: 'HTML', css: 'CSS', scss: 'SCSS',
  json: 'JSON', yaml: 'YAML', yml: 'YAML', md: 'Markdown',
  sql: 'SQL', sh: 'Shell', bash: 'Shell', dockerfile: 'Dockerfile',
};

function guessLanguage(filename: string): string | undefined {
  const ext = filename.split('.').pop()?.toLowerCase();
  return ext ? LANG_MAP[ext] : undefined;
}
