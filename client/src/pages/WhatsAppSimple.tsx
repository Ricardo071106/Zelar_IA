import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, XCircle, Loader2, RefreshCw } from 'lucide-react';

interface ZAPIStatus {
  connected: boolean;
  message: string;
}

interface ZAPIConfig {
  instanceId: string;
  token: string;
  phone: string;
}

export default function WhatsAppSimple() {
  const [config, setConfig] = useState<ZAPIConfig>({
    instanceId: '',
    token: '',
    phone: ''
  });
  
  const [status, setStatus] = useState<ZAPIStatus>({ connected: false, message: 'Não configurado' });
  const [loading, setLoading] = useState(false);
  const [qrCode, setQrCode] = useState<string>('');
  const { toast } = useToast();

  const setupZAPI = async () => {
    if (!config.instanceId || !config.token || !config.phone) {
      toast({
        title: "Erro",
        description: "Todos os campos são obrigatórios",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/zapi/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config)
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Sucesso",
          description: "Z-API configurado com sucesso"
        });
        checkStatus();
      } else {
        toast({
          title: "Erro",
          description: data.error || "Falha ao configurar Z-API",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro de conexão com o servidor",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const checkStatus = async () => {
    try {
      const response = await fetch('/api/zapi/status');
      const data = await response.json();
      setStatus(data);
    } catch (error) {
      console.error('Erro ao verificar status:', error);
    }
  };

  const connectWhatsApp = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/zapi/connect', {
        method: 'POST'
      });

      const data = await response.json();

      if (data.success) {
        setQrCode(data.qrCode);
        toast({
          title: "Sucesso",
          description: "QR Code gerado"
        });
      } else {
        toast({
          title: "Erro",
          description: data.message || "Falha ao gerar QR Code",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro de conexão com o servidor",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Verificar status automaticamente
  useEffect(() => {
    const interval = setInterval(checkStatus, 30000);
    checkStatus();
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">WhatsApp Business - Z-API (Simples)</h1>
        <Button onClick={checkStatus} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar Status
        </Button>
      </div>

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
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuração Z-API */}
      <Card>
        <CardHeader>
          <CardTitle>Configuração Z-API</CardTitle>
          <CardDescription>
            Configure suas credenciais do Z-API (serviço brasileiro)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="instanceId">Instance ID</Label>
            <Input
              id="instanceId"
              placeholder="Sua Instance ID do Z-API"
              value={config.instanceId}
              onChange={(e) => setConfig(prev => ({ ...prev, instanceId: e.target.value }))}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="token">Token</Label>
            <Input
              id="token"
              type="password"
              placeholder="Seu Token do Z-API"
              value={config.token}
              onChange={(e) => setConfig(prev => ({ ...prev, token: e.target.value }))}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="phone">Seu Número WhatsApp</Label>
            <Input
              id="phone"
              placeholder="5511999999999"
              value={config.phone}
              onChange={(e) => setConfig(prev => ({ ...prev, phone: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              Número com código do país (apenas números)
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button 
              onClick={setupZAPI} 
              disabled={loading}
              className="flex-1"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Configurando...
                </>
              ) : (
                'Configurar Z-API'
              )}
            </Button>
            
            <Button 
              onClick={connectWhatsApp} 
              disabled={loading}
              variant="outline"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Conectar WhatsApp'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Instruções Simples */}
      <Card>
        <CardHeader>
          <CardTitle>Como Usar (Muito Simples!)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium">1. Cadastre-se no Z-API</h4>
            <p className="text-sm text-muted-foreground">
              Acesse z-api.io e crie uma conta (serviço brasileiro, muito fácil)
            </p>
          </div>
          
          <div className="space-y-2">
            <h4 className="font-medium">2. Pegue suas credenciais</h4>
            <p className="text-sm text-muted-foreground">
              No painel do Z-API, copie: Instance ID e Token
            </p>
          </div>
          
          <div className="space-y-2">
            <h4 className="font-medium">3. Configure aqui</h4>
            <p className="text-sm text-muted-foreground">
              Cole as credenciais acima e digite seu número do WhatsApp
            </p>
          </div>
          
          <div className="space-y-2">
            <h4 className="font-medium">4. Conecte o WhatsApp</h4>
            <p className="text-sm text-muted-foreground">
              Clique "Conectar WhatsApp" e escaneie o QR Code
            </p>
          </div>
          
          <div className="space-y-2">
            <h4 className="font-medium">5. Pronto!</h4>
            <p className="text-sm text-muted-foreground">
              Envie mensagens como "reunião amanhã às 15h" e receba links de calendário
            </p>
          </div>
          
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">📱 Webhook URL para Z-API:</h4>
            <code className="text-sm bg-white p-2 rounded border block">
              {window.location.origin}/api/zapi/webhook
            </code>
            <p className="text-xs text-blue-700 mt-2">
              Configure esta URL no painel do Z-API para receber mensagens
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}