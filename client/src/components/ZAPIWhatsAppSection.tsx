import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Smartphone, MessageCircle, CheckCircle, AlertCircle, RefreshCw, QrCode, ExternalLink } from 'lucide-react';

interface ZAPIStatus {
  connected: boolean;
  configured: boolean;
  instanceId?: string;
  messageCount: number;
  timestamp: string;
}

export function ZAPIWhatsAppSection() {
  const [status, setStatus] = useState<ZAPIStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [testNumber, setTestNumber] = useState('');

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/zapi/status');
      const data = await response.json();
      setStatus(data);
      setError(null);
    } catch (err) {
      setError('Erro ao buscar status da ZAPI');
    }
  };

  const connectInstance = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/zapi/connect', { method: 'POST' });
      const data = await response.json();
      
      if (data.success) {
        if (data.qrCode) {
          setQrCode(data.qrCode);
        }
        fetchStatus();
      } else {
        setError(data.error || 'Erro ao conectar instância');
      }
    } catch (err) {
      setError('Erro ao conectar instância');
    } finally {
      setLoading(false);
    }
  };

  const sendTestMessage = async () => {
    if (!testNumber.trim()) {
      setError('Digite um número para teste');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/zapi/send-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          phone: testNumber,
          message: '🤖 Olá! Este é um teste do Zelar. Sistema funcionando perfeitamente!'
        })
      });
      const data = await response.json();
      
      if (data.success) {
        setError(null);
        alert('Mensagem enviada com sucesso!');
        fetchStatus();
      } else {
        setError(data.error || 'Erro ao enviar mensagem');
      }
    } catch (err) {
      setError('Erro ao enviar mensagem');
    } finally {
      setLoading(false);
    }
  };

  const restartInstance = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/zapi/restart', { method: 'POST' });
      const data = await response.json();
      
      if (data.success) {
        setQrCode(null);
        fetchStatus();
      } else {
        setError(data.error || 'Erro ao reiniciar instância');
      }
    } catch (err) {
      setError('Erro ao reiniciar instância');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
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
    
    if (status.configured) {
      return (
        <Badge variant="secondary" className="bg-yellow-500 hover:bg-yellow-600">
          <QrCode className="w-3 h-3 mr-1" />
          Aguardando QR
        </Badge>
      );
    }
    
    return (
      <Badge variant="destructive">
        <AlertCircle className="w-3 h-3 mr-1" />
        Não configurado
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
              WhatsApp via ZAPI
            </h2>
          </div>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Conecte seu WhatsApp usando ZAPI - Simples e rápido
          </p>
        </div>

        <div className="max-w-2xl mx-auto">
          <Card className="shadow-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center">
                    <MessageCircle className="w-5 h-5 mr-2 text-green-600" />
                    Status do WhatsApp ZAPI
                  </CardTitle>
                  <CardDescription>
                    {status?.connected 
                      ? `Conectado - ${status.messageCount} mensagens enviadas`
                      : status?.configured
                      ? `Instância configurada: ${status.instanceId}`
                      : 'Configure sua instância ZAPI para começar'
                    }
                  </CardDescription>
                </div>
                {getStatusBadge()}
              </div>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {!status?.configured ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Credenciais ZAPI não encontradas.</strong><br/>
                    Configure ZAPI_INSTANCE_ID e ZAPI_TOKEN nas variáveis de ambiente.<br/>
                    <a 
                      href="https://z-api.io" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 inline-flex items-center"
                    >
                      Criar conta ZAPI <ExternalLink className="w-3 h-3 ml-1" />
                    </a>
                  </AlertDescription>
                </Alert>
              ) : status?.connected ? (
                <div className="text-center space-y-4">
                  <div className="p-6 bg-green-50 border border-green-200 rounded-lg">
                    <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
                    <h3 className="text-lg font-semibold text-green-800">WhatsApp Conectado!</h3>
                    <p className="text-green-700">
                      Instância {status.instanceId} ativa e funcionando
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-gray-900">{status.messageCount}</div>
                      <div className="text-sm text-gray-600">Mensagens enviadas</div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">✓</div>
                      <div className="text-sm text-gray-600">Auto-resposta ativa</div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <Input
                        type="tel"
                        placeholder="5511999999999"
                        value={testNumber}
                        onChange={(e) => setTestNumber(e.target.value)}
                        className="flex-1"
                      />
                      <Button 
                        onClick={sendTestMessage} 
                        disabled={loading}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {loading ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <MessageCircle className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                    <p className="text-sm text-gray-500">Digite um número e clique para enviar mensagem de teste</p>
                  </div>
                </div>
              ) : qrCode ? (
                <div className="text-center space-y-4">
                  <div className="bg-white p-6 rounded-lg border-2 border-green-200 inline-block">
                    <img 
                      src={`data:image/png;base64,${qrCode}`}
                      alt="QR Code WhatsApp" 
                      className="w-64 h-64 mx-auto"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold">Escaneie com WhatsApp:</h3>
                    <ol className="text-left space-y-1 max-w-md mx-auto text-sm">
                      <li>• Abra WhatsApp no celular</li>
                      <li>• Toque em ⋮ → Dispositivos conectados</li>
                      <li>• Toque em "Conectar dispositivo"</li>
                      <li>• Escaneie o QR code acima</li>
                    </ol>
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-gray-600 mb-4">
                    Instância ZAPI configurada. Clique para conectar.
                  </p>
                </div>
              )}

              <div className="flex gap-3 justify-center">
                {status?.configured && !status?.connected && (
                  <Button 
                    onClick={connectInstance} 
                    disabled={loading}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {loading ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <QrCode className="w-4 h-4 mr-2" />
                    )}
                    {qrCode ? 'Gerar Novo QR' : 'Conectar WhatsApp'}
                  </Button>
                )}
                
                {status?.configured && (
                  <Button 
                    onClick={restartInstance} 
                    disabled={loading}
                    variant="outline"
                  >
                    {loading ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-2" />
                    )}
                    Reiniciar
                  </Button>
                )}
              </div>

              <div className="text-center text-sm text-gray-500">
                Status atualizado automaticamente a cada 10 segundos
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}