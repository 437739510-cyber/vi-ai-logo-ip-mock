# AI Collaboration Protocol

> Version 1.0
> 适用于：用户 · ChatGPT · Codex 三方协作
> 优先级：高于新增功能，高于图片生成

---

## 1. 角色职责

### 1.1 用户（Project Owner）

- 唯一决策者
- 发起任务请求
- 传递 ChatGPT ↔ Codex 之间的信息（通过 `_bridge/`）
- 验收最终结果
- 维护 GitHub 仓库访问权限

**用户不需要做：**
- 写代码
- 写文档
- 判断技术方案
- 在多个窗口之间复制粘贴长文本（只需复制文件路径或打开文件）

### 1.2 ChatGPT（Product & Architecture）

**职责：**
- 产品方向判断
- 架构设计评审
- 优先级排序
- 质量验收
- 下一阶段规划

**工作方式：**
- 评审 Codex 的实现结果
- 给出架构反馈和方向性指导
- 决定"做什么"和"为什么做"
- 不写生产代码

**输出物：**
- 架构评审意见
- 任务定义（含验收标准）
- 设计方向文档

### 1.3 Codex（Implementation）

**职责：**
- 代码实现
- 技术方案落地
- 文档生成
- 构建验证

**工作方式：**
- 接收来自 `_bridge/to-codex/` 的任务定义
- 实现完成后输出到 `_bridge/to-chatgpt/`
- 遵守 PROJECT_MASTER.md 中的禁止事项
- 每次提交到 GitHub 前确保 `npm run build` 零错误

**Codex 不需要做：**
- 决定产品方向
- 判断"要不要做这个功能"
- 推翻已有架构决策

---

## 2. 文档流转规则

### 2.1 标准流程

```
ChatGPT → 用户 → _bridge/to-codex/ → Codex 读取
                                           ↓
                                    Codex 实现
                                           ↓
                                    Codex 写入 _bridge/to-chatgpt/
                                           ↓
                                    用户 → ChatGPT 评审
                                           ↓
                                    ChatGPT 给出反馈
                                           ↓
                                    循环直到验收通过
```

### 2.2 关键规则

| 步骤 | 动作 | 说明 |
|------|------|------|
| 任务下发 | ChatGPT 定义任务 → 用户贴到 `to-codex/` | 任务必须包含验收标准 |
| Codex 开始工作 | 自动读取 `to-codex/` 最新文件 | 每次只处理一个任务 |
| Codex 完成 | 写入 `to-chatgpt/` + 提交 GitHub | 文件包含改动清单 + 测试结果 |
| 用户传递 | 打开 `to-chatgpt/` 最新文件 → 复制给 ChatGPT | 不需要自己写摘要 |
| 评审 | ChatGPT 给出通过/修改意见 | 通过后进入下一任务 |
| 清理 | 已处理的文件可删除 | 保持目录整洁 |

### 2.3 紧急情况

如果用户直接向 Codex 提出需求（未经过 ChatGPT）：
- Codex 应先评估是否属于当前阶段范围
- 如果是小修小补（Bug 修复、文案调整）：直接处理
- 如果是新功能或架构变更：先写入 `to-chatgpt/`，建议用户先给 ChatGPT 评审

---

## 3. `_bridge/` 目录规范

### 3.1 目录结构

```
_bridge/
├── README.md               ← 使用说明
├── to-codex/               ← ChatGPT → Codex 的任务和反馈
│   └── YYYY-MM-DD-title.md
└── to-chatgpt/             ← Codex → ChatGPT 的完成报告
    └── YYYY-MM-DD-title.md
```

### 3.2 命名规则

`YYYY-MM-DD-简短英文标题.md`

示例：
- `2026-05-31-ip-sandbox-ui-done.md`
- `2026-05-31-design-review-feedback.md`

### 3.3 文件内容规范

**to-codex/ 文件（ChatGPT → Codex）：**
- 必须有明确的输出物描述
- 包含验收标准
- 包含禁止事项

