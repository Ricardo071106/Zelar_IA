import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, XCircle, Loader2, RefreshCw, Settings, MessageSquare, AlertCircle } from 'lucide-react';

interface EvolutionConfig {
  configured: boolean;
  baseUrl?: string;
  instanceName?: string;
}

interface EvolutionStatus {
  success: boolean;
  connected: boolean;
  message: string;
}

export default function WhatsAppEvolution() {
  const [config, setConfig] = useState<EvolutionConfig>({ configured: false });
  const [status, setStatus] = useState<EvolutionStatus>({ success: false, connected: false, message: 'Verificando...' });
  const [loading, setLoading] = useState(false);
  const [qrCode, setQrCode] = useState<string>('');
  const [setupForm, setSetupForm] = useState({
    baseUrl: '',
    instanceName: '',
    apiKey: ''
  });
  const { toast } = useToast();

  // Verifica configuração inicial
  useEffect(() => {
    checkConfiguration();
    if (config.configured) {
      checkStatus();
    }
  }, []);

  // Atualiza status periodicamente se configurado
  useEffect(() => {
    if (config.configured) {
      const interval = setInterval(checkStatus, 30000);
      return () => clearInterval(interval);
    }
  }, [config.configured]);

  const checkConfiguration = async () => {
    try {
      const response = await fetch('/api/evolution/config');
      const data = await response.json();
      setConfig(data);
    } catch (error) {
      console.error('Erro ao verificar configuração:', error);
    }
  };

  const checkStatus = async () => {
    try {
      const response = await fetch('/api/evolution/status');
      const data = await response.json();
      setStatus(data);
    } catch (error) {
      console.error('Erro ao verificar status:', error);
      setStatus({ success: false, connected: false, message: 'Erro ao verificar status' });
    }
  };

  const setupEvolution = async () => {
    if (!setupForm.baseUrl || !setupForm.instanceName || !setupForm.apiKey) {
      toast({
        title: "Erro",
        description: "Todos os campos são obrigatórios",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/evolution/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(setupForm)
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast({
          title: "Sucesso",
          description: "Evolution API configurada com sucesso"
        });
        await checkConfiguration();
        await createInstance();
      } else {
        toast({
          title: "Erro",
          description: data.error || 'Erro ao configurar Evolution API',
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao conectar com o servidor",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const createInstance = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/evolution/create', {
        method: 'POST'
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast({
          title: "Sucesso",
          description: "Instância criada com sucesso"
        });
        await setupWebhook();
      } else {
        console.log('Instância pode já existir, continuando...');
        await setupWebhook();
      }
    } catch (error) {
      console.log('Erro ao criar instância, mas continuando...');
      await setupWebhook();
    } finally {
      setLoading(false);
    }
  };

  const setupWebhook = async () => {
    try {
      const webhookUrl = `${window.location.origin}/api/evolution/webhook-receive`;
      
      const response = await fetch('/api/evolution/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast({
          title: "Sucesso",
          description: "Webhook configurado automaticamente"
        });
      }
    } catch (error) {
      console.log('Erro ao configurar webhook:', error);
    }
  };

  const connectWhatsApp = async () => {
    setLoading(true);
    setQrCode('');
    
    try {
      const response = await fetch('/api/evolution/connect', {
        method: 'POST'
      });

      const data = await response.json();

      if (response.ok && data.success && data.qrCode) {
        setQrCode(data.qrCode);
        toast({
          title: "QR Code Gerado",
          description: "Escaneie o QR Code com seu WhatsApp"
        });
      } else {
        toast({
          title: "Erro",
          description: data.message || 'Erro ao gerar QR Code',
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao conectar com o servidor",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-green-700">WhatsApp Business Bot</h1>
          <p className="text-gray-600 mt-2">Evolution API - Solução Profissional</p>
        </div>

        {!config.configured ? (
          <Card className="border-blue-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Configurar Evolution API
              </CardTitle>
              <CardDescription>
                Configure sua instância da Evolution API para começar a usar o WhatsApp Business
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="baseUrl">URL da Evolution API</Label>
                  <Input
                    id="baseUrl"
                    placeholder="https://sua-evolution-api.com"
                    value={setupForm.baseUrl}
                    onChange={(e) => setSetupForm({...setupForm, baseUrl: e.target.value})}
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    URL do seu servidor Evolution API (ex: https://evolution.seunegocio.com)
                  </p>
                </div>
                
                <div>
                  <Label htmlFor="instanceName">Nome da Instância</Label>
                  <Input
                    id="instanceName"
                    placeholder="meu-whatsapp-bot"
                    value={setupForm.instanceName}
                    onChange={(e) => setSetupForm({...setupForm, instanceName: e.target.value})}
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Nome único para sua instância do WhatsApp
                  </p>
                </div>
                
                <div>
                  <Label htmlFor="apiKey">Chave da API</Label>
                  <Input
                    id="apiKey"
                    type="password"
                    placeholder="sua-api-key-evolution"
                    value={setupForm.apiKey}
                    onChange={(e) => setSetupForm({...setupForm, apiKey: e.target.value})}
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Chave de API fornecida pelo seu servidor Evolution
                  </p>
                </div>
              </div>

              <Button 
                onClick={setupEvolution} 
                disabled={loading}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Configurando...
                  </>
                ) : (
                  'Configurar Evolution API'
                )}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Status da Conexão */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Status da Conexão
                  {status.connected ? (
                    <Badge variant="default" className="bg-green-500">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Conectado
                    </Badge>
                  ) : (
                    <Badge variant="destructive">
                      <XCircle className="w-3 h-3 mr-1" />
                      Desconectado
                    </Badge>
                  )}
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={checkStatus}
                    className="ml-auto"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{status.message}</p>
                
                {qrCode && (
                  <div className="mt-4 space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Escaneie o QR Code abaixo com o WhatsApp:
                    </p>
                    <div className="bg-white p-4 rounded-lg inline-block">
                      <img 
                        src={qrCode} 
                        alt="QR Code WhatsApp" 
                        className="w-64 h-64"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      WhatsApp → Menu → Dispositivos Conectados → Conectar Dispositivo
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Configuração */}
            <Card className="border-green-200 bg-green-50/50">
              <CardHeader>
                <CardTitle className="text-green-800">Configuração Evolution API</CardTitle>
                <CardDescription className="text-green-700">
                  Sua Evolution API está configurada e pronta para uso
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="text-green-800 font-medium">URL: {config.baseUrl}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="text-green-800 font-medium">Instância: {config.instanceName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="text-green-800 font-medium">Webhook: /api/evolution/webhook-receive</span>
                  </div>
                </div>

                <Button 
                  onClick={connectWhatsApp} 
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Gerando QR Code...
                    </>
                  ) : (
                    'Conectar WhatsApp'
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Como Funciona */}
            <Card className="border-blue-200 bg-blue-50/50">
              <CardHeader>
                <CardTitle className="text-blue-800">Como Funciona</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="text-sm">
                    <h4 className="font-medium text-blue-800">1. Conecte o WhatsApp</h4>
                    <p className="text-blue-700">Clique "Conectar WhatsApp" e escaneie o QR Code</p>
                  </div>
                  
                  <div className="text-sm">
                    <h4 className="font-medium text-blue-800">2. Envie Mensagens</h4>
                    <p className="text-blue-700">Mande "reunião amanhã às 15h" para seu número</p>
                  </div>
                  
                  <div className="text-sm">
                    <h4 className="font-medium text-blue-800">3. Receba Links</h4>
                    <p className="text-blue-700">Bot responde com links para Google Calendar, Outlook e ICS</p>
                  </div>
                </div>

                <div className="bg-blue-100 p-3 rounded-lg">
                  <h4 className="font-medium text-blue-800 mb-2">Exemplos de mensagens:</h4>
                  <div className="space-y-1 text-sm text-blue-700">
                    <p>• "consulta médica terça às 14h30"</p>
                    <p>• "reunião de trabalho amanhã às 10h"</p>
                    <p>• "dentista sexta às 9h"</p>
                    <p>• "almoço com cliente segunda às 12h"</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Guia Evolution API */}
            <Card className="border-orange-200 bg-orange-50/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-orange-800">
                  <AlertCircle className="w-5 h-5" />
                  Precisa de uma Evolution API?
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-orange-700">
                <p>
                  A Evolution API é um serviço profissional para WhatsApp Business. 
                  Você pode contratar de provedores confiáveis como:
                </p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Servidor próprio com Evolution API instalada</li>
                  <li>Provedores de hospedagem especializados</li>
                  <li>Serviços gerenciados de WhatsApp Business</li>
                </ul>
                <p className="text-xs">
                  Não precisamos de GitHub ou configurações complexas - apenas URL, nome da instância e chave da API.
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}