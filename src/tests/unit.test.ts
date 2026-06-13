import { describe, it, expect, vi } from 'vitest';
import * as crypto from 'crypto';

// 测试用 RSA 密钥对（测试内生成，不依赖外部文件）
const testKeyPair = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
});
const TEST_RSA_KEY = testKeyPair.privateKey;

// ===== Prompt Builder =====
import { buildPrompt } from '../prompt/builder.js';
import type { ParsedDiff } from '../types/index.js';

describe('buildPrompt', () => {
  it('should build prompt for normal diff', () => {
    const diff: ParsedDiff = {
      files: [{ path: 'src/foo.ts', type: 'modified', additions: 10, deletions: 2, content: '@@ -1,5 +1,8 @@\n-old\n+new', language: 'TypeScript' }],
      totalAdditions: 10, totalDeletions: 2, totalFiles: 1, isTooLarge: false, repoFullName: 'test/repo', pullNumber: 1,
    };
    const result = buildPrompt(diff);
    expect(result.system).toContain('描述');
    expect(result.user).toContain('src/foo.ts');
    expect(result.truncated).toBe(false);
  });

  it('should return simplified summary for oversized diff', () => {
    const diff: ParsedDiff = { files: [], totalAdditions: 10000, totalDeletions: 5000, totalFiles: 600, isTooLarge: true, repoFullName: 'test/repo', pullNumber: 2 };
    const result = buildPrompt(diff);
    expect(result.truncated).toBe(true);
    expect(result.user).toContain('600');
  });

  it('should trigger truncation for many files', () => {
    const files = Array.from({ length: 100 }, (_, i) => ({
      path: `src/file${i}.ts`, type: 'modified' as const, additions: 5, deletions: 1,
      content: '@@ -1,1 +1,1 @@\n-old\n+new\n'.repeat(50), language: 'TypeScript',
    }));
    const diff: ParsedDiff = { files, totalAdditions: 500, totalDeletions: 100, totalFiles: 100, isTooLarge: false, repoFullName: 'test/repo', pullNumber: 3 };
    const result = buildPrompt(diff);
    expect(result.truncated).toBe(true);
    expect(result.user).toContain('file0');
  });
});

// ===== Prompt Template =====
import { SYSTEM_PROMPT, buildUserPrompt, estimateTokens } from '../prompt/template.js';

describe('prompt template', () => {
  it('SYSTEM_PROMPT should contain required sections', () => {
    expect(SYSTEM_PROMPT).toContain('标题');
    expect(SYSTEM_PROMPT).toContain('变更摘要');
    expect(SYSTEM_PROMPT).toContain('测试建议');
    expect(SYSTEM_PROMPT).toContain('影响范围');
  });

  it('buildUserPrompt should embed diff', () => {
    const result = buildUserPrompt('test diff');
    expect(result).toContain('test diff');
    expect(result).toContain('```');
  });

  it('estimateTokens should return reasonable value', () => {
    expect(estimateTokens('hello world')).toBe(7);
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('a'.repeat(180))).toBe(100);
  });
});

// ===== Auth =====
import { createAppJWT, decodeJWT } from '../github/auth.js';

describe('GitHub Auth', () => {
  it('should generate 3-part JWT', () => {
    const token = createAppJWT({ appId: '123', privateKey: TEST_RSA_KEY });
    expect(token.split('.').length).toBe(3);
  });

  it('should decode valid JWT', () => {
    const token = createAppJWT({ appId: '123', privateKey: TEST_RSA_KEY });
    const decoded = decodeJWT(token);
    expect(decoded).not.toBeNull();
    expect(decoded?.iss).toBe('123');
  });

  it('should return null for invalid JWT', () => {
    expect(decodeJWT('invalid.token')).toBeNull();
  });
});

// ===== Rate Limiter =====
import { checkRepoRateLimit } from '../middleware/rate-limiter.js';

describe('checkRepoRateLimit', () => {
  it('should handle mock redis without error', async () => {
    const mockRedis = { incr: vi.fn().mockResolvedValue(1), expire: vi.fn().mockResolvedValue(1) };
    const result = await checkRepoRateLimit(mockRedis as any, 'test', 'repo');
    expect(result).toBe(true);
  });
});

// ===== Format =====
import { formatPRComment } from '../github/format.js';

describe('formatPRComment', () => {
  it('should wrap description', () => {
    const result = formatPRComment('test');
    expect(result).toContain('test');
    expect(result).toContain('AI');
  });
});
