# AI PR 描述生成器 — 任务看板

> 基于 development-plan.md 拆解为可执行任务
> 看板列：📋 Backlog | ▶️ In Progress | ✅ Done

---

## Phase 1：准备期（Day 1-2）

| ID | 任务 | 工作量 | 依赖 |
|:--:|:-----|:------:|:----:|
| P1-01 | 注册 GitHub App 开发账号 & 创建测试仓库 | 1h | - |
| P1-02 | 创建 GitHub App 并获取凭证（App ID、Private Key、Webhook Secret） | 2h | P1-01 |
| P1-03 | 安装 ngrok 并配置本地 Webhook 隧道 | 1h | - |
| P1-04 | 初始化项目脚手架（Hono.js + TypeScript + Vitest + Zod） | 3h | - |
| P1-05 | 配置环境变量 + 验证 .env 加载 | 1h | P1-02, P1-04 |
| P1-06 | 搭建 Upstash Redis + BullMQ 队列（幂等性 + 限流基础设施） | 2h | P1-04 |

**里程碑 M1：** `GET /api/v1/health` 返回 200，Redis 可连接，JWT 可生成

---

## Phase 2：GitHub App Skeleton（Day 3-5）

| ID | 任务 | 工作量 | 依赖 |
|:--:|:-----|:------:|:----:|
| P2-01 | 实现 Webhook 接收端点 `POST /api/v1/webhook` | 3h | P1-04 |
| P2-02 | Webhook 签名验证中间件（x-hub-signature-256） | 2h | P2-01 |
| P2-03 | GitHub App JWT 认证 + Installation Token 获取（需 jsonwebtoken） | 3h | P1-02 |
| P2-04 | 幂等性去重（delivery_id Redis Set + 24h TTL） | 2h | P1-06, P2-01 |
| P2-05 | 事件路由器（按 x-github-event 分发） | 2h | P2-01 |
| P2-06 | 限流中间件（Redis 滑动窗口） | 2h | P1-06, P2-01 |

**里程碑 M2：** 测试仓库创建 PR，本地可接收 webhook，重复事件被去重

---

## Phase 3：Diff + Prompt 核心（Day 6-8）

| ID | 任务 | 工作量 | 依赖 |
|:--:|:-----|:------:|:----:|
| P3-01 | Diff Fetcher — 通过 GitHub API 获取 PR diff | 4h | P2-03, P2-05 |
| P3-02 | Diff 解析器 — 按文件分组的结构化 diff 数据 | 3h | P3-01 |
| P3-03 | 大 diff 阈值检测（>500 文件 / >5MB 自动跳过） | 1h | P3-01 |
| P3-04 | Prompt 模板 v1 — PR 标题 + 描述 + 变更摘要 | 4h | - |
| P3-05 | Prompt Builder — 动态组装 prompt + token 估算 | 3h | P3-02, P3-04 |
| P3-06 | Prompt 迭代优化 — 用真实 diff 测试并调优 | 4h | P3-05 |

**里程碑 M3：** 输入真实 diff → 生成格式正确的 prompt

---

## Phase 4：LLM 集成（Day 9-12）

| ID | 任务 | 工作量 | 依赖 |
|:--:|:-----|:------:|:----:|
| P4-01 | OpenAI SDK 接入 + GPT-4o-mini 调用 | 3h | P3-05 |
| P4-02 | 结构化输出解析（LLM 返回 → PRDescription Discriminated Union） | 3h | P4-01 |
| P4-03 | 重试策略（2 次重试，指数退避 3s → 9s） | 2h | P4-01 |
| P4-04 | 队列消费者 — BullMQ 异步消费队列任务 | 3h | P1-06, P4-01 |
| P4-05 | 完整流程串联（Webhook → 202 → 队列 → diff → LLM → 评论） | 4h | P3-01, P4-01, P4-04 |
| P4-06 | GitHub API 评论发布 + PR body 更新 | 3h | P2-03 |
| P4-07 | 边缘情况处理（空 diff、超大 diff、LLM 空返回、网络错误、幂等性边界） | 3h | P4-05 |

**里程碑 M4：** 创建 PR → 202 Accepted → 队列消费 → AI 描述 → PR 评论

---

## Phase 5：测试 + 上线（Day 13-14）

| ID | 任务 | 工作量 | 依赖 |
|:--:|:-----|:------:|:----:|
| P5-01 | 接入错误监控 Sentry（错误追踪 + LLM 失败报警） | 2h | P1-04 |
| P5-02 | 单元测试（vitest，核心逻辑 80%+ 覆盖率） | 4h | P4-05 |
| P5-03 | Webhook 集成测试（模拟 GitHub 事件） | 3h | P5-02 |
| P5-04 | 部署到 Railway / Fly.io | 3h | P5-02 |
| P5-05 | 生产环境 GitHub App 配置（域名、权限终版） | 2h | P5-04 |
| P5-06 | 冒烟测试 + 回滚方案 | 3h | P5-04, P5-05 |

**里程碑 M5：** 生产环境上线，Sentry 监控正常，真实仓库 PR 可获得 AI 描述

---

## 总计

| Phase | 天数 | 任务数 | 总工时 |
|:-----|:---:|:------:|:------:|
| P1 准备期 | 2 | 6 | 10h |
| P2 GitHub App Skeleton | 3 | 6 | 14h |
| P3 Diff + Prompt | 3 | 6 | 19h |
| P4 LLM 集成 | 4 | 7 | 21h |
| P5 测试 + 上线 | 2 | 6 | 17h |
| **总计** | **14** | **31** | **81h** |
