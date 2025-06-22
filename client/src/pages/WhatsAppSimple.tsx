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
          description: data.credentialsValid ? "Z-API configurado e testado com sucesso" : "Configurado, mas credenciais inválidas"
        });
        checkStatus();
      } else {
        toast({
          title: "Erro de Configuração",
          description: data.error || data.message || "Falha ao configurar Z-API",
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

      {/* Guia de Configuração */}
      <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-900/10">
        <CardHeader>
          <CardTitle className="text-blue-800 dark:text-blue-200">Como Configurar o Z-API (5 minutos)</CardTitle>
          <CardDescription className="text-blue-700 dark:text-blue-300">
            Siga estes passos para configurar seu WhatsApp Business
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">1</div>
              <div>
                <p className="font-medium text-blue-800 dark:text-blue-200">Cadastre-se no Z-API</p>
                <p className="text-sm text-blue-700 dark:text-blue-300">Acesse https://z-api.io e crie sua conta gratuita</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">2</div>
              <div>
                <p className="font-medium text-blue-800 dark:text-blue-200">Crie uma Instância</p>
                <p className="text-sm text-blue-700 dark:text-blue-300">No painel Z-API, clique "Criar Instância" e escolha um nome</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">3</div>
              <div>
                <p className="font-medium text-blue-800 dark:text-blue-200">Copie as Credenciais</p>
                <p className="text-sm text-blue-700 dark:text-blue-300">Anote o <strong>Instance ID</strong> e <strong>Token</strong> que aparecem na tela</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">4</div>
              <div>
                <p className="font-medium text-blue-800 dark:text-blue-200">Configure Abaixo</p>
                <p className="text-sm text-blue-700 dark:text-blue-300">Cole as credenciais nos campos e seu número no formato 5511999999999</p>
              </div>
            </div>
          </div>
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
              placeholder="ex: 3C4D5E6F"
              value={config.instanceId}
              onChange={(e) => setConfig(prev => ({ ...prev, instanceId: e.target.value.trim() }))}
              className={config.instanceId && config.instanceId.length < 4 ? "border-orange-300" : ""}
            />
            {config.instanceId && config.instanceId.length < 4 && (
              <p className="text-xs text-orange-600">Instance ID geralmente tem pelo menos 4 caracteres</p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="token">Token</Label>
            <Input
              id="token"
              type="password"
              placeholder="Token longo do Z-API..."
              value={config.token}
              onChange={(e) => setConfig(prev => ({ ...prev, token: e.target.value.trim() }))}
              className={config.token && config.token.length < 10 ? "border-orange-300" : ""}
            />
            {config.token && config.token.length < 10 && (
              <p className="text-xs text-orange-600">Token geralmente é uma string longa</p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="phone">Seu Número WhatsApp</Label>
            <Input
              id="phone"
              placeholder="5511999999999"
              value={config.phone}
              onChange={(e) => {
                const cleaned = e.target.value.replace(/\D/g, '');
                setConfig(prev => ({ ...prev, phone: cleaned }));
              }}
              className={config.phone && config.phone.length < 10 ? "border-orange-300" : ""}
            />
            <div className="text-xs text-muted-foreground space-y-1">
              <p>Formato: 55 + DDD + número (apenas números)</p>
              <p>Exemplo: 5511999999999 (Brasil + SP + número)</p>
              {config.phone && config.phone.length < 10 && (
                <p className="text-orange-600">Número parece muito curto</p>
              )}
            </div>
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

      {/* Resumo e Próximos Passos */}
      <Card className="border-green-200 bg-green-50/50 dark:bg-green-900/10">
        <CardHeader>
          <CardTitle className="text-green-800 dark:text-green-200">Sistema Pronto - Próximos Passos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="text-green-800 dark:text-green-200 font-medium">Bot Telegram funcionando com Claude Haiku</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="text-green-800 dark:text-green-200 font-medium">Interface WhatsApp Z-API criada</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="text-green-800 dark:text-green-200 font-medium">Sistema de links de calendário automático</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="text-green-800 dark:text-green-200 font-medium">Processamento inteligente de datas em português</span>
            </div>
          </div>

          <div className="border-t pt-4">
            <h4 className="font-medium text-green-800 dark:text-green-200 mb-2">Para ativar WhatsApp:</h4>
            <ol className="text-sm text-green-700 dark:text-green-300 space-y-1 list-decimal list-inside">
              <li>Acesse https://z-api.io e crie conta gratuita</li>
              <li>Crie uma instância no painel Z-API</li>
              <li>Copie Instance ID e Token</li>
              <li>Cole as credenciais nos campos acima</li>
              <li>Clique "Configurar Z-API" e depois "Conectar WhatsApp"</li>
              <li>Escaneie o QR Code que aparecerá</li>
            </ol>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded p-3">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Custo:</strong> Z-API oferece 100 mensagens grátis por mês. 
              Zelar é totalmente gratuito. Total: R$ 0,00 para começar.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}