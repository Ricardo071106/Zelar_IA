import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AnalyticsSection from "@/components/AnalyticsSection";

export default function AnalyticsDashboardPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="pt-24">
        <AnalyticsSection />
      </main>
      <Footer />
    </div>
  );
}

