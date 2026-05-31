# Wanxiang Provider Design V1

> 通义万相图片供应商接入设计
> 状态：Design Only — 未实现
> 日期：2026-05-31

---

## 1. 背景

Brand Brain 的 IP Sandbox 已经通过 ProviderRegistry 与 MockProvider 完成闭环。当前用户逐张生成 IP 资产时走的是 MockProvider（返回空 URL，不产生真实图片）。

Wanxiang Provider 是第一个计划接入的**真实图片供应商**。

---

## 2. 环境依赖

```env
# .env.local
WANXIANG_API_KEY=sk-xxx                    # 阿里云 DashScope API Key
NEXT_PUBLIC_IMAGE_BASE_URL=                # 图片 CDN 域名（未来）
```

- 使用 DashScope 平台：`https://dashscope.aliyuncs.com`
- API Key 从阿里云控制台获取：`RAM 访问控制 → API Key 管理`
- 测试环境可以用每月免费额度
- Key 不存在时 `isAvailable()` 返回 `false`，自动回退到 MockProvider

---

## 3. API 接入点

### 主 API

```
POST https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis
```

### 认证

```http
Authorization: Bearer sk-xxx
Content-Type: application/json
```

### 请求体（以 wanx2.1-t2i-turbo 为例）

```json
{
  "model": "wanx2.1-t2i-turbo",
  "input": {
    "prompt": "品牌吉祥物设计...",
    "negative_prompt": "文字, 水印, 复杂背景..."
  },
  "parameters": {
    "size": "1024*1024",
    "n": 1,
    "seed": 42,
    "style": "<auto>"
  }
}
```

### 同步响应

```json
{
  "output": {
    "task_id": "xxx",
    "task_status": "SUCCEEDED",
    "results": [
      {
        "url": "https://dashscope-result.oss-cn-hangzhou.aliyuncs.com/xxx.png",
        "height": 1024,
        "width": 1024
      }
    ]
  },
  "usage": {
    "image_count": 1
  }
}
```

### 异步任务

- 部分模型为异步任务：`task_status: "PENDING"` → 需轮询
- 轮询端点：`GET https://dashscope.aliyuncs.com/api/v1/tasks/{task_id}`
- 轮询间隔：建议 2s（指数退避：2s → 4s → 8s，上限 30s）

---

## 4. 模型选择策略

| 模型 | 速度 | 质量 | 成本 | 推荐场景 |
|------|------|------|------|---------|
| `wanx2.1-t2i-turbo` | 快（~5s） | 高 | 低 | IP 主形象、三视图、表情 |
| `wanx2.1-t2i-plus` | 慢（~15s） | 极高 | 高 | 包装设计、场景延展 |
| `wanxim2.1-t2i-turbo` | 快 | 高 | 中 | IP 形象一致性优化 |

**V1 策略：**

- 快速迭代步骤（主形象、表情）：用 `turbo`
- 精细步骤（包装、门店）：用 `plus` 或手动选择
- 由 `MascotPromptStrategy` 的 `stepId` 决定模型选择

```ts
function selectModel(stepId: string): string {
  const turboSteps = ["mascot-main", "mascot-three-view", "mascot-expression", "mascot-action"];
  if (turboSteps.includes(stepId)) return "wanx2.1-t2i-turbo";
  return "wanx2.1-t2i-plus";
}
```

---

## 5. 成本估算

通义万相计费（基于公开信息，以 API 实际返回为准）：

| 模型 | 分辨率 | 单价（元/张） | 对应 Credits |
|------|--------|--------------|-------------|
| wanx2.1-t2i-turbo | 1024x1024 | ~0.08 | 80 |
| wanx2.1-t2i-plus | 1024x1024 | ~0.20 | 200 |
| wanx2.1-t2i-turbo | 1280x720 | ~0.06 | 60 |
| wanx2.1-t2i-plus | 1280x720 | ~0.15 | 150 |

**单位转换：** `1 元 = 1000 Credits`

