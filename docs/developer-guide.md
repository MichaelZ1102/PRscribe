# 开发者使用指南 — 从开发者的角度看 PRscribe

> 如果你是一个普通开发者（不是管理员），您的团队已经安装了 PRscribe，  
> 您只需要像往常一样提 PR，剩下的交给 PRscribe。

---

## 🎯 一句话总结

**你正常提 PR，PRscribe 自动在评论里帮你写好描述。**

---

## 你只需要做这些

跟你平时的工作流**完全一样**，没有任何额外操作：

### 第 1 步：日常开发

```bash
git checkout -b feat/add-login-api
# ...写代码...
git add .
git commit -m "feat: add login API"
git push origin feat/add-login-api
```

### 第 2 步：创建 PR

在 GitHub 上点 **New Pull Request** → **Create Pull Request**

> 标题和描述可以随便写，甚至留空。PRscribe 会自动生成。

### 第 3 步：等待几秒

创建 PR 后，PRscribe 会自动：

1. 分析你的代码变更
2. 调用 AI 生成描述
3. 在 PR 中发布评论

整个过程约 **15-30 秒**。

---

## 你会看到的效果

### 创建 PR 后，评论区会出现这样一条消息：

---

🤖 **ai-pr-description-dev[bot]** 刚刚评论

## 📋 PR 描述（由 AI 自动生成）

### 标题
feat: add user login API with JWT authentication

### 变更摘要
- **做了什么：** 新增用户登录接口 `/api/v1/auth/login`，使用 JWT Token 鉴权
- **为什么做：** 实现用户认证功能，后续接口需要登录后才能访问
- **影响范围：** `src/routes/auth.ts`，`src/middleware/jwt.ts`

### 变更详情
| 文件 | 变更类型 | 说明 |
|------|---------|------|
| src/routes/auth.ts | 新增 | 登录接口，验证用户名密码并返回 JWT |
| src/middleware/jwt.ts | 新增 | JWT Token 验证中间件 |
| src/types/auth.ts | 新增 | 认证相关类型定义 |

### 🧪 测试建议
- [ ] 单元测试：验证 Token 过期后请求被正确拒绝
- [ ] 集成测试：验证完整登录流程（用户名密码 → Token → 访问受保护接口）

### ⚠️ 影响范围
- **破坏性变更：** 否
- **需要更新的文档：** API 文档需补充登录接口说明

---

> 🤖 此描述由 AI 自动生成，请审核后使用。

---

### 然后你可以

| 操作 | 说明 |
|:-----|:------|
| ✅ **直接使用** | 如果 AI 生成的描述准确，直接合并 PR |
| ✏️ **微调后使用** | 修改几个字后使用，比从零开始写快 10 倍 |
| ↩️ **忽略** | 删除评论，自己写描述，完全不影响流程 |

---

## 实际效果对比

### 没有 PRscribe

```
创建 PR → 写标题 → 写描述 → 写变更摘要 → 写测试建议
           ↓
      心理抗拒 → 随便写几个字
           ↓
      Reviewer 看不懂 → 反复沟通
```

### 有 PRscribe

```
创建 PR → （等 20 秒）
           ↓
    AI 自动生成完整描述
           ↓
      审核 → 合并
```

### Reviewer 看到的变化

| 对比 | 没有 PRscribe | 有 PRscribe |
|:-----|:-------------|:------------|
| **标题** | "修复 bug" | "fix: handle null pointer in user profile query" |
| **描述** | 空 | ✅ 完整描述：做了什么 + 为什么做 + 影响范围 |
| **变更详情** | 要自己看 diff | ✅ 表格列出每个文件及变更说明 |
| **测试建议** | 无 | ✅ 自动生成具体测试建议 |
| **Reviewer 体验** | ❌ 要自己理解变更 | ✅ 一目了然 |

---

## 几个真实例子

| PR | AI 生成的标题 | 代码量 | 耗时 |
|:---|:-------------|:------:|:----:|
| [PR #5](https://github.com/MichaelZ1102/PRscribe/pull/5) | 新增平台适配器接口定义，抽象多平台支持能力 | +40 行 | 15s |
| [PR #6](https://github.com/MichaelZ1102/PRscribe/pull/6) | feat: 将环境变量验证改为降级模式 | +22/-19 行 | 18s |
| [PR #7](https://github.com/MichaelZ1102/PRscribe/pull/7) | 新增 CommentService 封装 PR 评论发布逻辑 | +74 行 | 20s |

---

## 常见问题

### Q: 我需要安装任何工具吗？

**不需要。** 你只需要用 GitHub 提 PR，PRscribe 自动工作。

### Q: 我需要写特殊的 PR 模板吗？

**不需要。** PRscribe 分析你的代码 diff 来生成描述，跟 PR 正文内容无关。

### Q: 不想让 PRscribe 分析某个 PR 怎么办？

在 PR 标题或正文中包含 `[skip pr]`，PRscribe 会跳过该 PR。

### Q: PRscribe 生成的描述能修改吗？

**可以。** AI 生成的只是评论，你可以编辑、删除或忽略。

### Q: 代码安全吗？PRscribe 会存储我的代码吗？

**不会。** 代码仅用于 AI 生成描述，生成后立即丢弃，绝不存储。

---

> 你只管写代码，PRscribe 帮你写文档。🚀
