import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, XCircle, Loader2, RefreshCw, Settings } from 'lucide-react';

interface ZAPIStatus {
  connected: boolean;
  message: string;
}

export default function WhatsAppAuto() {
  const [status, setStatus] = useState<ZAPIStatus>({ connected: false, message: 'Verificando...' });
  const [loading, setLoading] = useState(false);
  const [qrCode, setQrCode] = useState<string>('');
  const { toast } = useToast();

  const checkStatus = async () => {
    try {
      const response = await fetch('/api/zapi/status');
      const data = await response.json();
      setStatus(data);
    } catch (error) {
      console.error('Erro ao verificar status:', error);
      setStatus({ connected: false, message: 'Erro de conexão' });
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
          title: "QR Code gerado",
          description: "Escaneie com seu WhatsApp"
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
        <h1 className="text-2xl font-bold">WhatsApp Business - Automático</h1>
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
              <p className="text-xs text-muted-foreground">
                WhatsApp → Menu → Dispositivos Conectados → Conectar Dispositivo
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuração Automática */}
      <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-900/10">
        <CardHeader>
          <CardTitle className="text-blue-800 dark:text-blue-200 flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Configuração Automática
          </CardTitle>
          <CardDescription className="text-blue-700 dark:text-blue-300">
            WhatsApp configurado automaticamente via secrets (igual ao Telegram)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="text-green-800 dark:text-green-200 font-medium">ZAPI_INSTANCE_ID configurado</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="text-green-800 dark:text-green-200 font-medium">ZAPI_TOKEN configurado</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="text-green-800 dark:text-green-200 font-medium">Webhook automático: /api/zapi/webhook</span>
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
      <Card className="border-green-200 bg-green-50/50 dark:bg-green-900/10">
        <CardHeader>
          <CardTitle className="text-green-800 dark:text-green-200">Como Funciona</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="text-sm">
              <h4 className="font-medium text-green-800 dark:text-green-200">1. Conecte o WhatsApp</h4>
              <p className="text-green-700 dark:text-green-300">Clique "Conectar WhatsApp" e escaneie o QR Code</p>
            </div>
            
            <div className="text-sm">
              <h4 className="font-medium text-green-800 dark:text-green-200">2. Envie Mensagens</h4>
              <p className="text-green-700 dark:text-green-300">Mande "reunião amanhã às 15h" para seu número</p>
            </div>
            
            <div className="text-sm">
              <h4 className="font-medium text-green-800 dark:text-green-200">3. Receba Links</h4>
              <p className="text-green-700 dark:text-green-300">Bot responde com links para Google Calendar e Outlook</p>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded p-3">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Webhook URL:</strong> {window.location.origin}/api/zapi/webhook
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
              Configure no painel Z-API se necessário
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}