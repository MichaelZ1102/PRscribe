import { describe, it, expect } from "vitest";
import { parsePRDescription, toPRDescriptionResult } from "./markdown-parser.js";

// ──────────────────────────────────────────────────────
// Sample fixture: full Markdown output from LLM
// ──────────────────────────────────────────────────────
const FULL_MARKDOWN = `## 📋 PR 描述 (由 AI 自动生成)

### 标题
feat: 添加用户认证模块

### 变更摘要
- **做了什么：** 实现了基于 JWT 的用户注册和登录功能
- **为什么做：** 之前的版本缺少认证机制，存在安全风险
- **影响范围：** src/auth、src/middleware

### 变更详情
| 文件 | 变更类型 | 说明 |
|------|---------|------|
| src/auth/login.ts | 新增 | 实现用户登录逻辑，包含 JWT token 生成 |
| src/auth/register.ts | 新增 | 实现用户注册逻辑，含密码加密存储 |
| src/middleware/auth.ts | 修改 | 添加 JWT 验证中间件，保护需要认证的路由 |
| src/types/user.ts | 修改 | 添加 User 类型定义和 JWT payload 接口 |

### 🧪 测试建议
- [ ] 单元测试：验证 JWT token 生成和验证的正确性
- [ ] 单元测试：测试密码加密和比对功能
- [ ] 集成测试：确认登录-注册-访问受保护资源完整流程

### ⚠️ 影响范围
- **破坏性变更：** 否，新增功能与现有 API 完全兼容
- **需要更新的文档：** README.md（添加认证流程说明）
- **相关 Issue：** #42, #45

---

> 🤖 此描述由 AI 自动生成，请审核后使用。`;

describe("parsePRDescription", () => {
  it("parses a full markdown output correctly", () => {
    const result = parsePRDescription(FULL_MARKDOWN);

    expect(result.success).toBe(true);
    expect(result.error).toBeNull();
    expect(result.data).not.toBeNull();

    const d = result.data!;
    expect(d.title).toBe("feat: 添加用户认证模块");

    // Summary
    expect(d.summary.whatDone).toBe(
      "实现了基于 JWT 的用户注册和登录功能"
    );
    expect(d.summary.whyDone).toBe(
      "之前的版本缺少认证机制，存在安全风险"
    );
    expect(d.summary.briefImpact).toBe("src/auth、src/middleware");

    // Changed files
    expect(d.changedFiles).toHaveLength(4);
    expect(d.changedFiles[0]).toEqual({
      file: "src/auth/login.ts",
      changeType: "新增",
      description: "实现用户登录逻辑，包含 JWT token 生成",
    });
    expect(d.changedFiles[1]).toEqual({
      file: "src/auth/register.ts",
      changeType: "新增",
      description: "实现用户注册逻辑，含密码加密存储",
    });
    expect(d.changedFiles[3]).toEqual({
      file: "src/types/user.ts",
      changeType: "修改",
      description: "添加 User 类型定义和 JWT payload 接口",
    });

    // Test suggestions
    expect(d.testSuggestions).toHaveLength(3);
    expect(d.testSuggestions[0]).toBe(
      "单元测试：验证 JWT token 生成和验证的正确性"
    );
    expect(d.testSuggestions[2]).toBe(
      "集成测试：确认登录-注册-访问受保护资源完整流程"
    );

    // Impact scope
    expect(d.impactScopeDetailed.breakingChange).toBe(
      "否，新增功能与现有 API 完全兼容"
    );
    expect(d.impactScopeDetailed.docsToUpdate).toBe(
      "README.md（添加认证流程说明）"
    );
    expect(d.impactScopeDetailed.relatedIssues).toBe("#42, #45");

    // Full description (without disclaimer)
    expect(d.fullDescription).toContain("feat: 添加用户认证模块");
    expect(d.fullDescription).toContain("src/auth/login.ts");
    expect(d.fullDescription).not.toContain("此描述由 AI 自动生成");

    // Disclaimer
    expect(d.aiDisclaimer).toContain("此描述由 AI 自动生成");
  });

  it("returns the correct fullDescription without the disclaimer footer", () => {
    const result = parsePRDescription(FULL_MARKDOWN);
    const d = result.data!;

    // Should contain the sections but not "---" footer nor disclaimer
    expect(d.fullDescription).toContain("### 标题");
    expect(d.fullDescription).toContain("### 变更摘要");
    expect(d.fullDescription).toContain("### 变更详情");
    expect(d.fullDescription).toContain("### 🧪 测试建议");
    expect(d.fullDescription).toContain("### ⚠️ 影响范围");
    expect(d.fullDescription).not.toMatch(/> 🤖 此描述由 AI 自动生成/);
  });

  it("handles empty string input", () => {
    const result = parsePRDescription("");

    expect(result.success).toBe(false);
    expect(result.data).toBeNull();
    expect(result.error).toContain("Empty");
  });

  it("handles whitespace-only input", () => {
    const result = parsePRDescription("   \n  \n  ");

    expect(result.success).toBe(false);
    expect(result.data).toBeNull();
  });

  it("handles markdown with only a title section", () => {
    const md = `### 标题
minimal change`;

    const result = parsePRDescription(md);
    expect(result.success).toBe(true);
    expect(result.data!.title).toBe("minimal change");
    // Other sections should have defaults
    expect(result.data!.summary.whatDone).toBe("");
    expect(result.data!.changedFiles).toHaveLength(0);
    expect(result.data!.testSuggestions).toHaveLength(0);
  });

  it("handles sections without emoji prefixes", () => {
    const md = `### 标题
no-emoji test

### 变更摘要
- **做了什么：** something

### 影响范围
- **破坏性变更：** yes`;

    const result = parsePRDescription(md);
    expect(result.success).toBe(true);
    expect(result.data!.title).toBe("no-emoji test");
    expect(result.data!.summary.whatDone).toBe("something");
    expect(result.data!.impactScopeDetailed.breakingChange).toBe("yes");
  });

  it("handles colon variants (： vs :)", () => {
    const md = `### 变更摘要
- **做了什么：** colon-1
- **为什么做:** colon-2`;

    const result = parsePRDescription(md);
    expect(result.data!.summary.whatDone).toBe("colon-1");
    expect(result.data!.summary.whyDone).toBe("colon-2");
  });

  it("parses a table with pipe-padded content", () => {
    const md = `### 变更详情
| 文件 | 变更类型 | 说明 |
|------|---------|------|
| src/index.ts | 修改 | fixed bug |
| src/utils.ts | 新增 | added utility |`;

    const result = parsePRDescription(md);
    expect(result.data!.changedFiles).toHaveLength(2);
    expect(result.data!.changedFiles[0].file).toBe("src/index.ts");
    expect(result.data!.changedFiles[1].changeType).toBe("新增");
  });

  it("handles malformed table rows gracefully", () => {
    const md = `### 变更详情
| 文件 | 变更类型 | 说明 |
|------|---------|------|
| src/ok.ts | 修改 | ok |
| src/bad.ts | | 
| src/utils.ts | 新增 | utility added |`;

    const result = parsePRDescription(md);
    // Should skip the malformed row (missing changeType) and parse others
    expect(result.data!.changedFiles.length).toBe(2);
    expect(result.data!.changedFiles[0].file).toBe("src/ok.ts");
    expect(result.data!.changedFiles[1].file).toBe("src/utils.ts");
  });

  it("handles checklist items with checked [x] markers", () => {
    const md = `### 🧪 测试建议
- [x] 已完成：检查 A
- [ ] 待完成：检查 B`;

    const result = parsePRDescription(md);
    expect(result.data!.testSuggestions).toHaveLength(2);
    expect(result.data!.testSuggestions[0]).toBe("已完成：检查 A");
    expect(result.data!.testSuggestions[1]).toBe("待完成：检查 B");
  });

  it("extracts disclaimer without emoji variant", () => {
    const md = `### 标题
test

---

> 此描述由 AI 自动生成，请审核后使用。`;

    const result = parsePRDescription(md);
    expect(result.data!.aiDisclaimer).toContain("AI 自动生成");
    expect(result.data!.fullDescription).not.toContain("AI 自动生成");
  });
});

