import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import BotDemoSection from "@/components/BotDemoSection";
import CtaSection from "@/components/CtaSection";

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <HeroSection />
      <BotDemoSection />
      <CtaSection />
    </div>
  );
}