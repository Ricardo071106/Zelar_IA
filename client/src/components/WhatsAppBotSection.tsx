import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { MessageSquare, Phone, QrCode, Check, X } from 'lucide-react';

interface WhatsAppStatus {
  status: string;
  qrCode?: string;
  connected: boolean;
}

export default function WhatsAppBotSection() {
  const [whatsappStatus, setWhatsappStatus] = useState<WhatsAppStatus>({
    status: 'Desconectado',
    connected: false
  });
  const [loading, setLoading] = useState(false);
  const [testForm, setTestForm] = useState({
    number: '',
    message: ''
  });

  const checkStatus = async () => {
    try {
      const response = await fetch('/api/whatsapp/status');
      if (response.ok) {
        const data = await response.json();
        setWhatsappStatus(data);
      }
    } catch (error) {
      console.error('Erro ao verificar status:', error);
    }
  };

  const startBot = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/whatsapp/start', {
        method: 'POST'
      });
      
      if (response.ok) {
        await checkStatus();
        // Verificar status periodicamente para pegar o QR Code
        setTimeout(checkStatus, 2000);
      }
    } catch (error) {
      console.error('Erro ao iniciar bot:', error);
    } finally {
      setLoading(false);
    }
  };

  const stopBot = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/whatsapp/stop', {
        method: 'POST'
      });
      
      if (response.ok) {
        await checkStatus();
      }
    } catch (error) {
      console.error('Erro ao parar bot:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendTestMessage = async () => {
    if (!testForm.number || !testForm.message) {
      alert('Preencha número e mensagem');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          number: testForm.number,
          message: testForm.message
        })
      });

      if (response.ok) {
        alert('Mensagem enviada com sucesso!');
        setTestForm({ number: '', message: '' });
      } else {
        alert('Erro ao enviar mensagem');
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      alert('Erro de conexão');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();
    // Verificar status periodicamente
    const interval = setInterval(checkStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            WhatsApp Bot
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${
                whatsappStatus.connected ? 'bg-green-500' : 'bg-red-500'
              }`}></div>
              <span className="font-medium">Status: {whatsappStatus.status}</span>
            </div>
            
            <div className="flex gap-2">
              <Button 
                onClick={startBot} 
                disabled={loading || whatsappStatus.connected}
                size="sm"
              >
                {loading ? 'Carregando...' : 'Iniciar Bot'}
              </Button>
              <Button 
                onClick={stopBot} 
                disabled={loading || !whatsappStatus.connected}
                size="sm"
                variant="outline"
              >
                Parar Bot
              </Button>
            </div>
          </div>

          {whatsappStatus.qrCode && !whatsappStatus.connected && (
            <Alert>
              <QrCode className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-medium">Escaneie o QR Code com seu WhatsApp:</p>
                  <div className="bg-white p-4 rounded-lg inline-block">
                    <pre className="text-xs font-mono">{whatsappStatus.qrCode}</pre>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Abra o WhatsApp → Menu → Dispositivos conectados → Conectar dispositivo
                  </p>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {whatsappStatus.connected && (
            <div className="space-y-4">
              <Alert>
                <Check className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-medium">Bot WhatsApp conectado e funcionando!</p>
                    <p className="text-sm text-muted-foreground">
                      Envie "oi" ou "lembrete" para testar as respostas automáticas.
                    </p>
                  </div>
                </AlertDescription>
              </Alert>

              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">Teste de Mensagem</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Número (com código do país)
                    </label>
                    <Input
                      placeholder="Ex: 5511999999999"
                      value={testForm.number}
                      onChange={(e) => setTestForm(prev => ({ ...prev, number: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Mensagem
                    </label>
                    <Textarea
                      placeholder="Digite sua mensagem de teste..."
                      value={testForm.message}
                      onChange={(e) => setTestForm(prev => ({ ...prev, message: e.target.value }))}
                      rows={3}
                    />
                  </div>
                  <Button 
                    onClick={sendTestMessage}
                    disabled={loading || !testForm.number || !testForm.message}
                    className="w-full"
                  >
                    {loading ? 'Enviando...' : 'Enviar Mensagem de Teste'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}