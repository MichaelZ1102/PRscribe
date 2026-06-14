# PRscribe 用户使用手册

> AI 驱动的 Pull Request 描述自动生成工具  
> 支持 GitHub，自动分析 PR diff 并生成专业描述

---

## 目录

1. [产品简介](#1-产品简介)
2. [快速开始](#2-快速开始)
3. [安装 GitHub App](#3-安装-github-app)
4. [配置指南](#4-配置指南)
5. [使用场景](#5-使用场景)
6. [PR 描述格式说明](#6-pr-描述格式说明)
7. [常见问题](#7-常见问题)
8. [技术支持](#8-技术支持)

---

## 1. 产品简介

### 1.1 这是什么？

PRscribe 是一个 **GitHub App**，当你在仓库中创建或更新 Pull Request 时，它会自动：

1. 分析代码变更（diff）
2. 调用 AI 生成 PR 标题、描述、变更摘要
3. 以评论形式发布到 PR 中

### 1.2 核心价值

| 痛点 | PRscribe 的解决方式 |
|:-----|:--------------------|
| 不想写 PR 描述 | 提交 PR 后自动生成，零操作 |
| 描述质量参差不齐 | AI 统一生成结构化描述，格式规范 |
| Code Review 效率低 | 自动生成变更摘要、影响范围， Reviewer 一目了然 |
| 漏测风险 | 自动生成测试建议，提醒需要验证的点 |

### 1.3 定价

| 套餐 | 价格 | 适用场景 |
|:----|:----:|:---------|
| **Free** | $0 | 个人开源项目，每月 5 次生成 |
| **Pro** | $9/月 | 个人开发者，无限生成 |
| **Team** | $49/月 | 团队使用，自定义模板 + 统计 |
| **Enterprise** | $199/月 | 企业级部署，SSO + 审计日志 |

---

## 2. 快速开始

### 2.1 前置条件

- 拥有一个 GitHub 账号
- 拥有或管理一个 GitHub 仓库
- 该仓库不是空的（至少有一个文件）

### 2.2 安装 App

**1.** 打开安装链接（由管理员提供）：

```
https://github.com/apps/ai-pr-description-dev/installations/new
```

**2.** 选择仓库：

- 选择 **Only select repositories**
- 勾选你要使用 PRscribe 的仓库
- 点击 **Install**

![Install App](https://via.placeholder.com/600x300?text=Install+PRscribe+App)

**3.** 安装完成 ✅

### 2.3 验证安装

创建一个 Pull Request，PRscribe 会自动在 PR 中发布评论。

---

## 3. 安装 GitHub App

### 3.1 创建 App（管理员操作）

如果你是仓库管理员，需要先在 GitHub 上创建 App：

**1.** 打开 https://github.com/settings/apps/new

**2.** 填写基本信息：

| 字段 | 值 |
|:-----|:----|
| **GitHub App Name** | `your-company-pr-description` |
| **Homepage URL** | 你的服务部署地址 |
| **Webhook URL** | `https://your-domain.com/api/v1/webhook` |
| **Webhook Secret** | 生成一个随机字符串 |

**3.** 设置权限：

| 权限 | 级别 |
|:-----|:----:|
| Pull requests | **Read & Write** |
| Contents | **Read** |
| Metadata | **Read** |
| Issues | **Read & Write** |

**4.** 订阅事件：

- [x] **Pull request**

**5.** 保存并生成 Private Key

### 3.2 部署服务

PRscribe 需要部署一个后端服务来处理 Webhook 和调用 AI。

**部署方式：**

```
推荐：Railway / Fly.io / Render
方式：连接 GitHub 仓库，自动部署
配置：设置环境变量（见第 4 节）
```

### 3.3 更新 Webhook URL

部署完成后，将 GitHub App 的 Webhook URL 更新为你的部署地址：

```
https://your-app.onrender.com/api/v1/webhook
```

---

## 4. 配置指南

### 4.1 环境变量

| 变量 | 必填 | 说明 |
|:-----|:----:|:-----|
| `GITHUB_APP_ID` | ✅ | GitHub App 的 ID |
| `GITHUB_PRIVATE_KEY` | ✅ | GitHub App 的私钥（含 `-----BEGIN...END-----`） |
| `GITHUB_WEBHOOK_SECRET` | ✅ | Webhook Secret |
| `LLM_API_KEY` | ✅ | AI 模型的 API Key |
| `REDIS_URL` | ✅ | Redis 连接地址（用于队列和限流） |
| `LLM_BASE_URL` | ❌ | AI API 地址，默认 `https://api.openai.com/v1` |
| `LLM_MODEL` | ❌ | 模型名，默认 `gpt-4o-mini` |
| `SENTRY_DSN` | ❌ | 错误监控（可选） |

### 4.2 LLM 模型选择

PRscribe 支持任何 OpenAI 兼容的 API：

| 服务商 | Base URL | 推荐模型 | 特点 |
|:-------|:---------|:---------|:-----|
| **OpenAI** | `https://api.openai.com/v1` | `gpt-4o-mini` | 质量最高，需国际支付 |
| **OpenRouter** | `https://openrouter.ai/api/v1` | `openai/gpt-4o-mini` | 多模型聚合，支付宝 |
| **DeepSeek** | `https://api.deepseek.com/v1` | `deepseek-chat` | 极便宜，¥0.5/百万 token |
| **Groq** | `https://api.groq.com/openai/v1` | `llama-3.3-70b-versatile` | 免费，有限速 |

### 4.3 Redis 配置

推荐使用 Upstash（免费 tier 足够）：

```
# 免费额度：日 10K 请求，5MB 存储
# 创建地址：https://console.upstash.com
REDIS_URL=rediss://default:***@xxx.upstash.io:6379
```

---

## 5. 使用场景

### 5.1 新功能开发

```
开发者创建 PR → PRscribe 自动生成：
  📋 标题: feat: add user authentication middleware
  📋 变更摘要: 新增 JWT 认证中间件，包含 Token 验证和错误处理
  📋 变更详情: src/middleware/auth.ts, src/utils/jwt.ts
  📋 测试建议: 单元测试验证 Token 过期场景
```

### 5.2 Bug 修复

```
开发者创建 PR → PRscribe 自动生成：
  📋 标题: fix: handle null pointer in user profile query
  📋 变更摘要: 修复用户 profile 查询中可能出现的空指针异常
  📋 影响范围: 破坏性变更：否
  📋 测试建议: 集成测试验证 null 输入场景
```

### 5.3 代码重构

```
开发者创建 PR → PRscribe 自动生成：
  📋 标题: refactor: extract database connection pool
  📋 变更摘要: 将数据库连接逻辑抽取为独立连接池模块
  📋 变更详情: src/db/connection.ts → src/db/pool.ts
  📋 测试建议: 回归测试确保连接行为一致
```

### 5.4 文档更新

```
开发者创建 PR → PRscribe 自动生成：
  📋 标题: docs: update API reference for v2 endpoints
  📋 变更摘要: 更新 API 文档，新增 v2 端点的使用示例
  📋 影响范围: docs/api-v2.md, README.md
```

---

## 6. PR 描述格式说明

### 6.1 标准输出格式

PRscribe 生成的描述遵循统一的 Markdown 格式：

```markdown
## 📋 PR 描述（由 AI 自动生成）

### 标题
[简明的标题，基于变更内容]

### 变更摘要
- **做了什么：** [简要描述变更内容]
- **为什么做：** [推理变更原因]
- **影响范围：** [涉及的文件/模块]

### 变更详情
| 文件 | 变更类型 | 说明 |
|------|---------|------|
| src/file.ts | 修改 | [变更描述] |
| src/new.ts | 新增 | [变更描述] |

### 🧪 测试建议
- [ ] 单元测试：[具体的测试建议]
- [ ] 集成测试：[具体的测试建议]

### ⚠️ 影响范围
- **破坏性变更：** 是/否（说明原因）
- **需要更新的文档：** [列举需要更新的文档]
- **相关 Issue：** [如果有相关 Issue 请提及]

---

> 🤖 此描述由 AI 自动生成，请审核后使用。
```

### 6.2 各字段说明

| 字段 | 说明 | 限制 |
|:-----|:-----|:-----|
| **标题** | 一句话概括变更内容 | 80 字以内 |
| **变更摘要（做了什么）** | 描述具体的变更内容 | 2-3 句话 |
| **变更摘要（为什么做）** | AI 根据 diff 推断变更原因 | 基于代码逻辑推理 |
| **变更摘要（影响范围）** | 涉及的文件或模块路径 | - |
| **变更详情** | 表格形式列出每个文件 | 按文件展示 |
| **测试建议** | 基于具体变更的测试建议 | 必须具体，禁止空泛 |
| **影响范围** | 破坏性变更、需更新的文档 | - |

### 6.3 标题规则

- 控制在 80 字以内
- 基于变更内容生成，禁止编造
- 通常格式：`类型: 简要描述`
- 示例：`feat: add login API`, `fix: resolve timeout issue`

---

## 7. 常见问题

### Q: PRscribe 支持 GitLab 吗？

目前只支持 GitHub。GitLab 支持已在计划中。

### Q: 我的代码会被 PRscribe 存储吗？

不会。代码 diff 仅用于 AI 生成描述，生成后立即丢弃，不落盘、不存储。

### Q: AI 生成的描述准确吗？

经过测试，**80%+ 的生成描述可直接使用或仅需微调**。对于简单变更（新增文件、修改配置），准确率接近 100%。对于复杂业务逻辑变更，建议开发者审核后使用。

### Q: 生成的描述是什么语言？

取决于 diff 中的代码语言和注释语言。代码注释是中文就用中文，英文就用英文。

### Q: 如何关闭 PRscribe？

在仓库的 **Settings → GitHub Apps 管理** 中，可以随时卸载 App。

### Q: 为什么我的 PR 没有收到描述？

可能的原因：
1. **Webhook 未送达** — 检查 GitHub App 的 Webhook URL 是否正确
2. **服务休眠** — Render 免费版 15 分钟无请求后会休眠，GitHub 会在 1 分钟后重试
3. **变更过大** — 超过 500 个文件的 PR 会自动跳过
4. **每日配额用完** — Free 套餐每月 5 次，Pro 套餐无限

### Q: 如何重试生成？

在 PR 中评论 `@prscribe retry`，或者关闭后重新打开 PR。

### Q: 费用是多少？

| 套餐 | 价格 | 功能 |
|:-----|:----:|:------|
| Free | $0 | 5 次/月 |
| Pro | $9/月 | 无限次 |
| Team | $49/月 | 无限次 + 自定义模板 |
| Enterprise | $199/月 | 私有化部署 + SSO |

### Q: 需要自建服务器吗？

是的，PRscribe 是一个需要自部署的 GitHub App。部署到 Railway / Fly.io / Render 大约需要 10 分钟。

---

## 8. 技术支持

### 文档

- [产品需求文档](./PRD.md) — 详细了解产品设计
- [架构设计](./docs/architecture.md) — 系统架构说明
- [部署指南](./docs/deployment.md) — 部署到生产环境
- [API 设计](./docs/api-design.md) — API 接口规范

### 报告问题

在 GitHub 仓库提交 Issue：
```
https://github.com/MichaelZ1102/PRscribe/issues
```

### 功能建议

欢迎提交 Pull Request 或 Issue 讨论新功能。

---

> v0.1.0 | © 2026 PRscribe | Made with ❤️ and AI
