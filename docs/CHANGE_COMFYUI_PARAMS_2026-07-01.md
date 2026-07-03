# ComfyUI 参数变更记录

## 日期: 2026-07-01

## 修改文件
src/lib/ip/ip-image-provider/comfyui-provider.ts

## 备份文件
src/lib/ip/ip-image-provider/comfyui-provider.ts.20bak

## 变更内容

### buildSDXLWorkflow()
- 新增参数: genParams?: { steps, cfg, sampler_name, scheduler }
- 旧值: steps=20, cfg=3.5, sampler=euler, scheduler=normal
- 新值: 由调用方传入，默认fallback保持旧值

### comfyGenerateImage()
- 新增参数: genParams (透传到 buildSDXLWorkflow)

### comfyGenerateLogo()
- 新增传参: steps=28, cfg=5.5, sampler_name=dpmpp_2m, scheduler=karras

### comfyGenerateScene()
- 新增传参: steps=25, cfg=6.0, sampler_name=dpmpp_2m_sde, scheduler=karras

## 参数来源
豆包AI优化方案 (2026-07-01), 记录于 industry-templates.json
Logo: Canny(0.7) + Tile(0.5) ControlNet 未变
Scene: IP-Adapter(0.75) + Depth(0.5) ControlNet 未变

## 验证
- npx tsc --noEmit: 通过
- 向后兼容: 未传 genParams 时使用旧值(20/3.5/euler/normal)
