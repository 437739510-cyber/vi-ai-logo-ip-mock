# IP Image Provider Layer — 架构设计

> 版本: v1 (设计稿)
> 状态: 待评审
> 当前阶段: 仅设计，不实现

---

## 1. 设计目标

让 Sandbox 的生成步骤与具体的图片提供商解耦。

Sandbox 只调用：
```ts
const result = await provider.generateImage(params);
```

不关心背后是 Mock、通义万相、Flux 还是 Midjourney。

---

## 2. 目录结构

```
src/lib/ip-image-provider/
├── types.ts              # 统一接口定义
├── provider.ts           # ProviderRegistry — 注册/选择/调用
├── mock-provider.ts      # 当前占位实现（已有）
├── wanxiang-provider.ts  # 未来：通义万相（预留，不实现）
├── flux-provider.ts      # 未来：Flux（预留，不实现）
└── index.ts              # 统一导出
```

---

## 3. 核心接口

### ImageProvider — 供应商接口

```ts
interface ImageProvider {
  /** 供应商名称标识 */
  name: string;

  /** 是否可用（如 API Key 是否配置） */
  isAvailable(): Promise<boolean>;

  /**
   * 生成单张图片
   * Sandbox 的 generateStepImage() 内部调用此方法
   */
  generateImage(params: GenerateImageParams): Promise<GenerateImageResult>;

  /**
   * 生成变体（重新生成时使用不同的 seed）
   */
  generateVariant(params: GenerateVariantParams): Promise<GenerateImageResult>;
}
```

### GenerateImageParams — 生成参数

```ts
interface GenerateImageParams {
  /** 品牌上下文 */
  brandContext: {
    brandName: string;
    industry: string;
    brandPositioning: string;
    brandPersona: string[];
    visualDirection: string;
  };

  /** IP 设定 */
  ipProfile: {
    mascotName?: string;
    type: string;
    personality: string[];
    visualTraits: string[];
    colorDirection: string[];
  };

  /** 当前步骤信息 */
  step: {
    stepId: string;
    label: string;
    description: string;
  };

  /** 生成的提示词（来自 MascotPromptSet） */
  prompt: string;
  negativePrompt: string;

  /** 前一步资产 ID（用于保持一致性） */
  seedAssetId?: string;

  /** 输出配置 */
  output: {
    width: number;
    height: number;
    format: "png" | "webp";
  };
}
```

### GenerateImageResult — 生成结果

```ts
interface GenerateImageResult {
  /** 图片 URL */
  imageUrl: string;
  /** 实际消耗（credits） */
  actualCost: number;
  /** 生成耗时（毫秒） */
  durationMs: number;
  /** 资产 ID（供后续步骤引用，保持一致性） */
  assetId: string;
  /** 供应商返回的元信息 */
  providerMeta?: Record<string, unknown>;
}
```

---

## 4. ProviderRegistry — 供应商注册中心

```ts
class ProviderRegistry {
  private providers: Map<string, ImageProvider> = new Map();

  /** 注册供应商 */
  register(provider: ImageProvider): void;

  /** 获取指定供应商 */
  get(name: string): ImageProvider | undefined;

  /** 获取当前最合适的供应商 */
  getActive(): Promise<ImageProvider>;

  /** 列出所有可用供应商 */
  listAvailable(): Promise<ImageProvider[]>;
}
```

### 选择策略

```ts
async function selectProvider(): Promise<ImageProvider> {
  // 1. 按优先级检查注册的供应商
  // 2. 返回第一个 isAvailable() === true 的
  // 3. 如果没有可用供应商，返回 MockProvider（保底）
  const providers = [wanxiang, flux, midjourney, mock];
  for (const p of providers) {
    if (await p.isAvailable()) return p;
  }
  return mock; // 保底
}
```

---

## 5. 各供应商实现

### MockProvider（当前实现，已有）

- `isAvailable()` → `true`
- `generateImage()` → 延迟 1.5-3 秒，返回占位 URL + 固定费用 10 credits
- 永不失败

### WanxiangProvider（未来实现）

**触发条件：**
- 环境变量 `WANXIANG_API_KEY` 已设置
- 环境变量 `WANXIANG_API_URL` 已设置（可选，有默认值）

**实现要点：**
- `generateImage()` 调用通义万相文生图 API
- 将 `prompt` 和 `negativePrompt` 映射到通义万相的请求格式
- 返回图片 URL、实际费用、耗时
- 错误重试逻辑（3 次）
- 超时控制（30 秒）

### FluxProvider / MidjourneyProvider（未来预留）

- 结构相同，API 调用方式不同
- 通过 ProviderRegistry 统一管理

---

## 6. 与 Sandbox 的集成

```
IPSandboxSession
    ↓
step.status === "generating"
    ↓
// 当前（占位实现）：
const result = await mockProvider.generateImage(params)

// 未来（适配后）：
const provider = await registry.getActive()
const result = await provider.generateImage(params)
    ↓
step.generatedAssetUrl = result.imageUrl
step.actualCost = result.actualCost
step.seedAssetId = result.assetId
step.status = "reviewing"
```

---

## 7. 配置管理

### 环境变量

```
# Mock 为默认，无需配置

# Wanxiang（未来）
WANXIANG_API_KEY=sk-xxx
WANXIANG_API_URL=https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis

# Flux（未来）
FLUX_API_KEY=fk-xxx

# Midjourney（未来）
MJ_API_KEY=mj-xxx
```

### 运行时配置

```ts
interface ImageProviderConfig {
  /** 默认供应商（空 = 自动选择） */
  defaultProvider?: string;
  /** 超时时间（毫秒） */
  timeoutMs: number;
  /** 重试次数 */
  maxRetries: number;
  /** 输出图片宽度 */
  outputWidth: number;
  /** 输出图片高度 */
  outputHeight: number;
}
```

---

## 8. 当前阶段不做的事

- ❌ 实现 WanxiangProvider（仅预留类型和空文件）
- ❌ 实现 FluxProvider
- ❌ 实现 MidjourneyProvider
- ❌ 修改 Sandbox 的调用代码（保持使用 MockProvider）
- ❌ 改 SVG
- ❌ 改封面
- ❌ 改生成层

只做：
- ✅ `types.ts` — 接口定义
- ✅ `provider.ts` — ProviderRegistry
- ✅ `mock-provider.ts` — 从 image-generator.ts 迁移过来
- ✅ `index.ts` — 导出

---

## 9. 验收标准

| 场景 | 预期 | 验证方式 |
|------|------|----------|
| 只有一个 MockProvider 注册 | isAvailable() 返回 true | 单元测试 |
| ProviderRegistry.getActive() | 返回 MockProvider | 单元测试 |
| MockProvider.generateImage() | 返回固定 cost + 空 URL | 单元测试 |
| 现有 Sandbox 不受影响 | 53/53 测试仍然通过 | 跑测试 |
| npm run build | 零错误 | build |

---

*本设计完成。待 ChatGPT 评审通过后进入实现阶段。*
