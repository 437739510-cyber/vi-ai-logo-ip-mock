import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12 md:py-16">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-neutral-900">服务协议</h1>
        <p className="mt-2 text-sm text-neutral-400">更新日期：2026年6月1日</p>
      </div>

      <div className="prose prose-neutral prose-sm max-w-none space-y-6 text-neutral-700">
        <section>
          <h2 className="text-lg font-semibold text-neutral-900">1. 服务内容</h2>
          <p>Brand Brain 品牌脑（以下简称"本平台"）提供AI驱动的品牌视觉识别（VI）设计服务，包括但不限于Logo生成、VI手册制作、品牌管家内容代发等服务。</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-neutral-900">2. 服务套餐</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>基础版（¥99）</strong>：包含Logo方案生成，3个工作日内交付</li>
            <li><strong>标准版（¥499）</strong>：包含Logo方案 + VI手册，3个工作日内交付</li>
            <li><strong>品牌管家（¥299/月）</strong>：包含每月品牌化内容生成与代发服务</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-neutral-900">3. 付款与退款</h2>
          <p>付款后即开始服务流程。如对生成结果不满意，可在交付后7日内申请一次免费修改。因AI生成结果的特殊性，已交付的数字内容不支持全额退款。</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-neutral-900">4. 知识产权</h2>
          <p>您通过本平台生成的Logo和VI方案，在完成付款后其使用权归您所有。本平台保留在作品展示中使用匿名化案例的权利。</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-neutral-900">5. 免责声明</h2>
          <p>AI生成的内容仅供参考，本平台不对生成结果的商业适用性做明示或暗示的保证。用户应自行判断生成内容是否符合其品牌定位和法律法规要求。</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-neutral-900">6. 联系我们</h2>
          <p>如有服务相关问题，请联系：400-666-1806</p>
        </section>
      </div>

      <div className="mt-10 pt-6 border-t border-neutral-100">
        <Link href="/" className="text-sm text-primary hover:underline">← 返回首页</Link>
      </div>
    </div>
  );
}
