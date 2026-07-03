import requests
import json
import time

DEEPSEEK_API_KEY = "YOUR_KEY_HERE"
DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1"
MODEL_NAME = "deepseek-chat"
REQUEST_TIMEOUT = 60
MAX_RETRY = 2

SYSTEM_PROMPT = """
你是资深VI视觉提示词工程师，精通SDXL生图模型的提示词逻辑。
你的任务是：根据客户提交的品牌信息，生成「可直接用于生图」的高质量Logo提示词 + 场景图提示词。
输出必须是严格标准的JSON格式，不允许任何多余解释文字、 markdown 代码块、开场白或结束语，只输出纯JSON。

【Logo生成强制规则】
固定生成 4 款差异化Logo，每款对应不同应用场景。

1. 通用强制约束（所有Logo正向词必须包含）：
   - 2D平面矢量、扁平化、干净轮廓、无渐变、无3D效果、无阴影、高对比度、白色背景、边缘锐利清晰
   - 中文文字笔画完整无畸变、无乱码

2. 4款Logo固定结构：
   款1：横版字标组合（门头/招牌专用，左图右字结构）
   款2：圆形徽章款（包装/工服/会员卡专用）
   款3：极简图形标（辅助标识/小尺寸物料专用，纯图形无文字）
   款4：特色字标（海报/营销物料专用，字体做创意化处理）

3. 行业风格匹配：
   * 海鲜/大排档：粗犷渔港风、手绘笔触、木刻质感、市井烟火气
   * 茶饮/轻食：清新简约、年轻治愈、线条流畅
   * 中式快餐：家常温暖、朴实接地气
   * 美业/养生：雅致柔和、东方禅意、高级质感
   * 美发沙龙：时尚潮流、简约酷感
   * 零售/生鲜：亲民朴实、健康鲜活
   * 文创礼品：文艺精致、复古质感
   * 宠物：可爱治愈、圆润柔和
   * 建材/定制：专业硬朗、简约商务

4. 通用负向词（所有Logo必加）：
   blurry, distorted text, garbled characters, 3d render, gradient, shadow, glow effect, delicate ornament, watermark

【场景图生成强制规则】
固定生成 8 张场景图，严格对应VI手册四大模块。

1. 8张场景固定分类：
   - 应用系统 3张：门头招牌实景、核心经营物料、员工工服
   - 包装系统 2张：主营产品包装、手提/打包袋
   - 营销系统 2张：店内宣传物料、会员卡/消费凭证
   - 导视系统 1张：店内标识/指示牌

2. 通用负向词（所有场景图必加）：
   blurry, low quality, distorted logo, garbled text, clean studio, white background, 3d render, cartoon, watermark

【输出JSON固定结构】
{
  "brand_tags": ["标签1", "标签2"],
  "logo_prompts": [
    {"id": "logo_1", "name": "横版字标组合", "positive": "...", "negative": "...", "color_main": "#...", "color_accent": "#..."}
  ],
  "scene_prompts": [
    {"id": "scene_1", "vi_module": "...", "name": "...", "positive": "...", "negative": "...", "controlnet": [...], "priority": "required"}
  ]
}
"""

def generate_vi_prompts(customer_info):
    headers = {"Authorization": f"Bearer {DEEPSEEK_API_KEY}", "Content-Type": "application/json"}
    user_content = f"品牌名：{customer_info.get('brand_name','')}\n所在城市：{customer_info.get('city','')}\n所属行业：{customer_info.get('industry','')}\n经营形态：{customer_info.get('business_type','')}\n主营产品：{customer_info.get('main_products','')}\n品牌个性：{customer_info.get('brand_personality','')}\n核心价值：{customer_info.get('core_value','')}\nLogo风格要求：{customer_info.get('logo_style','')}\n避免元素：{customer_info.get('avoid_elements','')}\n设计理念：{customer_info.get('design_concept','')}"
    payload = {"model": MODEL_NAME, "messages": [{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": user_content}], "temperature": 0.7, "max_tokens": 4096, "response_format": {"type": "json_object"}}
    
    for attempt in range(MAX_RETRY + 1):
        try:
            response = requests.post(f"{DEEPSEEK_BASE_URL}/chat/completions", headers=headers, json=payload, timeout=REQUEST_TIMEOUT)
            response.raise_for_status()
            return json.loads(response.json()["choices"][0]["message"]["content"].strip())
        except Exception as e:
            print(f"Attempt {attempt+1} failed: {e}")
            if attempt < MAX_RETRY:
                time.sleep(2)
            else:
                raise

if __name__ == "__main__":
    customer_data = {
        "brand_name": "潮味海鲜大排档", "city": "珠海市", "industry": "美食-海鲜",
        "business_type": "大排档/夜市", "main_products": "椒盐皮皮虾、蒜蓉生蚝、炒蟹、砂锅粥",
        "brand_personality": "豪爽有烟火气", "core_value": "新鲜、地道、烟火气、实惠",
        "logo_style": "文字+图标组合", "avoid_elements": "太精致",
        "design_concept": "以海浪和蟹钳为灵感，融合渔港粗犷风格，传递新鲜地道"
    }
    result = generate_vi_prompts(customer_data)
    print(json.dumps(result, ensure_ascii=False, indent=2))