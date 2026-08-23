export interface CaseInfo {
  slug: string;
  name: string;
  industry: string;
  city: string;
  tagline: string;
  story: string;
  cover: string;
  images: string[];
  authNote: string;
}

/** 客户已授权公开的统一声明文案 */
export const CASE_AUTH_NOTE = "本案例经客户本人授权公开，禁止转载";

export const CASES: CaseInfo[] = [
  {
    slug: "zhaocai",
    name: "招财进堡",
    industry: "餐饮",
    city: "南昌",
    tagline: "美式复古风 · 红金配色 · 十年现点现做的青春味道",
    story:
      "南昌开了十年的汉堡炸鸡店，服务附近高中和大学学生。始终坚持现点现做，用新鲜食材和真诚服务赢得一届又一届学生的喜爱。招财进堡不只是一家快餐店，更是无数年轻人青春记忆中的味道。",
    cover: "/cases/zhaocai/stall.png",
    images: [
      "/cases/zhaocai/stall.png",
      "/cases/zhaocai/menu.png",
      "/cases/zhaocai/logo.png",
      "/cases/zhaocai/scene-marketing.png",
    ],
    authNote: CASE_AUTH_NOTE,
  },
  {
    slug: "chaowei",
    name: "潮味海鲜大排档",
    industry: "餐饮",
    city: "珠海",
    tagline: "潮汕夜市的鲜味江湖，老字号烟火气韵",
    story:
      "潮汕夜市的鲜味江湖，老字号烟火气韵——让每一口都尝到潮汕海风的鲜甜。新鲜、地道、烟火气、老字号传承。",
    cover: "/cases/chaowei/scene-1.png",
    images: [
      "/cases/chaowei/scene-1.png",
      "/cases/chaowei/scene-2.png",
      "/cases/chaowei/scene-3.png",
    ],
    authNote: CASE_AUTH_NOTE,
  },
  {
    slug: "huayushiguang",
    name: "花语时光美容院",
    industry: "丽人",
    city: "",
    tagline: "温柔、专业、可信赖的品牌视觉焕新",
    story:
      "为美容行业客户打造的品牌视觉焕新。品牌故事待 Chris 补充，先用行业化通用描述：以温柔、专业、可信赖的视觉语言，帮助门店建立品牌辨识度。",
    cover: "/cases/huayushiguang/scene-1.png",
    images: [
      "/cases/huayushiguang/scene-1.png",
      "/cases/huayushiguang/scene-2.png",
    ],
    authNote: CASE_AUTH_NOTE,
  },
  {
    slug: "huayan",
    name: "花颜美容院",
    industry: "丽人",
    city: "",
    tagline: "新中式优雅 · 花瓣与女性侧脸圆形徽章",
    story:
      "花颜标识以花瓣与女性侧脸轮廓为核心元素，采用圆形徽章构图。花瓣层叠舒展，寓意肌肤如花般自然绽放；侧脸线条柔美流畅，体现东方女性优雅气质。新中式优雅风格，花颜粉主色搭配浅樱粉与暗金点缀。",
    cover: "/cases/huayan/storefront.png",
    images: [
      "/cases/huayan/storefront.png",
      "/cases/huayan/scene-1.png",
      "/cases/huayan/logo.png",
      "/cases/huayan/vipcard.png",
      "/cases/huayan/poster.png",
    ],
    authNote: CASE_AUTH_NOTE,
  },
  {
    slug: "bailiaocui",
    name: "百疗萃",
    industry: "美容养生",
    city: "",
    tagline: "从 Logo 到 IP 公仔的完整品牌视觉体系",
    story:
      "为美容养生品牌打造完整的 VI 手册体系，覆盖 Logo、色彩、字体、物料与 IP 公仔，帮助品牌建立统一、可识别的视觉形象。",
    cover: "/cases/bailiaocui/01-logo-primary.png",
    images: [
      "/cases/bailiaocui/01-logo-primary.png",
      "/cases/bailiaocui/02-color-palette.png",
      "/cases/bailiaocui/09-mascot.png",
      "/cases/bailiaocui/10-mascot-scene-membership.png",
      "/cases/bailiaocui/11-mascot-scene-packaging.png",
      "/cases/bailiaocui/16-mascot-side.png",
      "/cases/bailiaocui/17-mascot-back.png",
      "/cases/bailiaocui/18-mascot-3view-sheet.png",
    ],
    authNote: CASE_AUTH_NOTE,
  },
];

export function getCaseBySlug(slug: string): CaseInfo | undefined {
  return CASES.find((c) => c.slug === slug);
}

export function getCaseIndustries(): string[] {
  return Array.from(new Set(CASES.map((c) => c.industry)));
}