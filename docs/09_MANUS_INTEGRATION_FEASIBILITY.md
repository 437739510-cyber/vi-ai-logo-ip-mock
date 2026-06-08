# 09 — Manus Integration Feasibility

> 目的：验证 Manus 是否可作为 Brand Brain 的执行层
> 信息来源：Manus 官方文档（manus.im/docs + open.manus.ai/docs v2）
> 验证日期：2026-06-02
> 当前状态：Manus 已被 Meta 收购，提供正式 REST API v2

---

## 一、结论先行

**Manus 可以作为 Brand Brain 的执行层接入。**

Manus 提供了完整的 REST API v2，支持：
- 程序化任务创建与执行
- 文件上传（PDF/图片/文档）
- 结构化输出（JSON Schema）
- 异步结果回调（Webhook）
- 多轮对话（追问/澄清）
- 中文支持

不需要等内测或白名单。API 已开放。

---

## 二、逐一回答 10 个问题

### Q1: Manus 是否有正式 API？

**是。** Manus 提供 REST API v2，基地址为 `https://api.manus.ai`。

OpenAPI 规范可获取：
- v2: `https://open.manus.ai/docs/v2/openapi_v2.json`
- API 文档: `https://open.manus.ai/docs`

Manus 本身也已被 Meta 收购，作为 Meta 面向企业的 AI 产品线一部分。

### Q2: 如何认证？

两种方式：

| 方式 | 说明 |
|------|------|
| API Key | 请求头 `x-manus-api-key`，在 Manus 后台生成 |
| OAuth2 | `Authorization: Bearer {access_token}`，适用于第三方应用集成 |

推荐 Brand Brain 使用 API Key 方式，简单直接。

### Q3: 如何创建任务？

`POST /v2/task.create`

```json
{
  "message": {
    "content": "根据以下品牌需求生成 VI 手册..."
  },
  "project_id": "brand-brain-prod",
  "structured_output_schema": { ... },
  "locale": "zh-CN",
  "interactive_mode": false
}
```

任务异步执行。创建后返回 `task_id`，用于后续轮询或 Webhook 接收结果。

### Q4: 如何传入 Brand Brief？

Brand Brief 可通过 `message.content` 传入。有两种策略：

**策略 A（推荐）：Brief 作为任务描述的一部分**

```
message.content = "
请根据以下品牌需求生成 VI 手册。

品牌名称：老陈牛肉面
行业：餐饮/食品
品牌DNA：匠人、真实、坚持
品牌人格：温暖、传统、烟火气
品牌价值：一碗熬了28年的好汤
差异化：坚持鲜牛骨熬汤6小时
Logo：无
IP公仔：无

请输出包含封面、品牌色、字体、Logo规范、应用规范等完整VI手册。
输出格式为 PDF。
"
```

**策略 B：Brief 作为 JSON 附件**

将 Brand Brief JSON 通过 `file.upload` 上传，在任务中引用 `file_id`。

### Q5: 是否支持文件上传？

**是。** 通过 `file.upload` 上传：

| 方式 | 说明 |
|------|------|
| `file_id` | 先上传到 Manus，获取 file_id 后在任务中引用 |
| `file_url` | 提供文件的公开 URL，Manus 直接下载 |
| `file_data` | Base64 编码，直接在请求体中附带 |

文件类型支持：PDF、PNG、JPG、CSV 等。文件上传后 48 小时自动过期。

Brand Brain 场景下：客户上传的 Logo 图片、参考手册 PDF 可通过 `file.upload` 传入 Manus。

### Q6: 是否能返回生成结果？

**是。** 通过两种方式获取：

**方式 1（推荐）：Webhook 回调**

配置 webhook 后，任务完成时自动推送通知。Brand Brain 接收回调后拉取结果。

**方式 2：轮询**

调用 `GET /v2/task.listMessages?task_id=xxx` 获取事件流。其中包含 `structured_output_result` 事件（结构化输出）和文件消息。

### Q7: 返回格式是什么？

Manus 返回的是事件流（event stream），包含：

| 事件类型 | 说明 |
|---------|------|
| `text` | Agent 的文本回应 |
| `file` | Agent 生成的文件（图片、PDF 等） |
| `structured_output_result` | 结构化 JSON 结果（如果传入了 schema） |
| `agent_status` | 任务状态（running / waiting / completed / failed）|
| `messageAskUser` | Agent 需要用户确认或补充信息 |

### Q8: 是否能拿到 PDF / 图片 / 文档？

**是。** Agent 生成的文件通过 `file` 类型事件返回，包含文件的下载 URL。Brand Brain 可以直接下载并通过 Supabase Storage 存储。

Manus 的 Design View 功能支持生成设计稿级别的输出，适合 VI 手册场景。

### Q9: 价格、并发、限制是什么？

**价格：** 定价页面（manus.im/pricing）为 JS 渲染，未抓取到精确数字。但已知：
- 免费个人账户降级为 `manus-1.6-lite`
- 付费计划通过 API 可调用 `manus-1.6` 和 `manus-1.6-max`
- 消耗按 credit 计费（通过 `usage.list` API 查询）

**限制：**

| 端点 | 限制 |
|------|------|
| `task.create` | 10 次/分钟/用户 |
| `task.listMessages` | 100 次/分钟/用户 |
| 文件上传 | 40 次/分钟 |
| Webhook | 40 次/分钟 |

