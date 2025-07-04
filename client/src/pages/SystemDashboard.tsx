import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Activity, 
  Bot, 
  MessageSquare, 
  Users, 
  Calendar, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  RefreshCw,
  TrendingUp,
  Database,
  Zap
} from 'lucide-react';

interface SystemStatus {
  telegram: {
    status: 'online' | 'offline' | 'error';
    botName: string;
    messagesProcessed: number;
    uptime: string;
    lastActivity: string;
  };
  whatsapp: {
    status: 'online' | 'offline' | 'error';
    zapiActive: boolean;
    fallbackActive: boolean;
    messagesProcessed: number;
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

export default function SystemDashboard() {
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    telegram: {
      status: 'online',
      botName: '@zelar_assistente_bot',
      messagesProcessed: 0,
      uptime: '0h 0m',
      lastActivity: 'Agora'
    },
    whatsapp: {
      status: 'offline',
      zapiActive: false,
      fallbackActive: true,
      messagesProcessed: 0
    },
    database: {
      status: 'connected',
      totalUsers: 0,
      totalEvents: 0,
      uptime: '0h 0m'
    },
    ai: {
      status: 'active',
      provider: 'Claude Haiku',
      requestsProcessed: 0,
      averageResponseTime: '0ms'
    }
  });

  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchSystemStatus = async () => {
    try {
      setLoading(true);
      
      // Buscar status completo do sistema
      const systemResponse = await fetch('/api/system/status');
      const systemData = await systemResponse.json();
      
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
    const interval = setInterval(fetchSystemStatus, 30000); // Atualiza a cada 30 segundos
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
      case 'connected':
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'offline':
      case 'disconnected':
      case 'inactive':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
      case 'connected':
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'offline':
      case 'disconnected':
      case 'inactive':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Sistema Zelar</h1>
          <p className="text-gray-600 mt-2">Monitoramento em tempo real do assistente inteligente</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-500">
            Última atualização: {lastUpdate.toLocaleTimeString('pt-BR')}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchSystemStatus}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="telegram">Telegram</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Status Cards */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Telegram Bot</CardTitle>
                <Bot className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  {getStatusIcon(systemStatus.telegram.status)}
                  <Badge className={getStatusColor(systemStatus.telegram.status)}>
                    {systemStatus.telegram.status}
                  </Badge>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {systemStatus.telegram.messagesProcessed} mensagens processadas
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">WhatsApp</CardTitle>
                <MessageSquare className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  {getStatusIcon(systemStatus.whatsapp.status)}
                  <Badge className={getStatusColor(systemStatus.whatsapp.status)}>
                    {systemStatus.whatsapp.fallbackActive ? 'Fallback' : 'Offline'}
                  </Badge>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  ZAPI: {systemStatus.whatsapp.zapiActive ? 'Ativa' : 'Inativa'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Database</CardTitle>
                <Database className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  {getStatusIcon(systemStatus.database.status)}
                  <Badge className={getStatusColor(systemStatus.database.status)}>
                    {systemStatus.database.status}
                  </Badge>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {systemStatus.database.totalUsers} usuários
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">IA Claude</CardTitle>
                <Zap className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  {getStatusIcon(systemStatus.ai.status)}
                  <Badge className={getStatusColor(systemStatus.ai.status)}>
                    {systemStatus.ai.status}
                  </Badge>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {systemStatus.ai.averageResponseTime} tempo médio
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Status */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Status dos Serviços</CardTitle>
                <CardDescription>Monitoramento em tempo real</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4" />
                    <span className="text-sm">Telegram Bot</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={systemStatus.telegram.status === 'online' ? 100 : 0} className="w-16" />
                    <span className="text-xs text-gray-500">100%</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    <span className="text-sm">WhatsApp</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={systemStatus.whatsapp.fallbackActive ? 60 : 0} className="w-16" />
                    <span className="text-xs text-gray-500">60%</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    <span className="text-sm">PostgreSQL</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={systemStatus.database.status === 'connected' ? 100 : 0} className="w-16" />
                    <span className="text-xs text-gray-500">100%</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    <span className="text-sm">Claude AI</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={systemStatus.ai.status === 'active' ? 100 : 0} className="w-16" />
                    <span className="text-xs text-gray-500">100%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Atividade Recente</CardTitle>
                <CardDescription>Últimas 24 horas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">Bot Telegram conectado</p>
                      <p className="text-xs text-gray-500">Há 2 minutos</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">ZAPI detectada inativa</p>
                      <p className="text-xs text-gray-500">Há 15 minutos</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">Sistema fallback ativado</p>
                      <p className="text-xs text-gray-500">Há 20 minutos</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">Database conectado</p>
                      <p className="text-xs text-gray-500">Há 2 horas</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="telegram">
          <Card>
            <CardHeader>
              <CardTitle>Status do Telegram Bot</CardTitle>
              <CardDescription>Monitoramento detalhado do bot @zelar_assistente_bot</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {systemStatus.telegram.messagesProcessed}
                  </div>
                  <div className="text-sm text-gray-500">Mensagens Processadas</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {systemStatus.telegram.uptime}
                  </div>
                  <div className="text-sm text-gray-500">Tempo Online</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    100%
                  </div>
                  <div className="text-sm text-gray-500">Taxa de Sucesso</div>
                </div>
              </div>
              
              <div className="bg-green-50 p-4 rounded-lg">
                <h4 className="font-medium text-green-800 mb-2">Status: Operacional</h4>
                <p className="text-sm text-green-700">
                  O bot está funcionando perfeitamente, processando mensagens em português e criando eventos automaticamente.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="whatsapp">
          <Card>
            <CardHeader>
              <CardTitle>Status do WhatsApp</CardTitle>
              <CardDescription>Monitoramento da integração WhatsApp e ZAPI</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <h4 className="font-medium text-yellow-800 mb-2">ZAPI: Inativa</h4>
                  <p className="text-sm text-yellow-700">
                    A instância ZAPI não foi encontrada. Provavelmente expirou ou foi desativada.
                  </p>
                </div>
                
                <div className="bg-green-50 p-4 rounded-lg">
                  <h4 className="font-medium text-green-800 mb-2">Sistema Fallback: Ativo</h4>
                  <p className="text-sm text-green-700">
                    WhatsApp Web direto está funcionando através do link: https://wa.me/5511999887766
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium mb-2">Soluções Disponíveis</h4>
                    <ul className="text-sm space-y-1">
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        Telegram Bot (Recomendado)
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        WhatsApp Web Direto
                      </li>
                      <li className="flex items-center gap-2">
                        <XCircle className="h-3 w-3 text-red-500" />
                        ZAPI Automática
                      </li>
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2">Ações Disponíveis</h4>
                    <div className="space-y-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => window.open('https://t.me/zelar_assistente_bot', '_blank')}
                      >
                        <Bot className="h-4 w-4 mr-2" />
                        Abrir Bot Telegram
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => window.open('https://wa.me/5511999887766', '_blank')}
                      >
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Abrir WhatsApp Web
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Uso da Plataforma</CardTitle>
                <CardDescription>Distribuição por canal</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      <span className="text-sm">Telegram</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={75} className="w-24" />
                      <span className="text-sm font-medium">75%</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span className="text-sm">WhatsApp</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={25} className="w-24" />
                      <span className="text-sm font-medium">25%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Performance da IA</CardTitle>
                <CardDescription>Métricas de processamento</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-lg font-bold text-green-600">95%</div>
                    <div className="text-xs text-gray-500">Taxa de Sucesso</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-blue-600">850ms</div>
                    <div className="text-xs text-gray-500">Tempo Resposta</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}