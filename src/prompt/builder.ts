import { SYSTEM_PROMPT, buildUserPrompt, estimateTokens } from './template.js';
import type { ParsedDiff } from '../types/index.js';

export interface BuiltPrompt {
  system: string;
  user: string;
  totalTokens: number;
  truncated: boolean;
}

/** 每文件在截断时保留的行数 */
const LINES_PER_FILE = 20;
/** 最大 token 数（GPT-4o-mini 上下文 128K，预留输出空间） */
const MAX_TOKENS = 64_000;

/**
 * Prompt Builder — 将结构化 diff 组装为 LLM 使用的 prompt
 */
export function buildPrompt(diff: ParsedDiff): BuiltPrompt {
  // 1. 超大 diff：直接返回摘要，不发送 diff 内容
  if (diff.isTooLarge) {
    return {
      system: SYSTEM_PROMPT,
      user: [
        `⚠️ 此 PR 变更过大（${diff.totalFiles} 个文件），仅提供变更概要。`,
        '',
        '变更概要：',
        `- 仓库：${diff.repoFullName}`,
        `- PR #：${diff.pullNumber}`,
        `- 文件数：${diff.totalFiles}`,
        `- 新增行：${diff.totalAdditions}`,
        `- 删除行：${diff.totalDeletions}`,
        '',
        '请基于以上概要生成简化的 PR 描述。',
      ].join('\n'),
      totalTokens: 0,
      truncated: true,
    };
  }

  // 2. 构建完整的 diff 文本
  const diffText = formatDiff(diff);

  // 3. Token 估算，判断是否需要截断
  const systemTokens = estimateTokens(SYSTEM_PROMPT);
  let userPrompt = buildUserPrompt(diffText);
  let userTokens = estimateTokens(userPrompt);

  if (systemTokens + userTokens <= MAX_TOKENS) {
    return {
      system: SYSTEM_PROMPT,
      user: userPrompt,
      totalTokens: systemTokens + userTokens,
      truncated: false,
    };
  }

  // 4. 需要截断：每个文件保留前 LINES_PER_FILE 行
  const truncatedFiles = diff.files.map((f) => {
    if (!f.content) return f;
    const lines = f.content.split('\n');
    const kept = lines.slice(0, LINES_PER_FILE);
    const skipped = lines.length - LINES_PER_FILE;
    return {
      ...f,
      content: kept.join('\n') + (skipped > 0 ? `\n  ... 省略 ${skipped} 行` : ''),
    };
  });

  const truncatedDiffText = formatDiff({
    ...diff,
    files: truncatedFiles,
  });

  userPrompt = buildUserPrompt(truncatedDiffText);
  userTokens = estimateTokens(userPrompt);

  return {
    system: SYSTEM_PROMPT,
    user: userPrompt,
    totalTokens: estimateTokens(SYSTEM_PROMPT) + userTokens,
    truncated: true,
  };
}

/**
 * 将结构化 diff 格式化为文本
 */
function formatDiff(diff: ParsedDiff): string {
  const parts: string[] = [];

  // 统计摘要
  parts.push([
    '## 变更统计',
    `- 文件数：${diff.totalFiles} 个`,
    `- 新增行：${diff.totalAdditions}`,
    `- 删除行：${diff.totalDeletions}`,
    '',
  ].join('\n'));

  // 每个文件的 diff
  for (const file of diff.files) {
    const statusChar =
      file.type === 'added' ? '+' :
      file.type === 'deleted' ? '-' :
      file.type === 'renamed' ? '→' : '~';

    parts.push(`### ${statusChar} ${file.path} (${file.type})`);

    if (file.additions > 0 || file.deletions > 0) {
      parts.push(`  +${file.additions} / -${file.deletions} 行`);
    }

    if (file.content) {
      const lang = (file.language || '').toLowerCase();
      parts.push('```' + lang);
      parts.push(file.content);
      parts.push('```');
    }

    parts.push('');
  }

  return parts.join('\n');
}