**to-chatgpt/ 文件（Codex → ChatGPT）：**
- 改动简述（改了哪些文件/加了什么功能）
- 测试结果（npm run build 是否通过）
- 如有异常需说明原因

### 3.4 生命周期

- 文件处理完成后即可删除
- 建议每周清理一次已完成的文件
- 不需要长期保留 -- 重要信息已记录在 `docs/` 和 GitHub commit 中

---

## 4. 工作单模板

### 4.1 ChatGPT → Codex 任务模板

```markdown
## 任务：{任务名称}

### 目标
{一句话描述要做什么}

### 实现范围
- {具体的文件/模块改动}
- {注意不要改什么}

### 验收标准
1. {标准1}
2. {标准2}
3. npm run build 零错误

### 禁止事项
- ❌ {不要做的事1}
- ❌ {不要做的事2}
```

### 4.2 Codex → ChatGPT 完成报告模板

```markdown
## 完成报告：{任务名称}

### 改动清单
- {文件A}: {改动说明}
- {文件B}: {改动说明}

### 测试结果
- npm run build: ✅ 通过
- {其他验证}: {结果}

### 注意事项
{如果有需要特别说明的事项}
```

---

## 5. GitHub 更新规范
### 5.1 提交规范

### 5.1 提交等级

GitHub 提交分三个等级，根据任务范围决定使用哪个等级。

**Level 1：工作提交（普通提交）**

适用场景：
- 修 Bug
- 改 UI
- 补测试
- 补文档
- 完成一个小功能（无需评审的）

操作：
```
git add -A
git commit -m "{type}: {说明}"
git push
```

规则：
- Codex 可以直接 push，无需等待评审
- commit message 必须清晰说明改动
- 不需要更新 PROJECT_MASTER.md
- 不需要打 tag

---

**Level 2：功能提交（需记录）**

适用场景：
- 新增一个完整的模块/文件
- 完成一个通过评审的任务
- 涉及数据结构变更

操作：
```
git add -A
git commit -m "feat: {模块名} — {说明}"
git push
```

规则：
- Codex 可以直接 push，前提是任务已通过 ChatGPT 评审
- 写入 `to-chatgpt/` 告知完成
- 不需要更新 PROJECT_MASTER.md（除非 ChatGPT 指定需要）
- 不需要打 tag

---

**Level 3：里程碑提交（需 tag）**

适用场景：
- 多个功能模块组合成一个里程碑
- ChatGPT 明确说"可以打 tag"
- 项目阶段升级（如 Beta → Preview → v1.0）

操作：
```
git add -A
git commit -m "feat: {里程碑名称}"
git tag -a v{版本} -m "{里程碑说明}"
git push origin master --tags
```

规则：
- 必须先通过 ChatGPT 评审
- 必须同时更新 PROJECT_MASTER.md
- 必须更新 AI_CONTEXT.md（如有重大变更）

---

**总结：**

| 等级 | 名称 | 是否需要评审 | 是否需要 tag | 是否需要更新 PROJECT_MASTER |
|------|------|-------------|-------------|---------------------------|
| L1 | 工作提交 | 否 | 否 | 否 |
| L2 | 功能提交 | 是（任务评审） | 否 | 否（除非指定） |
| L3 | 里程碑提交 | 是（里程碑评审） | 是 | 是 |

Codex 不需要请示就可以做 L1 和 L2 的 push。
L3 需要 ChatGPT 或用户明确说"可以打 tag"再执行。

每个里程碑提交后需：

1. **Commit message 格式：**
   ```
   {type}: {简短说明}
   ```
   类型：`feat` / `fix` / `docs` / `refactor` / `chore`

2. **Tag 规范（里程碑级别）：**
   - Alpha 阶段：`v0.1-alpha` 起
   - Beta 阶段：`v0.5-beta` 起
   - Preview 阶段：`v0.6-preview`
   - Release 阶段：`v1.0.0` 起

