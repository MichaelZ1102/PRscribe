# 开发计划 — 2 周 MVP

## 时间线概览

```
Day 1-2    Day 3-5    Day 6-8    Day 9-12   Day 13-14
  准备期    GitHub App   核心逻辑   LLM 集成    测试+上线
           Skeleton     Diff+Prompt             
```

## 详细计划

### Phase 1：准备期（Day 1-2）

| 任务 | 工时 | 依赖 | 产出 |
|:----|:----:|:----:|:-----|
| 1.1 注册 GitHub App 开发账号 | 1h | - | GitHub App 注册完成 |
| 1.2 创建 GitHub App 并获取凭证 | 2h | 1.1 | App ID、Private Key、Webhook Secret |
| 1.3 安装 ngrok 并配置本地隧道 | 1h | - | 本地 Webhook 可接收远程请求 |
| 1.4 初始化项目脚手架 | 3h | - | Hono.js 项目结构 + TypeScript 配置 |
| 1.5 配置开发环境变量 | 1h | 1.2, 1.4 | .env 文件 + 环境变量验证 |
| 1.6 搭建 Upstash Redis + BullMQ 队列 | 2h | 1.4 | Redis 连接 + 队列初始化 + 去重逻辑 |

**验证标准：** `GET /api/v1/health` 返回 200，Redis 可连接，JWT 可生成

### Phase 2：GitHub App Skeleton（Day 3-5）

| 任务 | 工时 | 依赖 | 产出 |
|:----|:----:|:----:|:-----|
| 2.1 实现 Webhook 接收端点 | 3h | 1.4 | POST /api/v1/webhook 可接收 GitHub 事件 |
| 2.2 Webhook 签名验证中间件 | 2h | 2.1 | 非法请求被拒签 |
| 2.3 GitHub App JWT 认证 + Installation Token | 3h | 1.2 | 可获取 Installation Token（需 jsonwebtoken） |
| 2.4 幂等性去重（delivery_id Redis 去重） | 2h | 1.6, 2.1 | 重复 webhook 被忽略 |
| 2.5 Webhook 事件路由 | 2h | 2.1 | 不同事件分发给不同处理器 |
| 2.6 限流中间件 | 2h | 1.6, 2.1 | 防滥用，Redis 滑动窗口限流 |

**验证标准：** 在测试仓库创建 PR，服务器可收到并验证 webhook，重复事件被去重

### Phase 3：Diff + Prompt 核心（Day 6-8）

| 任务 | 工时 | 依赖 | 产出 |
|:----|:----:|:----:|:-----|
| 3.1 Diff Fetcher 实现 | 4h | 2.3, 2.5 | 通过 GitHub API 获取 PR diff |
| 3.2 Diff 解析与格式化 | 3h | 3.1 | 按文件分组的结构化 diff 数据 |
| 3.3 大 diff 阈值检测 | 1h | 3.1 | >500 文件 / >5MB 自动跳过 |
| 3.4 Prompt 模板设计 | 4h | - | 第一版 prompt（带示例输出格式） |
| 3.5 Prompt Builder 实现 | 3h | 3.2, 3.4 | 动态组装 prompt + token 估算 |
| 3.6 Prompt 优化迭代 | 4h | 3.5 | 用真实 diff 测试并调优 |

**验证标准：** 手动输入 diff 可生成格式正确的 prompt

### Phase 4：LLM 集成（Day 9-12）

| 任务 | 工时 | 依赖 | 产出 |
|:----|:----:|:----:|:-----|
| 4.1 OpenAI SDK 接入（仅 GPT-4o-mini） | 3h | 3.5 | 可调用 GPT-4o-mini 生成内容 |
| 4.2 结构化输出解析 | 3h | 4.1 | LLM 返回内容解析为 Discriminated Union 类型 |
| 4.3 重试策略（2 次重试，指数退避） | 2h | 4.1 | LLM 调用失败时自动重试 |
| 4.4 队列消费者（异步处理） | 3h | 1.6, 4.1 | BullMQ 消费者消费队列任务 |
| 4.5 完整流程串联 | 4h | 3.1, 4.1, 4.4 | Webhook → 202 → 队列 → diff → LLM → 评论 |
| 4.6 GitHub API 评论发布 | 3h | 2.3 | 将生成的描述发布到 PR |
| 4.7 边缘情况处理 | 3h | 4.5 | 空 diff、超大 diff、LLM 空返回、网络错误 |

**验证标准：** 创建 PR → 自动获得 AI 生成的 PR 描述评论

### Phase 5：测试 + 上线（Day 13-14）

| 任务 | 工时 | 依赖 | 产出 |
|:----|:----:|:----:|:-----|
| 5.1 接入错误监控 Sentry | 2h | 1.4 | 错误追踪 + 性能监控 + LLM 失败报警 |
| 5.2 单元测试（vitest） | 4h | 4.5 | 核心逻辑 80%+ 覆盖率 |
| 5.3 Webhook 集成测试 | 3h | 5.2 | 模拟 GitHub 事件的测试用例 |
| 5.4 部署到 Railway/Fly.io | 3h | 5.2 | 生产环境上线 |
| 5.5 生产环境 GitHub App 配置 | 2h | 5.4 | 生产 App 凭证 + 域名配置 |
| 5.6 冒烟测试 + 回滚方案 | 3h | 5.4, 5.5 | 真实仓库测试 + 回滚流程 |

**验证标准：** 在生产环境中，真实仓库的 PR 可获得 AI 描述

## 3. 里程碑

| 里程碑 | 时间 | 检查点 |
|:------:|:----:|:-------|
| **M1：环境就绪** | Day 2 | 项目可运行，Redis 连接正常，JWT 可生成，ngrok 可用 |
| **M2：Webhook 接收** | Day 5 | 本地可接收 GitHub Webhook，签名验证通过，去重正确 |
| **M3：Diff 处理** | Day 8 | 可获取并解析 PR diff，生成正确 prompt |
| **M4：完整流程** | Day 12 | End-to-end：创建 PR → 202 → 队列 → AI 描述 → PR 评论 |
| **M5：上线** | Day 14 | 生产环境部署完成，Sentry 监控正常 |

## 4. 风险与缓解

| 风险 | 概率 | 影响 | 缓解方案 |
|:----|:----:|:----:|:---------|
| LLM 生成质量差 | 中 | 高 | 多次迭代 prompt；上线后收集用户反馈 |
| diff 太大导致 token 超限 | 中 | 中 | 截断策略；优先保留文件列表 + 变更类型 |
| GitHub API 限流 | 低 | 中 | 合理限流 + 队列缓冲 |
| Webhook 重放导致重复处理 | 中 | 中 | delivery_id 幂等性去重（已加入 Phase 2） |
| Railway 实例重启导致队列任务丢失 | 低 | 低 | BullMQ 持久化到 Redis，重启后恢复 |
