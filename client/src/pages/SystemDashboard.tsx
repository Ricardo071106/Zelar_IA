import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Bot,
  Users,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Database,
  Zap,
} from 'lucide-react';

interface SystemStatus {
  whatsapp: {
    status: 'online' | 'offline' | 'error';
    botLabel: string;
    messagesProcessed: number;
    uptime: string;
    lastActivity: string;
  };
  database: {
    status: 'connected' | 'disconnected';
    totalUsers: number;
    totalEvents: number;
    uptime: string;
  };
  ai: {
    status: 'active' | 'inactive' | 'error';
    provider: string;
    requestsProcessed: number;
    averageResponseTime: string;
  };
}

const defaultStatus: SystemStatus = {
  whatsapp: {
    status: 'offline',
    botLabel: 'WhatsApp',
    messagesProcessed: 0,
    uptime: '—',
    lastActivity: '—',
  },
  database: {
    status: 'disconnected',
    totalUsers: 0,
    totalEvents: 0,
    uptime: '—',
  },
  ai: {
    status: 'inactive',
    provider: '—',
    requestsProcessed: 0,
    averageResponseTime: '—',
  },
};

export default function SystemDashboard() {
  const [systemStatus, setSystemStatus] = useState<SystemStatus>(defaultStatus);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchSystemStatus = async () => {
    try {
      setLoading(true);
      const systemResponse = await fetch('/api/system/status');
      if (!systemResponse.ok) throw new Error('status failed');
      const systemData = (await systemResponse.json()) as SystemStatus;
      setSystemStatus(systemData);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Erro ao buscar status do sistema:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSystemStatus();
    const interval = setInterval(fetchSystemStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
      case 'connected':
      case 'active':
        return <CheckCircle className="h-4 w-4 text-emerald-600" />;
      case 'offline':
      case 'disconnected':
      case 'inactive':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-amber-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
      case 'connected':
      case 'active':
        return 'bg-emerald-100 text-emerald-900';
      case 'offline':
      case 'disconnected':
      case 'inactive':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-amber-100 text-amber-900';
    }
  };

  const shell =
    'min-h-screen relative overflow-hidden bg-gradient-to-b from-white via-emerald-50/70 to-green-50 text-slate-800';
  const orb = 'pointer-events-none absolute rounded-full blur-3xl opacity-35 mix-blend-multiply';

  return (
    <div className={shell}>
      <div className={`${orb} -left-20 top-0 h-72 w-72 bg-emerald-400`} />
      <div className={`${orb} right-0 top-1/3 h-96 w-96 bg-green-400`} />
      <div className="relative z-10 container mx-auto p-4 max-w-6xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-mago text-3xl font-bold text-emerald-950">
              Sistema Zelar
            </h1>
            <p className="text-slate-600 mt-2">Monitoramento do backend e WhatsApp</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-slate-500">
              Última atualização: {lastUpdate.toLocaleTimeString('pt-BR')}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-emerald-200 bg-white/80"
              onClick={fetchSystemStatus}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2 bg-white/80 border border-emerald-200/70">
            <TabsTrigger value="overview">Visão geral</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <Card className="rounded-2xl border-emerald-200/70 bg-white/85 backdrop-blur-md shadow-[0_0_48px_rgba(16,185,129,0.07)]">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">WhatsApp</CardTitle>
                  <Bot className="h-4 w-4 text-emerald-600" />
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(systemStatus.whatsapp.status)}
                    <Badge className={getStatusColor(systemStatus.whatsapp.status)}>
                      {systemStatus.whatsapp.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{systemStatus.whatsapp.botLabel}</p>
                  <p className="text-xs text-slate-500">
                    Eventos (proxy): {systemStatus.whatsapp.messagesProcessed}
                  </p>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-emerald-200/70 bg-white/85 backdrop-blur-md shadow-[0_0_48px_rgba(16,185,129,0.07)]">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Banco de dados</CardTitle>
                  <Database className="h-4 w-4 text-emerald-600" />
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(systemStatus.database.status)}
                    <Badge className={getStatusColor(systemStatus.database.status)}>
                      {systemStatus.database.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {systemStatus.database.totalUsers} usuários · {systemStatus.database.totalEvents}{' '}
                    eventos
                  </p>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-emerald-200/70 bg-white/85 backdrop-blur-md shadow-[0_0_48px_rgba(16,185,129,0.07)]">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">IA</CardTitle>
                  <Zap className="h-4 w-4 text-amber-500" />
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(systemStatus.ai.status)}
                    <Badge className={getStatusColor(systemStatus.ai.status)}>
                      {systemStatus.ai.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{systemStatus.ai.provider}</p>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-emerald-200/70 bg-white/85 backdrop-blur-md shadow-[0_0_48px_rgba(16,185,129,0.07)]">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Resumo</CardTitle>
                  <Users className="h-4 w-4 text-emerald-600" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold text-emerald-900">
                    {systemStatus.database.totalEvents}
                  </p>
                  <p className="text-xs text-slate-500">eventos registrados</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="rounded-2xl border-emerald-200/70 bg-white/85 backdrop-blur-md">
                <CardHeader>
                  <CardTitle>Serviços</CardTitle>
                  <CardDescription>Estado atual</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bot className="h-4 w-4" />
                      <span className="text-sm">WhatsApp bot</span>
                    </div>
                    <Progress
                      value={systemStatus.whatsapp.status === 'online' ? 100 : 0}
                      className="w-16 h-2"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4" />
                      <span className="text-sm">PostgreSQL</span>
                    </div>
                    <Progress
                      value={systemStatus.database.status === 'connected' ? 100 : 0}
                      className="w-16 h-2"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      <span className="text-sm">Provedor IA</span>
                    </div>
                    <Progress value={systemStatus.ai.status === 'active' ? 100 : 0} className="w-16 h-2" />
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-emerald-200/70 bg-white/85 backdrop-blur-md">
                <CardHeader>
                  <CardTitle>Contato</CardTitle>
                  <CardDescription>Suporte e comunicação</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600">
                    Dúvidas comerciais ou técnicas:{' '}
                    <a
                      className="text-emerald-700 font-medium underline"
                      href="mailto:zelar.ia.messages@gmail.com"
                    >
                      zelar.ia.messages@gmail.com
                    </a>
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="analytics">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="rounded-2xl border-emerald-200/70 bg-white/85 backdrop-blur-md">
                <CardHeader>
                  <CardTitle>Uso</CardTitle>
                  <CardDescription>Canal principal</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-emerald-500 rounded-full" />
                      <span className="text-sm">WhatsApp</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={100} className="w-24 h-2" />
                      <span className="text-sm font-medium">100%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-emerald-200/70 bg-white/85 backdrop-blur-md">
                <CardHeader>
                  <CardTitle>Volume (banco)</CardTitle>
                  <CardDescription>Dados persistidos</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <div className="text-lg font-bold text-emerald-700">
                        {systemStatus.database.totalUsers}
                      </div>
                      <div className="text-xs text-slate-500">Usuários</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-emerald-700">
                        {systemStatus.database.totalEvents}
                      </div>
                      <div className="text-xs text-slate-500">Eventos</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
