import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { MessageSquare, Phone, QrCode, Send, CheckCircle, XCircle, Clock, RefreshCw } from 'lucide-react';
import Header from '@/components/Header';

interface WhatsAppStatus {
  connected: boolean;
  ready: boolean;
  qrCode?: string;
  qrCodeImage?: string;
}

export default function WhatsAppPage() {
  const [status, setStatus] = useState<WhatsAppStatus>({
    connected: false,
    ready: false
  });
  const [isInitializing, setIsInitializing] = useState(false);
  const [testForm, setTestForm] = useState({
    number: '',
    message: 'Olá! Este é um teste do bot Zelar. 🤖'
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

  const checkStatus = async () => {
    try {
      const response = await fetch('/api/whatsapp/status');
      const data = await response.json();
      
      if (data.success) {
        setStatus({
          connected: data.connected,
          ready: data.ready,
          qrCode: data.qrCode,
          qrCodeImage: data.qrCodeImage
        });
      }
    } catch (error) {
      console.error('Erro ao verificar status:', error);
    }
  };

  const initializeBot = async () => {
    try {
      setIsInitializing(true);
      addTestResult('info', 'Inicializando WhatsApp Bot...');
      
      const response = await fetch('/api/whatsapp/initialize', {
        method: 'POST'
      });
      
      const data = await response.json();
      
      if (data.success) {
        addTestResult('success', 'Bot inicializado com sucesso!');
        // Verificar status após inicialização
        setTimeout(checkStatus, 2000);
      } else {
        addTestResult('error', `Erro: ${data.error}`);
      }
    } catch (error) {
      addTestResult('error', `Erro de conexão: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setIsInitializing(false);
    }
  };

  const sendTestMessage = async () => {
    if (!testForm.number || !testForm.message) {
      addTestResult('error', 'Preencha o número e a mensagem');
      return;
    }

    try {
      const response = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          number: testForm.number,
          message: testForm.message
        })
      });

      const result = await response.json();
      if (result.success) {
        addTestResult('success', `Mensagem enviada para ${testForm.number}`);
        setTestForm({ ...testForm, number: '' });
      } else {
        addTestResult('error', `Erro: ${result.error}`);
      }
    } catch (error) {
      addTestResult('error', `Erro de conexão: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  };

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const getStatusBadge = () => {
    if (status.ready) {
      return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" /> Conectado</Badge>;
    } else if (status.qrCode) {
      return <Badge className="bg-yellow-500"><QrCode className="w-3 h-3 mr-1" /> Aguardando QR</Badge>;
    } else {
      return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Desconectado</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="container mx-auto px-4 py-8 pt-24">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              WhatsApp Bot Zelar
            </h1>
            <p className="text-xl text-gray-600">
              Assistente inteligente para criação de eventos via WhatsApp
            </p>
          </div>

          {/* Status Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="w-5 h-5" />
                Status do WhatsApp Bot
              </CardTitle>
              <CardDescription>
                Status atual da conexão com o WhatsApp
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-4">
                {getStatusBadge()}
                <div className="flex gap-2">
                  <Button 
                    onClick={checkStatus}
                    size="sm"
                    variant="outline"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Atualizar
                  </Button>
                  <Button 
                    onClick={initializeBot}
                    disabled={isInitializing || status.ready}
                    size="sm"
                  >
                    {isInitializing ? (
                      <>
                        <Clock className="w-4 h-4 mr-2 animate-spin" />
                        Inicializando...
                      </>
                    ) : (
                      <>
                        <Phone className="w-4 h-4 mr-2" />
                        Conectar
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* QR Code */}
              {status.qrCode && status.qrCodeImage && (
                <div className="mt-6 p-4 bg-white border rounded-lg">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <QrCode className="w-5 h-5" />
                    Escaneie o QR Code no WhatsApp
                  </h3>
                  <div className="flex flex-col items-center gap-4">
                    <img 
                      src={status.qrCodeImage} 
                      alt="QR Code para conectar WhatsApp" 
                      className="w-64 h-64 border"
                    />
                    <div className="text-sm text-gray-600 text-center">
                      <p>1. Abra o WhatsApp no seu celular</p>
                      <p>2. Vá em <strong>Configurações → Dispositivos conectados</strong></p>
                      <p>3. Toque em <strong>Conectar um dispositivo</strong></p>
                      <p>4. Escaneie este QR Code</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Status conectado */}
              {status.ready && (
                <Alert className="mt-4">
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    WhatsApp conectado com sucesso! O bot está pronto para receber mensagens.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Teste de Mensagem */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Teste de Mensagem
              </CardTitle>
              <CardDescription>
                Envie uma mensagem de teste para verificar se o bot está funcionando
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Número do WhatsApp (com código do país)
                  </label>
                  <Input
                    placeholder="Ex: 5511999999999"
                    value={testForm.number}
                    onChange={(e) => setTestForm({ ...testForm, number: e.target.value })}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Mensagem
                  </label>
                  <Textarea
                    placeholder="Digite sua mensagem de teste..."
                    value={testForm.message}
                    onChange={(e) => setTestForm({ ...testForm, message: e.target.value })}
                    rows={3}
                  />
                </div>

                <Button 
                  onClick={sendTestMessage}
                  disabled={!status.ready || !testForm.number || !testForm.message}
                  className="w-full"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Enviar Mensagem
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Resultados dos Testes */}
          {testResults.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Resultados dos Testes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {testResults.map((result, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
                      <div className="flex-shrink-0 mt-1">
                        {result.type === 'success' && <CheckCircle className="w-4 h-4 text-green-500" />}
                        {result.type === 'error' && <XCircle className="w-4 h-4 text-red-500" />}
                        {result.type === 'info' && <Clock className="w-4 h-4 text-blue-500" />}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm">{result.message}</p>
                        <p className="text-xs text-gray-500 mt-1">{result.timestamp}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Instruções */}
          <Card>
            <CardHeader>
              <CardTitle>Como usar o bot</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Para usuários finais:</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Envie mensagens como "Reunião amanhã às 14h"</li>
                    <li>• O bot criará automaticamente um evento no calendário</li>
                    <li>• Você receberá links para adicionar ao Google Calendar, Outlook, etc.</li>
                  </ul>
                </div>
                
                <Separator />
                
                <div>
                  <h4 className="font-semibold mb-2">Exemplos de mensagens:</h4>
                  <div className="bg-gray-50 p-3 rounded text-sm">
                    <p>• "Consulta médica sexta às 10h30"</p>
                    <p>• "Jantar com a família domingo às 19h"</p>
                    <p>• "Apresentação do projeto segunda às 9h"</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}