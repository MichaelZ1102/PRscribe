# 回滚方案 — AI PR 描述生成器

> 版本：1.0.0
> 目标环境：生产部署 (Vercel)
> 关联任务：P5-03 部署上线，P5-04 生产 GitHub App 配置

---

## 1. 回滚决策树

当冒烟测试失败或线上出现严重故障时，按以下流程判断：

```
生产故障（P0/P1）
    │
    ├── 是否影响核心链路？
    │   (Webhook 接收 / AI 生成 / 评论发布)
    │   ├── 是 → 立即回滚
    │   └── 否 → 继续运行，滚动修复
    │
    ├── 是否数据损坏？
    │   (数据库写入异常 / 配置项丢失)
    │   ├── 是 → 回滚 + 数据恢复
    │   └── 否 → 仅回滚代码
    │
    ├── 是否 LLM API 故障？
    │   (非我方代码问题)
    │   ├── 是 → 切换备选模型/提供商，不回滚
    │   └── 否 → 继续排查
    │
    └── 是否部署配置错误？
        (环境变量 / 域名 / SSL)
        ├── 是 → 修复配置，不回滚
        └── 否 → 回滚
```

**故障分级定义：**

| 级别 | 定义 | 响应时间 | 行动 |
|:----:|:-----|:--------:|:-----|
| **P0** | 核心链路完全不可用（Webhook 无法接收 / LLM 生成全失败） | < 5 min | 立即回滚 |
| **P1** | 核心链路部分受损（如 30% 请求失败 / 评论发布延迟 > 60s） | < 15 min | 评估后决定 |
| **P2** | 非核心功能异常（如 Web Dashboard 不可用） | < 1h | 滚动修复 |
| **P3** | 小 bug / 文案错误 | < 24h | 下个版本修复 |

---

## 2. Vercel 回滚

### 2.1 Instant Rollback（推荐）

Vercel 内置 Instant Rollback 功能，可在 1 秒内回滚到任何历史部署。

```bash
# 查看部署历史
vercel list --prod

# 回滚到指定部署（使用 deploy ID）
vercel rollback <deploy-id> --prod

# 或通过 Vercel Dashboard：
# 1. 打开 https://vercel.com/<team>/<project>/deployments
# 2. 找到目标部署版本
# 3. 点击 "..." → "Rollback to this deployment"
```

**回滚影响：**
- DNS 切换：< 1 秒（全球 CDN 缓存更新可能需要 1-5 分钟）
- 运行中的请求：等待完成，不回滚过程中的请求会继续使用旧版本资源
- 数据层：不受影响（Vercel 回滚仅涉及 Serverless Functions 代码）

### 2.2 Git 回滚 + 重部署

如果 Instant Rollback 不可用，或需要附带数据库迁移回滚：

```bash
# 1. 找到上一个稳定版本
git log --oneline -10

# 2. 回滚到该版本
git revert HEAD --no-edit   # 保留提交历史
# 或
git reset --hard <stable-sha>  # 强制重置（谨慎使用）

# 3. 强制推送
git push --force-with-lease

# 4. Vercel 自动触发重新部署
```

### 2.3 回滚后验证

回滚后立即执行冒烟测试 L0 + L1，确认服务恢复：

```bash
./scripts/smoke-test.sh --url https://<your-app>.vercel.app --l0 --l1
```

---

## 3. 数据库回滚（Neon PostgreSQL）

### 3.1 使用 Neon 分支回滚

Neon 支持即时创建数据库分支，可用来做回滚：

```bash
# 1. 在部署前创建"部署快照"分支
#    （通过 Neon Dashboard 或 API）

# 2. 出现问题时，将连接切换到快照分支
# 在 Vercel 环境变量中更新 DATABASE_URL：
# postgresql://user:***@ep-snapshot.us-east-2.aws.neon.tech/neondb
```

### 3.2 时间点恢复（Point-in-Time Recovery）

Neon 自动保留 WAL 日志，支持 PITR：

```bash
# 通过 Neon API 创建时间点恢复分支
curl -X POST "https://console.neon.tech/api/v2/projects/<project-id>/branches" \
  -H "Authorization: Bearer <api-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "endpoint": {
      "branch_id": "<source-branch-id>"
    },
    "branch": {
      "parent_id": "<source-branch-id>",
      "name": "rollback-<timestamp>"
    }
  }'
```

### 3.3 Drizzle 迁移回滚

如果数据库结构变更导致问题：

```bash
# 查看迁移历史
drizzle-kit status

# 回滚上次迁移
drizzle-kit rollback

# 重新同步到目标状态
drizzle-kit push
```

---

## 4. GitHub App 配置回滚

### 4.1 权限/事件回滚

如果需要回滚 GitHub App 的权限变更：

1. 打开 https://github.com/settings/apps/<app-name>
2. 在 **Permissions** 和 **Events** 部分恢复到上一版本的设置
3. 点击 **Save changes**
4. 如果 App 权限变动影响已安装的仓库，可能需要重新安装

**注意：** GitHub App 配置变更对所有已安装仓库即时生效。

### 4.2 Webhook URL 回滚

