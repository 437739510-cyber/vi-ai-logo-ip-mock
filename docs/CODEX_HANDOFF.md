# Codex Handoff — 交接文档

> 作用：如果当前 Codex 上下文满或无法继续，新 Codex 看完此文件即可接手
> 更新：2026-06-02

---

## 一、项目在做什么

**Brand Brain** — AI 品牌顾问系统。不是 Logo 生成器，不是 VI 自动生成器，不是 AI 绘图工具。

**核心目标**：帮助不会品牌语言的老板，通过访谈获得高质量 Brand Brief。生成 VI 手册不是终点，获得正确 Brand Brief 才是第一目标。

**当前阶段：Discovery First。** 经过 ChatGPT 评审，暂停所有引擎开发，聚焦于 Brand Interview Engine（品牌访谈引擎）。核心要解决的问题是"客户不会品牌语言怎么办"。

---

## 二、当前 Git 状态

| 项目 | 值 |
|------|-----|
| 工作目录 | `C:\Users\Administrator\Documents\Codex\vi-ai-logo-ip-mock` |
| 分支 | `master` |
| 最新 commit | `102e2ad` — docs: update team roles |
| Production | `vi-ai-logo-ip-mock.vercel.app`（Vercel 自动部署）|
| 远程 | `https://github.com/437739510-cyber/vi-ai-logo-ip-mock.git` |

---

## 三、团队角色与分工

```
ChatGPT（创始人合伙人 + 产品总监 + 首席架构师）
           ↓   CEO（用户）— 桥梁
           ↓   Codex（CTO / 技术负责人）
```

### ChatGPT — 创始人合伙人 + 产品总监 + 首席架构师
决定路线、优先级、架构。不写代码。通过 PDF 或 Markdown 文件下发任务。

### Codex（你）— CTO / 技术负责人
实现、验证、部署、重构。阅读 `_inbox/` 中的任务文档，产出到 `docs/` 和 `_outbox/`。

### CEO（用户）
客户反馈、市场判断、协调 ChatGPT ↔ Codex。
CEO 有时需要**人工操作网页**（如 Vercel 后台配环境变量、Supabase 执行 SQL、获取 Manus API Key），Codex 给清楚步骤和按钮位置即可。

---

## 四、沟通规范 — 最重要（2026-06-02 建立）

### 目录结构

```
vi-ai-logo-ip-mock/
│
├── _inbox/         ← ChatGPT 发任务（CEO 手动放入）
│                     格式：PDF 或 Markdown
│                     命名：YYYY-MM-DD_序号_任务名.md
│
├── docs/           ← Codex 产出设计文档
│                     命名：XX_模块名.md（序号 + 模块）
│
├── _outbox/        ← Codex 给 ChatGPT 的回复
│                     命名：YYYY-MM-DD_主题.md
│                     CEO 转发到 ChatGPT 对话框
│
├── decisions/      ← 项目重大决策记录
│                     命名：DECISION_XXX_标题.md
│
└── archive/        ← 已完成任务的文档归档
```

### 三方协作流程

```
ChatGPT
  │ 写任务文档 (PDF或MD)
  ▼
CEO
  │ 下载/另存为 → 放入 _inbox/
  ▼
Codex
  │ 读取 _inbox/
  │ 执行任务 → 产出 docs/XX.md + _outbox/YY.md
  ▼
CEO
  │ 将 docs/ 和 _outbox/ 转发给 ChatGPT
  ▼
ChatGPT
  │ 评审 → 新任务文档
  │ 循环...
```

### 关键约定

- **ChatGPT 不直接和 Codex 对话。** 所有沟通通过 CEO + 文件传递。
- **重大决策必须记录到 `decisions/`。** 每条决策包含日期、决策内容、原因、影响范围、关联文档。
- **不要替 CEO 做方向决策。** Codex 可以建议，但不能决定。重大修改先出设计文档再写代码。
- **CEO 不是程序员。** 沟通用中文、简洁、给文件路径。需要 CEO 人工操作网页时，给清楚步骤和按钮位置。

---

## 五、项目北极星（North Star）

Brand Brain 不是：
- Logo 生成器
- VI 自动生成器
- AI 绘图工具

Brand Brain 是：

**AI 品牌顾问系统。**

核心目标：

帮助不会品牌语言的老板，通过访谈获得高质量 Brand Brief。

生成 VI 手册不是终点。获得正确 Brand Brief 才是第一目标。

当前阶段：Discovery First。

未来路线：

```
Discovery
↓
Diagnosis
↓
Brand Brief
↓
Manus（候选执行层，待 PoC 验证）
↓
VI Manual
```

任何时候问"我们为什么做这个"，答案应该是：**为了从不会品牌语言的老板口中，挖出真正的品牌信息。**

---

## 六、方法论来源

Brand Brain 不是让 AI 自由发挥的生成工具。它是品牌方法论的数字化的产品。

