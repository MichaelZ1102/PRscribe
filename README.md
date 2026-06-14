<p align="center">
  <img src="https://via.placeholder.com/120x120?text=PR" alt="PRscribe logo" width="120">
</p>

<h1 align="center">PRscribe</h1>

<p align="center">
  <strong>AI-powered PR descriptions from your git diff.</strong>
  <br>
  A GitHub App that automatically generates professional Pull Request descriptions.
  <br>
  Just create a PR — we'll write the description for you.
</p>

<p align="center">
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-for-developers">For Developers</a> •
  <a href="#-for-admins">For Admins</a> •
  <a href="#-output-format">Output Format</a> •
  <a href="#-faq">FAQ</a> •
  <a href="#-self-hosting">Self-Hosting</a>
</p>

---

## ✨ What is PRscribe?

PRscribe is a **GitHub App** that automatically analyzes your Pull Request changes and generates a professional, structured PR description — so you don't have to write one.

### How it works

```
You create a PR → PRscribe analyzes the diff → AI generates a description → Posted as a PR comment
```

**Zero effort from developers.** Just create your PR as usual, and PRscribe handles the rest.

### Real examples

| PR | AI-Generated Title | Code Change |
|:---|:-------------------|:-----------:|
| [#5](https://github.com/MichaelZ1102/PRscribe/pull/5) | 新增平台适配器接口定义，抽象多平台支持能力 | +40 lines |
| [#6](https://github.com/MichaelZ1102/PRscribe/pull/6) | feat: 将环境变量验证改为降级模式 | +22/-19 lines |
| [#7](https://github.com/MichaelZ1102/PRscribe/pull/7) | 新增 CommentService 封装 PR 评论发布逻辑 | +74 lines |

---

## 🚀 Quick Start

### For Developers: Zero Setup Required

If your team has already installed PRscribe, you don't need to do anything special.

**Your workflow stays exactly the same:**

```bash
git checkout -b feat/add-login-api
# ... write code ...
git add .
git commit -m "feat: add login API"
git push origin feat/add-login-api
```

Create a PR on GitHub → wait **~20 seconds** → PRscribe posts a complete description as a comment.

> That's it. No extra tools, no extra steps, no templates to learn.

### For Admins: Install PRscribe in 3 Steps

**Step 1:** Install the GitHub App

```
https://github.com/apps/ai-pr-description-dev/installations/new
```

Select the repositories you want PRscribe to work on.

**Step 2:** Create a test PR to verify it works

**Step 3:** Done ✅ — PRscribe will now automatically describe every PR.

---

## 👨‍💻 For Developers

### What you'll see

After creating a PR, PRscribe posts a comment like this:

---

**🤖 ai-pr-description-dev[bot]** commented

```
## 📋 PR 描述（由 AI 自动生成）

### 标题
feat: add user login API with JWT authentication

### 变更摘要
- **做了什么：** 新增用户登录接口 `/api/v1/auth/login`，使用 JWT Token 鉴权
- **为什么做：** 实现用户认证功能
- **影响范围：** `src/routes/auth.ts`，`src/middleware/jwt.ts`

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

### What you can do with it

| Action | Description |
|:-------|:------------|
| ✅ **Use as-is** | Accurate enough? Just merge. |
| ✏️ **Tweak** | Small edits take seconds instead of writing from scratch. |
| ↩️ **Ignore** | Delete the comment and write your own — no harm done. |

### Before vs After

| Without PRscribe | With PRscribe |
|:-----------------|:--------------|
| Title: *"fix bug"* | Title: *"fix: handle null pointer in user profile query"* |
| Description: *(empty)* | ✅ Full description with what, why, and scope |
| Reviewer has to reverse-engineer the diff | ✅ Change details table at a glance |
| No test suggestions | ✅ AI-generated testing recommendations |

---

## 🛠 For Admins

### Architecture Overview

```
GitHub Webhook → PRscribe Backend → AI Processing → PR Comment
```

The backend is a Node.js service that:
1. Receives GitHub webhooks when PRs are created/updated
2. Verifies the webhook signature
3. Fetches the PR diff via GitHub API
4. Builds a prompt from the diff
5. Calls an AI model (LLM) to generate the description
6. Parses the result and posts it as a PR comment

### Tech Stack

| Layer | Technology |
|:------|:-----------|
| Runtime | Node.js 20 + TypeScript 5 |
| Framework | Hono.js 4 |
| GitHub SDK | Octokit 5 |
| AI Model | OpenAI-compatible (GPT-4o-mini / DeepSeek / Claude) |
| Queue | BullMQ + Redis |
| Deployment | Railway / Render / Fly.io |
| Monitoring | Sentry (optional) |

### Self-Hosting Deployment

Deploy PRscribe on any Node.js-compatible platform (Railway, Render, Fly.io, or your own server).

**Required environment variables:**

| Variable | Required | Description |
|:---------|:--------:|:------------|
| `GITHUB_APP_ID` | ✅ | GitHub App ID |
| `GITHUB_PRIVATE_KEY` | ✅ | App private key (RSA PEM) |
| `GITHUB_WEBHOOK_SECRET` | ✅ | Webhook secret |
| `LLM_API_KEY` | ✅ | AI model API key |
| `REDIS_URL` | ✅ | Redis connection URL |

**Optional configuration:**

| Variable | Default | Description |
|:---------|:--------|:------------|
| `LLM_BASE_URL` | `https://api.openai.com/v1` | API endpoint (OpenRouter, DeepSeek, etc.) |
| `LLM_MODEL` | `gpt-4o-mini` | Model name |
| `SENTRY_DSN` | — | Error monitoring |

**Supported AI providers (OpenAI-compatible):**

| Provider | Base URL | Recommended Model |
|:---------|:---------|:------------------|
| OpenAI | `https://api.openai.com/v1` | `gpt-4o-mini` |
| OpenRouter | `https://openrouter.ai/api/v1` | `openai/gpt-4o-mini` |
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat` |
| Groq | `https://api.groq.com/openai/v1` | `llama-3.3-70b-versatile` |

### Full Deployment Guide

See [docs/deployment.md](./docs/deployment.md) for step-by-step deployment instructions.

---

## 📋 Output Format

PRscribe generates descriptions in a consistent Markdown format:

```markdown
## 📋 PR 描述（由 AI 自动生成）

### 标题
[Concise title based on changes, ≤80 characters]

### 变更摘要
- **做了什么：** [What was changed]
- **为什么做：** [Why the change was made]
- **影响范围：** [Affected files/modules]

### 变更详情
| 文件 | 变更类型 | 说明 |
|------|---------|------|
| path/file | added/modified/deleted | Description |

### 🧪 测试建议
- [ ] 单元测试：[Specific test suggestion]
- [ ] 集成测试：[Specific test suggestion]

### ⚠️ 影响范围
- **破坏性变更：** 是/否
- **需要更新的文档：** [Documents to update]
- **相关 Issue：** [Related issues]
```

---

## ❓ FAQ

### General

**Q: Does PRscribe support GitLab?**  
Not yet. GitHub only for now — GitLab support is planned.

**Q: Is my code safe? Will PRscribe store my source code?**  
No. Code diffs are sent to the AI for description generation and discarded immediately afterward. Nothing is persisted.

**Q: What language are the descriptions generated in?**  
It matches the language of your code and comments — Chinese for Chinese codebases, English for English ones.

**Q: How accurate are the AI-generated descriptions?**  
**80%+ are usable as-is or with minor edits.** Simple changes (new files, config updates) are nearly 100% accurate. Complex business logic may need review.

### Troubleshooting

**Q: Why didn't my PR get a description?**  
Possible causes:
1. Webhook URL is misconfigured
2. Service is sleeping (Render free tier cold start — GitHub retries automatically)
3. PR has 500+ files (auto-skipped)
4. Daily quota reached (Free plan: 5/month)

**Q: How to retry generation?**  
Close and re-open the PR, or push a new commit to trigger re-generation.

**Q: Can I skip PRscribe for a specific PR?**  
Include `[skip pr]` in the PR title or body.

### Pricing

| Plan | Price | Features |
|:-----|:-----:|:---------|
| **Free** | $0 | 5 generations/month |
| **Pro** | $9/mo | Unlimited, private repos |
| **Team** | $49/mo | Custom templates, analytics |
| **Enterprise** | $199/mo | Self-hosted, SSO, audit logs |

---

## 🔧 Self-Hosting

### Project Structure

```
PRscribe/
├── src/
│   ├── routes/          # API endpoints (webhook, health)
│   ├── github/          # GitHub auth, diff fetcher, comment formatting
│   ├── prompt/          # AI prompt templates and builder
│   ├── llm/             # AI client with retry logic
│   ├── queue/           # BullMQ async job processing
│   ├── middleware/       # Rate limiter, error handler
│   └── types/           # TypeScript type definitions
├── docs/                # Documentation
└── tests/               # Unit tests
```

### Local Development

```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your GitHub App credentials, LLM API key, and Redis URL

# 3. Start the service
pnpm dev

# 4. Verify
curl http://localhost:3000/api/v1/health
# → {"status":"ok","checks":{"redis":"connected","github_app":"valid"}}
```

### API Endpoints

| Method | Path | Description |
|:------:|:-----|:------------|
| `POST` | `/api/v1/webhook` | Receives GitHub webhooks (returns 202) |
| `GET` | `/api/v1/health` | Health check endpoint |

---

## 📚 Documentation Index

| Document | Description |
|:---------|:------------|
| [PRD](./PRD.md) | Product requirements and user stories |
| [Architecture](./docs/architecture.md) | System architecture overview |
| [API Design](./docs/api-design.md) | API specifications |
| [Deployment Guide](./docs/deployment.md) | Production deployment instructions |
| [Tech Stack](./docs/tech-stack.md) | Technology choices and rationale |
| [Developer Guide](./docs/developer-guide.md) | Guide for end-user developers |

---

## 🧪 Project Status

| Phase | Status |
|:------|:------:|
| Core pipeline (webhook → AI → comment) | ✅ Complete |
| Rate limiting & idempotency | ✅ Complete |
| Async queue processing | ✅ Complete |
| Multi-model AI support | ✅ Complete |
| Production deployment | ✅ Live on Render |
| End-to-end verified | ✅ PR #1, #4, #5, #6, #7 |
| Unit tests (11 tests) | ✅ Passing |

---

## 🗺️ Roadmap

- [ ] GitLab / Bitbucket support
- [ ] Custom prompt templates per repository
- [ ] Web dashboard for team usage analytics
- [ ] Slack / Discord notification integration
- [ ] PR description templates marketplace

---

## 🤝 Contributing

Report issues and suggest features via [GitHub Issues](https://github.com/MichaelZ1102/PRscribe/issues). Pull requests welcome.

---

<p align="center">
  <sub>Built with ❤️ and AI ｜ v0.1.0 ｜ © 2026 PRscribe</sub>
</p>
