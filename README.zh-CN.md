<p align="center">
  <img src="./assets/logo.svg" alt="PRscribe" width="120">
</p>

<h1 align="center">PRscribe</h1>

<p align="center">
  <strong>AI 自动生成 Pull Request 描述 — 从代码 diff 到专业描述，只需一次 PR。</strong>
  <br>
  一个 GitHub App，提交 PR 后自动分析代码变更，生成标题、描述、变更摘要和测试建议。
  <br>
  <strong>你只管写代码，PRscribe 帮你写文档。</strong>
</p>

<p align="center">
  <a href="#-快速开始">快速开始</a> •
  <a href="#-给开发者">给开发者</a> •
  <a href="#-给管理员">给管理员</a> •
  <a href="#-输出格式">输出格式</a> •
  <a href="#-常见问题">常见问题</a> •
  <a href="#-自部署">自部署</a>
</p>

---

## ✨ 这是什么？

PRscribe 是一个 **GitHub App**，当你创建或更新 Pull Request 时，它会自动分析代码变更（diff），调用 AI 生成结构化的 PR 描述，并以评论形式发布到 PR 中。

### 工作流程

```
你创建 PR → PRscribe 分析 diff → AI 生成描述 → 发布到 PR 评论区
```

**开发者零额外操作。** 正常提 PR，剩下的交给 PRscribe。

### 真实效果