### 知识来源

1. **老师课件** — 品牌 VI 设计的核心方法论（已整理为知识文档）
2. **老师真实案例** — 正面案例库
3. **反面案例库** — 什么是不好的品牌 VI，为什么不好
4. **华为坤灵等行业规范案例** — 行业标准参考
5. **Discovery Framework V2** — 当前核心设计文档

### 原则

```
老师方法论
↓
结构化
↓
数字化
↓
AI化
```

不是"让 AI 设计 Logo"，而是"把品牌顾问的方法论做成 AI 可执行的系统"。

---

## 七、当前已建立的关键决策

| 编号 | 决策 | 日期 | 状态 |
|------|------|------|------|
| DECISION_001 | Discovery First — 暂停 DNA/Maturity/Layout Engine，聚焦访谈 | 2026-06-01 | 已执行 |
| DECISION_002 | 保留现有系统底座 — 不推倒重来 | 2026-06-01 | 已执行 |
| DECISION_003 | Manus 作为候选执行层（待 PoC 验证）| 2026-06-02 | 待验证 |

详见 `decisions/` 目录。

---

## 八、当前已完成工作

### 现行架构

```
客户
  ↓
Brand Interview Engine（设计阶段）
  ↓
Brand Brief（设计阶段）
  ↓
Manus API（PoC 阶段）
  ↓
VI Manual
```

### 生产环境已上线验证的功能

| 功能 | 状态 |
|------|------|
| Lead Capture（咨询表单 + 文件上传） | 生产可用 |
| Supabase Storage（文件存储） | 生产可用 |
| 管理后台（Dashboard / Projects / Clients / Billing） | 生产可用 |
| PDF 导出（pdf-lib + Supabase 缓存） | 生产可用 |
| 管理员登录 | 生产可用 |
| Billing 系统（余额 + 消费记录 + 费用预估） | 可用（本地 JSON） |
| Memory 系统（ClientMemory / ProjectMemory / IndustryMemory） | 可用 |
| Brand Dictionary + Industry Knowledge | 可用 |

### 已修复的生产问题

| Issue | 修复方式 |
|-------|---------|
| EROFS (/api/upload) | 改为 Supabase Storage 直传 |
| 413 Payload Too Large | 去掉 Vercel Function 中转 |
| Supabase Storage RLS | 添加 Storage Policy 允许 anon 写入 |
| EROFS (/api/submit) | 包裹 `process.env.VERCEL !== "1"` 保护 |
| PDF export 500 | 不再依赖 SUPABASE_SERVICE_KEY |

### 已评审通过的设计文档

| 文件 | 内容 | 状态 |
|------|------|------|
| `docs/06_BRAND_DISCOVERY_FRAMEWORK.md` | Discovery Framework V2（5 个新增模块） | V2 通过 |
| `docs/08_EXISTING_SYSTEM_VALUE_AUDIT.md` | 现有系统价值审计（保留/冻结/废弃/改造） | 通过（92/100） |
| `docs/09_MANUS_INTEGRATION_FEASIBILITY.md` | Manus 接入可行性调研 | 通过 |
| `docs/10_MANUS_POC_PLAN.md` | Manus PoC 计划（3 案例 + 评分标准） | 新产出 |

---

## 九、待办事项

1. 获取 Manus API Key — CEO 在 manus.im 注册并生成
2. 执行 Manus PoC — 用 3 个案例测试 Manus 生成质量
3. PoC 通过后 → 07_DECISION_LAYER_V2.md — 设计 Decision Layer 核心算法
4. Brand Interview Engine 设计和开发
5. Manus API 集成开发

### 暂停开发

- DNA Engine
- Maturity Engine
- Layout Engine V1 / V1.1 / V2
- 当前 VI 生成链路（generate-manual 系列 API）
- Agent Pipeline（orchestrator + 6 agents）
- Brand Interview UI（等 Decision Layer 设计完成后）

---

## 十、当前最大风险

| 风险 | 状态 | 影响 | 缓解措施 |
|------|------|------|---------|
| Manus PoC 尚未验证 | 待验证 | 决定执行层路线 | PoC 计划已就绪，等 API Key |
| Discovery 尚未生产验证 | 设计完成 | 决定 Brand Brief 质量 | V2 已通过评审 |
| Knowledge Hub 仅完成知识整理 | 初期 | 访谈质量依赖知识库深度 | 先做 PoC，后续迭代 |
| 项目已近一个月未提交代码 | 待恢复 | 代码落后于设计 | PoC 通过后进入开发阶段 |

---

## 十一、未来路线图

```
Phase 1: Discovery First（当前）
  06_BRAND_DISCOVERY_FRAMEWORK.md — V2 通过

Phase 2: Manus PoC
  09 + 10 — 验证 Manus 作为执行层

Phase 3: Decision Layer
  07_DECISION_LAYER_V2.md — 访谈决策逻辑

Phase 4: Brand Brief Generator
  从 Interview 到结构化 Brief 的完整链路

Phase 5: Brand Interview UI
  前端访谈界面

Phase 6: Manus Integration
  Brand Brain + Manus 全链路打通

Phase 7: Production Validation
  真实客户验证 + 迭代
```

