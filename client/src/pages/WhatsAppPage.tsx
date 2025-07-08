import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  MessageSquare, 
  QrCode, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  RefreshCw,
  Phone,
  Send,
  Bot
} from 'lucide-react';
import Header from '@/components/Header';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface WhatsAppStatus {
  connected: boolean;
  status: string;
  qrCode: string;
  qrCodeImage: string;
  hasQrCode: boolean;
  hasQrCodeImage: boolean;
}

export default function WhatsAppPage() {
  const [status, setStatus] = useState<WhatsAppStatus>({
    connected: false,
    status: 'disconnected',
    qrCode: '',
    qrCodeImage: '',
    hasQrCode: false,
    hasQrCodeImage: false
  });
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  // Polling para status
  useEffect(() => {
    const interval = setInterval(fetchStatus, 2000);
    fetchStatus();
    return () => clearInterval(interval);
  }, []);

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/whatsapp/status');
      const data = await response.json();
      setStatus(data);
    } catch (error) {
      console.error('Erro ao buscar status:', error);
    }
  };

  const startBot = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/whatsapp/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      
      if (data.success) {
        setTimeout(fetchStatus, 1000);
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      
      if (data.success) {
        setTimeout(fetchStatus, 1000);
      }
    } catch (error) {
      console.error('Erro ao parar bot:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendTestMessage = async () => {
    if (!phone || !message) return;
    
    setSendingMessage(true);
    try {
      const response = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, message })
      });
      const data = await response.json();
      
      if (data.success) {
        setMessage('');
        alert('Mensagem enviada com sucesso!');
      } else {
        alert('Erro ao enviar mensagem');
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      alert('Erro ao enviar mensagem');
    } finally {
      setSendingMessage(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'qr_code':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'authenticated':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'disconnected':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-red-100 text-red-800 border-red-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="h-4 w-4" />;
      case 'qr_code':
        return <QrCode className="h-4 w-4" />;
      case 'authenticated':
        return <CheckCircle className="h-4 w-4" />;
      case 'disconnected':
        return <XCircle className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="container mx-auto px-4 py-8 pt-24">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">WhatsApp Bot</h1>
            <p className="text-gray-600">Gerencie e monitore o bot WhatsApp do Zelar</p>
          </div>

          <Tabs defaultValue="status" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="status">Status</TabsTrigger>
              <TabsTrigger value="qr">QR Code</TabsTrigger>
              <TabsTrigger value="test">Testar</TabsTrigger>
            </TabsList>

            <TabsContent value="status">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bot className="h-5 w-5" />
                    Status do Bot
                  </CardTitle>
                  <CardDescription>
                    Monitore o status de conexão do WhatsApp
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(status.status)}
                      <div>
                        <p className="font-medium">Status da Conexão</p>
                        <Badge className={getStatusColor(status.status)}>
                          {status.status}
                        </Badge>
                      </div>
                    </div>
                    <Button
                      onClick={fetchStatus}
                      variant="outline"
                      size="sm"
                      disabled={loading}
                    >
                      <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                      Atualizar
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Button
                      onClick={startBot}
                      disabled={loading || status.connected}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {loading ? 'Iniciando...' : 'Iniciar Bot'}
                    </Button>
                    <Button
                      onClick={stopBot}
                      disabled={loading || !status.connected}
                      variant="destructive"
                    >
                      {loading ? 'Parando...' : 'Parar Bot'}
                    </Button>
                  </div>

                  {status.status === 'qr_code' && (
                    <Alert>
                      <QrCode className="h-4 w-4" />
                      <AlertDescription>
                        QR Code gerado! Vá para a aba "QR Code" para escanear.
                      </AlertDescription>
                    </Alert>
                  )}

                  {status.connected && (
                    <Alert>
                      <CheckCircle className="h-4 w-4" />
                      <AlertDescription>
                        Bot conectado e funcionando! Envie mensagens para testar.
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="qr">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <QrCode className="h-5 w-5" />
                    QR Code
                  </CardTitle>
                  <CardDescription>
                    Escaneie o QR Code com o WhatsApp para conectar
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {status.hasQrCodeImage ? (
                    <div className="text-center space-y-4">
                      <div className="inline-block p-4 bg-white rounded-lg shadow-sm border">
                        <img 
                          src={status.qrCodeImage}
                          alt="QR Code WhatsApp"
                          className="w-80 h-80"
                        />
                      </div>
                      <div className="text-sm text-gray-600 max-w-md mx-auto">
                        <div className="bg-blue-50 p-4 rounded-lg">
                          <h4 className="font-medium text-blue-900 mb-2">Como conectar:</h4>
                          <ol className="text-left space-y-1">
                            <li>1. Abra o WhatsApp no seu celular</li>
                            <li>2. Toque em "Mais opções" (⋮) → "Dispositivos conectados"</li>
                            <li>3. Toque em "Conectar um dispositivo"</li>
                            <li>4. Aponte a câmera para este QR Code</li>
                          </ol>
                        </div>
                        <div className="mt-4">
                          <Button
                            onClick={async () => {
                              try {
                                const response = await fetch('/api/whatsapp/simulate-connection', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' }
                                });
                                if (response.ok) {
                                  await refreshStatus();
                                }
                              } catch (error) {
                                console.error('Erro ao simular conexão:', error);
                              }
                            }}
                            className="w-full"
                            variant="outline"
                          >
                            ⚡ Simular Conexão (Demo)
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : status.connected ? (
                    <div className="text-center py-8">
                      <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                      <p className="text-lg font-medium">Bot Conectado!</p>
                      <p className="text-gray-600">WhatsApp está conectado e funcionando</p>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <QrCode className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                      <p className="text-lg font-medium">QR Code não disponível</p>
                      <p className="text-gray-600">Inicie o bot para gerar o QR Code</p>
                      <Button onClick={startBot} className="mt-4">
                        Iniciar Bot
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="test">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Send className="h-5 w-5" />
                    Testar Mensagem
                  </CardTitle>
                  <CardDescription>
                    Envie uma mensagem de teste para um número
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Número (com DDD)
                      </label>
                      <Input
                        placeholder="Ex: 5511999999999"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        disabled={!status.connected}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Status
                      </label>
                      <div className="flex items-center gap-2 py-2">
                        {getStatusIcon(status.status)}
                        <span className="text-sm">{status.status}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Mensagem
                    </label>
                    <Textarea
                      placeholder="Digite sua mensagem de teste..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      disabled={!status.connected}
                      rows={4}
                    />
                  </div>

                  <Button
                    onClick={sendTestMessage}
                    disabled={!status.connected || !phone || !message || sendingMessage}
                    className="w-full"
                  >
                    {sendingMessage ? 'Enviando...' : 'Enviar Mensagem'}
                  </Button>

                  {!status.connected && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Bot não conectado. Conecte primeiro para enviar mensagens.
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}