3. **Push 前检查：**
   - [x] `npm run build` 通过
   - [ ] `docs/` 是否需要同步更新
   - [ ] `PROJECT_MASTER.md` 是否需要更新
   - [ ] 是否涉及新的禁止事项需要记录

### 5.2 不应该提交的内容

- `node_modules/`
- `.next/`
- 临时测试文件（`_test_*.ts`、`_test_*.json`）
- `_bridge/` 内的通讯文件（非项目代码）
- 个人环境配置

---

## 6. PROJECT_MASTER.md 更新规范

### 6.1 更新时机

以下情况必须更新 PROJECT_MASTER.md：

1. 新增模块/Agent 完成并通过评审
2. 禁止事项发生变化
3. 路线图/优先级调整
4. 当前阶段状态变更

### 6.2 更新内容

每次更新只需追加/修改对应章节：

- **Current Stage** — 当前阶段名称（如 `Brand Brain Beta`）
- **Completed Modules** — 新增完成的模块名称 + 一句话说明
- **Blockers** — 如有阻塞项
- **Latest Milestone** — 最近完成的里程碑
- **Next Priority** — 下一优先级任务

### 6.3 不应该改动的内容

- 项目定位和核心原则（除非产品方向变更）
- 已完成模块的基础架构（除非重构）
- 已确定的禁止事项

---

## 7. 协作原则（摘要）

1. **ChatGPT 定方向，Codex 写代码，用户做决策。**
2. **所有重要信息落地为文件。** 聊天记录会丢，文件不会。
3. **每次提交前跑 build。** 零错误是底线。
4. **先通过评审，再进入下一阶段。** 不要并行推进多个未评审的任务。
5. **禁止事项要记录。** 防止反复踩同一个坑。
6. **`_bridge/` 是通讯工具，`docs/` 是知识库，`src/` 是产品代码。** 三者不混用。

---

*本协议由 ChatGPT + Codex 共同起草，用户确认后生效。*
*更新需经三方同意。*
---

## 8. 双端同步切换对话机制

> 新增于：2026-05-31
> 背景：ChatGPT 和 Codex 的对话长度随着项目增长会不断膨胀，需要在上下文过载前同步切换

### 8.1 触发时机

当 ChatGPT 发出以下信号时，启动切换流程：
- "准备换新对话"
- "上下文要膨胀了"
- "这个版本完成了，开新对话吧"
- 任何明确表示需要切换对话的提示

### 8.2 Codex 收口步骤

收到切换信号后，Codex **立即停止**扩展新功能。然后执行：

**步骤 1：确认当前工程状态**
- 当前分支
- 最新 commit hash
- 已完成内容清单
- 未完成内容清单

**步骤 2：确认测试状态**
- 测试结果（通过/失败数）
- 是否有失败测试
- npm run build 是否通过

**步骤 3：确认环境和成本**
- 是否有环境变量要求
- 是否有真实 API 调用
- 是否有计费或成本消耗

**步骤 4：输出 Codex Handover**

```md
# Codex Handover

## 当前任务
## 当前状态
## 最新提交
## 修改文件
## 新增测试
## 测试结果
## 已知问题
## 环境变量
## 下一步建议
## 不要做的事项
```

### 8.3 双 Handover 规则

每次切换对话，必须有两份 Handover：

| Handover | 责任方 | 内容 |
|----------|--------|------|
| ChatGPT Handover | ChatGPT | 方向、规划、最后指令、下一步 |
| Codex Handover | Codex | 代码状态、commit、测试、未完成项 |

### 8.4 切换后流程

```
ChatGPT: "准备换新对话"
  ↓
Codex: 停止新功能 → 收口 → 输出 Handover
  ↓
用户开新对话 → 粘贴两份 Handover
  ↓
ChatGPT: 阅读 → 重新确认下一步指令
  ↓
Codex: 等待新指令 → 继续工作
```

*此机制从 v0.7-alpha 开始执行。*