---

## 十二、技术栈

Next.js 15.5.18 / TypeScript / Node 22.14 / Supabase / DeepSeek / 通义万相 / pdf-lib / Sharp / Vercel

**新增依赖（待 PoC 后确定）：**
- Manus API（`https://api.manus.ai`，REST v2，API Key 认证）

---

## 十三、Production API Keys

全部已配在 Vercel Production。新 Codex 本地开发时间 CEO 要。

| Key | Vercel 变量 |
|-----|------------|
| DeepSeek | `DEEPSEEK_API_KEY` |
| 通义万相 | `ALIYUN_API_KEY` |
| Supabase URL | `NEXT_PUBLIC_SUPABASE_URL` |
| Supabase Anon | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| 管理员密码 | `ADMIN_PASSWORD` |
| Manus API Key（待获取） | `MANUS_API_KEY` |

余额：DeepSeek ¥54.71 / 通义万相 ¥153.84

---

## 十四、本地网络

| 配置 | 值 |
|------|-----|
| HTTP 代理 | `http://127.0.0.1:22307` |
| SOCKS5 代理 | `127.0.0.1:22308` |

Git push 报连接错误时设代理：

```powershell
git config --global http.proxy http://127.0.0.1:22307
git push origin master
git config --global --unset http.proxy
```

本地运行：
```powershell
Set-Location "C:\Users\Administrator\Documents\Codex\vi-ai-logo-ip-mock"
npm run dev
```

---

## 十五、项目禁止事项

未经决策记录批准，禁止：

1. **推倒重写现有平台** — 现有系统底座已验证可用（08 审计 92 分）
2. **跳过 Discovery 直接做生成** — 当前最大瓶颈是理解客户，不是生成能力
3. **跳过 Diagnosis 直接生成 Brief** — Discovery 完成后必须经过 Diagnosis Summary + 客户确认
4. **把 Brand Brain 做成 Logo Generator** — 北极星是品牌顾问，不是设计工具
5. **在 Manus PoC 完成前绑定 Manus 为唯一执行层** — PoC 通过后才能确认
6. **删除 decisions 中的历史决策** — 决策记录不可逆，只能新增
7. **绕过 CEO 进行重大架构调整** — 任何方向性变更必须经过 CEO

原则：

```
重大方向改变
→ 设计文档
→ ChatGPT 评审
→ 决策记录
→ 执行
```

---

## 十六、当前认知地图

### 已经确认

- 客户不会品牌语言（这是核心问题）
- Discovery 比生成更重要（先后顺序）
- 保留现有平台比重写更合理（08 审计确认）
- 品牌首先是人格，不是功能（Humanization Layer 原则）
- 正面案例比纯理论更有价值（方法论来源）
- 反面案例是重要训练素材（Anti-Pattern 参考）
- Manus 有潜力成为候选执行层，但必须经过 PoC 验证

### 尚未确认

- Manus 输出质量是否达到椰岛工坊水平（待 PoC）
- Discovery 在真实客户中的完成率（待生产验证）
- Brand Brief 是否足以驱动高质量 VI（待 PoC 验证）
- Knowledge Hub 如何形成真正决策能力（待设计）

---

## 十七、给新 Codex 的提示

1. **先读 `decisions/` 目录。** 了解已经做过的重大决策，不要推翻已有结论。
2. **先读 `_inbox/` 目录。** 最后一个文件是最新的任务。
3. **读 `docs/06_BRAND_DISCOVERY_FRAMEWORK.md`。** 这是当前核心设计文档。
4. **读 `docs/08_EXISTING_SYSTEM_VALUE_AUDIT.md`。** 了解哪些代码保留、哪些冻结。
5. 产出文档一律放到 `docs/`，不要堆在根目录。
6. 给 ChatGPT 的回复放到 `_outbox/`，让 CEO 转发。
7. 重大决策要与 CEO 确认后记录到 `decisions/`。
8. **记住北极星：** Brand Brain 是品牌顾问系统，不是生成工具。目标是获得正确 Brand Brief。
9. **记住禁止事项：** 第七条。未经批准，不要替 CEO 做方向决策。

---

## 十八、当前 Codex 状态

- Discovery Framework V2 设计完成
- 现有系统审计完成（92 分）
- Manus 可行性验证完成（API 可用）
- Manus PoC 计划完成（待执行）
- 协作规范建立（_inbox / docs / decisions / _outbox）
- 交接文档升级为"项目宪法"（含北极星 + 方法论 + 风险 + 路线图 + 禁止事项 + 认知地图）
- 等待 Manus PoC 执行结果