**IP 资产生成成本估算示例（连锁茶饮，create_new）：**

| 步骤 | 模型 | 数量 | 单价（Credits） | 小计 |
|------|------|------|----------------|------|
| 主形象 | turbo | 1 | 80 | 80 |
| 三视图 | turbo | 3 | 80 | 240 |
| 标准色 | turbo | 1 | 80 | 80 |
| 表情系统 | turbo | 5 | 80 | 400 |
| 动作系统 | turbo | 3 | 80 | 240 |
| 场景延展 | plus | 3 | 200 | 600 |
| 包装应用 | plus | 2 | 200 | 400 |
| 社媒应用 | turbo | 4 | 80 | 320 |
| **合计** | | **22** | | **2,360** |

**成本估算接口：**

```ts
interface WanxiangCostEstimate {
  model: string;
  resolution: string;
  unitCredits: number;
  quantity: number;
  totalCredits: number;
}

function estimateWanxiangCost(plan: IPCreationPlan): WanxiangCostEstimate[] {
  // ... 根据 plan.assetSequence 和 selectModel 计算
}
```

---

## 6. 重试与错误处理

### 可重试错误（自动重试，最多 3 次）

| HTTP 状态码 | 错误类型 | 处理方式 |
|-----------|---------|---------|
| 429 | Rate limit | 等待 5s 后重试，指数退避 |
| 500 | Server error | 等待 3s 后重试 |
| 503 | Service unavailable | 等待 5s 后重试 |

### 不可重试错误（立即报错，提示用户）

| HTTP 状态码 | 错误类型 | 处理方式 |
|-----------|---------|---------|
| 401 | Invalid API key | 提示用户检查 API Key |
| 403 | Insufficient balance | 提示用户充值 |
| 400 | Invalid prompt | 返回错误信息，建议修改 prompt |
| 413 | Content filtered | 提示用户修改 prompt 避开敏感词 |

### 超时设置

```ts
const WANXIANG_TIMEOUT_MS = 120_000; // 2 分钟（含异步轮询）
```

### 重试逻辑

```ts
async function generateWithRetry(
  params: GenerateImageParams,
  maxRetries = 3
): Promise<GenerateImageResult> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await callWanxiang(params);
    } catch (error) {
      if (!isRetryable(error) || attempt === maxRetries) throw error;
      const delay = Math.min(1000 * Math.pow(2, attempt), 30_000);
      await sleep(delay);
    }
  }
  throw new Error("Max retries exceeded");
}
```

---

## 7. 速率限制

- DashScope 默认限制：
  - T2I Turbo：约 10 QPS
  - T2I Plus：约 5 QPS
- Sandbox 是逐张生成，不会触发 QPS 限制
- 但如果未来做批量生成（如表情包一次 5 张），需要引入队列

**V1 不做队列。** Sandbox 逐张调用天然不触发限流。

---

## 8. 图片存储与 CDN

通义万相返回的图片 URL 为阿里云 OSS 临时链接：

```
https://dashscope-result.oss-cn-hangzhou.aliyuncs.com/{task_id}/{index}.png?x-oss-process=...
```

- 临时链接有效期：约 1 小时
- **V1 策略：** 直接使用临时链接（适合预览）
- **未来策略：** 下载到自有 S3/CDN，确保长期可用

V1 时 `GenerateImageResult.imageUrl` 直接返回通义的 OSS 临时链接。

---

## 9. 安全性

### Prompt 过滤

- 通义万相会自动过滤政治敏感、色情、暴力等内容
- 触发过滤时返回 413 错误
- System Prompt（来自 `MascotPromptStrategy` 的 `negativePrompt`）可以辅助过滤

### API Key 安全

- Key 仅存于 `.env.local`
- 不暴露给前端
- 所有 API 调用在 Server Route 或 Server Action 中执行
- 未来可支持多租户独立 Key

---

## 10. 实现计划

### V1（当前设计阶段）

