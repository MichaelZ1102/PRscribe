# API 接口设计

## 1. 概述

本项目核心接口分为三类：
1. **GitHub Webhook** — 被动接收 GitHub 事件（异步处理，立即响应）
2. **健康检查** — 服务状态监控
3. **LLM Provider API** — 对外部 LLM 服务的调用（间接）

## 2. 版本约定

所有端点使用 `/api/v1/` 前缀，便于后续版本升级。

---

## 3. Webhook 端点

### POST /api/v1/webhook

接收 GitHub 发出的 Webhook 事件。

**⚠️ 异步处理：** 端点接收 webhook 后立即返回 202，实际处理由后台队列消费。

**请求 Headers：**

| Header | 说明 | 必填 |
|:-------|:-----|:----:|
| `x-hub-signature-256` | Webhook 签名（SHA256） | 是 |
| `x-github-event` | 事件类型（如 `pull_request`） | 是 |
| `x-github-delivery` | 事件唯一 ID（用于幂等去重） | 是 |

**请求 Body：** GitHub Webhook 事件 payload（JSON）

**响应：**

| 状态码 | 说明 |
|:------:|:-----|
| 202 | Webhook 接收成功，已加入处理队列 |
| 200 | 事件已处理过（幂等性命中，忽略重复） |
| 400 | 签名验证失败 |
| 429 | 速率限制命中 |

**幂等性说明：**
- 以 `x-github-delivery` 为唯一标识
- Redis Set 中已存在的 delivery_id 直接返回 200（忽略）
- delivery_id 有效期 24 小时
- 防止 GitHub 重试机制导致重复处理

**示例：**

```bash
curl -X POST http://localhost:3000/api/v1/webhook \
  -H "Content-Type: application/json" \
  -H "x-hub-signature-256: sha256=..." \
  -H "x-github-event: pull_request" \
  -H "x-github-delivery: abc123-..." \
  -d '{
    "action": "opened",
    "pull_request": {
      "number": 1,
      "html_url": "https://github.com/owner/repo/pull/1",
      "title": "Add new feature",
      "body": null
    },
    "repository": {
      "full_name": "owner/repo",
      "clone_url": "https://github.com/owner/repo.git"
    }
  }'
```

## 4. 健康检查

### GET /api/v1/health

检查服务是否正常运行。

**响应示例：**

```json
{
  "status": "ok",
  "timestamp": "2026-06-13T00:00:00Z",
  "version": "1.0.0",
  "checks": {
    "redis": "connected",
    "github_app": "valid",
    "queue": "active"
  }
}
```

**检测项：**

| 检测项 | 正常值 | 说明 |
|:------|:------|:-----|
| `redis` | `connected` / `disconnected` | Redis 连接状态 |
| `github_app` | `valid` / `invalid` | GitHub App JWT 可正常生成 |
| `queue` | `active` / `inactive` | 队列消费者是否在运行 |

## 5. GitHub API 调用（我方发出）

### 5.1 获取 PR Diff

```
GET /repos/{owner}/{repo}/pulls/{pull_number}
Headers:
  Accept: application/vnd.github.diff
  Authorization: Bearer {installation_token}
  X-GitHub-Api-Version: 2022-11-28
```

### 5.2 发布 PR 评论

```
POST /repos/{owner}/{repo}/issues/{issue_number}/comments
Headers:
  Authorization: Bearer {installation_token}
  Content-Type: application/json
  X-GitHub-Api-Version: 2022-11-28

Body:
{
  "body": "## 📋 PR 描述\n\n由 AI 自动生成..."
}
```

## 6. LLM Provider API 调用（我方发出）

### 6.1 OpenAI Chat Completion

```
POST https://api.openai.com/v1/chat/completions
Headers:
  Authorization: Bearer {openai_api_key}
  Content-Type: application/json

Body:
{
  "model": "gpt-4o-mini",
  "messages": [
    {"role": "system", "content": "你是一个专业的 PR 描述生成器..."},
    {"role": "user", "content": "已渲染完成的完整 prompt（含 diff 内容）"}
  ],
  "temperature": 0.3,
  "max_tokens": 2000
}
```

**注意：** `user.content` 应该在 Prompt Builder 中提前渲染好完整的 prompt（含 diff），示例中不适用模板变量。

## 7. 错误响应格式

所有 API 端点统一的错误响应格式：

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "请求过于频繁，请 30 秒后重试",
    "status": 429
  }
}
```

### 错误码定义

| Code | HTTP Status | 说明 |
|:----:|:-----------:|:-----|
| `INVALID_SIGNATURE` | 400 | Webhook 签名验证失败 |
| `IDEMPOTENCY_REPLAY` | 200 | 幂等性命中，事件已处理过 |
| `RATE_LIMIT_EXCEEDED` | 429 | 速率限制 |
| `DIFF_TOO_LARGE` | 422 | PR diff 超出处理阈值 |
| `LLM_ERROR` | 502 | LLM API 调用失败 |
| `GITHUB_API_ERROR` | 502 | GitHub API 调用失败 |
| `INTERNAL_ERROR` | 500 | 服务器内部错误 |

## 8. 内部函数 API（非 HTTP）

```typescript
// PR 描述生成结果 — Discriminated Union 类型
type PRDescriptionResult = 
  | {
      success: true;
      title: string;
      description: string;       // 完整的 Markdown 描述
      summary: string;           // 变更摘要
      changeDetails: Array<{     // 变更详情
        file: string;
        type: 'added' | 'modified' | 'deleted';
        description: string;
      }>;
      testSuggestions: string[]; // 测试建议
      impactScope: string[];     // 影响范围
    }
  | {
      success: false;
      error: string;             // 错误信息
      errorCode: 'DIFF_TOO_LARGE' | 'LLM_ERROR' | 'EMPTY_RESULT';
    };

// 核心服务函数
async function processPullRequest(event: PullRequestEvent): Promise<PRDescriptionResult>;

// 事件参数
interface PullRequestEvent {
  installationId: number;
  owner: string;
  repo: string;
  pullNumber: number;
  action: 'opened' | 'synchronize';
  deliveryId: string;            // 用于幂等性
}
```
