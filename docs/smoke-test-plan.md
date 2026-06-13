# 冒烟测试计划 — AI PR 描述生成器

> 版本：1.0.0
> 目标环境：生产部署 (Vercel)
> 前置依赖：P5-03 部署完成，P5-04 生产 GitHub App 配置完成

---

## 1. 概述

冒烟测试的目的是快速验证核心链路是否正常，在每次部署后或首次上线时执行。通过则视为「可发布」，不通过则触发回滚。

### 测试范围

| 层级 | 覆盖内容 |
|:----|:---------|
| L0 — 基础设施 | 服务可达、健康检查、环境变量加载 |
| L1 — 核心 API | Webhook 接收、签名验证、限流 |
| L2 — 业务链路 | Diff 获取 → Prompt 构建 → LLM 调用 → 评论发布 |
| L3 — 真实仓库 | 在真实 GitHub 仓库上创建 PR，验证端到端流程 |

---

## 2. 测试环境

| 项目 | 值 |
|:----|:----|
| **测试仓库** | 参考 `docs/prerequisites.md`，准备 1-2 个测试仓库 |
| **测试用 .env** | 复制 `.env.example`，填入真实的 GitHub App 凭证和 LLM API Key |
| **部署 URL** | `https://<your-app>.vercel.app` |

---

## 3. 冒烟测试用例

### L0 — 基础设施

#### TC-01: 健康检查端点

```bash
curl -s -o /dev/null -w "%{http_code}" https://<your-app>.vercel.app/api/health
# 预期：200

curl -s https://<your-app>.vercel.app/api/health | jq .
# 预期：
# {
#   "status": "ok",
#   "timestamp": "...",
#   "version": "1.0.0",
#   "checks": {
#     "database": "connected",
#     "redis": "connected"   # 可选
#   }
# }
```

#### TC-02: 环境变量验证

确认所有必需的环境变量已正确设置：

```bash
# 通过一个隐藏端点或日志确认
# 关键变量：GITHUB_APP_ID, GITHUB_PRIVATE_KEY, GITHUB_WEBHOOK_SECRET,
#           OPENAI_API_KEY, DATABASE_URL, LLM_MODEL
```
> 验证方式：部署日志中检查环境变量是否加载成功，或通过 /api/debug/env-check 端点

---

### L1 — 核心 API

#### TC-03: Webhook 签名验证 — 非法请求

```bash
curl -s -o /dev/null -w "%{http_code}" -X POST \
  https://<your-app>.vercel.app/api/webhook \
  -H "Content-Type: application/json" \
  -H "x-hub-signature-256: sha256=invalid" \
  -H "x-github-event: pull_request" \
  -H "x-github-delivery: test-001" \
  -d '{"action": "opened", "pull_request": {"number": 1}}'
# 预期：400
```

#### TC-04: Webhook 签名验证 — 合法请求

```bash
# 使用 @octokit/webhooks 的 sign 方法生成合法签名
# 或用测试脚本发送已签名的请求
# 预期：200
```

#### TC-05: 限流行为

```bash
# 在短时间内连续发送多次请求（>5 次/秒）
for i in $(seq 1 10); do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST \
    https://<your-app>.vercel.app/api/webhook \
    -H "Content-Type: application/json" \
    -H "x-hub-signature-256: sha256=invalid" \
    -H "x-github-event: pull_request" \
    -d '{}'
done
# 预期：前几次返回 400（签名无效），后续触发限流返回 429
```

---

### L2 — 业务链路

#### TC-06: Diff 获取 + Prompt 构建

```bash
# 此测试需要有效的 Installation Token
# 通过测试脚本执行：
# 1. 调用 GitHub API 获取 PR diff → 成功
# 2. 传入 Prompt Builder → 生成格式正确的 prompt
# 3. 检查 prompt 格式是否包含要求的结构
```
> 验证方式：单元测试中已经覆盖此逻辑，冒烟测试验证集成点

#### TC-07: LLM 调用 — 正常响应

使用测试脚本发送模拟请求到 LLM API：
- 输入：一个结构化的 diff 和 prompt
- 输出：合法的 PR 描述（包含标题、变更摘要、变更详情等）
- 预期：返回内容包含所有必需字段

#### TC-08: LLM 调用 — 降级处理