```bash
# 如果切换了域名/URL，需要在 GitHub App 设置中回滚 Webhook URL
# 1. 打开 App 设置页面
# 2. Webhook URL → 恢复为旧的 URL
# 3. 如果同时切换了 DNS，确保新 URL 也能正常响应
# 4. 建议：新旧 URL 同时运行 24h 再下线旧的
```

---

## 5. LLM 提供商切换（降级而非回滚）

当 LLM API 故障时，不一定要回滚整站，可以降级到备选模型：

```bash
# 通过环境变量切换模型（Vercel）
vercel env rm LLM_MODEL production
vercel env add LLM_MODEL production
# 输入: claude-sonnet-4-20250514

# 重新部署
vercel --prod
```

**模型降级矩阵：**

| 故障模型 | 降级目标 | 预期质量影响 | 切换时间 |
|:--------|:---------|:-----------:|:--------:|
| GPT-4o | GPT-4o-mini | 降低 | 1 min |
| GPT-4o-mini | Claude Sonnet 4 | 接近 | 1 min |
| OpenAI（全线） | Anthropic Claude | 质量相当 | 1 min |
| LLM API（全部） | 返回友好提示"暂时无法生成，请手动编写" | N/A | 即时 |

**注意：** 切换 LLM 提供商后，建议也更新 prompt 模板（不同模型对不同 prompt 格式有偏好）。

---

## 6. 回滚预演检查表

> 每季度或重大发布前执行一次，确保回滚能力可靠。

| # | 检查项 | 方法 | 频率 |
|:-:|:-------|:-----|:----:|
| 1 | Vercel Rollback 功能正常 | 在 Staging 环境实际执行一次回滚 | 每季度 |
| 2 | 数据库快照分支可用 | 创建一次历史分支，验证数据完整性 | 每次部署 |
| 3 | LLM 降级切换流畅 | 临时切换环境变量，验证模型响应 | 每月 |
| 4 | 冒烟测试脚本能独立运行 | 在回滚后的环境中执行 L0+L1 | 每次回滚后 |
| 5 | 回滚通信模板就绪 | 通知模板（Slack/邮件/微信）已保存 | 首次上线前 |

---

## 7. 回滚通信模板

### 7.1 回滚通知

```
[紧急] AI PR 描述生成器 — 版本回滚通知

时间：YYYY-MM-DD HH:MM (UTC+8)
回滚版本：vX.Y.Z → vX.Y.Z-1
回滚原因：[简要说明]
触发人：[姓名]
执行人：[姓名]

影响：
- 回滚期间约 [N] 个 PR 请求未处理
- 数据库：[未受影响 / 已恢复]
- 已回滚的 PR 评论：需手动处理

后续步骤：
1. [ ] 确认冒烟测试通过（L0+L1）
2. [ ] 排查根因
3. [ ] 创建修复工单
4. [ ] 安排修复版本上线
```

### 7.2 回滚完成确认

```
[已完成] vX.Y.Z 回滚完成

✅ 冒烟测试 L0 通过
✅ 冒烟测试 L1 通过
✅ 健康检查正常
✅ Webhook 接收正常

服务已恢复。根因排查中。
```

---

## 8. 关键回滚场景速查表

| 场景 | 回滚操作 | 预计耗时 | 数据损失 |
|:-----|:---------|:-------:|:--------:|
| 新部署导致 500 错误 | Vercel Instant Rollback | < 1 min | 无 |
| 数据库 schema 错误 | Neon 分支回滚 + 迁移回滚 | 5 min | 回滚到分支时间点 |
| 环境变量配置错 | 纠正环境变量 + 重部署 | 2 min | 无 |
| LLM 模型质量差 | 切换环境变量到备选模型 | 1 min | 无 |
| GitHub App 权限不足 | GitHub App 设置页面修改 | 2 min | 无 |
| 多个组件同时故障 | 全套回滚（代码+DB+配置） | 10 min | 取决于 DB 回滚方式 |

---

## 9. 预防措施

| 措施 | 收益 | 实施成本 |
|:----|:-----|:--------:|
| 每次部署前打数据库快照 | 回滚时数据一致 | 5 min |
| 使用 Vercel Preview Deployments | 上线前发现环境问题 | 接 CI 自动 |
| 环境变量版本管理（1Password/Vercel） | 避免配置漂移 | 30 min 初始设置 |
| 渐进式部署（10% → 50% → 100%） | 小流量发现故障 | Vercel Pro 功能 |
| 部署前冒烟测试 CI 门禁 | 阻止问题发布到生产 | 2h 初始搭建 |

---

## 10. 附录：回滚检查清单（快速执行版）

```markdown
## 回滚执行清单

### 决策阶段
- [ ] 确认 P0/P1 故障分类
- [ ] 确认是否需要回滚
- [ ] 通知团队将进行回滚

### 执行阶段
- [ ] Vercel Dashboard → Rollback 到上一版本
- [ ] 验证回滚完成（Dashboard 显示 active）
- [ ] 执行冒烟测试 L0+L1
- [ ] 如果数据库回滚：更新 DATABASE_URL 环境变量

### 恢复验证
- [ ] 健康检查正常
- [ ] Webhook 可接受请求
- [ ] 测试仓库 PR 可触发 AI 生成
- [ ] 通知团队回滚完成
```
