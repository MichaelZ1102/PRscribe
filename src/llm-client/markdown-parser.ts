import { z } from "zod";
import type {
  PRDescription,
  ParseResult,
  ChangedFile,
  Summary,
  ImpactScopeDetailed,
} from "../types/pr-description.js";

// ──────────────────────────────────────────────────────
// Regex patterns for section detection
// ──────────────────────────────────────────────────────

/** Match a section heading with optional emoji prefix before Chinese title.
 *  Emojis may include a variation selector (U+FE0F) when rendered as emoji text style. */
const HEADING_RE = /^###\s+(?:[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]\u{FE0F}?\s*)?(标题|变更摘要|变更详情|测试建议|影响范围)/u;

/** Match a bold key-value line: "- **xxx：** value" */
const BOLD_KEY_LINE = /^-\s*\*\*(.+?)[：:]\*\*\s*(.*)$/;

/** Match a markdown table row: "| cell1 | cell2 | cell3 |" — with optional leading whitespace */
const TABLE_ROW = /^\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.*?)\s*\|$/;

/** Match a checklist item: "- [ ] xxx" or "- [x] xxx" */
const CHECKLIST_ITEM = /^-\s*\[\s*[ xX]?\s*\]\s*(.*)$/;

/** Match the AI disclaimer footer */
const DISCLAIMER_RE = /^>\s*(?:🤖\s*)?此描述由\s*AI\s*自动生成/;

// ──────────────────────────────────────────────────────
// Section splitting helper
// ──────────────────────────────────────────────────────

interface Section {
  heading: string;
  body: string;
}

/**
 * Split a markdown document into sections by heading level 3 (###).
 * Returns sections with their Chinese heading names.
 */
function splitSections(markdown: string): Section[] {
  const lines = markdown.split("\n");
  const sections: Section[] = [];
  let currentHeading = "";
  let currentBody: string[] = [];

  for (const line of lines) {
    const match = line.match(HEADING_RE);
    if (match) {
      if (currentHeading) {
        sections.push({
          heading: currentHeading,
          body: currentBody.join("\n").trim(),
        });
      }
      currentHeading = match[1];
      currentBody = [];
    } else {
      currentBody.push(line);
    }
  }

  if (currentHeading) {
    sections.push({
      heading: currentHeading,
      body: currentBody.join("\n").trim(),
    });
  }

  return sections;
}

// ──────────────────────────────────────────────────────
// Individual section parsers
// ──────────────────────────────────────────────────────

/**
 * Extract title from body content after "### 标题".
 * The title is the first non-empty, non-quote line.
 */
function parseTitle(body: string): string {
  const lines = body
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith(">"));
  return lines[0] ?? "";
}

/**
 * Parse the 变更摘要 section.
 * Expects bullet points with bold keys:
 *   - **做了什么：** xxx
 *   - **为什么做：** xxx
 *   - **影响范围：** xxx
 */
function parseSummary(body: string): Summary {
  const summary: Summary = { whatDone: "", whyDone: "", briefImpact: "" };
  const lines = body.split("\n").map((l) => l.trim());

  for (const line of lines) {
    const match = line.match(BOLD_KEY_LINE);
    if (!match) continue;
    const [, key, value] = match;
    if (/做了什么/.test(key)) summary.whatDone = value.trim();
    else if (/为什么/.test(key)) summary.whyDone = value.trim();
    else if (/影响范围/.test(key)) summary.briefImpact = value.trim();
  }

  return summary;
}

/**
 * Parse a markdown table into ChangedFile entries.
 * Skips the header row and separator row (|---|---|).
 */
function parseTable(body: string): ChangedFile[] {
  const files: ChangedFile[] = [];
  const lines = body.split("\n").map((l) => l.trim());
  let headerPassed = false;

  for (const line of lines) {
    const match = line.match(TABLE_ROW);
    if (!match) continue;

    // Skip header row (contains "文件" / "File" etc.)
    if (!headerPassed) {
      headerPassed = true;
      continue;
    }

    // Skip separator row (e.g. |---|---|)
    if (/^[-:\s]+$/.test(match[1]) && /^[-:\s]+$/.test(match[2])) {
      continue;
    }

    files.push({
      file: match[1].trim(),
      changeType: match[2].trim(),
      description: (match[3] ?? "").trim(),
    });
  }

  return files;
}

/**
 * Parse the 测试建议 section.
 * Expects checklist items:
 *   - [ ] 单元测试：xxx
 *   - [ ] 集成测试：xxx
 */
function parseTestSuggestions(body: string): string[] {
  const suggestions: string[] = [];
  const lines = body.split("\n").map((l) => l.trim());

  for (const line of lines) {
    const match = line.match(CHECKLIST_ITEM);
    if (match) {
      suggestions.push(match[1].trim());
    }
  }

  return suggestions;
}

/**
 * Parse the 影响范围 section.
 * Expects bold key bullet points:
 *   - **破坏性变更：** xxx
 *   - **需要更新的文档：** xxx
 *   - **相关 Issue：** xxx
 */
function parseImpactScope(body: string): ImpactScopeDetailed {
  const scope: ImpactScopeDetailed = {
    breakingChange: "",
    docsToUpdate: "",
    relatedIssues: "",
  };
  const lines = body.split("\n").map((l) => l.trim());

  for (const line of lines) {
    const match = line.match(BOLD_KEY_LINE);
    if (!match) continue;
    const [, key, value] = match;
    if (/破坏性变更/.test(key)) scope.breakingChange = value.trim();
    else if (/文档/.test(key)) scope.docsToUpdate = value.trim();
    else if (/Issue|issue|问题/.test(key)) scope.relatedIssues = value.trim();
  }

  return scope;
}

