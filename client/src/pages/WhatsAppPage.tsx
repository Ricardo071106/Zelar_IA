import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { MessageSquare, Phone, QrCode, Check, X, RefreshCw } from 'lucide-react';
import Header from '@/components/Header';

interface WhatsAppStatus {
  status: string;
  qrCode?: string;
  qrCodeImage?: string;
  connected: boolean;
}

export default function WhatsAppPage() {
  const [whatsappStatus, setWhatsappStatus] = useState<WhatsAppStatus>({
    status: 'Desconectado',
    connected: false
  });
  const [loading, setLoading] = useState(false);
  const [testForm, setTestForm] = useState({
    number: '',
    message: 'Olá! Este é um teste do bot Zelar 🦾'
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
        const interval = setInterval(async () => {
          await checkStatus();
          if (whatsappStatus.connected) {
            clearInterval(interval);
          }
        }, 2000);
        
        // Limpar interval após 2 minutos
        setTimeout(() => clearInterval(interval), 120000);
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
        setTestForm({ ...testForm, number: '' });
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
    // Verificar status a cada 10 segundos
    const interval = setInterval(checkStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          
          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold text-green-800">WhatsApp Bot Zelar</h1>
            <p className="text-xl text-gray-600">
              Configure e use o assistente inteligente no WhatsApp
            </p>
          </div>

          {/* Status Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Status do Bot WhatsApp
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full ${
                    whatsappStatus.connected ? 'bg-green-500' : 'bg-red-500'
                  }`}></div>
                  <span className="font-semibold text-lg">
                    {whatsappStatus.status}
                  </span>
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    onClick={checkStatus}
                    size="sm"
                    variant="outline"
                    disabled={loading}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Atualizar
                  </Button>
                  
                  <Button 
                    onClick={startBot} 
                    disabled={loading || whatsappStatus.connected}
                    size="sm"
                  >
                    {loading ? 'Iniciando...' : 'Iniciar Bot'}
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
            </CardContent>
          </Card>

          {/* QR Code */}
          {(whatsappStatus.qrCode || whatsappStatus.qrCodeImage) && !whatsappStatus.connected && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <QrCode className="h-5 w-5" />
                  QR Code para Conexão
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Alert>
                  <AlertDescription>
                    <div className="space-y-6">
                      <div className="text-center">
                        <p className="font-medium text-lg mb-4">
                          Escaneie este QR Code com seu WhatsApp:
                        </p>
                        
                        {whatsappStatus.qrCodeImage ? (
                          <div className="flex justify-center">
                            <div className="bg-white p-6 rounded-xl shadow-lg border-2 border-green-200">
                              <img 
                                src={whatsappStatus.qrCodeImage} 
                                alt="QR Code WhatsApp" 
                                className="w-80 h-80 object-contain"
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="bg-white p-4 rounded-lg">
                            <pre className="text-xs font-mono break-all whitespace-pre-wrap">
                              {whatsappStatus.qrCode}
                            </pre>
                          </div>
                        )}
                      </div>
                      
                      <div className="bg-green-50 p-4 rounded-lg">
                        <h4 className="font-semibold text-green-800 mb-2">Como conectar:</h4>
                        <ol className="list-decimal list-inside space-y-1 text-green-700">
                          <li>Abra o WhatsApp no seu celular</li>
                          <li>Toque no menu (3 pontos) → <strong>Dispositivos conectados</strong></li>
                          <li>Toque em <strong>Conectar dispositivo</strong></li>
                          <li>Aponte a câmera para o QR Code acima</li>
                        </ol>
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          )}

          {/* Connected Status */}
          {whatsappStatus.connected && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-600" />
                  Bot Conectado com Sucesso!
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Alert>
                  <AlertDescription>
                    <div className="space-y-3">
                      <p className="font-medium text-green-800">
                        🎉 Seu WhatsApp está conectado ao Zelar!
                      </p>
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <h4 className="font-semibold text-blue-800 mb-2">Como usar:</h4>
                        <ul className="list-disc list-inside space-y-1 text-blue-700">
                          <li>Envie <strong>"oi"</strong> ou <strong>"olá"</strong> para iniciar uma conversa</li>
                          <li>Envie qualquer mensagem com a palavra <strong>"lembrete"</strong> para criar um lembrete</li>
                          <li>O bot responderá automaticamente a todas as mensagens</li>
                        </ul>
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>

                {/* Test Message Section */}
                <div className="mt-6 border-t pt-6">
                  <h4 className="font-semibold mb-4">Enviar Mensagem de Teste</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Número do WhatsApp (com código do país)
                      </label>
                      <Input
                        placeholder="Ex: 5511999999999"
                        value={testForm.number}
                        onChange={(e) => setTestForm(prev => ({ ...prev, number: e.target.value }))}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Formato: código do país + DDD + número (sem espaços ou símbolos)
                      </p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Mensagem
                      </label>
                      <Textarea
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
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}