| 文件 | 内容 |
|------|------|
| `src/lib/ip-image-provider/wanxiang-provider.ts` | WandxiangProvider 类（impl → 空方法） |
| `src/lib/wanxiang-cost.ts` | 成本估算函数 |
| `.env.local` | 新增 `WANXIANG_API_KEY` |

### V1 开发步骤

```
步骤 1: 实现 WanxiangProvider.generateImage()
         - HTTP POST 到 DashScope
         - 处理同步/异步响应
         - 返回 GenerateImageResult
         3-5 天

步骤 2: 集成成本估算
         - wanxiang-cost.ts
         - Billing 调用估计
         1 天

步骤 3: 注册到 ProviderRegistry
         - provider.ts 中注册
         - Wanxiang 可用时不回退 Mock
         0.5 天

步骤 4: 端到端测试
         - 真实调用 1 次
         - 检查图片返回
         - 检查扣费
         1 天
```

### 暂不实现

- 图片下载到本地/CDN（V2）
- 批量队列（V2）
- 多 Key 轮换（V3）
- 图片质量自动评分（V2）
- 退款/重试补偿逻辑（V2）

---

## 11. 代码结构

```ts
// src/lib/ip-image-provider/wanxiang-provider.ts

export class WanxiangProvider implements ImageProvider {
  name = "wanxiang";

  private apiKey: string;
  private baseUrl = "https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis";
  private taskUrl = "https://dashscope.aliyuncs.com/api/v1/tasks";

  constructor() {
    this.apiKey = process.env.WANXIANG_API_KEY || "";
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }

  async generateImage(params: GenerateImageParams): Promise<GenerateImageResult> {
    // 1. Select model based on stepId
    // 2. Build request payload
    // 3. POST to DashScope
    // 4. If async, poll until SUCCEEDED/FAILED
    // 5. Return GenerateImageResult
    throw new Error("Not implemented");
  }

  async generateVariant(params: GenerateImageParams): Promise<GenerateImageResult> {
    // Same as generateImage but with different seed
    return this.generateImage(params);
  }

  // ========== Private ==========

  private buildPayload(params: GenerateImageParams): object {
    // ...
  }

  private async pollTask(taskId: string): Promise<object> {
    // Exponential backoff: 2s → 4s → 8s → max 30s
  }

  private handleError(error: any): never {
    // Map DashScope errors to typed errors
  }
}
```

---

## 12. 验证清单

在接通前需要确认：

- [ ] 阿里云 DashScope 已开通通义万相服务
- [ ] API Key 有足够余额（建议先充 10 元测试）
- [ ] `wanx2.1-t2i-turbo` 模型可正常调用
- [ ] `wanx2.1-t2i-plus` 模型可正常调用
- [ ] 异步任务轮询机制正常
- [ ] 成本估算与实际扣费一致
- [ ] Sandbox approve 后扣费正常
- [ ] 余额不足时提示正常
- [ ] Mock → Wanxiang 切换无缝

---

## 13. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| API Key 泄露 | 资产损失 | 仅存 .env.local，Server 端调用 |
| 临时链接过期 | 图片无法查看 | V1 接受；V2 下载到自有存储 |
| 模型接口变更 | 生成失败 | 定期验证 API，版本锁定 |
| 成本超预期 | 亏损 | Billing 系统双检，超出 2x 预估时告警 |
| IP 风格不一致 | 多个 IP 资产风格偏离 | 强制 seedAssetId 传递，保持 seed 一致 |

---

## 14. 附录：DashScope 参考

- API 文档：`https://help.aliyun.com/zh/dashscope/`
- 通义万相模型说明：`wanx2.1-t2i-turbo` / `wanx2.1-t2i-plus`
- 计费说明：按张计费，不同分辨率和模型价格不同
- 免费额度：新用户通常有每月免费额度（具体以 DashScope 控制台为准）
- SDK 可选：`@alicloud/dashscope`（但 V1 推荐直接用 fetch，减少依赖）