/**
 * Extract AI disclaimer from the markdown.
 * Looks for lines starting with "> 此描述由 AI 自动生成".
 */
function parseDisclaimer(markdown: string): string {
  const lines = markdown.split("\n");
  for (const line of lines) {
    if (DISCLAIMER_RE.test(line.trim())) {
      return line.trim();
    }
  }
  return "";
}

/**
 * Strip the AI disclaimer footer from the full markdown.
 * Removes the "---" separator + disclaimer block from the end.
 * Handles blank lines between separator and disclaimer text.
 */
function stripDisclaimer(markdown: string): string {
  const lines = markdown.split("\n");
  const result: string[] = [];
  let afterSep = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!afterSep && line.trim() === "---") {
      afterSep = true;
      continue;
    }

    if (afterSep) {
      // Skip blank lines between --- and disclaimer
      if (line.trim() === "") continue;

      // Check if this line is the disclaimer
      if (DISCLAIMER_RE.test(line.trim())) {
        // Skip everything from here onward
        break;
      }

      // Not a disclaimer — restore the separator and keep this line
      afterSep = false;
      result.push("---");
      result.push(line);
      continue;
    }

    result.push(line);
  }

  return result.join("\n").trim();
}

// ──────────────────────────────────────────────────────
// Main parser function
// ──────────────────────────────────────────────────────

/**
 * Parse LLM-returned Markdown into a structured PRDescription object.
 *
 * Expected input format (PRD.md SS3.2):
 *
 * ## [emoji] PR heading
 * ### 标题
 * [title text]
 * ### 变更摘要
 * - **做了什么：** ...
 * - **为什么做：** ...
 * - **影响范围：** ...
 * ### 变更详情
 * | 文件 | 变更类型 | 说明 |
 * |------|---------|------|
 * | ... | ... | ... |
 * ### [emoji] 测试建议
 * - [ ] ...
 * ### [emoji] 影响范围
 * - **破坏性变更：** ...
 * - **需要更新的文档：** ...
 * - **相关 Issue：** ...
 * ---
 * > disclaimer
 *
 * Handles partial/malformed input gracefully —
 * missing sections result in empty defaults, not failure.
 */
export function parsePRDescription(markdown: string): ParseResult {
  try {
    if (!markdown || markdown.trim().length === 0) {
      return {
        success: false,
        data: null,
        error: "Empty markdown input — nothing to parse",
      };
    }

    const sections = splitSections(markdown);

    const sectionMap = new Map<string, string>();
    for (const sec of sections) {
      sectionMap.set(sec.heading, sec.body);
    }

    const title = parseTitle(sectionMap.get("标题") ?? "");
    const summary = parseSummary(sectionMap.get("变更摘要") ?? "");
    const changedFiles = parseTable(sectionMap.get("变更详情") ?? "");
    const testSuggestions = parseTestSuggestions(
      sectionMap.get("测试建议") ?? ""
    );
    const impactScopeDetailed = parseImpactScope(
      sectionMap.get("影响范围") ?? ""
    );
    const aiDisclaimer = parseDisclaimer(markdown);
    const fullDescription = stripDisclaimer(markdown);

    const data: PRDescription = {
      title,
      summary,
      changedFiles,
      testSuggestions,
      impactScopeDetailed,
      fullDescription,
      aiDisclaimer,
    };

    return { success: true, data, error: null };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Unknown parse error";
    return { success: false, data: null, error: message };
  }
}

/**
 * Convert the internal PRDescription to the consumer-facing
 * PRDescriptionResult shape defined in API design SS7.
 */
export function toPRDescriptionResult(
  parsed: ParseResult
): import("../types/pr-description.js").PRDescriptionResult {
  if (!parsed.success || !parsed.data) {
    return {
      success: false,
      error: parsed.error ?? "Parse failed",
    };
  }

  const d = parsed.data;

  return {
    success: true,
    title: d.title || undefined,
    description: d.fullDescription || undefined,
    summary: formatSummaryText(d.summary),
    testSuggestions:
      d.testSuggestions.length > 0 ? d.testSuggestions : undefined,
    impactScope: formatImpactScope(d.impactScopeDetailed),
  };
}

function formatSummaryText(summary: Summary): string | undefined {
  const parts: string[] = [];
  if (summary.whatDone) parts.push(`做了什么：${summary.whatDone}`);
  if (summary.whyDone) parts.push(`为什么做：${summary.whyDone}`);
  if (summary.briefImpact) parts.push(`影响范围：${summary.briefImpact}`);
  return parts.length > 0 ? parts.join("\n") : undefined;
}

function formatImpactScope(
  scope: ImpactScopeDetailed
): string[] | undefined {
  const items: string[] = [];
  if (scope.breakingChange) items.push(`破坏性变更：${scope.breakingChange}`);
  if (scope.docsToUpdate) items.push(`需要更新的文档：${scope.docsToUpdate}`);
  if (scope.relatedIssues) items.push(`相关 Issue：${scope.relatedIssues}`);
  return items.length > 0 ? items : undefined;
}
