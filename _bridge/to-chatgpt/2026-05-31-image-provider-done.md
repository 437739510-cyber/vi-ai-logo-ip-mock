**IP Image Provider Layer 实现完成，npm run build 零错误，10/10 单元测试通过。**

**新增文件：**

```
src/lib/ip-image-provider/
├── types.ts               — ImageProvider 接口、GenerateImageParams、GenerateImageResult
│                           （含 providerName + qualityScore）
├── provider.ts            — ProviderRegistry + getDefaultRegistry() 全局单例
├── mock-provider.ts       — 始终可用的占位实现（固定 cost 10、空 URL、模拟延迟）
├── wanxiang-provider.ts   — 空占位（未来通义万相）
├── flux-provider.ts       — 空占位（未来 Flux）
├── midjourney-provider.ts — 空占位（未来 Midjourney）
└── index.ts               — 统一导出
```

**测试结果（10/10）：**
- Registry 正确注册和查找
- getActive() 返回 MockProvider（当无真实提供商时）
- MockProvider.generateImage() 返回正确结构（空 URL、固定 cost、providerName、assetId、qualityScore）
- generateVariant() 返回不同 assetId
- 未注册的 provider 返回 undefined

**未改动的：**
- Sandbox 调用逻辑（仍使用原 image-generator.ts）
- SVG / 封面 / 生成层

**GitHub 待 push（网络波动）：**
- commit `11ca416` 在本地，网络恢复后 `git push` 即可。
