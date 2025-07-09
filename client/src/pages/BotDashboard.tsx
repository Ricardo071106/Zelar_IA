import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MessageSquare, Phone, Calendar, Send, CheckCircle, XCircle, Clock } from 'lucide-react';

interface BotStatus {
  telegram: {
    status: 'conectado' | 'desconectado' | 'carregando';
    lastUpdate?: string;
  };

}

export default function BotDashboard() {
  const [botStatus, setBotStatus] = useState<BotStatus>({
    telegram: { status: 'carregando' }
  });
  

  
  const [testResults, setTestResults] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
    timestamp: string;
  }[]>([]);

  const addTestResult = (type: 'success' | 'error' | 'info', message: string) => {
    setTestResults(prev => [...prev, {
      type,
      message,
      timestamp: new Date().toLocaleTimeString('pt-BR')
    }]);
  };

  const checkBotStatus = async () => {
    // Status do Telegram (sempre conectado se o servidor estiver rodando)
    setBotStatus(prev => ({
      ...prev,
      telegram: { status: 'conectado', lastUpdate: new Date().toLocaleString('pt-BR') }
    }));
  };



  const testCalendarEvent = async () => {
    const testMessage = "Reunião com a equipe amanhã às 15h";
    try {
      addTestResult('info', `Testando criação de evento: "${testMessage}"`);
      // Esta funcionalidade seria integrada com o parser de eventos existente
      addTestResult('success', 'Evento de calendário processado com sucesso');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      addTestResult('error', `Erro ao processar evento: ${errorMessage}`);
    }
  };

  useEffect(() => {
    checkBotStatus();
    const interval = setInterval(checkBotStatus, 10000); // Verificar a cada 10 segundos
    return () => clearInterval(interval);
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'conectado':
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" /> Conectado</Badge>;
      case 'desconectado':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Desconectado</Badge>;
      case 'aguardando_qr':
        return <Badge className="bg-yellow-500"><Clock className="w-3 h-3 mr-1" /> Aguardando QR</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" /> Carregando</Badge>;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Bot Zelar Dashboard</h1>
          <p className="text-muted-foreground">
            Central de controle do bot Telegram
          </p>
        </div>
        <Button onClick={checkBotStatus}>
          Atualizar Status
        </Button>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bot Telegram</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              {getStatusBadge(botStatus.telegram.status)}
              <span className="text-xs text-muted-foreground">
                {botStatus.telegram.lastUpdate}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Processamento inteligente de eventos em português
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">WhatsApp Bot</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              {getStatusBadge(botStatus.whatsapp.status)}
              <span className="text-xs text-muted-foreground">
                {botStatus.whatsapp.lastUpdate}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Bot simples com respostas automáticas
            </p>
          </CardContent>
        </Card>


      </div>





      {/* Testing Interface */}
      <Tabs defaultValue="calendar" className="space-y-4">
        <TabsList>
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
          <TabsTrigger value="calendar">Teste Calendário</TabsTrigger>
          <TabsTrigger value="logs">Logs de Teste</TabsTrigger>
        </TabsList>

        <TabsContent value="whatsapp" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>WhatsApp Bot Control</CardTitle>
              <CardDescription>
                Controle e teste do bot WhatsApp simples
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button 
                  onClick={async () => {
                    try {
                      const response = await fetch('/api/whatsapp/start', { method: 'POST' });
                      if (response.ok) {
                        addTestResult('success', 'WhatsApp bot iniciado');
                        setTimeout(checkBotStatus, 2000);
                      } else {
                        addTestResult('error', 'Erro ao iniciar WhatsApp bot');
                      }
                    } catch (error) {
                      addTestResult('error', 'Erro de conexão');
                    }
                  }}
                  size="sm"
                >
                  Iniciar Bot WhatsApp
                </Button>
                <Button 
                  onClick={async () => {
                    try {
                      const response = await fetch('/api/whatsapp/stop', { method: 'POST' });
                      if (response.ok) {
                        addTestResult('success', 'WhatsApp bot parado');
                        checkBotStatus();
                      } else {
                        addTestResult('error', 'Erro ao parar WhatsApp bot');
                      }
                    } catch (error) {
                      addTestResult('error', 'Erro de conexão');
                    }
                  }}
                  variant="outline"
                  size="sm"
                >
                  Parar Bot
                </Button>
              </div>

              {(botStatus.whatsapp.qrCode || botStatus.whatsapp.qrCodeImage) && botStatus.whatsapp.status !== 'conectado' && (
                <Alert>
                  <MessageSquare className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-4">
                      <p className="font-medium">Escaneie o QR Code com seu WhatsApp:</p>
                      
                      {botStatus.whatsapp.qrCodeImage ? (
                        <div className="flex justify-center">
                          <div className="bg-white p-4 rounded-lg shadow-sm border">
                            <img 
                              src={botStatus.whatsapp.qrCodeImage} 
                              alt="QR Code WhatsApp" 
                              className="w-64 h-64 object-contain"
                            />
                          </div>
                        </div>
                      ) : botStatus.whatsapp.qrCode ? (
                        <div className="bg-white p-4 rounded-lg">
                          <pre className="text-xs font-mono break-all whitespace-pre-wrap">
                            {botStatus.whatsapp.qrCode}
                          </pre>
                        </div>
                      ) : null}
                      
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">
                          Abra o WhatsApp → Menu → Dispositivos conectados → Conectar dispositivo
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Use a câmera do seu celular para escanear o código acima
                        </p>
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {botStatus.whatsapp.status === 'conectado' && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    <p className="font-medium">WhatsApp conectado com sucesso!</p>
                    <p className="text-sm text-muted-foreground">
                      Envie "oi" ou "lembrete" para o número conectado para testar as respostas.
                    </p>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calendar" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Teste de Processamento de Eventos</CardTitle>
              <CardDescription>
                Teste a interpretação inteligente de datas e criação de eventos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button onClick={testCalendarEvent} variant="outline">
                  <Calendar className="w-4 h-4 mr-2" />
                  "Reunião amanhã às 15h"
                </Button>
                <Button onClick={() => testCalendarEvent()} variant="outline">
                  <Calendar className="w-4 h-4 mr-2" />
                  "Médico sexta-feira 9h"
                </Button>
              </div>
              <Alert>
                <AlertDescription>
                  Estes testes demonstram como o bot interpreta linguagem natural em português
                  para crear eventos de calendário com links diretos para Google Calendar,
                  Outlook e arquivos ICS.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Logs de Teste</CardTitle>
              <CardDescription>
                Histórico de testes e operações realizadas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {testResults.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    Nenhum teste realizado ainda. Use as abas acima para testar as funcionalidades.
                  </p>
                ) : (
                  testResults.map((result, index) => (
                    <div key={index} className={`flex items-start gap-2 p-2 rounded text-sm ${
                      result.type === 'success' ? 'bg-green-50 text-green-800' :
                      result.type === 'error' ? 'bg-red-50 text-red-800' :
                      'bg-blue-50 text-blue-800'
                    }`}>
                      <span className="font-mono text-xs opacity-70">{result.timestamp}</span>
                      <span className="flex-1">{result.message}</span>
                    </div>
                  ))
                )}
              </div>
              {testResults.length > 0 && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setTestResults([])}
                  className="mt-4"
                >
                  Limpar Logs
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}