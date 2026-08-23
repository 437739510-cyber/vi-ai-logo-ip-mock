import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, BadgeCheck } from "lucide-react";
import { CASES, getCaseBySlug } from "@/lib/cases";

interface CaseDetailPageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return CASES.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: CaseDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const c = getCaseBySlug(slug);
  if (!c) return { title: "案例不存在" };
  return { title: `${c.name} · 客户案例` };
}

export default async function CaseDetailPage({ params }: CaseDetailPageProps) {
  const { slug } = await params;
  const c = getCaseBySlug(slug);
  if (!c) notFound();

  return (
    <main className="min-h-screen bg-neutral-50 py-10 md:py-16">
      <div className="max-w-5xl mx-auto px-4">
        {/* Hero */}
        <section className="bg-white rounded-3xl overflow-hidden border border-neutral-100 shadow-sm">
          <div className="relative aspect-[16/9] md:aspect-[2/1] bg-neutral-100">
            <Image
              src={c.cover}
              alt={c.name}
              fill
              priority
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 1024px"
            />
          </div>
          <div className="p-6 md:p-10">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="text-xs font-medium text-brand-600 bg-brand-50 px-2.5 py-1 rounded-full">
                {c.industry}
              </span>
              {c.city ? (
                <span className="inline-flex items-center gap-1 text-xs text-neutral-500 bg-neutral-100 px-2.5 py-1 rounded-full">
                  <MapPin className="w-3 h-3" />
                  {c.city}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                <BadgeCheck className="w-3 h-3" />
                客户已授权公开
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-neutral-900 mb-2">
              {c.name}
            </h1>
            <p className="text-neutral-500">{c.tagline}</p>
          </div>
        </section>

        {/* 品牌故事 */}
        <section className="mt-6 bg-white rounded-3xl border border-neutral-100 shadow-sm p-6 md:p-10">
          <h2 className="text-xl font-bold text-neutral-900 mb-3">品牌故事</h2>
          <p className="text-neutral-600 leading-relaxed whitespace-pre-line">
            {c.story}
          </p>
        </section>

        {/* 图片画廊 */}
        <section className="mt-6 bg-white rounded-3xl border border-neutral-100 shadow-sm p-6 md:p-10">
          <h2 className="text-xl font-bold text-neutral-900 mb-6">案例图集</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {c.images.map((src) => (
              <div
                key={src}
                className="relative aspect-[4/3] rounded-xl overflow-hidden bg-neutral-100"
              >
                <Image
                  src={src}
                  alt={`${c.name} 案例图片`}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 50vw, 33vw"
                />
              </div>
            ))}
          </div>
          <p className="mt-8 text-sm text-neutral-500 bg-neutral-50 border border-neutral-100 rounded-xl px-4 py-3">
            {c.authNote}
          </p>
        </section>

        {/* 回到首页 */}
        <div className="mt-8 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            回到首页
          </Link>
        </div>
      </div>
    </main>
  );
}