**对于 Brand Brain 场景评估：**
- 单次 VI 手册生成 = 1 次 `task.create`
- 轮询进度 = 假设 30-60 次 `task.listMessages`（完全够用）
- 10 次/分钟的限制对于 B2B 场景足够，仅客户提交时才触发

### Q10: 如果 Manus 无法稳定接入，替代方案是什么？

| 方案 | 可行性 | 说明 |
|------|--------|------|
| **方案 A：Manus API（首选）** | ✅ 可行 | 正式 API 已开放，有完整文档 |
| **方案 B：自研 DeepSeek + Tongyi Wanxiang 管道** | ✅ 已存在 | Brand Brain 已有 generate-manual 链路，但质量和一致性不如 Manus |
| **方案 C：Manus API + Brand Brain 混合** | ✅ 推荐 | Discovery（Brand Brain）→ 生成（Manus）+ 资产保护（Brand Brain Asset Guardian）|

---

## 三、推荐架构

```
Brand Brain（负责诊断 + 决策）
  │
  ├── Brand Interview Engine
  ├── Decision Layer
  ├── Knowledge Hub
  └── Asset Guardian
  │
  └── 产出 Brand Brief (JSON)
  │
  ▼
Manus API（负责执行）
  │
  ├── POST /v2/task.create
  │   ├── message.content = Brand Brief 文本
  │   ├── file_id[] = 客户上传的 Logo/参考图
  │   ├── structured_output_schema = VI Manual JSON Schema
  │   ├── locale = "zh-CN"
  │   └── agent_profile = "manus-1.6" 或 "manus-1.6-max"
  │
  ├── 轮询或 Webhook 接收结果
  │   ├── structured_output_result → VI 手册 JSON
  │   └── file → 生成的 PDF / 图片
  │
  ▼
Brand Brain（负责存储 + 交付）
  │
  ├── 下载生成文件 → Supabase Storage
  ├── PDF 缓存 → 复用现有 export-pdf 逻辑
  └── Billing 记录 → 复用现有 usage-log
```

### 关键点

1. **Manus 不替代 Brand Brain**。Brand Brain 负责 Discovery + Diagnosis + 资产保护。Manus 负责执行生成。
2. **Structured Output 是关键**。Manus 支持传入 JSON Schema 并返回结构化结果，Brand Brain 可以精确控制输出格式。
3. **已有资产保护逻辑可保留**。Asset Guardian Agent 的逻辑在下发给 Manus 之前可以先做一次保护扫描，确保 Manus 不会扭曲客户的 Logo/IP。
4. **Memory 系统仍然有价值**。ClientMemory 记录每次生成的结果，ProjectMemory 追踪进度。

---

## 四、集成难度评估

| 项目 | 难度 | 工作量 | 说明 |
|------|------|--------|------|
| API 认证对接 | 低 | 2 小时 | API Key 方式，一次配置 |
| Brand Brief 格式化 | 中 | 1 天 | 需要将 Interview 输出的 Brief 转为 Manus 任务指令 |
| 文件上传对接 | 低 | 4 小时 | 调用 `file.upload`，已有上传逻辑 |
| 结果接收（Webhook） | 中 | 1 天 | 配置 Webhook + 验证签名 |
| 结果解析与存储 | 中 | 1 天 | 解析 structured_output_result，存 Supabase |
| 错误重试 | 低 | 4 小时 | 基于 rate limit 的退避重试 |
| 整体集成 | 中 | **约 5 个工作日** | |

---

## 五、风险与缓解

| 风险 | 程度 | 缓解措施 |
|------|------|---------|
| Manus API 价格未知 | 中 | 待获取实际定价后评估。备选方案 B（自研管道）已存在 |
| Manus 生成的 VI 质量 | 中 | 未验证。建议先用少量真实 Brand Brief 做概念验证（PoC） |
| Rate limit 10次/分钟 | 低 | Brand Brain 是低并发场景（每次客户提交才调用一次）|
| API 变更 | 低 | 已接入 Meta，产品稳定。API v2 是新版本，v1 已标记废弃 |
| 依赖外部服务 | 低 | Manus API 有明确的 SLA。备选方案 B 可降级 |

---

## 六、建议下一步

1. **获取 Manus API Key** — 在 manus.im 注册并生成 API Key（CEO 人工操作）
2. **PoC 验证** — 用 1 个真实 Brand Brief 调用 Manus API 生成 VI 手册，验证输出质量
3. **如果 PoC 通过** — 开始集成开发（约 5 个工作日）
4. **如果 PoC 不通过** — 降级到方案 B（自研管道），继续优化现有生成链路

---

## 附录：Manus API v2 端点清单

| 端点 | 用途 |
|------|------|
| `POST /v2/task.create` | 创建任务（核心） |
| `GET /v2/task.detail` | 查询任务状态 |
| `GET /v2/task.listMessages` | 获取任务消息/结果（轮询） |
| `POST /v2/task.sendMessage` | 发送后续消息（多轮对话） |
| `POST /v2/task.stop` | 停止任务 |
| `POST /v2/task.confirmAction` | 确认待定操作 |
| `POST /v2/file.upload` | 上传文件 |
| `POST /v2/webhook.create` | 创建 Webhook |
| `GET /v2/usage.list` | 查询用量/余额 |
| `POST /v2/project.create` | 创建项目（组织任务） |
| `GET /v2/structured_output` | 结构化输出提取 |
