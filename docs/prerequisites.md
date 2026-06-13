# 前置条件清单

> 开始编码前需要准备好的所有东西。

## □ 1. GitHub 账号 & App 注册

### 1.1 GitHub 账号
- [ ] 拥有一个 GitHub 账号（用于注册 GitHub App）
- [ ] 创建一个测试仓库（用于开发和测试）
  ```
  示例：your-username/pr-tool-test
  ```

### 1.2 注册 GitHub App
前往 https://github.com/settings/apps/new 创建

| 配置项 | 值 |
|:------|:---|
| **GitHub App Name** | `ai-pr-description`（或你喜欢的名字） |
| **Homepage URL** | `http://localhost:3000`（开发阶段） |
| **Webhook URL** | `https://xxxx.ngrok.io/api/webhook`（ngrok 生成的 URL） |
| **Webhook Secret** | 生成一个随机字符串（保存到 .env） |
| **Permissions** | Pull requests: Read & Write, Contents: Read, Metadata: Read, Issues: Read & Write |
| **Events** | `pull_request` |
| **Where can this App be installed?** | Any account |

### 1.3 保存凭证
注册完成后，保存以下信息（这些就是你的 .env 内容）：

```
GITHUB_APP_ID=123456
GITHUB_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
GITHUB_WEBHOOK_SECRET=your-webhook-secret
GITHUB_CLIENT_ID=Iv1.xxxxx
GITHUB_CLIENT_SECRET=xxxxx
```

## □ 2. 本地开发环境

### 2.1 Node.js
- [ ] 安装 Node.js 20 LTS
  ```bash
  # 检查版本
  node --version  # v20.x.x
  ```

### 2.2 pnpm（包管理器）
- [ ] 安装 pnpm
  ```bash
  npm install -g pnpm
  pnpm --version  # 9.x.x
  ```

### 2.3 ngrok（Webhook 本地调试）
- [ ] 安装 ngrok
  ```bash
  # 下载: https://ngrok.com/download
  # 或通过包管理器
  npm install -g ngrok
  ngrok config add-authtoken <your-token>
  ```

### 2.4 Git
- [ ] Git 已安装并配置

## □ 3. 数据库

### 3.1 PostgreSQL（本地开发）
选项 A：本地安装
- [ ] 安装 PostgreSQL 16
- [ ] 创建开发数据库：
  ```sql
  CREATE DATABASE pr_tool_dev;
  ```

选项 B：Neon（Serverless PostgreSQL，推荐 MVP）
- [ ] 注册 https://neon.tech
- [ ] 创建项目，获取连接字符串

### 3.2 Redis（可选，用于限流/队列）
选项 A：本地安装 Redis
选项 B：Upstash Redis（推荐 MVP）
- [ ] 注册 https://upstash.com
- [ ] 创建 Redis 实例，获取连接信息

## □ 4. LLM API Keys

至少准备以下之一：

### 4.1 OpenAI API Key（推荐）
- [ ] 注册 https://platform.openai.com
- [ ] 创建 API Key 并充值（至少 $5）
- [ ] 确认可使用 GPT-4o-mini（无速率限制）

### 4.2 Anthropic API Key（备选）
- [ ] 注册 https://console.anthropic.com
- [ ] 创建 API Key

## □ 5. 部署环境

### Vercel（MVP 部署平台）
- [ ] 注册 https://vercel.com
- [ ] 安装 Vercel CLI：
  ```bash
  npm install -g vercel
  ```

## □ 6. 工具软件

- [ ] VS Code（推荐，非必须）
- [ ] Insomnia / Postman 或 curl（API 测试）
- [ ] GitHub CLI：
  ```bash
  npm install -g gh
  gh auth login
  ```

## □ 7. 开发前的知识准备

| 知识 | 用途 |
|:----|:-----|
| **GitHub App 机制** | 理解 App 注册、安装、认证流程 |
| **Octokit SDK** | GitHub API 调用的 Node.js 库 |
| **Webhook 签名验证** | 验证 GitHub 发来的事件是合法的 |
| **PR Diff 格式** | 了解 unified diff 格式 |
| **LLM Prompt Engineering** | 设计能生成高质量 PR 描述的提示词 |
| **Hono.js 框架** | 轻量 Web 框架，用于构建 API |
| **Drizzle ORM** | 如果使用数据库，了解基本操作 |

### 推荐阅读资源
1. [GitHub App 官方文档](https://docs.github.com/en/apps/creating-github-apps/about-creating-github-apps/about-creating-github-apps)
2. [Octokit - GitHub App 示例](https://github.com/octokit/octokit.js)
3. [OpenAI Prompt Engineering Guide](https://platform.openai.com/docs/guides/prompt-engineering)

## □ 速度检查表

> 如果以上全部就绪，标记此检查表——每项完成后在 [ ] 里填 ✓

- [ ] GitHub App 注册完成 & 凭证保存
- [ ] Node.js 20 + pnpm 安装完成
- [ ] ngrok 本地可运行
- [ ] 数据库连接字符串已就绪
- [ ] OpenAI/Claude API Key 已获取
- [ ] Vercel 账号已注册
- [ ] 测试仓库已创建
- [ ] .env 文件已配置
