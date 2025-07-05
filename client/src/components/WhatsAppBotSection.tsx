import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, MessageCircle, Play, Square } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface WhatsAppStatus {
  connected: boolean;
  message: string;
}

export default function WhatsAppBotSection() {
  const [status, setStatus] = useState<WhatsAppStatus>({ connected: false, message: 'Verificando...' });
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const checkStatus = async () => {
    try {
      const response = await fetch('/api/whatsapp/status');
      const data = await response.json();
      setStatus(data);
    } catch (error) {
      console.error('Erro ao verificar status:', error);
      setStatus({ connected: false, message: 'Erro ao verificar status' });
    }
  };

  const startBot = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/whatsapp/start', { method: 'POST' });
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "WhatsApp Bot Iniciado",
          description: "Bot WhatsApp iniciado com sucesso! Escaneie o QR code no console.",
        });
        setTimeout(checkStatus, 2000); // Aguarda um pouco antes de verificar status
      } else {
        toast({
          title: "Erro",
          description: data.message || "Falha ao iniciar o bot",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao iniciar WhatsApp Bot",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const stopBot = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/whatsapp/stop', { method: 'POST' });
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "WhatsApp Bot Parado",
          description: "Bot WhatsApp parado com sucesso!",
        });
        checkStatus();
      } else {
        toast({
          title: "Erro",
          description: "Falha ao parar o bot",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao parar WhatsApp Bot",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 10000); // Verifica a cada 10 segundos
    return () => clearInterval(interval);
  }, []);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          WhatsApp Bot - Levanter
        </CardTitle>
        <CardDescription>
          Bot WhatsApp com interpretação inteligente usando Claude AI
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Status:</span>
            <Badge variant={status.connected ? "default" : "secondary"}>
              {status.connected ? "Conectado" : "Desconectado"}
            </Badge>
          </div>
          <div className="text-sm text-muted-foreground">
            {status.message}
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={startBot}
            disabled={isLoading || status.connected}
            className="flex items-center gap-2"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Iniciar Bot
          </Button>

          <Button
            onClick={stopBot}
            disabled={isLoading || !status.connected}
            variant="outline"
            className="flex items-center gap-2"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Square className="h-4 w-4" />
            )}
            Parar Bot
          </Button>
        </div>

        <div className="bg-muted p-4 rounded-lg">
          <h4 className="font-medium mb-2">Como funciona:</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Escaneie o QR code que aparece no console</li>
            <li>• Envie mensagens como "Reunião amanhã às 14h"</li>
            <li>• O bot criará automaticamente eventos com Claude AI</li>
            <li>• Receba links diretos para Google Calendar e Outlook</li>
          </ul>
        </div>

        {status.connected && (
          <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
            <p className="text-green-800 text-sm font-medium">
              ✅ WhatsApp Bot ativo! Agora você pode enviar mensagens e criar eventos automaticamente.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}