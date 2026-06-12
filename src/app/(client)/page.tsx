import { HeroSection } from "@/components/client/HeroSection";
import { ProcessSection } from "@/components/client/ProcessSection";
import { CaseCarousel } from "@/components/client/CaseCarousel";
import { AdvantageCards } from "@/components/client/AdvantageCards";
import { FaqSection } from "@/components/client/FaqSection";
import { PricingSection } from "@/components/client/PricingSection";

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <ProcessSection />
      <AdvantageCards />
      <PricingSection />
      <CaseCarousel />
      <FaqSection />
    </>
  );
}
