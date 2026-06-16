import { Suspense } from "react";
import { ConsultationForm } from "@/components/client/ConsultationForm";

export default function ConsultationPage() {
  return (
    <Suspense>
    <div className="max-w-3xl mx-auto px-4 py-12 md:py-16">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-neutral-900">提交 VI 设计需求</h1>
        <p className="mt-3 text-neutral-500">
          填写信息并上传品牌素材，我们将在一到两个工作日内联系您
        </p>
        <p className="mt-4 text-sm font-bold text-neutral-800 leading-relaxed">
          为了不让您的品牌沦为千篇一律的模板货，我们需要DeepSeek AI深度消化您的行业特性与偏好。资料越详实，AI的理解越深刻——这十几分钟的耐心，换来的是专属您的高定视觉系统。
        </p>
      </div>

      <div className="bg-white border border-neutral-100 rounded-2xl p-6 md:p-8 shadow-sm">
        <ConsultationForm />
      </div>
    </div>
    </Suspense>
  );
}
