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
        const data = (await response.json()) as AnalyticsOverview;
        setOverview(data);
      } catch (error) {
        console.warn("Não foi possível carregar métricas do analytics:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  return (
    <section id="analytics" className="py-16 md:py-24 bg-gradient-to-br from-primary/5 via-white to-white">
      <div className="container mx-auto px-4">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <Badge className="mb-4 bg-primary/10 text-primary">Visão Geral</Badge>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Resultados que o Zelar entrega hoje</h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Acompanhe, em tempo real, o impacto do assistente nas operações: novos usuários, conversas ativas, eventos gerados e eficiência do parser inteligente.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          <Card className="border-primary/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Usuários ativos</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div className="text-3xl font-semibold text-primary">{overview.totals.users}</div>
              <Users className="text-primary/70" />
            </CardContent>
          </Card>

          <Card className="border-primary/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Conversas no mês</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div className="text-3xl font-semibold text-primary">{overview.totals.activeChats}</div>
              <TrendingUp className="text-primary/70" />
            </CardContent>
          </Card>

          <Card className="border-primary/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Eventos criados</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div className="text-3xl font-semibold text-primary">{overview.totals.eventsCreated}</div>
              <Calendar className="text-primary/70" />
            </CardContent>
          </Card>

          <Card className="border-primary/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Parser inteligente</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 mb-2">
                <Zap className="text-primary/70" />
                <span className="text-sm text-gray-500">
                  {Math.round(overview.automation.smartParserSuccess * 100)}% de acerto
                </span>
              </div>
              <Progress value={overview.automation.smartParserSuccess * 100} className="h-2" />
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-primary/10">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Principais intenções</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {(overview.topIntents || []).slice(0, 4).map((intent) => (
                <div key={intent.intent} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{intent.intent}</span>
                  <Badge variant="secondary" className="bg-primary/10 text-primary">
                    {Math.round(intent.percentage * 100)}%
                  </Badge>
                </div>
              ))}
              {!overview.topIntents.length && (
                <p className="text-sm text-gray-500">Carregando métricas de intenção…</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}

