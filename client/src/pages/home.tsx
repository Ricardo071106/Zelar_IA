import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import BotDemoSection from "@/components/BotDemoSection";
import ProblemsSection from "@/components/ProblemsSection";
import HowItWorksSection from "@/components/HowItWorksSection";
import IdealBusinessesSection from "@/components/IdealBusinessesSection";
import FeaturesSection from "@/components/FeaturesSection";
import TestimonialsSection from "@/components/TestimonialsSection";
import CtaSection from "@/components/CtaSection";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-slate-800">
      <Header />
      <main>
        <HeroSection />
        <BotDemoSection />
        <ProblemsSection />
        <HowItWorksSection />
        <IdealBusinessesSection />
        <FeaturesSection />
        <TestimonialsSection />
        <CtaSection />
      </main>
      <Footer />
    </div>
  );
}
