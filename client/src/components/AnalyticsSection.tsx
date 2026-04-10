import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, Users, Calendar, Zap } from "lucide-react";

interface BusinessMetric {
  label: string;
  value: number;
}

interface FunnelStage {
  stage: string;
  value: number;
}

interface TopIntent {
  intent: string;
  percentage: number;
}

interface AnalyticsOverview {
  totals: {
    users: number;
    netNewUsers30d: number;
    activeChats: number;
    eventsCreated: number;
  };
  businessMetrics: BusinessMetric[];
  funnel: FunnelStage[];
  automation: {
    smartParserSuccess: number;
    aiFallbackUsage: number;
    calendarLinkClicks: number;
    averageAiLatencyMs: number;
  };
  topIntents: TopIntent[];
  updatedAt?: string;
}

const initialOverview: AnalyticsOverview = {
  totals: {
    users: 0,
    netNewUsers30d: 0,
    activeChats: 0,
    eventsCreated: 0,
  },
  businessMetrics: [],
  funnel: [],
  automation: {
    smartParserSuccess: 0,
    aiFallbackUsage: 0,
    calendarLinkClicks: 0,
    averageAiLatencyMs: 0,
  },
  topIntents: [],
};

const cardShell =
  "rounded-2xl border border-emerald-200/70 bg-white/85 backdrop-blur-md shadow-[0_0_48px_rgba(16,185,129,0.07)]";

export default function AnalyticsSection() {
  const [overview, setOverview] = useState<AnalyticsOverview>(initialOverview);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const response = await fetch("/api/analytics/overview");
        if (!response.ok) {
          throw new Error("Falha ao carregar métricas");
        }
        const json = (await response.json()) as {
          success?: boolean;
          data?: AnalyticsOverview;
        };
        const payload = json.data ?? (json as unknown as AnalyticsOverview);
        if (payload && typeof payload === "object" && "totals" in payload) {
          setOverview(payload as AnalyticsOverview);
        }
      } catch (error) {
        console.warn("Não foi possível carregar métricas do analytics:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  return (
    <section
      id="analytics"
      className="py-16 md:py-24 relative overflow-hidden bg-gradient-to-b from-emerald-50/40 via-white to-white"
    >
      <div className="pointer-events-none absolute rounded-full blur-3xl opacity-30 mix-blend-multiply right-0 top-20 h-64 w-64 bg-emerald-300" />
      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <Badge className="mb-4 border-emerald-200 bg-emerald-50 text-emerald-800">Visão geral</Badge>
          <h2 className="font-mago text-3xl md:text-4xl font-bold text-emerald-950 mb-4">
            Números reais do Zelar
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Dados vindos do nosso banco: usuários, eventos e organizadores ativos nos últimos 30 dias.
            {loading && <span className="block text-sm text-emerald-700 mt-2">Carregando…</span>}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          <Card className={cardShell}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Usuários cadastrados</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div className="text-3xl font-semibold text-emerald-800">
                {overview?.totals?.users ?? 0}
              </div>
              <Users className="text-emerald-600/80" />
            </CardContent>
          </Card>

          <Card className={cardShell}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">
                Organizadores ativos (30 dias)
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div className="text-3xl font-semibold text-emerald-800">
                {overview?.totals?.activeChats ?? 0}
              </div>
              <TrendingUp className="text-emerald-600/80" />
            </CardContent>
          </Card>

          <Card className={cardShell}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Eventos criados</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div className="text-3xl font-semibold text-emerald-800">
                {overview?.totals?.eventsCreated ?? 0}
              </div>
              <Calendar className="text-emerald-600/80" />
            </CardContent>
          </Card>

          <Card className={cardShell}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Sincronismo com calendário</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 mb-2">
                <Zap className="text-emerald-600/80" />
                <span className="text-sm text-slate-600">
                  {Math.round((overview?.automation?.smartParserSuccess ?? 0) * 100)}% com ID no calendário
                </span>
              </div>
              <Progress
                value={(overview?.automation?.smartParserSuccess ?? 0) * 100}
                className="h-2 bg-emerald-100"
              />
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className={cardShell}>
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-emerald-950 font-mago">
                Títulos mais frequentes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {(overview?.topIntents || []).slice(0, 4).map((intent) => (
                <div key={intent.intent} className="flex items-center justify-between gap-2">
                  <span className="text-sm text-slate-600 truncate">{intent.intent}</span>
                  <Badge variant="secondary" className="shrink-0 bg-emerald-100 text-emerald-900">
                    {Math.round(intent.percentage * 100)}%
                  </Badge>
                </div>
              ))}
              {(!overview?.topIntents || !overview.topIntents.length) && !loading && (
                <p className="text-sm text-slate-500">Ainda não há eventos para exibir aqui.</p>
              )}
            </CardContent>
          </Card>

          <Card className={cardShell}>
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-emerald-950 font-mago">Funil (banco)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(overview?.funnel || []).map((row) => (
                <div key={row.stage} className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">{row.stage}</span>
                  <span className="font-medium text-emerald-800">{row.value}</span>
                </div>
              ))}
              {(!overview?.funnel || !overview.funnel.length) && !loading && (
                <p className="text-sm text-slate-500">Sem dados de funil.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
