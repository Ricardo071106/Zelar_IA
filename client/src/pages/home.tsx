import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import FeaturesSection from "@/components/FeaturesSection";
import HowItWorksSection from "@/components/HowItWorksSection";
import BotDemoSection from "@/components/BotDemoSection";
import DocumentationSection from "@/components/DocumentationSection";
import TestimonialsSection from "@/components/TestimonialsSection";
import CtaSection from "@/components/CtaSection";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <BotDemoSection />
      <DocumentationSection />
      <TestimonialsSection />
      <CtaSection />
      <Footer />
    </div>
  );
}