| PR | AI 生成的标题 | 代码量 |
|:---|:-------------|:------:|
| [#5](https://github.com/MichaelZ1102/PRscribe/pull/5) | 新增平台适配器接口定义，抽象多平台支持能力 | +40 行 |
| [#6](https://github.com/MichaelZ1102/PRscribe/pull/6) | feat: 将环境变量验证改为降级模式 | +22/-19 行 |
| [#7](https://github.com/MichaelZ1102/PRscribe/pull/7) | 新增 CommentService 封装 PR 评论发布逻辑 | +74 行 |

---

## 🚀 快速开始

### 如果你是开发者（零配置）

如果团队已经安装了 PRscribe，你**不需要做任何额外操作**。

你的工作流完全不变：

```bash
git checkout -b feat/add-login-api
# ... 写代码 ...
git add .
git commit -m "feat: add login API"
git push origin feat/add-login-api
```

在 GitHub 上创建 PR → 等 **约 20 秒** → PRscribe 自动在评论区发布完整描述。

> 不需要安装任何工具，不需要学任何模板，不需要写任何额外内容。

### 如果你是管理员（3 步安装）

**第 1 步：** 安装 GitHub App

```
https://github.com/apps/ai-pr-description-dev/installations/new
```

选择要使用 PRscribe 的仓库。

**第 2 步：** 创建一个测试 PR 验证是否生效

**第 3 步：** 完成 ✅ — 之后每个 PR 都会自动生成描述。

---

## 👨‍💻 给开发者

### 你会看到的效果

创建 PR 后，PRscribe 会在评论区发布一条消息：

---

**🤖 ai-pr-description-dev[bot]** 评论

```
## 📋 PR 描述（由 AI 自动生成）

### 标题
feat: add user login API with JWT authentication

### 变更摘要
- **做了什么：** 新增用户登录接口 /api/v1/auth/login，使用 JWT Token 鉴权
- **为什么做：** 实现用户认证功能
- **影响范围：** src/routes/auth.ts，src/middleware/jwt.ts

### 变更详情
| 文件 | 变更类型 | 说明 |
|------|---------|------|
| src/routes/auth.ts | 新增 | 登录接口，验证用户名密码并返回 JWT |
| src/middleware/jwt.ts | 新增 | JWT Token 验证中间件 |

### 🧪 测试建议
- [ ] 单元测试：验证 Token 过期后请求被正确拒绝
- [ ] 集成测试：验证完整登录流程

### ⚠️ 影响范围
- **破坏性变更：** 否
- **需要更新的文档：** API 文档需补充登录接口说明

---

> 🤖 此描述由 AI 自动生成，请审核后使用。
```

### 你可以怎么处理

| 操作 | 说明 |
|:-----|:------|
| ✅ **直接使用** | 如果描述准确，直接合并 PR |
| ✏️ **微调后使用** | 改几个字，比从零开始写快 10 倍 |
| ↩️ **忽略** | 删除评论，自己写描述，不影响流程 |

### 有 PRscribe vs 没有 PRscribe

| 没有 PRscribe | 有 PRscribe |
|:--------------|:------------|
| 标题: *"修复 bug"* | 标题: *"fix: handle null pointer in user profile query"* |
| 描述: *(空)* | ✅ 完整描述：做了什么 + 为什么做 + 影响范围 |
| Reviewer 要自己看 diff | ✅ 变更详情表格一览无余 |
| 没有测试建议 | ✅ AI 自动生成具体测试建议 |

---

## 🛠 给管理员

### 系统架构

```
GitHub Webhook → PRscribe 后端 → AI 处理 → PR 评论
```

后端是一个 Node.js 服务，主要流程：

1. 接收 GitHub Webhook（PR 创建/更新时触发）
2. 验证 Webhook 签名（`x-hub-signature-256`）
3. 通过 GitHub API 获取 PR 的 diff
4. 将 diff 组装成 AI prompt
5. 调用 AI 模型生成描述
6. 解析结果并以评论形式发布到 PR

### 技术栈

| 层级 | 技术 |
|:-----|:------|
| 运行时 | Node.js 20 + TypeScript 5 |
| Web 框架 | Hono.js 4 |
| GitHub SDK | Octokit 5 |
| AI 模型 | OpenAI 兼容 API（可切换 DeepSeek / GPT / Claude） |
| 队列 | BullMQ + Redis |
| 部署 | Railway / Render / Fly.io |
| 监控 | Sentry（可选） |

### 自部署

**需要的环境变量：**

| 变量 | 必填 | 说明 |
|:-----|:----:|:------|
| `GITHUB_APP_ID` | ✅ | GitHub App ID |
| `GITHUB_PRIVATE_KEY` | ✅ | App 私钥（RSA PEM 格式） |
| `GITHUB_WEBHOOK_SECRET` | ✅ | Webhook 密钥 |
| `LLM_API_KEY` | ✅ | AI 模型的 API Key |
| `REDIS_URL` | ✅ | Redis 连接地址 |

**可选配置：**

| 变量 | 默认值 | 说明 |
|:-----|:-------|:------|
| `LLM_BASE_URL` | `https://api.openai.com/v1` | AI API 地址（可换 OpenRouter / DeepSeek） |
| `LLM_MODEL` | `gpt-4o-mini` | 模型名 |
| `SENTRY_DSN` | — | 错误监控 |

**支持的大模型服务商：**

| 服务商 | Base URL | 推荐模型 | 特点 |
|:-------|:---------|:---------|:-----|
| OpenAI | `https://api.openai.com/v1` | `gpt-4o-mini` | 质量最高 |
| OpenRouter | `https://openrouter.ai/api/v1` | `openai/gpt-4o-mini` | 支持支付宝 |
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat` | 极便宜 |
| Groq | `https://api.groq.com/openai/v1` | `llama-3.3-70b-versatile` | 免费 |

### 完整部署指南

详见 [docs/deployment.md](./docs/deployment.md)

---

## 📋 输出格式

PRscribe 生成统一的 Markdown 格式描述：

```markdown
## 📋 PR 描述（由 AI 自动生成）

### 标题
[80 字以内，基于变更内容]

### 变更摘要
- **做了什么：** [变更内容描述]
- **为什么做：** [变更原因推断]
- **影响范围：** [涉及的文件/模块]

### 变更详情
| 文件 | 变更类型 | 说明 |
|------|---------|------|
| path/file | 新增/修改/删除 | 变更描述 |

### 🧪 测试建议
- [ ] 单元测试：[具体测试建议]
- [ ] 集成测试：[具体测试建议]

### ⚠️ 影响范围
- **破坏性变更：** 是/否
- **需要更新的文档：** [文档列表]
- **相关 Issue：** [关联 Issue]
```

---

## ❓ 常见问题

### 通用问题

**问：PRscribe 支持 GitLab 吗？**  
目前只支持 GitHub。GitLab 支持已在计划中。

**问：代码安全吗？PRscribe 会存储我的代码吗？**  
不会。代码 diff 仅用于 AI 生成描述，生成后立即丢弃，不存储。

**问：生成的描述是什么语言？**  
取决于代码语言。中文代码用中文，英文代码用英文。

**问：AI 生成的描述准确率如何？**  
**80%+ 可直接使用或仅需微调。** 简单变更（新增文件、改配置）接近 100%，复杂业务逻辑建议审核。

### 问题排查

**问：为什么我的 PR 没有生成描述？**  
可能原因：
1. Webhook URL 配置错误
2. 服务休眠中（Render 免费版冷启动约 30 秒，GitHub 会自动重试）
3. PR 超过 500 个文件（自动跳过）
4. 免费套餐次数用完（每月 5 次）

**问：如何重新生成？**  
关闭再打开 PR，或者 push 一个新 commit 触发重新生成。

**问：可以跳过某个 PR 不生成吗？**  
在 PR 标题或正文中加入 `[skip pr]` 即可。

### 定价

PRscribe 在测试期间 **完全免费使用**，无需信用卡，无使用次数限制。

> 💖 **支持开发**
>
> 如果 PRscribe 为你节省了时间，欢迎赞助支持项目：
>
> <img src="./assets/wechat-pay.jpg" width="200" alt="微信收款码">

你的赞助帮助覆盖 AI API 成本，让项目持续发展。🙏

### 灵活切换模型

PRscribe 支持任何 OpenAI 兼容的 API。你随时可以通过改环境变量切换底层模型，代码不需要任何修改：

```env
# 示例：
LLM_API_KEY=your-api-key
LLM_BASE_URL=https://api.openai.com/v1       # OpenAI
LLM_BASE_URL=https://api.deepseek.com/v1      # DeepSeek（极便宜）
LLM_BASE_URL=https://api.groq.com/openai/v1   # Groq（免费）
LLM_MODEL=gpt-4o-mini                          # 模型名
```

---

## 🔧 自部署

### 项目结构

```
PRscribe/
├── src/
│   ├── routes/          # API 端点（webhook, health）
│   ├── github/          # GitHub 认证、diff 获取、评论格式化
│   ├── prompt/          # AI prompt 模板和组装器
│   ├── llm/             # AI 客户端（含重试逻辑）
│   ├── queue/           # BullMQ 异步任务队列
│   ├── middleware/       # 限流、错误处理
│   └── types/           # TypeScript 类型定义
├── docs/                # 文档
└── tests/               # 单元测试
```

### 本地开发

```bash
# 1. 安装依赖
pnpm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，填入 GitHub App 凭证 + LLM API Key + Redis URL

# 3. 启动服务
pnpm dev

# 4. 验证
curl http://localhost:3000/api/v1/health
# → {"status":"ok","checks":{"redis":"connected","github_app":"valid"}}
```

### API 端点

| 方法 | 路径 | 说明 |
|:----:|:-----|:------|
| `POST` | `/api/v1/webhook` | 接收 GitHub Webhook（异步返回 202） |
| `GET` | `/api/v1/health` | 健康检查 |

---

## 📚 文档索引

| 文档 | 说明 |
|:-----|:------|
| [产品需求文档](./PRD.md) | 产品设计、用户故事 |
| [架构设计](./docs/architecture.md) | 系统架构说明 |
| [API 设计](./docs/api-design.md) | API 接口规范 |
| [部署指南](./docs/deployment.md) | 生产环境部署 |
| [技术栈](./docs/tech-stack.md) | 技术选型理由 |
| [开发者指南](./docs/developer-guide.md) | 给开发者的使用说明 |
| [用户手册](./docs/user-manual.md) | 完整用户手册 |

---

## 🧪 项目状态

| 阶段 | 状态 |
|:-----|:----:|
| 核心流程（Webhook → AI → 评论） | ✅ 完成 |
| 限流与幂等性 | ✅ 完成 |
| 异步队列处理 | ✅ 完成 |
| 多模型支持 | ✅ 完成 |
| 生产环境部署 | ✅ Render 运行中 |
| 端到端验证 | ✅ PR #1, #4, #5, #6, #7 |
| 单元测试（11 个） | ✅ 通过 |

---

## 🗺️ 开发计划

- [ ] GitLab / Bitbucket 支持
- [ ] 自定义 prompt 模板
- [ ] 团队用量统计面板
- [ ] Slack / Discord 通知
- [ ] PR 描述模板市场

---

## 🤝 贡献

通过 [GitHub Issues](https://github.com/MichaelZ1102/PRscribe/issues) 报告问题和建议。欢迎提交 Pull Request。

---

<p align="center">
  <sub>Built with ❤️ and AI ｜ v0.1.0 ｜ © 2026 PRscribe</sub>
</p>
