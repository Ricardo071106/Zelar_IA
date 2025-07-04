import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Smartphone, MessageCircle, Settings, CheckCircle, AlertCircle, RefreshCw, Eye, EyeOff } from 'lucide-react';

interface WhatsAppBusinessStatus {
  connected: boolean;
  configured: boolean;
  messageCount: number;
  phoneNumber?: string;
  timestamp: string;
}

export function WhatsAppBusinessSection() {
  const [status, setStatus] = useState<WhatsAppBusinessStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [credentials, setCredentials] = useState({
    phoneNumber: '',
    accessToken: '',
    phoneNumberId: '',
    businessAccountId: ''
  });

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/whatsapp-business/status');
      const data = await response.json();
      setStatus(data);
      setError(null);
    } catch (err) {
      setError('Erro ao buscar status do WhatsApp Business');
    }
  };

  const configureWhatsApp = async () => {
    if (!credentials.phoneNumber || !credentials.accessToken || !credentials.phoneNumberId) {
      setError('Preencha todos os campos obrigatórios');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/whatsapp-business/configure', {
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
      const response = await fetch('/api/whatsapp-business/test', { method: 'POST' });
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

  const sendTestMessage = async () => {
    const testNumber = prompt('Digite o número para teste (formato: 5511999999999):');
    if (!testNumber) return;

    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/whatsapp-business/send-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: testNumber,
          message: 'Olá! Este é um teste do bot Zelar. 🤖'
        })
      });
      const data = await response.json();
      
      if (data.success) {
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

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000); // Atualiza a cada 10 segundos
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
          <Settings className="w-3 h-3 mr-1" />
          Configurado
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
              WhatsApp Business Integration
            </h2>
          </div>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Conecte seu WhatsApp Business usando API oficial do Meta
          </p>
        </div>

        <div className="max-w-2xl mx-auto">
          <Card className="shadow-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center">
                    <MessageCircle className="w-5 h-5 mr-2 text-green-600" />
                    Status do WhatsApp Business
                  </CardTitle>
                  <CardDescription>
                    {status?.connected 
                      ? `Conectado - ${status.messageCount} mensagens enviadas`
                      : status?.configured
                      ? 'Configurado - Pronto para usar'
                      : 'Configure suas credenciais para começar'
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

              {!showConfig ? (
                <div className="space-y-4">
                  {status?.connected ? (
                    <div className="text-center space-y-4">
                      <div className="p-6 bg-green-50 border border-green-200 rounded-lg">
                        <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
                        <h3 className="text-lg font-semibold text-green-800">WhatsApp Business Conectado!</h3>
                        <p className="text-green-700">
                          Número: {status.phoneNumber || 'Configurado'}
                        </p>
                        <p className="text-green-700">
                          API funcionando e pronta para receber mensagens
                        </p>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-center">
                        <div className="p-4 bg-gray-50 rounded-lg">
                          <div className="text-2xl font-bold text-gray-900">{status.messageCount}</div>
                          <div className="text-sm text-gray-600">Mensagens enviadas</div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-lg">
                          <div className="text-2xl font-bold text-green-600">✓</div>
                          <div className="text-sm text-gray-600">API Ativa</div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center space-y-4">
                      <div className="p-6 bg-blue-50 border border-blue-200 rounded-lg">
                        <Settings className="w-12 h-12 text-blue-600 mx-auto mb-3" />
                        <h3 className="text-lg font-semibold text-blue-800">Configure WhatsApp Business API</h3>
                        <p className="text-blue-700 mb-4">
                          Para usar o WhatsApp Business, você precisa configurar as credenciais da API do Meta
                        </p>
                        <div className="text-left space-y-2 max-w-md mx-auto text-sm">
                          <p><strong>Você vai precisar:</strong></p>
                          <ul className="list-disc list-inside text-blue-700">
                            <li>Número de telefone do WhatsApp Business</li>
                            <li>Token de acesso da API do Meta</li>
                            <li>ID do número de telefone</li>
                            <li>ID da conta business (opcional)</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3 justify-center">
                    {!status?.connected && (
                      <Button 
                        onClick={() => setShowConfig(true)} 
                        variant="outline"
                        className="flex items-center"
                      >
                        <Settings className="w-4 h-4 mr-2" />
                        Configurar API
                      </Button>
                    )}
                    
                    {status?.configured && (
                      <Button 
                        onClick={testConnection} 
                        disabled={loading}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {loading ? (
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <CheckCircle className="w-4 h-4 mr-2" />
                        )}
                        Testar Conexão
                      </Button>
                    )}

                    {status?.connected && (
                      <Button 
                        onClick={sendTestMessage} 
                        disabled={loading}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {loading ? (
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <MessageCircle className="w-4 h-4 mr-2" />
                        )}
                        Enviar Teste
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h3 className="font-semibold text-blue-800 mb-2">Como obter as credenciais:</h3>
                    <ol className="text-sm text-blue-700 space-y-1">
                      <li>1. Acesse o Meta Business (business.facebook.com)</li>
                      <li>2. Vá em "WhatsApp Business API"</li>
                      <li>3. Configure seu número de telefone</li>
                      <li>4. Obtenha o token de acesso permanente</li>
                      <li>5. Copie o ID do número de telefone</li>
                    </ol>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="phoneNumber">Número de telefone *</Label>
                      <Input
                        id="phoneNumber"
                        type="tel"
                        placeholder="5511999999999"
                        value={credentials.phoneNumber}
                        onChange={(e) => setCredentials({...credentials, phoneNumber: e.target.value})}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="accessToken">Token de acesso *</Label>
                      <div className="relative">
                        <Input
                          id="accessToken"
                          type={showToken ? "text" : "password"}
                          placeholder="EAAxxxxxxxxxxxxxxx"
                          value={credentials.accessToken}
                          onChange={(e) => setCredentials({...credentials, accessToken: e.target.value})}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2"
                          onClick={() => setShowToken(!showToken)}
                        >
                          {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phoneNumberId">ID do número de telefone *</Label>
                      <Input
                        id="phoneNumberId"
                        type="text"
                        placeholder="1234567890123456"
                        value={credentials.phoneNumberId}
                        onChange={(e) => setCredentials({...credentials, phoneNumberId: e.target.value})}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="businessAccountId">ID da conta business (opcional)</Label>
                      <Input
                        id="businessAccountId"
                        type="text"
                        placeholder="1234567890123456"
                        value={credentials.businessAccountId}
                        onChange={(e) => setCredentials({...credentials, businessAccountId: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 justify-center">
                    <Button 
                      onClick={() => setShowConfig(false)} 
                      variant="outline"
                    >
                      Cancelar
                    </Button>
                    <Button 
                      onClick={configureWhatsApp} 
                      disabled={loading}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {loading ? (
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4 mr-2" />
                      )}
                      Configurar
                    </Button>
                  </div>
                </div>
              )}

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