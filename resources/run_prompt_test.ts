#!/usr/bin/env tsx
/**
 * P3-06 Prompt 迭代优化 — 综合测试套件
 *
 * 1. 加载 12 个真实 PR diff
 * 2. 用 PromptBuilder 生成 v2 prompt
 * 3. 结构分析：各部分覆盖度、token 估算、截断情况
 * 4. 对每个 PR 调用 LLM 获取实际 PR 描述
 * 5. 质量评估：完整性、格式合规、变更类型匹配
 * 6. 结果汇总+对比
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import OpenAI from 'openai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIFFS_DIR = path.resolve(__dirname, 'pr-diffs');
const RESULTS_DIR = path.resolve(__dirname, 'test-results');
const PROMPT_TS_PATH = path.resolve(__dirname, '../src/prompt-templates/pr-description.ts');

// ============================================================================
// 1. 加载 PR diffs
// ============================================================================
interface PRDiff {
  repoFullName: string;
  prNumber: number;
  prTitle: string;
  prBody: string;
  prUrl: string;
  totalAdditions: number;
  totalDeletions: number;
  totalFiles: number;
  files: Array<{
    filename: string;
    status: string;
    additions: number;
    deletions: number;
    patch?: string;
  }>;
}

function loadDiffs(): PRDiff[] {
  const files = fs.readdirSync(DIFFS_DIR).filter(function(f) { return f.endsWith('.json'); }).sort();
  var diffs: PRDiff[] = [];
  for (var i = 0; i < files.length; i++) {
    var data = JSON.parse(fs.readFileSync(path.join(DIFFS_DIR, files[i]), 'utf-8'));
    diffs.push(data);
  }
  console.log('\u2713 Loaded ' + diffs.length + ' PR diffs from ' + DIFFS_DIR);
  return diffs;
}

// ============================================================================
// 2. 组装 prompt
// ============================================================================
function getPromptContent(): { system: string; userTemplate: string; quickTemplate: string } {
  var content = fs.readFileSync(PROMPT_TS_PATH, 'utf-8');
  var sysMatch = content.match(/export const SYSTEM_PROMPT = `([\s\S]*?)`;/);
  var userMatch = content.match(/export const USER_PROMPT_TEMPLATE = `([\s\S]*?)`;/);
  var quickMatch = content.match(/export const QUICK_PROMPT_TEMPLATE = `([\s\S]*?)`;/);
  return {
    system: sysMatch ? sysMatch[1] : '',
    userTemplate: userMatch ? userMatch[1] : '',
    quickTemplate: quickMatch ? quickMatch[1] : '',
  };
}

function statusLabel(status: string): string {
  var map: Record<string, string> = {
    added: '\u65b0\u589e', modified: '\u4fee\u6539', removed: '\u5220\u9664', renamed: '\u91cd\u547d\u540d', copied: '\u590d\u5236',
  };
  return map[status] || status;
}

function fillTemplate(template: string, data: PRDiff): string {
  var structuredDiff = data.files.map(function(f) {
    var label = statusLabel(f.status);
    var patch = f.patch || '(no diff content available)';
    return '### ' + f.filename + ' (' + label + ', +' + f.additions + '/-' + f.deletions + ')\n```diff\n' + patch + '\n```';
  }).join('\n\n');

  return template
    .replace('{{REPO_NAME}}', data.repoFullName)
    .replace('{{BASE_BRANCH}}', 'main')
    .replace('{{HEAD_BRANCH}}', 'pr-' + String(data.prNumber))
    .replace('{{FILE_COUNT}}', String(data.totalFiles))
    .replace('{{ADDITIONS}}', String(data.totalAdditions))
    .replace('{{DELETIONS}}', String(data.totalDeletions))
    .replace('{{STRUCTURED_DIFF}}', structuredDiff)
    .replace('{{DIFF_TEXT}}', data.files.map(function(f) {
      return 'diff --git a/' + f.filename + ' b/' + f.filename + '\n' + (f.patch || '(no diff)');
    }).join('\n'));
}

// ============================================================================
// 3. 结构分析
// ============================================================================
function analyzePrompt(system: string, user: string, data: PRDiff): {
  sectionCount: number;
  totalSections: number;
  tokenEstimate: number;
  issues: string[];
  details: Record<string, boolean>;
} {
  var full = system + '\n\n' + user;
  var issues: string[] = [];

  var sections = {
    hasTitle: full.indexOf('\u6807\u9898') >= 0,
    hasSummary: full.indexOf('\u53d8\u66f4\u6458\u8981') >= 0,
    hasChangeTable: full.indexOf('\u53d8\u66f4\u8be6\u60c5') >= 0,
    hasTestSuggestions: full.indexOf('\u6d4b\u8bd5\u5efa\u8bae') >= 0,
    hasImpactScope: full.indexOf('\u5f71\u54cd\u8303\u56f4') >= 0,
    hasTypeInference: system.indexOf('\u53d8\u66f4\u7c7b\u578b\u63a8\u65ad') >= 0,
    hasDiffSizeHandling: system.indexOf('Diff \u5927\u5c0f\u5904\u7406') >= 0,
    hasMixedFileTypes: system.indexOf('\u6df7\u5408\u6587\u4ef6\u7c7b\u578b') >= 0,
    hasChangesetAwareness: system.indexOf('Changeset') >= 0,
    hasWhyInference: system.indexOf('\u53d8\u66f4\u610f\u56fe\u63a8\u65ad') >= 0,
    hasSpecialCases: system.indexOf('\u7279\u6b8a\u573a\u666f') >= 0,
  };

  var sectionCount = 0;
  for (var k in sections) {
    if (sections[k]) sectionCount++;
  }
  var totalSections = 11;

  // Per-PR context-aware issues
  var totalChanges = data.totalAdditions + data.totalDeletions;
  if (totalChanges < 5 && !sections.hasDiffSizeHandling) {
    issues.push('small-diff: prompt lacks small diff handling guidance');
  }
  if (totalChanges > 500 && !sections.hasDiffSizeHandling) {
    issues.push('large-diff: prompt lacks large diff handling guidance');
  }

  var hasNonCode = false;
  for (var j = 0; j < data.files.length; j++) {
    if (/\.(md|json|yaml|yml|toml|snap|lock)$/i.test(data.files[j].filename)) {
      hasNonCode = true;
      break;
    }
  }
  if (hasNonCode && !sections.hasMixedFileTypes) {
    issues.push('mixed-filetypes: prompt lacks file type categorization guidance');
  }

  var hasChangeset = false;
  for (var k2 = 0; k2 < data.files.length; k2++) {
    if (data.files[k2].filename.indexOf('.changeset/') >= 0) {
      hasChangeset = true;
      break;
    }
  }
  if (hasChangeset && !sections.hasChangesetAwareness) {
    issues.push('changeset: prompt lacks changeset handling guidance');
  }

  if (/update\s+dependenc|chore\(deps\)/i.test(data.prTitle) && !sections.hasSpecialCases) {
    issues.push('dep-update: prompt lacks dependency-only guidance');
  }

  if ((data.prTitle.length < 30 || /^PR #/.test(data.prTitle)) && !sections.hasWhyInference) {
    issues.push('short-title: prompt lacks why-inference guidance for short titles');
  }

  if (data.totalFiles <= 2 && !sections.hasImpactScope) {
    issues.push('impact-scope: prompt should emphasize scope even for small PRs');
  }

  var tokenEstimate = Math.ceil(full.length / 4);

  return { sectionCount: sectionCount, totalSections: totalSections, tokenEstimate: tokenEstimate, issues: issues, details: sections };
}

// ============================================================================
// 4. LLM 调用
// ============================================================================
async function callLLM(system: string, user: string): Promise<{
  content: string;
  success: boolean;
  error?: string;
}> {
  var apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { content: '', success: false, error: 'No OPENAI_API_KEY configured' };
  }

  try {
    var openai = new OpenAI({ apiKey: apiKey });
    var response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    });

    var content = response.choices[0]?.message?.content || '';
    return { content: content, success: content.length > 0 };
  } catch (err: any) {
    return { content: '', success: false, error: err.message };
  }
}

// ============================================================================
// 5. 输出质量评估
// ============================================================================
function assessOutput(output: string): { score: number; maxScore: number; issues: string[]; details: Record<string, boolean> } {
  var issues: string[] = [];
  var score = 0;
  var maxScore = 14;

  var hasTitle = output.indexOf('\u6807\u9898') >= 0 || (/\n###/.test(output) && /PR|title|TITLE/.test(output));
  if (hasTitle) { score += 2; } else { issues.push('missing: PR title section'); }

  var hasSummary = output.indexOf('\u53d8\u66f4\u6458\u8981') >= 0 || output.indexOf('\u505a\u4e86\u4ec0\u4e48') >= 0;
  if (hasSummary) { score += 2; } else { issues.push('missing: change summary section'); }

  var hasTable = output.indexOf('| \u6587\u4ef6 |') >= 0 || output.indexOf('|\u6587\u4ef6|') >= 0;
  if (hasTable) { score += 2; } else { issues.push('missing: change detail table'); }

  var hasTests = output.indexOf('\u6d4b\u8bd5\u5efa\u8bae') >= 0;
  if (hasTests) { score += 2; } else { issues.push('missing: test suggestions'); }

  var hasImpact = output.indexOf('\u5f71\u54cd\u8303\u56f4') >= 0 || output.indexOf('\u7834\u574f\u6027\u53d8\u66f4') >= 0;
  if (hasImpact) { score += 2; } else { issues.push('missing: impact scope'); }

  var hasTypePrefix = /\[(Feature|Fix|Refactor|Chore|Docs|Style|Test|feat|fix|refactor|chore|docs|test|style)\]/i.test(output);
  if (hasTypePrefix) { score += 2; } else { issues.push('title: missing [Type] prefix'); }

  var hasTableRow = /\|\s*[\w./-]+\s*\|/.test(output);
  if (hasTableRow) { score += 2; } else { issues.push('table: missing file rows in change table'); }

  return {
    score: score,
    maxScore: maxScore,
    issues: issues,
    details: { hasTitle: hasTitle, hasSummary: hasSummary, hasTable: hasTable, hasTests: hasTests, hasImpact: hasImpact, hasTypePrefix: hasTypePrefix, hasTableRow: hasTableRow },
  };
}

// ============================================================================
// 6. 主流程
// ============================================================================
function classifyPR(data: PRDiff): string {
  var title = data.prTitle.toLowerCase();
  if (/update\s+dependenc|chore\(deps\)|renovate/.test(title)) return 'chore: dependency update';
  if (data.files.some(function(f) { return f.filename.indexOf('.github/workflows/') === 0; }) && data.totalAdditions + data.totalDeletions < 5) return 'chore: CI';
  if (data.files.some(function(f) { return f.filename === 'README.md'; }) && data.totalAdditions + data.totalDeletions < 5) return 'docs: trivial';
  if (data.totalAdditions + data.totalDeletions < 5 && data.totalFiles <= 2) return 'fix: trivial';
  if (/^feat|add\b|support\b|implement\b|introduce\b/.test(title)) return 'feat';
  if (/^fix|fix\b|correct\b|handle\b|prevent\b/.test(title)) return 'fix';
  if (/refactor/.test(title)) return 'refactor';
  if (/^chore/.test(title)) return 'chore';
  if (/^docs/.test(title)) return 'docs';
  return 'other';
}

async function main() {
  var diffs = loadDiffs();
  var prompts = getPromptContent();

  console.log('\n\u{1F4CB} Prompt template: ' + prompts.system.length + ' chars (system), ' + prompts.userTemplate.length + ' chars (user template)');
  console.log('   Sections present in system prompt:');
  var sysSections: Array<[string, boolean]> = [
    ['\u53d8\u66f4\u7c7b\u578b\u63a8\u65ad', prompts.system.indexOf('\u53d8\u66f4\u7c7b\u578b\u63a8\u65ad') >= 0],
    ['Diff \u5927\u5c0f\u5904\u7406', prompts.system.indexOf('Diff \u5927\u5c0f\u5904\u7406') >= 0],
    ['\u6df7\u5408\u6587\u4ef6\u7c7b\u578b', prompts.system.indexOf('\u6df7\u5408\u6587\u4ef6\u7c7b\u578b') >= 0],
    ['\u53d8\u66f4\u610f\u56fe\u63a8\u65ad', prompts.system.indexOf('\u53d8\u66f4\u610f\u56fe\u63a8\u65ad') >= 0],
    ['\u6d4b\u8bd5\u5efa\u8bae', prompts.system.indexOf('## \u6d4b\u8bd5\u5efa\u8bae') >= 0],
    ['\u5f71\u54cd\u8303\u56f4', prompts.system.indexOf('## \u5f71\u54cd\u8303\u56f4') >= 0],
    ['\u7279\u6b8a\u573a\u666f', prompts.system.indexOf('\u7279\u6b8a\u573a\u666f') >= 0],
  ];
  for (var si = 0; si < sysSections.length; si++) {
    console.log('   ' + (sysSections[si][1] ? '\u2713' : '\u2717') + ' ' + sysSections[si][0]);
  }

  // Structural analysis for all 12 diffs
  console.log('\n' + '='.repeat(70));
  console.log('\u{1F4CA} STRUCTURAL ANALYSIS (all ' + diffs.length + ' PRs)');
  console.log('='.repeat(70));

  var allIssues: string[] = [];
  var results: Array<{
    prName: string;
    prTitle: string;
    type: string;
    files: number;
    additions: number;
    deletions: number;
    tokenEstimate: number;
    sectionCount: number;
    totalSections: number;
    issues: string[];
    analysis: ReturnType<typeof analyzePrompt>;
  }> = [];

  for (var di = 0; di < diffs.length; di++) {
    var data = diffs[di];
    var userPrompt = fillTemplate(prompts.userTemplate, data);
    var analysis = analyzePrompt(prompts.system, userPrompt, data);
    var prType = classifyPR(data);

    results.push({
      prName: data.repoFullName + '#' + data.prNumber,
      prTitle: data.prTitle.slice(0, 60),
      type: prType,
      files: data.totalFiles,
      additions: data.totalAdditions,
      deletions: data.totalDeletions,
      tokenEstimate: analysis.tokenEstimate,
      sectionCount: analysis.sectionCount,
      totalSections: analysis.totalSections,
      issues: analysis.issues,
      analysis: analysis,
    });
    allIssues.push.apply(allIssues, analysis.issues);
  }

  // Summary by category
  var byType: Record<string, { names: string[]; sections: number[]; tokens: number[]; issues: string[] }> = {};
  for (var ri = 0; ri < results.length; ri++) {
    var r = results[ri];
    var cat = r.type.split(':')[0];
    if (!byType[cat]) byType[cat] = { names: [], sections: [], tokens: [], issues: [] };
    byType[cat].names.push(r.prName);
    byType[cat].sections.push(r.sectionCount);
    byType[cat].tokens.push(r.tokenEstimate);
    byType[cat].issues.push.apply(byType[cat].issues, r.issues);
  }

  console.log('');
  for (var catKey in byType) {
    var info = byType[catKey];
    var avgSec = info.sections.reduce(function(a, b) { return a + b; }, 0) / info.sections.length;
    var avgTok = info.tokens.reduce(function(a, b) { return a + b; }, 0) / info.tokens.length;
    console.log('  ' + catKey + ' (' + info.sections.length + ' PRs):');
    console.log('    Avg sections covered: ' + avgSec.toFixed(1) + '/11');
    console.log('    Avg token estimate: ' + Math.round(avgTok));
    var topIssues: string[] = [];
    for (var ii = 0; ii < info.issues.length; ii++) {
      if (topIssues.indexOf(info.issues[ii]) < 0) topIssues.push(info.issues[ii]);
    }
    if (topIssues.length) {
      console.log('    Issues: ' + topIssues.slice(0, 4).join(', '));
    }
    for (var ni = 0; ni < info.names.length; ni++) {
      var res = results.filter(function(x) { return x.prName === info.names[ni]; })[0];
      var icon = res.sectionCount >= 10 ? '\u2713' : res.sectionCount >= 7 ? '\u25b3' : '\u2717';
      console.log('    ' + icon + ' ' + res.prName + ': ' + res.sectionCount + '/11 sections, ~' + res.tokenEstimate + ' tokens');
    }
  }

  // Overall structural summary
  var allSectionsAvg = results.reduce(function(s, r) { return s + r.sectionCount; }, 0) / results.length;
  var allTokensAvg = results.reduce(function(s, r) { return s + r.tokenEstimate; }, 0) / results.length;
  var uniqueIssues: string[] = [];
  for (var ai = 0; ai < allIssues.length; ai++) {
    if (uniqueIssues.indexOf(allIssues[ai]) < 0) uniqueIssues.push(allIssues[ai]);
  }
  var cleanPRs = results.filter(function(r) { return r.issues.length === 0; });

  console.log('\n' + '='.repeat(70));
  console.log('\u2705 STRUCTURAL ANALYSIS COMPLETE');
  console.log('='.repeat(70));
  console.log('  Average section coverage: ' + allSectionsAvg.toFixed(1) + '/11 (' + (allSectionsAvg/11*100).toFixed(0) + '%)');
  console.log('  Average token estimate: ' + Math.round(allTokensAvg));
  console.log('  PRs with no issues: ' + cleanPRs.length + '/' + results.length);
  console.log('  Unique issue types: ' + uniqueIssues.length);

  if (uniqueIssues.length > 0) {
    console.log('\n  Remaining issues:');
    for (var ui = 0; ui < uniqueIssues.length; ui++) {
      var count = allIssues.filter(function(x) { return x === uniqueIssues[ui]; }).length;
      console.log('    [' + count + '/' + results.length + '] ' + uniqueIssues[ui]);
    }
  }

  // ==========================================================================
  // LLM inference (on a representative subset)
  // ==========================================================================
  console.log('\n' + '='.repeat(70));
  console.log('\u{1F916} LLM INFERENCE (sampling 6 PRs across categories)');
  console.log('='.repeat(70));

  // Representative sample
  var targetPRs: Array<{ repo: string; pr: number }> = [
    { repo: 'honojs/hono', pr: 3685 },       // feat (medium diff)
    { repo: 'shadcn-ui/ui', pr: 6965 },      // fix w/ changeset
    { repo: 'biomejs/biome', pr: 4500 },     // chore: dep (1-line CI)
    { repo: 'colinhacks/zod', pr: 3800 },    // docs: trivial (1-line)
    { repo: 'vitejs/vite', pr: 20163 },      // other (short title, large diff)
    { repo: 'vitestjs/vite', pr: 9262 },     // fix (medium)
  ];

  var samplePRs: PRDiff[] = [];
  for (var ti = 0; ti < targetPRs.length; ti++) {
    var t = targetPRs[ti];
    var found = diffs.filter(function(d) { return d.repoFullName === t.repo && d.prNumber === t.pr; });
    if (found.length > 0) samplePRs.push(found[0]);
  }

  var llmResults: Array<{ prName: string; quality: ReturnType<typeof assessOutput> }> = [];

  for (var si2 = 0; si2 < samplePRs.length; si2++) {
    var data2 = samplePRs[si2];
    var prName2 = data2.repoFullName + '#' + data2.prNumber;
    console.log('\n  Calling LLM for ' + prName2 + '...');
    console.log('    "' + data2.prTitle.slice(0, 70) + '"');
    console.log('    Files: ' + data2.totalFiles + ', +' + data2.totalAdditions + '/-' + data2.totalDeletions);

    var userPrompt2 = fillTemplate(prompts.userTemplate, data2);
    var llmResult = await callLLM(prompts.system, userPrompt2);

    if (llmResult.success) {
      var quality = assessOutput(llmResult.content);
      var pct = (quality.score / quality.maxScore * 100).toFixed(0);
      console.log('    \u2713 Generated ' + llmResult.content.length + ' chars, score: ' + quality.score + '/' + quality.maxScore + ' (' + pct + '%)');
      if (quality.issues.length) {
        for (var qi = 0; qi < quality.issues.length; qi++) {
          console.log('    \u26a0  ' + quality.issues[qi]);
        }
      }
      var preview = llmResult.content.replace(/\n/g, '\\n').slice(0, 150);
      console.log('    Preview: ' + preview + '...');
      llmResults.push({ prName: prName2, quality: quality });

      // Save output
      var outDir = path.join(RESULTS_DIR, 'llm-output');
      fs.mkdirSync(outDir, { recursive: true });
      var safeName = prName2.replace(/[/#]/g, '_');
      fs.writeFileSync(path.join(outDir, safeName + '.md'), llmResult.content, 'utf-8');
      console.log('    \u2713 Output saved to ' + path.join(outDir, safeName + '.md'));
    } else {
      console.log('    \u2717 LLM error: ' + llmResult.error);
    }
  }

  // LLM summary
  var llmAvgScore = 0;
  var llmAvgMax = 14;
  var allLLMIssues: string[] = [];
  if (llmResults.length > 0) {
    for (var lr = 0; lr < llmResults.length; lr++) {
      llmAvgScore += llmResults[lr].quality.score;
    }
    llmAvgScore = llmAvgScore / llmResults.length;
    llmAvgMax = llmResults[0].quality.maxScore;
    for (var lr2 = 0; lr2 < llmResults.length; lr2++) {
      for (var li = 0; li < llmResults[lr2].quality.issues.length; li++) {
        allLLMIssues.push(llmResults[lr2].quality.issues[li]);
      }
    }

    var uniqueLLMIssues: string[] = [];
    for (var al = 0; al < allLLMIssues.length; al++) {
      if (uniqueLLMIssues.indexOf(allLLMIssues[al]) < 0) uniqueLLMIssues.push(allLLMIssues[al]);
    }

    console.log('\n' + '='.repeat(70));
    console.log('\u{1F916} LLM INFERENCE SUMMARY');
    console.log('='.repeat(70));
    console.log('  PRs tested: ' + llmResults.length);
    console.log('  Average quality score: ' + llmAvgScore.toFixed(1) + '/' + llmAvgMax + ' (' + (llmAvgScore/llmAvgMax*100).toFixed(0) + '%)');

    if (uniqueLLMIssues.length) {
      console.log('\n  Issues in LLM output:');
      for (var uli = 0; uli < uniqueLLMIssues.length; uli++) {
        var cnt = allLLMIssues.filter(function(x) { return x === uniqueLLMIssues[uli]; }).length;
        console.log('    [' + cnt + '/' + llmResults.length + '] ' + uniqueLLMIssues[uli]);
      }
    }
  } else {
    console.log('\n  \u26a0 No LLM results to summarize (check API key)');
  }

  // ==========================================================================
  // Save results
  // ==========================================================================
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  var timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  var outPath = path.join(RESULTS_DIR, 'prompt-v2-test-results-' + timestamp + '.json');

  var remainingIssues: Array<{ issue: string; count: number }> = [];
  for (var ui2 = 0; ui2 < uniqueIssues.length; ui2++) {
    remainingIssues.push({
      issue: uniqueIssues[ui2],
      count: allIssues.filter(function(x) { return x === uniqueIssues[ui2]; }).length,
    });
  }

  var summaryData = {
    promptVersion: 'v2',
    testedAt: new Date().toISOString(),
    totalPRs: diffs.length,
    structuralAnalysis: {
      avgSectionCoverage: (allSectionsAvg/11*100).toFixed(0) + '%',
      avgTokenEstimate: Math.round(allTokensAvg),
      cleanPRs: cleanPRs.length,
      remainingIssues: remainingIssues,
    },
    llmInference: llmResults.length > 0 ? {
      prsTested: llmResults.length,
      avgScore: (llmAvgScore/llmAvgMax*100).toFixed(0) + '%',
      issues: (function() {
        var uis: string[] = [];
        for (var ai2 = 0; ai2 < allLLMIssues.length; ai2++) {
          if (uis.indexOf(allLLMIssues[ai2]) < 0) uis.push(allLLMIssues[ai2]);
        }
        return uis.map(function(i) {
          return { issue: i, count: allLLMIssues.filter(function(x) { return x === i; }).length };
        });
      })(),
      outputsSaved: RESULTS_DIR + '/llm-output/',
    } : null,
    results: results.map(function(r) {
      var resIssues: string[] = [];
      return {
        pr: r.prName,
        title: r.prTitle,
        type: r.type,
        files: r.files,
        changes: '+' + r.additions + '/-' + r.deletions,
        sectionCoverage: r.sectionCount + '/11',
        tokenEstimate: r.tokenEstimate,
        issues: r.issues,
      };
    }),
  };

  fs.writeFileSync(outPath, JSON.stringify(summaryData, null, 2), 'utf-8');
  console.log('\n\u{1F4DD} Full results saved to ' + outPath);
  console.log('\n\u2705 DONE');
}

main().catch(function(err) { console.error(err); process.exit(1); });
