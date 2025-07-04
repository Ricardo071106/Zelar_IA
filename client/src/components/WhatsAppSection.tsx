import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Smartphone, MessageCircle, Settings, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

interface WhatsAppStatus {
  connected: boolean;
  configured: boolean;
  messageCount: number;
  timestamp: string;
}

export function WhatsAppSection() {
  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [credentials, setCredentials] = useState({
    phoneNumber: '',
    accessToken: '',
    phoneNumberId: '',
    businessAccountId: ''
  });

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/whatsapp/status');
      const data = await response.json();
      setStatus(data);
      setError(null);
    } catch (err) {
      setError('Erro ao buscar status do WhatsApp');
    }
  };

  const configureWhatsApp = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/whatsapp/configure', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(credentials)
      });
      const data = await response.json();
      
      if (data.success) {
        setShowConfig(false);
        fetchStatus();
      } else {
        setError(data.error || 'Erro ao configurar WhatsApp Business');
      }
    } catch (err) {
      setError('Erro ao configurar WhatsApp Business');
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/whatsapp/test', { method: 'POST' });
      const data = await response.json();
      
      if (data.success) {
        fetchStatus();
      } else {
        setError(data.error || 'Erro ao testar conexão');
      }
    } catch (err) {
      setError('Erro ao testar conexão');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    generateQR();
    
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const getStatusBadge = () => {
    if (!status) return <Badge variant="secondary">Carregando...</Badge>;
    
    if (status.connected) {
      return (
        <Badge variant="default" className="bg-green-500 hover:bg-green-600">
          <CheckCircle className="w-3 h-3 mr-1" />
          Conectado
        </Badge>
      );
    }
    
    if (status.hasQR) {
      return (
        <Badge variant="secondary" className="bg-yellow-500 hover:bg-yellow-600">
          <QrCode className="w-3 h-3 mr-1" />
          Aguardando
        </Badge>
      );
    }
    
    return (
      <Badge variant="destructive">
        <AlertCircle className="w-3 h-3 mr-1" />
        Desconectado
      </Badge>
    );
  };

  return (
    <section className="py-20 bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-950 dark:to-emerald-950">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-4">
            <Smartphone className="w-12 h-12 text-green-600 mr-3" />
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white">
              WhatsApp Integration
            </h2>
          </div>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Conecte seu WhatsApp ao Zelar para receber notificações e respostas automáticas
          </p>
        </div>

        <div className="max-w-2xl mx-auto">
          <Card className="shadow-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center">
                    <MessageCircle className="w-5 h-5 mr-2 text-green-600" />
                    Status do WhatsApp
                  </CardTitle>
                  <CardDescription>
                    {status?.connected 
                      ? `Conectado - ${status.messageCount} mensagens processadas`
                      : 'Conecte seu WhatsApp para ativar as funcionalidades'
                    }
                  </CardDescription>
                </div>
                {getStatusBadge()}
              </div>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}

              {status?.connected ? (
                <div className="text-center space-y-4">
                  <div className="p-6 bg-green-50 border border-green-200 rounded-lg">
                    <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
                    <h3 className="text-lg font-semibold text-green-800">WhatsApp Conectado!</h3>
                    <p className="text-green-700">
                      Seu WhatsApp está conectado e funcionando. O bot responderá automaticamente às mensagens.
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-gray-900">{status.messageCount}</div>
                      <div className="text-sm text-gray-600">Mensagens</div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">✓</div>
                      <div className="text-sm text-gray-600">Auto-resposta</div>
                    </div>
                  </div>
                </div>
              ) : qrCode ? (
                <div className="text-center space-y-4">
                  <div className="bg-white p-6 rounded-lg border-2 border-green-200 inline-block">
                    <img 
                      src={qrCode} 
                      alt="QR Code WhatsApp" 
                      className="w-64 h-64 mx-auto"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold">Como conectar:</h3>
                    <ol className="text-left space-y-1 max-w-md mx-auto">
                      <li className="flex items-start">
                        <span className="bg-green-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center mr-2 mt-0.5">1</span>
                        Abra o WhatsApp no seu celular
                      </li>
                      <li className="flex items-start">
                        <span className="bg-green-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center mr-2 mt-0.5">2</span>
                        Toque em Menu → Dispositivos conectados
                      </li>
                      <li className="flex items-start">
                        <span className="bg-green-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center mr-2 mt-0.5">3</span>
                        Toque em "Conectar dispositivo"
                      </li>
                      <li className="flex items-start">
                        <span className="bg-green-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center mr-2 mt-0.5">4</span>
                        Escaneie o QR Code acima
                      </li>
                    </ol>
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-gray-600 mb-4">Gere um QR Code para conectar seu WhatsApp</p>
                </div>
              )}

              <div className="flex gap-3 justify-center">
                {!status?.connected && (
                  <Button 
                    onClick={generateQR} 
                    disabled={loading}
                    variant="outline"
                    className="flex items-center"
                  >
                    {loading ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <QrCode className="w-4 h-4 mr-2" />
                    )}
                    {qrCode ? 'Gerar Novo QR' : 'Gerar QR Code'}
                  </Button>
                )}
                
                <Button 
                  onClick={simulateConnection} 
                  disabled={loading}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4 mr-2" />
                  )}
                  {status?.connected ? 'Reconectar' : 'Testar Conexão'}
                </Button>
              </div>

              <div className="text-center text-sm text-gray-500">
                Status atualizado automaticamente a cada 5 segundos
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}