- 使用无效的 API Key 模拟 LLM 调用失败
- 预期：系统按重试策略尝试 3 次后返回友好错误提示

---

### L3 — 真实仓库测试

> 这是本计划最关键的部分，需要在真实 GitHub 仓库上触发完整流程。

#### TC-09: PR 创建触发 AI 描述

**前置条件：**
- GitHub App 已安装到测试仓库
- 测试仓库至少有 1 个文件（如 README.md）

**测试步骤：**
1. 在测试仓库创建一个新分支：`smoke-test/ai-pr-$(date +%s)`
2. 修改 1-2 个文件（添加注释、修改 README 等）
3. 创建 Pull Request（可以设为 Draft 避免影响他人）
4. 等待 AI 描述生成（预期 < 10 秒）
5. 检查 PR 中是否出现 AI 生成的评论

**预期结果：**
- PR 中出现格式正确的 AI 描述评论
- 评论包含：标题、变更摘要、变更详情表格、测试建议、影响范围
- 评论底部有"由 AI 生成"标记

**验证步骤：**

```bash
# 使用 GitHub CLI 检查 PR 评论
gh pr view <pr-number> --repo <owner>/<test-repo> --comments
# 输出应包含 AI 生成的描述
```

#### TC-10: PR 更新触发 AI 更新

**步骤：**
1. 在 TC-09 的 PR 分支上再提交一个变更
2. 等待 AI 重新生成描述
3. 检查评论是否更新

**预期结果：**
- AI 评论更新为反映最新变更的内容
- 旧评论被标记为过时或新评论发布

#### TC-11: 超大 diff 跳过

**步骤：**
1. 在测试仓库中创建一个包含超过 500 个文件的 PR
2. 触发 AI 生成

**预期结果：**
- PR 中出现提示：变更过大，无法自动生成，请手动编写
- 系统不会调用 LLM API（节省成本）

---

## 4. 冒烟测试脚本

配套的自动化脚本位于 `scripts/smoke-test.sh`，支持：

```bash
# 完整冒烟测试
./scripts/smoke-test.sh --url https://<your-app>.vercel.app --all

# 仅测试 L0 层
./scripts/smoke-test.sh --url https://<your-app>.vercel.app --l0

# 测试真实仓库（需要 GitHub Token）
./scripts/smoke-test.sh --url https://<your-app>.vercel.app \
  --e2e --repo <owner>/<repo> \
  --token $(cat .github-token)
```

---

## 5. 通过标准

| 层级 | 测试数 | 必须通过 | 说明 |
|:----|:-----:|:--------:|:-----|
| L0 | 2 | 2/2 | 基础设施不通过 → 立即回滚 |
| L1 | 3 | 3/3 | API 不可用 → 立即回滚 |
| L2 | 3 | 2/3 | 次要链路故障可上版但需要跟进 |
| L3 | 3 | 2/3 | 真实仓库测试结果作为上线依据 |
| **合计** | **11** | **9/11** | |

**关键判断：**
- ✅ 通过：L0+L1 全通过，且 L2+L3 通过率 ≥ 2/3
- ⚠️ 有条件通过：L0+L1 全通过，L2+L3 通过率 1/2
- ❌ 不通过：L0 或 L1 有任何一项失败

---

## 6. 真实仓库测试模板

### 测试仓库准备

```bash
# 在 GitHub 上创建测试仓库
gh repo create pr-tool-smoke-test --public --description "Smoke test repo for AI PR Description Generator"

# 初始化仓库
mkdir -p /tmp/smoke-test-repo
cd /tmp/smoke-test-repo
echo "# Smoke Test Repo" > README.md
git init
git add README.md
git commit -m "init"
git remote add origin https://github.com/<owner>/pr-tool-smoke-test.git
git push -u origin main
```

### 测试执行日志模板

```markdown
## 冒烟测试执行报告

日期：YYYY-MM-DD
执行人：
部署版本：vX.Y.Z
目标 URL：https://<your-app>.vercel.app

### 测试结果

| TC ID | 名称 | 结果 | 备注 |
|:-----:|:----|:---:|:-----|
| TC-01 | 健康检查 | ✅ | |
| TC-02 | 环境变量 | ✅ | |
| ... | ... | ... | |

### 总体结论

✅ / ⚠️ / ❌

### 备注

...
```
