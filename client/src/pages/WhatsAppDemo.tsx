import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, MessageCircle, Bot, CheckCircle, XCircle } from 'lucide-react';

interface WhatsAppInfo {
  phoneNumber: string;
  connected: boolean;
  whatsappWebUrl: string;
  bestOption: {
    method: string;
    url: string;
    description: string;
    isWorking: boolean;
  };
  workingSolutions: Array<{
    method: string;
    url: string;
    description: string;
    isWorking: boolean;
  }>;
  zapiStatus: {
    isActive: boolean;
    error: string;
    recommendation: string;
  };
  quickActions: Array<{
    name: string;
    url: string;
    description: string;
    recommended: boolean;
  }>;
}

export default function WhatsAppDemo() {
  const [whatsappInfo, setWhatsappInfo] = useState<WhatsAppInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWhatsAppInfo = async () => {
      try {
        const response = await fetch('/api/whatsapp/info');
        const data = await response.json();
        setWhatsappInfo(data);
      } catch (error) {
        console.error('Erro ao buscar informações do WhatsApp:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchWhatsAppInfo();
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando informações do WhatsApp...</p>
        </div>
      </div>
    );
  }

  if (!whatsappInfo) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center">
          <p className="text-red-600">Erro ao carregar informações do WhatsApp</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Assistente Zelar - WhatsApp</h1>
        <p className="text-gray-600">Agende compromissos de forma inteligente</p>
      </div>

      {/* Ações Rápidas */}
      <div className="grid md:grid-cols-2 gap-4 mb-8">
        {whatsappInfo.quickActions.map((action, index) => (
          <Card key={index} className={action.recommended ? 'border-green-500 bg-green-50' : ''}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  {action.name === 'Telegram Bot' ? <Bot className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
                  {action.name}
                </CardTitle>
                {action.recommended && (
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    Recomendado
                  </Badge>
                )}
              </div>
              <CardDescription>{action.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => window.open(action.url, '_blank')}
                className={action.recommended ? 'bg-green-600 hover:bg-green-700' : ''}
                size="sm"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Abrir {action.name}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Link para configuração do WhatsApp */}
      <div className="mb-8">
        <Card className="border-blue-500 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-blue-800">Configurar WhatsApp Próprio</CardTitle>
            <CardDescription className="text-blue-700">
              Configure seu próprio número WhatsApp para receber agendamentos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => window.location.href = '/whatsapp-setup'}
              variant="outline"
              className="border-blue-500 text-blue-700 hover:bg-blue-100"
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              Configurar Meu WhatsApp
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Status da ZAPI */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-500" />
            Status da ZAPI
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="destructive">Inativa</Badge>
              <span className="text-sm text-gray-600">
                {whatsappInfo.zapiStatus.error}
              </span>
            </div>
            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Recomendação:</strong> {whatsappInfo.zapiStatus.recommendation}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Todas as Soluções */}
      <Card>
        <CardHeader>
          <CardTitle>Todas as Opções Disponíveis</CardTitle>
          <CardDescription>
            Escolha a melhor forma de usar o assistente Zelar
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {whatsappInfo.workingSolutions.map((solution, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  {solution.isWorking ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                  <div>
                    <div className="font-medium capitalize">
                      {solution.method.replace('_', ' ')}
                    </div>
                    <div className="text-sm text-gray-600">
                      {solution.description}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={solution.isWorking ? 'default' : 'secondary'}>
                    {solution.isWorking ? 'Funcionando' : 'Inativo'}
                  </Badge>
                  {solution.isWorking && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(solution.url, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Abrir
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Exemplo de Uso */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Como Usar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-sm font-medium mb-2">Exemplo de mensagem:</p>
              <p className="text-sm text-gray-700 italic">
                "Reunião com cliente amanhã às 14h na sala de reuniões"
              </p>
            </div>
            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="text-sm font-medium mb-2">O que acontece:</p>
              <p className="text-sm text-blue-800">
                O assistente interpreta sua mensagem e cria um evento no calendário automaticamente
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}