/**
 * PR 描述格式化的 markdown 模板
 * 用于将 LLM 生成的结构化内容发布到 PR 评论
 */

export function formatPRComment(description: string): string {
  return `## 📋 PR 描述\n\n${description}\n\n---\n> 🤖 此描述由 AI 自动生成，请审核后使用。`;
}
