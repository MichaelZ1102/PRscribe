import { z } from "zod";

// ──────────────────────────────────────────────────────
// Zod schemas for runtime validation
// ──────────────────────────────────────────────────────

/** A single changed file entry extracted from the 变更详情 table */
export const ChangedFileSchema = z.object({
  file: z.string().min(1, "文件路径不能为空"),
  changeType: z.string().min(1, "变更类型不能为空"),
  description: z.string().default(""),
});
export type ChangedFile = z.infer<typeof ChangedFileSchema>;

/** Brief summary section extracted from 变更摘要 */
export const SummarySchema = z.object({
  whatDone: z.string().default(""),
  whyDone: z.string().default(""),
  briefImpact: z.string().default(""),
});
export type Summary = z.infer<typeof SummarySchema>;

/** Detailed impact scope extracted from 影响范围 section */
export const ImpactScopeDetailedSchema = z.object({
  breakingChange: z.string().default(""),
  docsToUpdate: z.string().default(""),
  relatedIssues: z.string().default(""),
});
export type ImpactScopeDetailed = z.infer<typeof ImpactScopeDetailedSchema>;

/** Full parsed PR description from LLM Markdown output */
export const PRDescriptionSchema = z.object({
  /** Extracted concise PR title */
  title: z.string().default(""),
  /** Structured summary (做了什么 / 为什么做 / 影响范围) */
  summary: SummarySchema.default({}),
  /** Parsed list of changed files from the table */
  changedFiles: z.array(ChangedFileSchema).default([]),
  /** Test suggestions from the 🧪 section */
  testSuggestions: z.array(z.string()).default([]),
  /** Detailed impact scope from the ⚠️ section */
  impactScopeDetailed: ImpactScopeDetailedSchema.default({}),
  /** The complete original Markdown text */
  fullDescription: z.string().default(""),
  /** AI disclaimer text (e.g. "此描述由 AI 自动生成") */
  aiDisclaimer: z.string().default(""),
});
export type PRDescription = z.infer<typeof PRDescriptionSchema>;

// ──────────────────────────────────────────────────────
// Parse result types
// ──────────────────────────────────────────────────────

/** Outcome of a single parse attempt */
export interface ParseResult {
  success: boolean;
  data: PRDescription | null;
  error: string | null;
}

/**
 * Service-level return type (as defined in API design §7).
 * Maps from the richer internal PRDescription to the
 * consumer-facing result shape.
 */
export interface PRDescriptionResult {
  success: boolean;
  title?: string;
  description?: string;
  summary?: string;
  testSuggestions?: string[];
  impactScope?: string[];
  error?: string;
}
