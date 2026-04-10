import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AnalyticsSection from "@/components/AnalyticsSection";

export default function AnalyticsDashboardPage() {
  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-b from-white via-emerald-50/70 to-green-50 text-slate-800">
      <div className="pointer-events-none absolute rounded-full blur-3xl opacity-35 mix-blend-multiply -left-20 top-0 h-72 w-72 bg-emerald-400" />
      <div className="relative z-10">
        <Header />
        <main className="pt-24">
          <AnalyticsSection />
        </main>
        <Footer />
      </div>
    </div>
  );
}
