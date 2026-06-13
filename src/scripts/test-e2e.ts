import 'dotenv/config';
import { App } from 'octokit';
import { buildPrompt } from '../prompt/builder.js';
import OpenAI from 'openai';
import type { ParsedDiff } from '../types/index.js';

async function main() {
  const pk = process.env.GITHUB_PRIVATE_KEY!;
  const appId = process.env.GITHUB_APP_ID!;

  console.log('=== 1. 获取安装 Token ===');
  const app = new App({ appId, privateKey: pk });
  const instResp = await fetch('https://api.github.com/app/installations', {
    headers: { Authorization: `Bearer ${app.getSignedJsonWebToken?.() || ''}`, Accept: 'application/vnd.github+json' },
  });
  
  // Use App to get octokit directly
  const installations = await app.eachInstallation.iterator();
  let octokit: any = null;
  for await (const { installation, octokit: octo } of installations) {
    if (installation.account?.login === 'MichaelZ1102' || true) {
      octokit = octo;
      console.log('Installation:', installation.id);
      break;
    }
  }

  if (!octokit) {
    // Fallback: manually get installation
    const jwt = (await import('jsonwebtoken')).default;
    const now = Math.floor(Date.now() / 1000);
    const token = jwt.sign({ iat: now - 60, exp: now + 600, iss: appId }, pk, { algorithm: 'RS256' });
    const insts = await fetch('https://api.github.com/app/installations', {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
    }).then(r => r.json());
    const installId = insts[0]?.id;
    console.log('Installation ID (manual):', installId);
    octokit = await app.getInstallationOctokit(installId);
  }

  // 2. 获取 PR diff
  console.log('\n=== 2. 获取 PR diff ===');
  const files = await octokit.paginate(octokit.rest.pulls.listFiles, {
    owner: 'MichaelZ1102', repo: 'PRscribe', pull_number: 1, per_page: 100,
  });
  console.log('文件数:', files.length);
  console.log('文件:', files[0]?.filename, `+${files[0]?.additions}/-${files[0]?.deletions}`);

  // 3. 构建 Prompt
  console.log('\n=== 3. 构建 Prompt ===');
  const diff: ParsedDiff = {
    files: files.slice(0, 500).map((f: any) => ({
      path: f.filename, type: f.status as any,
      additions: f.additions || 0, deletions: f.deletions || 0,
      content: f.patch || '', language: 'Text',
    })),
    totalAdditions: files.reduce((s: number, f: any) => s + (f.additions || 0), 0),
    totalDeletions: files.reduce((s: number, f: any) => s + (f.deletions || 0), 0),
    totalFiles: files.length,
    isTooLarge: files.length > 500,
    repoFullName: 'MichaelZ1102/PRscribe',
    pullNumber: 1,
  };
  const prompt = buildPrompt(diff);
  console.log('Token 数:', prompt.totalTokens);
  console.log('截断:', prompt.truncated);

  // 4. 调用 LLM
  console.log('\n=== 4. 调用 LLM ===');
  const client = new OpenAI({
    apiKey: process.env.LLM_API_KEY,
    baseURL: process.env.LLM_BASE_URL,
    timeout: 15000,
    maxRetries: 2,
  });
  const response = await client.chat.completions.create({
    model: process.env.LLM_MODEL!,
    messages: [
      { role: 'system', content: prompt.system },
      { role: 'user', content: prompt.user },
    ],
    temperature: 0.3,
    max_tokens: 2000,
  });
  const description = response.choices?.[0]?.message?.content?.trim() || '';
  console.log('LLM 返回长度:', description.length);
  console.log('\n=== 生成结果 ===');
  console.log(description.slice(0, 800));

  // 5. 发布评论
  if (description) {
    console.log('\n=== 5. 发布 PR 评论 ===');
    const comment = `## 📋 PR 描述\n\n${description}\n\n---\n> 🤖 此描述由 AI 自动生成，请审核后使用。`;
    await octokit.rest.issues.createComment({
      owner: 'MichaelZ1102', repo: 'PRscribe', issue_number: 1, body: comment,
    });
    console.log('✅ 评论已发布到 PR #1');
  }
}

main().catch(console.error);
