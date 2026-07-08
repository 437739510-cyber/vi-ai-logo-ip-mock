/**
 * Commercial-Safe Font Library
 * 10+ free-for-commercial-use fonts with license info.
 */
export interface FontEntry {
  name: string;
  nameZh: string;
  weights: string[];
  license: string;
  commercialUse: boolean;
  bestFor: string;
}

export const SAFE_FONTS: FontEntry[] = [
  { name: "Source Han Sans", nameZh: "思源黑体", weights: ["ExtraLight","Light","Regular","Medium","Bold","Heavy"], license: "SIL Open Font License 1.1", commercialUse: true, bestFor: "中文标题/正文（全场景）" },
  { name: "Source Han Serif", nameZh: "思源宋体", weights: ["ExtraLight","Light","Regular","Medium","Bold","Heavy"], license: "SIL Open Font License 1.1", commercialUse: true, bestFor: "中文品牌标题/高端正文" },
  { name: "Alibaba PuHuiTi", nameZh: "阿里巴巴普惠体", weights: ["Light","Regular","Medium","Bold","Heavy"], license: "阿里巴巴免费商用授权", commercialUse: true, bestFor: "中文电商/数字化场景" },
  { name: "Montserrat", nameZh: "蒙特塞拉特", weights: ["Thin","Light","Regular","Medium","Bold","ExtraBold"], license: "SIL Open Font License", commercialUse: true, bestFor: "英文标题/正文" },
  { name: "Inter", nameZh: "Inter", weights: ["Thin","Light","Regular","Medium","Bold","ExtraBold"], license: "SIL Open Font License", commercialUse: true, bestFor: "英文UI/数字/小字号正文" },
  { name: "Open Sans", nameZh: "Open Sans", weights: ["Light","Regular","Medium","Bold","ExtraBold"], license: "SIL Open Font License", commercialUse: true, bestFor: "英文正文/多语言场景" },
  { name: "Lato", nameZh: "Lato", weights: ["Thin","Light","Regular","Bold","Black"], license: "SIL Open Font License", commercialUse: true, bestFor: "英文品牌正文" },
  { name: "Playfair Display", nameZh: "Playfair Display", weights: ["Regular","Medium","Bold","Black"], license: "SIL Open Font License", commercialUse: true, bestFor: "英文高端标题/时尚品牌" },
  { name: "Noto Sans SC", nameZh: "Noto Sans SC", weights: ["Thin","Light","Regular","Medium","Bold","Black"], license: "SIL Open Font License", commercialUse: true, bestFor: "中文多语言/国际化场景" },
  { name: "ZCOOL KuaiLe", nameZh: "站酷快乐体", weights: ["Regular"], license: "站酷免费商用授权", commercialUse: true, bestFor: "中文装饰标题/活泼场景" },
  { name: "ZCOOL QingKe HuangYou", nameZh: "站酷庆科黄油体", weights: ["Regular"], license: "站酷免费商用授权", commercialUse: true, bestFor: "中文创意标题/手写风格" },
  { name: "LXGW WenKai", nameZh: "霞鹜文楷", weights: ["Light","Regular","Bold"], license: "SIL Open Font License 1.1", commercialUse: true, bestFor: "中文复古/文艺正文" },
];