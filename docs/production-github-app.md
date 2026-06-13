# 生产环境 GitHub App 配置指南

> 对应任务：P5-04 | 依赖：P5-03（Vercel 部署完成）
> 本文档指导如何将 GitHub App 从开发配置切换到生产环境。

---

## 1. 前置条件

- [ ] P5-03 已完成 — 项目已部署到 Vercel，获得生产域名
- [ ] 拥有 GitHub App 的管理权限（Owner 角色）
- [ ] 已登录 https://github.com/settings/apps

---

## 2. 生产 Webhook URL

### 2.1 确定生产域名

Vercel 部署后，项目默认域名格式：

```
https://<project-name>.vercel.app
```

例如项目名 `ai-pr-description`，则域名为：
```
https://ai-pr-description.vercel.app
```

**生产 Webhook URL：**
```
https://<project-name>.vercel.app/api/webhook
```

### 2.2 配置自定义域名（推荐）

避免 Vercel 域名变更风险，建议绑定自定义域名：
- 在 Vercel Dashboard → Project → Settings → Domains 添加
- 例如：`api.pr-describe.com`
- 在 DNS 提供商处添加 CNAME 记录指向 `cname.vercel-dns.com`

**生产 Webhook URL（自定义域名）：**
```
https://api.pr-describe.com/api/webhook
```

---

## 3. GitHub App 设置步骤

在 GitHub App 配置页面（https://github.com/settings/apps/<app-name>）逐项修改：

### 3.1 Basic Information

| 字段 | 开发环境值 | 生产环境值 | 说明 |
|:----|:----------|:-----------|:----|
| **Homepage URL** | `http://localhost:3000` | `https://<production-domain>` | 改为生产域名 |
| **Webhook URL** | `https://xxxx.ngrok.io/api/webhook` | `https://<production-domain>/api/webhook` | **关键修改** |
| **Webhook Secret** | 开发用 secret | 生成新的生产 secret | 建议重新生成 |

### 3.2 Webhook Secret 生成

```bash
# 生成 32 字节随机 hex 字符串
openssl rand -hex 32
# 示例输出: a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1
```

将新 secret 保存到生产环境的 Vercel Environment Variables 中：
```
GITHUB_WEBHOOK_SECRET=<new-secret>
```

### 3.3 Permissions（终版权限）

按以下配置设置最终权限：

| Permission | Access | 用途说明 |
|:-----------|:------:|:---------|
| **Pull requests** | **Read & Write** | 读取 PR diff → 写入 AI 描述评论 |
| **Contents** | **Read only** | 读取仓库内容（可选，获取上下文） |
| **Metadata** | **Read only** | 自动授予，获取仓库基本信息 |
| **Issues** | **Read & Write** | PR 评论本质是 Issue 评论，必须开启 |
| **Checks** | **Read only** | 如需读取 CI 状态（v1.1 功能预留） |

> ⚠️ 权限原则：**最小必要原则** — 只授予上述权限，不要多开不必要的权限。

### 3.4 Webhook Events

仅订阅生产环境所需的事件：

| Event | 用途 |
|:------|:-----|
| **Pull requests** | 监听 `opened` / `synchronize` / `edited` — PR 创建、更新、编辑 |

> 在「Subscribe to events」中勾选 `Pull requests`

### 3.5 Additional Settings

| 设置项 | 推荐值 | 说明 |
|:-------|:------:|:-----|
| **Where can this App be installed?** | Any account | 允许任意账号安装（SaaS 模式） |
| **Active** | ✅ | 确认 App 处于活跃状态 |
| **Expire user authorization tokens** | ✅ 启用 | 安全最佳实践 |
| **Request user authorization (OAuth) during installation** | ❌ 不启用 | MVP 阶段不需要 OAuth 流程 |

### 3.6 Callback URL（可选）

如未来需要 OAuth 登录功能，设置回调 URL：
```
https://<production-domain>/api/auth/callback
```

---

## 4. 生产环境凭证管理

### 4.1 Vercel Environment Variables

在 Vercel Dashboard → Project → Settings → Environment Variables 中设置：

| Variable | 值来源 | 环境 |
|:---------|:-------|:----:|
| `GITHUB_APP_ID` | GitHub App 页面 → App ID | Production |
| `GITHUB_PRIVATE_KEY` | GitHub App 页面 → Generate a private key | Production |
| `GITHUB_WEBHOOK_SECRET` | 步骤 3.2 生成 | Production |
| `GITHUB_CLIENT_ID` | GitHub App 页面 → Client ID | Production |
| `GITHUB_CLIENT_SECRET` | GitHub App 页面 → Client secrets | Production |
| `OPENAI_API_KEY` | OpenAI Platform | Production |
| `ANTHROPIC_API_KEY` | Anthropic Console | Production |
| `LLM_MODEL` | `gpt-4o` | Production |
| `LLM_TEMPERATURE` | `0.3` | Production |
| `LLM_MAX_TOKENS` | `2000` | Production |
| `DATABASE_URL` | Neon Dashboard | Production |
| `REDIS_URL` | Upstash Dashboard | Production |
| `NODE_ENV` | `production` | Production |

> ⚠️ **Private Key 处理：** GitHub App Private Key 以 `-----BEGIN RSA PRIVATE KEY-----` 开头，需要将换行符替换为 `\n` 或以 Base64 编码后存入环境变量。

### 4.2 Private Key 编码方案

方案 A — 将换行替换为 `\n`（Vercel 原生支持）：
```
GITHUB_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----\n"
```

方案 B — Base64 编码后存入，代码中解码：
```bash
base64 -i path/to/private-key.pem | pbcopy  # macOS
# 然后存入 VERCELL: GITHUB_PRIVATE_KEY_B64=<base64>
```

---

## 5. 验证清单

配置完成后，执行以下验证：

- [ ] **Webhook 可达性测试：** GitHub App 页面 → Advanced → 点击「Redeliver」测试 Webhook 是否可达
- [ ] **签名验证测试：** 确认服务器正确验证 `x-hub-signature-256`
- [ ] **权限验证：** 在测试仓库安装 App，确认能读取 PR diff 并写入评论
- [ ] **健康检查：** `GET https://<production-domain>/api/health` 返回 `{"status": "ok"}`
- [ ] **SSL/HTTPS：** 确认 Vercel 自动提供的 HTTPS 证书有效

---

## 6. 回滚方案

如果生产环境出现异常，回滚步骤：

1. **临时回退：** 在 GitHub App 设置中将 Webhook URL 改回开发 ngrok URL
2. **彻底回滚：** Vercel Dashboard → Deployments → 选择上一个正常版本 → ⋮ → Promote to Production
3. **凭证回滚：** 保留旧版 .env 备份，必要时还原

---

## 7. 附录：GitHub App 配置截图参考

| 页面 | URL |
|:----|:----|
| GitHub App 列表 | https://github.com/settings/apps |
| 创建新 App | https://github.com/settings/apps/new |
| 编辑已有 App | https://github.com/settings/apps/<app-name> |
| 安装管理 | https://github.com/settings/installations |
