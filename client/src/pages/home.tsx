import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import FeaturesSection from "@/components/FeaturesSection";
import HowItWorksSection from "@/components/HowItWorksSection";
import BotDemoSection from "@/components/BotDemoSection";
import DocumentationSection from "@/components/DocumentationSection";
import TestimonialsSection from "@/components/TestimonialsSection";
import CtaSection from "@/components/CtaSection";
import Footer from "@/components/Footer";
import AnalyticsSection from "@/components/AnalyticsSection";

export default function Home() {
  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-b from-white via-emerald-50/70 to-green-50 text-slate-800">
      <div className="pointer-events-none absolute rounded-full blur-3xl opacity-35 mix-blend-multiply -left-20 top-0 h-72 w-72 bg-emerald-400" />
      <div className="pointer-events-none absolute rounded-full blur-3xl opacity-35 mix-blend-multiply right-0 top-1/3 h-96 w-96 bg-green-400" />
      <div className="pointer-events-none absolute rounded-full blur-3xl opacity-30 mix-blend-multiply left-1/3 bottom-0 h-64 w-64 bg-teal-300" />
      <div className="relative z-10">
        <Header />
        <HeroSection />
        <FeaturesSection />
        <HowItWorksSection />
        <BotDemoSection />
        <AnalyticsSection />
        <DocumentationSection />
        <TestimonialsSection />
        <CtaSection />
        <Footer />
      </div>
    </div>
  );
}
