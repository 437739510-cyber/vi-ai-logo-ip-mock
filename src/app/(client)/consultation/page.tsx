import { ConsultationForm } from "@/components/client/ConsultationForm";

export default function ConsultationPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12 md:py-16">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-neutral-900">提交 VI 设计需求</h1>
        <p className="mt-3 text-neutral-500">
          填写信息并上传品牌素材，我们将在一到两个工作日内联系您
        </p>
      </div>

      <div className="bg-white border border-neutral-100 rounded-2xl p-6 md:p-8 shadow-sm">
        <ConsultationForm />
      </div>
    </div>
  );
}
