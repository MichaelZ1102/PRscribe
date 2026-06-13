# AI Pull Request 描述生成器

> 一个 GitHub App，自动分析 PR diff 并生成专业的 PR 标题、描述、变更摘要、测试建议和影响范围说明。
>
> 目标用户：GitHub 上的软件团队
> 定价：$9/月（个人），$49/月（团队）
> 技术栈：Node.js + TypeScript + Hono.js + BullMQ + OpenAI

## 产品定位

**一句话：** 开发者提交 PR 时，自动生成高质量、标准化、可直接用的 PR 描述。

**核心价值：**
- 消除「不想写 PR 描述」的心理阻力
- 统一团队 PR 描述格式，提升 Code Review 效率
- 自动生成测试建议和影响范围，降低漏测风险

---

## 架构概览

```
GitHub Webhook → POST /api/v1/webhook
  → 签名验证 (x-hub-signature-256)
  → 幂等性去重 (delivery_id ↔ Redis)
  → 限流检查 (Redis 滑动窗口)
  → 事件路由 → BullMQ Queue
    → 消费者出队
      → Octokit 获取 PR diff（自动分页）
      → Prompt Builder 组装
      → LLM 生成描述（GPT-4o-mini，2 次重试）
      → Markdown 解析（多正则 fallback）
      → 发布 PR 评论

部署: Railway / Fly.io（自托管 Node.js）
队列: Upstash Redis（BullMQ）
LLM: OpenAI 兼容 API（OpenRouter / DeepSeek / Groq）
```

---

## 快速开始

### 前置条件

1. **GitHub App** — 在 https://github.com/settings/apps/new 注册
2. **Redis** — 创建 Upstash 免费实例
3. **LLM API Key** — OpenAI / OpenRouter / DeepSeek / Groq

### 本地运行

```bash
# 1. 安装依赖
pnpm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，填入 GitHub App 凭证 + LLM API Key + Redis URL

# 3. 启动 ngrok / localtunnel
npx localtunnel --port 3000
# → 得到 https://xxx.loca.lt，更新 GitHub App Webhook URL

# 4. 启动服务
pnpm dev
```

### 验证

```bash
curl http://localhost:3000/api/v1/health
# → {"status":"ok","checks":{"redis":"connected","github_app":"valid"}}
```

---

## API 端点

| 方法 | 路径 | 说明 |
|:----:|:-----|:-----|
| `POST` | `/api/v1/webhook` | 接收 GitHub Webhook（异步，返回 202） |
| `GET` | `/api/v1/health` | 健康检查（Redis + GitHub App JWT） |

### 健康检查响应

```json
{
  "status": "ok",
  "timestamp": "2026-06-13T00:00:00Z",
  "version": "0.1.0",
  "checks": {
    "redis": "connected",
    "github_app": "valid"
  }
}
```

---

## 项目结构

```
PR-tool/
├── src/
│   ├── index.ts                 # 入口（Sentry + 队列消费者）
│   ├── config.ts                # Zod 配置验证
│   ├── types/index.ts           # Discriminated Union 类型定义
│   │
│   ├── routes/
│   │   ├── webhook.ts           # POST /api/v1/webhook（挂载限流中间件）
│   │   ├── webhook-handler.ts   # 签名验证 → 幂等性 → 事件路由
│   │   ├── event-router.ts      # 可扩展的事件处理器注册机制
│   │   └── health.ts            # GET /api/v1/health
│   │
│   ├── middleware/
│   │   ├── error-handler.ts     # 统一错误响应格式
│   │   └── rate-limiter.ts      # Redis 滑动窗口限流 + 仓库日限
│   │
│   ├── github/
│   │   ├── auth.ts              # GitHub App JWT 生成（RS256）
│   │   ├── diff-fetcher.ts      # Octokit 获取 PR diff（自动分页）
│   │   └── format.ts            # PR 评论 Markdown 格式化
│   │
│   ├── prompt/
│   │   ├── template.ts          # PR 描述生成 prompt 模板（80 字软限制）
│   │   └── builder.ts           # Prompt 组装 + Token 估算 + 截断
│   │
│   ├── llm/
│   │   └── client.ts            # LLM 调用 + 2 次指数退避重试 + Markdown 解析
│   │
│   ├── queue/
│   │   ├── redis.ts             # Redis 长连接管理
│   │   ├── producer.ts          # BullMQ 队列生产
│   │   └── consumer.ts          # 队列消费（diff → LLM → 评论）
│   │
│   └── tests/
│       └── unit.test.ts         # 11 个单元测试
│
├── docs/
│   ├── architecture.md          # 系统架构设计
│   ├── api-design.md            # API 接口规范
│   ├── tech-stack.md            # 技术栈详解
│   ├── development-plan.md      # 2 周 MVP 开发计划
│   ├── prerequisites.md         # 前置条件清单
│   ├── blockers.md              # 实施阻塞项与解决方案
│   └── deployment.md            # 生产环境部署指南
│
├── .env.example                 # 环境变量模板
├── vitest.config.ts             # Vitest 配置
├── tsconfig.json
└── package.json
```

