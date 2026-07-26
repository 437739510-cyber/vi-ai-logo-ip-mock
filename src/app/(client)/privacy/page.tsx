export const dynamic = "force-dynamic";

import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12 md:py-16">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-neutral-900">隐私政策</h1>
        <p className="mt-2 text-sm text-neutral-400">更新日期：2026年6月1日</p>
      </div>

      <div className="prose prose-neutral prose-sm max-w-none space-y-6 text-neutral-700">
        <section>
          <h2 className="text-lg font-semibold text-neutral-900">1. 信息收集</h2>
          <p>我们收集您主动提供的信息，包括但不限于：</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>手机号码（用于订单查询和项目进度通知）</li>
            <li>品牌名称、行业类别等品牌信息（用于生成VI方案）</li>
            <li>上传的图片素材（用于Logo和VI手册制作）</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-neutral-900">2. 信息使用</h2>
          <p>我们仅将您的信息用于：</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>提供VI设计和品牌管家服务</li>
            <li>通知项目进度和交付成果</li>
            <li>改善服务质量和用户体验</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-neutral-900">3. 信息保护</h2>
          <p>我们采用业界标准的安全措施保护您的个人信息，包括数据加密存储和传输。您的项目数据仅您本人可通过手机号和查看密码访问。</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-neutral-900">4. 信息共享</h2>
          <p>未经您的明确同意，我们不会将您的个人信息出售或共享给任何第三方，法律法规要求或政府主管部门依法要求除外。</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-neutral-900">5. AI生成内容</h2>
          <p>通过AI生成的Logo、VI手册等内容，其使用权归您所有。我们保留将匿名化的生成结果用于改进AI模型的权利，但不会关联到您的个人身份。</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-neutral-900">6. 联系我们</h2>
          <p>如有隐私相关问题，请联系：400-666-1806</p>
        </section>
      </div>

      <div className="mt-10 pt-6 border-t border-neutral-100">
        <Link href="/" className="text-sm text-primary hover:underline">← 返回首页</Link>
      </div>
    </div>
  );
}