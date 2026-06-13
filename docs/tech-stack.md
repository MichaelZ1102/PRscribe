# 技术栈详解

## 1. 技术栈总览

| 层级 | 技术 | 版本 | 选型理由 |
|:----:|:----:|:----:|:---------|
| **运行时** | Node.js | 20 LTS | 生态最成熟，GitHub 官方 SDK 支持最好 |
| **语言** | TypeScript | 5.x | 类型安全，开发体验好 |
| **框架** | Hono.js | 4.x | 轻量、快速，支持 Express 中间件适配 |
| **GitHub SDK** | octokit | 4.x | GitHub 官方 SDK，整合 App + Webhook 功能 |
| **LLM SDK** | OpenAI SDK | 4.x | 质量最佳的通用模型 |
| **队列** | BullMQ + Upstash Redis | 最新 | 可靠的异步任务队列 |
| **缓存/存储** | Upstash Redis | 最新 | Serverless Redis，免费 tier（MVP 唯一数据层） |
| **部署** | Railway / Fly.io | - | 长时间运行进程，不受 Serverless 超时限制 |
| **错误追踪** | Sentry | 最新 | 免费 tier，月 5K 错误 |
| **验证** | Zod | 3.x | 类型安全的运行时验证 |

## 2. 核心依赖

### package.json 核心依赖

```json
{
  "dependencies": {
    "hono": "^4.0.0",
    "octokit": "^4.0.0",
    "@octokit/webhooks": "^13.0.0",
    "openai": "^4.0.0",
    "bullmq": "^5.0.0",
    "ioredis": "^5.0.0",
    "zod": "^3.22.0",
    "jsonwebtoken": "^9.0.0",
    "dotenv": "^16.0.0",
    "@sentry/node": "^8.0.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vitest": "^1.0.0",
    "@types/node": "^20.0.0",
    "@types/jsonwebtoken": "^9.0.0"
  }
}
```

## 3. GitHub App 配置

### 需要的权限

| 权限 | 级别 | 用途 |
|:----:|:----:|:-----|
| **Pull requests** | Read & Write | 读取 PR diff，写入评论 |
| **Contents** | Read | 读取仓库内容（可选，用于获取上下文） |
| **Metadata** | Read | 获取仓库基本信息 |
| **Issues** | Read & Write | 写入评论到 PR（PR 本质是 Issue） |

### 需要订阅的事件

- `pull_request` — 监听 PR 创建/更新

## 4. 开发环境

| 工具 | 版本 | 用途 |
|:----:|:----:|:-----|
| **Node.js** | 20 LTS | 运行时 |
| **pnpm** | 9.x | 包管理器（比 npm/yarn 更快，磁盘节约） |
| **ngrok** | 最新 | 本地开发暴露 Webhook 到公网 |
| **GitHub CLI** | 最新 | 测试和调试 |
| **VS Code** | 最新 | IDE |
| **Insomnia/curl** | - | API 测试 |

## 5. LLM 模型策略

### MVP 策略（保持简单）

```
统一使用：GPT-4o-mini（或任意 OpenAI 兼容 API）
```

### 支持任意 OpenAI 兼容 API

本项目使用 `openai` SDK v4，支持通过 `LLM_BASE_URL` 切换到任意 OpenAI 兼容 API：

| 服务 | base_url | 推荐模型 | 特点 |
|:----|:---------|:---------|:-----|
| **OpenAI** | `https://api.openai.com/v1` | `gpt-4o-mini` | 质量最高 |
| **OpenRouter** | `https://openrouter.ai/api/v1` | `openai/gpt-4o-mini` | 多模型聚合，支持支付宝 |
| **DeepSeek** | `https://api.deepseek.com/v1` | `deepseek-chat` | 极便宜，¥0.5/M input |
| **Groq** | `https://api.groq.com/openai/v1` | `llama-3.3-70b-versatile` | 免费，速度快 |
| **Together AI** | `https://api.together.xyz/v1` | `mistralai/Mixtral-8x22B-Instruct-v0.1` | 开源模型多 |

### 后续迭代策略

| 模型 | 时机 | 原因 |
|:----:|:----|:-----|
| **GPT-4o-mini** | MVP | 足够生成高质量 PR 描述，$0.15/M input token |
| **GPT-4o** | 质量不够时升级 | $2.5/M input token，质量更高 |
| **Claude Sonnet 4** | 大型 diff 处理 | 200K 上下文窗口 |

### 为什么 MVP 只用一个模型

1. PR 描述生成的复杂度远低于代码生成，GPT-4o-mini 足够
2. 三层降级（mini → 4o → Claude）增加大量复杂性
3. 上线后根据实际质量数据再决定是否需要升级

## 6. 架构注意事项

### Hono.js + Octokit 适配

`@octokit/webhooks` 的 `verify` 方法可以独立使用（不依赖 Express 中间件）：

```typescript
import { verify } from '@octokit/webhooks';
// 直接调用 verify(secret, payload, signature)，无需中间件
```

### 为什么不用 @octokit/app

`octokit` v4 已经整合了 GitHub App 的全部功能，`@octokit/app` 是额外封装层，MVP 阶段不需要。

### 为什么不用 PostgreSQL（MVP）

| 数据用途 | MVP 方案 | 原因 |
|:---------|:---------|:-----|
| 任务队列 | BullMQ + Redis | 必须，异步处理核心 |
| 幂等性去重 | Redis Set + TTL | 简单高效 |
| 限流计数 | Redis Sliding Window | 原子操作 |
| 用量跟踪 | Redis Hash | 计数即可，不涉及关联查询 |

等 v1.1 需要用户数据、团队管理、历史记录时再加 PostgreSQL。
