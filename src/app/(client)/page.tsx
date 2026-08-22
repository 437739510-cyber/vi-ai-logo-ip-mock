import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI品牌VI手册自动生成",
};

import { HeroSection } from "@/components/client/HeroSection";
import { ProcessSection } from "@/components/client/ProcessSection";
import { CaseCarousel } from "@/components/client/CaseCarousel";
import { AdvantageCards } from "@/components/client/AdvantageCards";
import { FaqSection } from "@/components/client/FaqSection";
import { PricingSection } from "@/components/client/PricingSection";
import { ComparisonSection } from "@/components/client/ComparisonSection";
import { DeliverableSection } from "@/components/client/DeliverableSection";
import { TrustSection } from "@/components/client/TrustSection";
import { BottomCtaSection } from "@/components/client/BottomCtaSection";
import { ChatWidget } from "@/components/client/ChatWidget";

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <ProcessSection />
      <AdvantageCards />
      <DeliverableSection />
      <PricingSection />
      <ComparisonSection />
      <TrustSection />
      <CaseCarousel />
      <FaqSection />
      <BottomCtaSection />
      <ChatWidget />
    </>
  );
}
