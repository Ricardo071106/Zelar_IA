import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, XCircle, Loader2, Copy, RefreshCw } from 'lucide-react';

interface WhatsAppStatus {
  connected: boolean;
  qrCode?: string;
}

interface WhatsAppConfig {
  baseUrl: string;
  instanceName: string;
  apiKey: string;
}

interface Instance {
  instanceName: string;
  status: string;
  serverUrl: string;
  apikey: string;
}

export default function WhatsAppAdmin() {
  const [config, setConfig] = useState<WhatsAppConfig>({
    baseUrl: '',
    instanceName: '',
    apiKey: ''
  });
  
  const [status, setStatus] = useState<WhatsAppStatus>({ connected: false });
  const [loading, setLoading] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [instances, setInstances] = useState<Instance[]>([]);
  const [newInstanceName, setNewInstanceName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const { toast } = useToast();

  // Gerar URL do webhook automaticamente
  useEffect(() => {
    const currentUrl = window.location.origin;
    setWebhookUrl(`${currentUrl}/api/whatsapp/webhook`);
  }, []);

  const handleSetupEvolution = async () => {
    if (!config.baseUrl || !config.instanceName || !config.apiKey) {
      toast({
        title: "Erro",
        description: "Todos os campos são obrigatórios",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/whatsapp/setup', {
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
          description: "Evolution API configurada com sucesso"
        });
        checkStatus();
      } else {
        toast({
          title: "Erro",
          description: data.error || "Falha ao configurar Evolution API",
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
      const response = await fetch('/api/whatsapp/status');
      const data = await response.json();
      setStatus(data);
    } catch (error) {
      console.error('Erro ao verificar status:', error);
    }
  };

  const setupWebhook = async () => {
    if (!webhookUrl) {
      toast({
        title: "Erro",
        description: "URL do webhook é obrigatória",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/whatsapp/configure-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ webhookUrl })
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Sucesso",
          description: "Webhook configurado com sucesso"
        });
      } else {
        toast({
          title: "Erro",
          description: data.error || "Falha ao configurar webhook",
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado",
      description: "Texto copiado para a área de transferência"
    });
  };

  const createNewInstance = async () => {
    if (!newInstanceName) {
      toast({
        title: "Erro",
        description: "Nome da instância é obrigatório",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/whatsapp/create-instance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          instanceName: newInstanceName,
          phone: phoneNumber || undefined
        })
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Sucesso",
          description: "Instância criada com sucesso"
        });
        setNewInstanceName('');
        setPhoneNumber('');
        loadInstances();
        
        // Atualizar config com nova instância
        setConfig(prev => ({ ...prev, instanceName: newInstanceName }));
        
        if (data.qrCode) {
          setStatus({ connected: false, qrCode: data.qrCode });
        }
      } else {
        toast({
          title: "Erro",
          description: data.message || "Falha ao criar instância",
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

  const connectToInstance = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/whatsapp/connect', {
        method: 'POST'
      });

      const data = await response.json();

      if (data.success) {
        setStatus({ connected: false, qrCode: data.qrCode });
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

  const loadInstances = async () => {
    try {
      const response = await fetch('/api/whatsapp/instances');
      const data = await response.json();

      if (data.success) {
        setInstances(data.instances || []);
      }
    } catch (error) {
      console.error('Erro ao carregar instâncias:', error);
    }
  };

  const deleteInstanceById = async (instanceName: string) => {
    if (!confirm(`Tem certeza que deseja deletar a instância ${instanceName}?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/whatsapp/instances/${instanceName}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Sucesso",
          description: "Instância deletada com sucesso"
        });
        loadInstances();
      } else {
        toast({
          title: "Erro",
          description: data.message || "Falha ao deletar instância",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro de conexão com o servidor",
        variant: "destructive"
      });
    }
  };

  // Verificar status automaticamente a cada 30 segundos e carregar instâncias
  useEffect(() => {
    const interval = setInterval(() => {
      checkStatus();
      loadInstances();
    }, 30000);
    
    checkStatus(); // Verificar imediatamente
    loadInstances(); // Carregar instâncias imediatamente
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">WhatsApp Business - Evolution API</h1>
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
          {!status.connected && status.qrCode && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Escaneie o QR Code abaixo com o WhatsApp:
              </p>
              <div className="bg-white p-4 rounded-lg inline-block">
                <img 
                  src={`data:image/png;base64,${status.qrCode}`} 
                  alt="QR Code WhatsApp" 
                  className="w-64 h-64"
                />
              </div>
            </div>
          )}
          
          {!status.connected && !status.qrCode && (
            <p className="text-sm text-muted-foreground">
              Configure a Evolution API abaixo para conectar o WhatsApp
            </p>
          )}
          
          {status.connected && (
            <p className="text-sm text-green-600">
              WhatsApp Business conectado e funcionando
            </p>
          )}
        </CardContent>
      </Card>

      {/* Criar Nova Instância */}
      <Card>
        <CardHeader>
          <CardTitle>Criar Nova Instância WhatsApp</CardTitle>
          <CardDescription>
            Cadastre seu número no WhatsApp Business através da Evolution API
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="newInstanceName">Nome da Instância</Label>
              <Input
                id="newInstanceName"
                placeholder="meu-whatsapp-bot"
                value={newInstanceName}
                onChange={(e) => setNewInstanceName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Identificador único para sua instância
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Número do WhatsApp (Opcional)</Label>
              <Input
                id="phoneNumber"
                placeholder="5511999999999"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Número com código do país (apenas números)
              </p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button 
              onClick={createNewInstance} 
              disabled={loading}
              className="flex-1"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                'Criar Instância'
              )}
            </Button>
            
            <Button 
              onClick={connectToInstance} 
              disabled={loading}
              variant="outline"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Gerar QR Code'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Instâncias */}
      {instances.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Instâncias Ativas</CardTitle>
            <CardDescription>
              Gerencie suas instâncias do WhatsApp
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {instances.map((instance) => (
                <div 
                  key={instance.instanceName}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="font-medium">{instance.instanceName}</div>
                    <div className="text-sm text-muted-foreground">
                      Status: {instance.status}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant={instance.status === 'open' ? 'default' : 'secondary'}
                      className={instance.status === 'open' ? 'bg-green-500' : ''}
                    >
                      {instance.status === 'open' ? 'Conectado' : 'Desconectado'}
                    </Badge>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setConfig(prev => ({ ...prev, instanceName: instance.instanceName }));
                        toast({
                          title: "Instância Selecionada",
                          description: `Agora usando: ${instance.instanceName}`
                        });
                      }}
                    >
                      Usar
                    </Button>
                    
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteInstanceById(instance.instanceName)}
                    >
                      Deletar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Configuração da Evolution API */}
      <Card>
        <CardHeader>
          <CardTitle>Configuração da Evolution API</CardTitle>
          <CardDescription>
            Configure os parâmetros da sua instância Evolution API
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="baseUrl">URL Base da Evolution API</Label>
              <Input
                id="baseUrl"
                type="url"
                placeholder="https://api.evolution.com"
                value={config.baseUrl}
                onChange={(e) => setConfig(prev => ({ ...prev, baseUrl: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="instanceName">Nome da Instância</Label>
              <Input
                id="instanceName"
                placeholder="minha-instancia"
                value={config.instanceName}
                onChange={(e) => setConfig(prev => ({ ...prev, instanceName: e.target.value }))}
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key</Label>
            <Input
              id="apiKey"
              type="password"
              placeholder="sua-api-key-aqui"
              value={config.apiKey}
              onChange={(e) => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
            />
          </div>
          
          <Button 
            onClick={handleSetupEvolution} 
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Configurando...
              </>
            ) : (
              'Configurar Evolution API'
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Configuração do Webhook */}
      <Card>
        <CardHeader>
          <CardTitle>Configuração do Webhook</CardTitle>
          <CardDescription>
            Configure o webhook para receber mensagens do WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="webhookUrl">URL do Webhook</Label>
            <div className="flex gap-2">
              <Input
                id="webhookUrl"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                readOnly
              />
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => copyToClipboard(webhookUrl)}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Use esta URL na configuração do webhook da Evolution API
            </p>
          </div>
          
          <Button 
            onClick={setupWebhook} 
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Configurando...
              </>
            ) : (
              'Configurar Webhook'
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Instruções */}
      <Card>
        <CardHeader>
          <CardTitle>Como Usar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium">1. Configure a Evolution API</h4>
            <p className="text-sm text-muted-foreground">
              Insira a URL base e API key do seu servidor Evolution API
            </p>
          </div>
          
          <div className="space-y-2">
            <h4 className="font-medium">2. Crie uma Nova Instância</h4>
            <p className="text-sm text-muted-foreground">
              Cadastre seu número criando uma nova instância WhatsApp
            </p>
          </div>
          
          <div className="space-y-2">
            <h4 className="font-medium">3. Escaneie o QR Code</h4>
            <p className="text-sm text-muted-foreground">
              Use o WhatsApp do seu celular para escanear o QR Code e conectar
            </p>
          </div>
          
          <div className="space-y-2">
            <h4 className="font-medium">4. Configure o Webhook</h4>
            <p className="text-sm text-muted-foreground">
              O webhook será configurado automaticamente para receber mensagens
            </p>
          </div>
          
          <div className="space-y-2">
            <h4 className="font-medium">5. Teste o Bot</h4>
            <p className="text-sm text-muted-foreground">
              Envie mensagens como "me lembre de reunião amanhã às 15h" e receba links de calendário
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}