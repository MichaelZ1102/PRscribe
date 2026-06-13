import OpenAI from 'openai';
import { loadConfig } from '../config.js';
import { buildPrompt, type BuiltPrompt } from '../prompt/builder.js';
import type { ParsedDiff, PRDescriptionResult } from '../types/index.js';

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    const config = loadConfig();
    client = new OpenAI({
      apiKey: config.llm.apiKey,
      baseURL: config.llm.baseUrl,
      timeout: config.llm.timeout,
      maxRetries: 2,
    });
  }
  return client;
}

/**
 * 根据 PR diff 生成 PR 描述
 */
export async function generatePRDescription(diff: ParsedDiff): Promise<PRDescriptionResult> {
  const config = loadConfig();
  const prompt = buildPrompt(diff);
  return callLLM(prompt, config);
}

/**
 * 调用 LLM API 生成描述
 * 重试策略：最多 2 次，指数退避（3s → 9s）
 */
async function callLLM(
  prompt: BuiltPrompt,
  config: ReturnType<typeof loadConfig>,
  attempt: number = 1,
): Promise<PRDescriptionResult> {
  const maxAttempts = 2;

  try {
    const openai = getClient();
    const response = await openai.chat.completions.create({
      model: config.llm.model,
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
      temperature: config.llm.temperature,
      max_tokens: config.llm.maxTokens,
    });

    const content = response.choices?.[0]?.message?.content?.trim() || '';

    if (!content) {
      throw new Error('LLM 返回空内容');
    }

    return {
      success: true,
      title: extractTitle(content),
      description: content,
      summary: extractSummary(content),
      changeDetails: extractChangeDetails(content),
      testSuggestions: extractTestSuggestions(content),
      impactScope: extractImpactScope(content),
    };
  } catch (error) {
    const err = error as Error;

    if (attempt < maxAttempts) {
      const delay = Math.pow(3, attempt) * 1000;
      console.log(`[LLM] 第 ${attempt} 次失败，${delay / 1000}s 后重试: ${err.message}`);
      await new Promise((r) => setTimeout(r, delay));
      return callLLM(prompt, config, attempt + 1);
    }

    return {
      success: false,
      error: `LLM 调用失败: ${err.message}`,
      errorCode: 'LLM_ERROR',
    };
  }
}

// ===== 容错性 Markdown 解析 =====

/**
 * 从多个正则模式中匹配第一个成功的
 */
function firstMatch(content: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match?.[1]?.trim()) return match[1].trim();
  }
  return null;
}

/** 提取标题 */
function extractTitle(content: string): string {
  // 三级 fallback: ### 标题 → ## ▶ → 第一行
  const title = firstMatch(content, [
    /###\s*标题\s*\n(.+)/,
    /##\s*标题\s*\n(.+)/,
    /###\s*Title\s*\n(.+)/i,
    /##\s*Title\s*\n(.+)/i,
    /^#+\s*(.+)/m,
  ]);
  return title || content.split('\n')[0].replace(/^#+\s*/, '').trim();
}

/** 提取变更摘要 */
function extractSummary(content: string): string {
  const summary = firstMatch(content, [
    /###\s*变更摘要\s*\n([\s\S]*?)(?=\n###)/,
    /##\s*变更摘要\s*\n([\s\S]*?)(?=\n##|$)/,
    /###\s*Summary\s*\n([\s\S]*?)(?=\n###)/i,
  ]);
  return summary || '';
}

/** 提取变更详情 */
function extractChangeDetails(content: string): Array<{ file: string; type: 'added' | 'modified' | 'deleted'; description: string }> {
  const details: Array<{ file: string; type: 'added' | 'modified' | 'deleted'; description: string }> = [];

  // 找到变更详情部分
  const section = firstMatch(content, [
    /###\s*变更详情\s*\n([\s\S]*?)(?=\n###)/,
    /##\s*变更详情\s*\n([\s\S]*?)(?=\n##|$)/,
    /###\s*Changes\s*\n([\s\S]*?)(?=\n###)/i,
  ]);

  if (!section) return details;

  // 解析表格行：| path | type | desc |
  for (const line of section.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|') || trimmed.includes('---')) continue;

    const cols = trimmed.split('|').map((c) => c.trim()).filter(Boolean);
    // 跳过表头行
    if (cols.length >= 3 && !cols[0].includes('文件') && !cols[0].includes('File')) {
      details.push({
        file: cols[0],
        type: mapChangeType(cols[1]),
        description: cols[2],
      });
    }
  }

  return details;
}

function mapChangeType(t: string): 'added' | 'modified' | 'deleted' {
  const lower = t.toLowerCase();
  if (lower.includes('add') || lower.includes('新增') || lower.includes('新建')) return 'added';
  if (lower.includes('del') || lower.includes('删除') || lower.includes('移除')) return 'deleted';
  return 'modified';
}

/** 提取测试建议 */
function extractTestSuggestions(content: string): string[] {
  const suggestions: string[] = [];

  const section = firstMatch(content, [
    /###\s*🧪\s*测试建议\s*\n([\s\S]*?)(?=\n###)/,
    /###\s*测试建议\s*\n([\s\S]*?)(?=\n###)/,
    /##\s*测试建议\s*\n([\s\S]*?)(?=\n##|$)/,
    /###\s*Testing\s*\n([\s\S]*?)(?=\n###)/i,
  ]);

  if (!section) return suggestions;

  for (const line of section.split('\n')) {
    const suggestion = line.replace(/^-\s*\[\s*\]\s*/, '').replace(/^-\s+/, '').trim();
    if (suggestion) suggestions.push(suggestion);
  }

  return suggestions;
}

/** 提取影响范围 */
function extractImpactScope(content: string): string[] {
  const scope: string[] = [];

  const section = firstMatch(content, [
    /###\s*⚠️\s*影响范围\s*\n([\s\S]*?)(?=\n---|$)/,
    /###\s*影响范围\s*\n([\s\S]*?)(?=\n---|$)/,
    /##\s*影响范围\s*\n([\s\S]*?)(?=\n---|$)/,
    /###\s*Impact\s*\n([\s\S]*?)(?=\n---|$)/i,
  ]);

  if (!section) return scope;

  for (const line of section.split('\n')) {
    const trimmed = line.replace(/^-\s*\*\*/, '').replace(/\*\*:/, ':').trim();
    if (trimmed && !trimmed.startsWith('---') && !trimmed.startsWith('>')) {
      scope.push(trimmed);
    }
  }

  return scope;
}
