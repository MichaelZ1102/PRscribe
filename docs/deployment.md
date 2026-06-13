# 生产环境部署指南

## 平台选择：Railway

推荐 Railway（而非 Vercel Serverless），原因：

| 特性 | Railway | Vercel Hobby |
|:----|:--------|:-------------|
| ⏱ 函数超时 | 无限制（长进程） | 10s ❌ |
| ⚙️ 后台 Worker | ✅ 原生支持 | ❌ 需要附加产品 |
| 💰 月费 | $5 起 | 免费但不够用 |
| 🚀 部署 | `git push` | `git push` |

## 部署步骤

### 1. 创建 Railway 项目

```bash
# 安装 Railway CLI
npm install -g @railway/cli

# 登录
railway login

# 在项目目录初始化
cd pr-tool
railway init

# 连接 GitHub 仓库
railway link
```

### 2. 配置环境变量

在 Railway Dashboard → Variables 中设置：

```
PORT=3000
NODE_ENV=production

GITHUB_APP_ID=4042683
GITHUB_PRIVATE_KEY=← 完整私钥内容（包含 -----BEGIN/END-----）
GITHUB_WEBHOOK_SECRET=***LLM_API_KEY=***LLM_BASE_URL=https://opencode.ai/zen/go/v1
LLM_MODEL=deepseek-v4-flash
LLM_TEMPERATURE=0.3
LLM_MAX_TOKENS=***REDIS_URL=*** Pro Tip：私钥建议用 Base64 编码后传入，启动时解码：
# Base64 编码私钥
base64 -w0 private-key.pem > private-key.txt
# 在 Railway 设置 GITHUB_PRIVATE_KEY_B64=←内容→
# 在代码中解码（可添加到 config.ts）
# privateKey: Buffer.from(env.GITHUB_PRIVATE_KEY_B64, 'base64').toString('utf-8')
```

### 3. 部署

```bash
# 部署
railway up

# 查看日志
railway logs

# 打开公网 URL
railway open
```

### 4. 更新 GitHub App

部署后，将 GitHub App 的 Webhook URL 更新为 Railway 的公网 URL：

```
Webhook URL: https://pr-tool.up.railway.app/api/v1/webhook
```

### 5. 验证

```bash
# 健康检查
curl https://pr-tool.up.railway.app/api/v1/health

# 预期返回:
# {"status":"ok","checks":{"redis":"connected","github_app":"valid"}}
```

## 回滚方案

```bash
# Railway 支持一键回滚到上一个部署版本
railway rollback

# 或通过 Dashboard → Deployments → Rollback
```

## 生产 Checklist

- [ ] Railway 项目创建并关联 GitHub 仓库
- [ ] 所有环境变量已配置
- [ ] Webhook URL 已更新为生产地址
- [ ] GitHub App 权限已验证（Pull requests R&W）
- [ ] 健康检查返回 ok
- [ ] Sentry DSN 已配置（可选）
- [ ] 测试仓库创建 PR 验证端到端流程