// ──────────────────────────────────────────────────────
// toPRDescriptionResult
// ──────────────────────────────────────────────────────

describe("toPRDescriptionResult", () => {
  it("converts a successful ParseResult to PRDescriptionResult", () => {
    const pr = parsePRDescription(FULL_MARKDOWN);
    const r = toPRDescriptionResult(pr);

    expect(r.success).toBe(true);
    expect(r.title).toBe("feat: 添加用户认证模块");
    expect(r.description).toContain("feat: 添加用户认证模块");

    // Summary should be a formatted string
    expect(r.summary).toContain("做了什么：");
    expect(r.summary).toContain("为什么做：");

    // Test suggestions
    expect(r.testSuggestions).toHaveLength(3);

    // Impact scope
    expect(r.impactScope).toHaveLength(3);
    expect(r.impactScope![0]).toContain("破坏性变更：");
  });

  it("returns failure result when parse failed", () => {
    const failed: any = { success: false, data: null, error: "bad input" };
    const r = toPRDescriptionResult(failed);

    expect(r.success).toBe(false);
    expect(r.error).toBe("bad input");
    expect(r.title).toBeUndefined();
  });

  it("omits empty fields from the result", () => {
    const md = "### 标题\nhello";
    const pr = parsePRDescription(md);
    const r = toPRDescriptionResult(pr);

    expect(r.success).toBe(true);
    expect(r.title).toBe("hello");
    expect(r.testSuggestions).toBeUndefined();
    expect(r.impactScope).toBeUndefined();
  });

  it("handles partial data in conversion", () => {
    const md = `### 标题
partial

### 变更摘要
- **做了什么：** only this`;

    const pr = parsePRDescription(md);
    const r = toPRDescriptionResult(pr);

    expect(r.success).toBe(true);
    expect(r.summary).toContain("做了什么：");
    expect(r.summary).not.toContain("为什么做：");
    expect(r.testSuggestions).toBeUndefined();
    expect(r.impactScope).toBeUndefined();
  });
});
