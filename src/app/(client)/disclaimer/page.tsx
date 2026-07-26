export const dynamic = "force-dynamic";

import Link from "next/link";

export default function DisclaimerPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12 md:py-16">
      <h1 className="text-2xl font-bold text-neutral-900 mb-8">免责声明</h1>

      <div className="prose prose-sm prose-neutral space-y-6 text-neutral-700 leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-neutral-900">一、关于品牌素材与信息</h2>
          <p>
            本平台（Brand Brain · 品牌顾问）所生成的品牌视觉识别系统（VI手册）、Logo方案、品牌名称及相关设计内容，均基于用户自行提交的品牌信息、素材及需求描述生成。用户对其提交的所有信息、素材的合法性、真实性及原创性承担全部责任。
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-neutral-900">二、关于商标与知识产权</h2>
          <ol className="list-decimal pl-5 space-y-2">
            <li>
              本平台提供的Logo设计、品牌名称等内容仅供参考和设计使用，<strong>不构成商标注册建议或担保</strong>。商标能否成功注册取决于商标局的审查结果及在先权利状况，本平台不对商标注册的成功率做任何承诺。
            </li>
            <li>
              若用户拟将平台生成的设计方案用于商标注册，应<strong>自行或在专业商标代理机构协助下进行商标查重与可行性评估</strong>。因品牌名称或Logo与已有商标冲突导致无法注册的，本平台不承担任何责任。
            </li>
            <li>
              用户因使用平台生成内容而涉及的商标侵权、著作权争议或其他知识产权纠纷，由用户自行承担全部法律责任，本平台不承担连带责任。
            </li>
          </ol>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-neutral-900">三、关于AI生成内容</h2>
          <ol className="list-decimal pl-5 space-y-2">
            <li>
              本平台采用AI技术辅助生成设计方案，AI生成内容可能存在与现有设计偶然相似的情形。用户在使用生成内容前，应自行进行充分的原创性核查。
            </li>
            <li>
              AI生成内容经专业设计师精修后交付，但<strong>本平台不对生成内容的独创性、商业可用性做绝对保证</strong>。用户应结合自身业务场景对最终方案进行独立判断。
            </li>
          </ol>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-neutral-900">四、关于服务范围</h2>
          <ol className="list-decimal pl-5 space-y-2">
            <li>本平台提供品牌视觉识别系统的AI生成与设计服务，不提供法律咨询、商标代理、知识产权登记等法律专业服务。</li>
            <li>用户如需进行商标注册、知识产权保护等法律行为，建议咨询专业法律顾问或商标代理机构。</li>
            <li>大学生上门服务（如有）为第三方独立行为，不在本平台管控范围之内，本平台不承担相关责任。</li>
          </ol>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-neutral-900">五、关于版权归属</h2>
          <p>
            交付后的VI手册版权归客户所有，本平台承诺不会将客户的品牌素材和手册用于其他项目。但客户需确保其提供的原始素材不侵犯第三方权益，否则由此产生的版权纠纷由客户自行承担。
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-neutral-900">六、免责范围</h2>
          <p>在法律允许的最大范围内，以下情形本平台不承担责任：</p>
          <ol className="list-decimal pl-5 space-y-2">
            <li>因用户提交的信息不实或素材存在权利瑕疵导致的任何损失；</li>
            <li>因商标冲突、知识产权争议等导致用户无法获得预期权利的情形；</li>
            <li>因不可抗力、网络故障、系统维护等导致服务中断或数据丢失；</li>
            <li>用户将平台生成内容用于非法用途所产生的后果。</li>
          </ol>
        </section>

        <section className="pt-4 border-t border-neutral-200">
          <p className="text-neutral-500 text-xs">
            本免责声明的最终解释权归Brand Brain · 品牌顾问所有。如有疑问，请通过平台咨询渠道与我们联系。
            <br />
            最后更新：2026年6月
          </p>
        </section>
      </div>

      <div className="mt-10">
        <Link
          href="/"
          className="inline-flex items-center px-5 py-2.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors"
        >
          返回首页
        </Link>
      </div>
    </div>
  );
}