---

## 技术栈

| 层级 | 技术 | 说明 |
|:----|:-----|:------|
| **运行时** | Node.js 20 + TypeScript 5 | 类型安全 |
| **框架** | Hono.js 4 | 轻量，Serverless 友好 |
| **GitHub SDK** | Octokit 5 | 自动 JWT → Token 认证 |
| **LLM** | OpenAI SDK（兼容 OpenRouter / DeepSeek / Groq） | 可切换 baseURL |
| **队列** | BullMQ + Upstash Redis | 异步处理 + 幂等性 |
| **限流** | Redis 滑动窗口 | 30s 窗口 / 仓库日限 100 |
| **监控** | Sentry（可选） | 错误追踪 |
| **测试** | Vitest | 11 个单元测试 |

---

## 端到端流程

```
1. 开发者创建 PR
2. GitHub 发送 pull_request.opened webhook
3. 签名验证（x-hub-signature-256）
4. 幂等性检查（delivery_id，24h TTL）
5. Redis 滑动窗口限流
6. 事件路由 → BullMQ 队列（返回 202）
7. 消费者出队
8. Octokit 自动分页获取 PR 文件列表
9. Prompt Builder 组装 diff + 模板
10. LLM 调用生成 Markdown 描述
11. 多正则 fallback 解析结构化内容
12. 发布 PR 评论
```

---

## 当前状态

| Phase | 任务 | 状态 |
|:------|:----|:----:|
| Phase 1 | 准备期（GitHub App / 脚手架 / Redis） | ✅ |
| Phase 2 | GitHub App Skeleton（Webhook / 签名 / 幂等 / 限流） | ✅ |
| Phase 3 | Diff + Prompt 核心（Diff Fetcher / Prompt Builder） | ✅ |
| Phase 4 | LLM 集成（生成 / 解析 / 队列消费者） | ✅ |
| Phase 5 | 测试 + 上线（Sentry / 单元测试 / 部署文档） | ✅ |
| **总计** | **29 个任务 / 1,334 行代码** | **✅ 全部完成** |

---

## 部署

详见 [docs/deployment.md](./docs/deployment.md)

### 生产 Checklist

- [ ] Railway / Fly.io 项目创建
- [ ] 环境变量全部配置
- [ ] Webhook URL 更新为生产地址
- [ ] GitHub App 权限已验证
- [ ] 健康检查返回 ok
- [ ] SWA 测试仓库创建 PR 验证

---

## 文档索引

| 文档 | 说明 |
|:-----|:------|
| [PRD](./PRD.md) | 产品需求文档 |
| [架构设计](./docs/architecture.md) | 系统架构和技术方案 |
| [技术栈](./docs/tech-stack.md) | 技术栈详解和选型理由 |
| [API 设计](./docs/api-design.md) | API 接口规范 |
| [开发计划](./docs/development-plan.md) | 2 周 MVP 开发路线图 |
| [前置条件](./docs/prerequisites.md) | 开发前需要准备的资源 |
| [部署指南](./docs/deployment.md) | 生产环境部署步骤 |
| [环境变量模板](./.env.example) | 开发环境变量配置 |

---
