import { HeroSection } from "@/components/client/HeroSection";
import { ProcessSection } from "@/components/client/ProcessSection";
import { CaseCarousel } from "@/components/client/CaseCarousel";
import { AdvantageCards } from "@/components/client/AdvantageCards";
import { FaqSection } from "@/components/client/FaqSection";
import { PricingSection } from "@/components/client/PricingSection";
import { DeliverableSection } from "@/components/client/DeliverableSection";
import { TrustSection } from "@/components/client/TrustSection";

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <ProcessSection />
      <AdvantageCards />
      <DeliverableSection />
      <PricingSection />
      <TrustSection />
      <CaseCarousel />
      <FaqSection />
    </>
  );
}
