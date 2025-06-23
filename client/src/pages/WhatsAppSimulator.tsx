import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

interface Message {
  id: number;
  sender: string;
  message: string;
  response: string;
  eventDetected: boolean;
  timestamp: string;
}

export default function WhatsAppSimulator() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [testMessage, setTestMessage] = useState('');
  const [senderName, setSenderName] = useState('Cliente Teste');
  const [businessConfig, setBusinessConfig] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadBusinessConfig();
    loadMessages();
  }, []);

  const loadBusinessConfig = async () => {
    try {
      const response = await fetch('/api/business/config');
      const data = await response.json();
      if (data.success && data.configuration) {
        setBusinessConfig(data.configuration);
      }
    } catch (error) {
      console.error('Erro ao carregar configuração:', error);
    }
  };

  const loadMessages = async () => {
    try {
      const response = await fetch('/api/whatsapp/messages');
      const data = await response.json();
      if (data.success) {
        setMessages(data.messages);
      }
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
    }
  };

  const sendTestMessage = async () => {
    if (!testMessage.trim()) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/whatsapp/simulate-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: testMessage,
          senderName
        })
      });

      const data = await response.json();
      if (data.success) {
        setTestMessage('');
        loadMessages();
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const clearMessages = async () => {
    try {
      const response = await fetch('/api/whatsapp/messages', {
        method: 'DELETE'
      });
      const data = await response.json();
      if (data.success) {
        setMessages([]);
      }
    } catch (error) {
      console.error('Erro ao limpar mensagens:', error);
    }
  };

  const generateWhatsAppLink = () => {
    if (!businessConfig?.phoneNumber) return '#';
    const message = 'Olá! Gostaria de agendar um evento usando o Zelar Assistant.';
    return `https://wa.me/${businessConfig.phoneNumber}?text=${encodeURIComponent(message)}`;
  };

  const testExamples = [
    'Reunião amanhã às 14h',
    'Consulta médica sexta-feira às 10h',
    'Evento importante segunda às 15h30',
    'Compromisso hoje às 16h',
    'Apresentação terça-feira 9h',
    'Olá, como você está?'
  ];

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-green-600 mb-4">WhatsApp Business - Simulador</h1>
        <p className="text-xl text-gray-600">Teste o sistema de processamento inteligente de mensagens</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Test Panel */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Enviar Mensagem Teste</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Nome do Remetente</label>
              <Input
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="Cliente Teste"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Mensagem</label>
              <Input
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                placeholder="Digite uma mensagem..."
                onKeyPress={(e) => e.key === 'Enter' && sendTestMessage()}
              />
            </div>

            <Button 
              onClick={sendTestMessage} 
              disabled={!testMessage.trim() || isLoading}
              className="w-full"
            >
              {isLoading ? 'Processando...' : 'Enviar Mensagem'}
            </Button>

            <div className="pt-4 border-t">
              <h4 className="font-medium mb-2">Exemplos para testar:</h4>
              <div className="space-y-1">
                {testExamples.map((example, index) => (
                  <button
                    key={index}
                    onClick={() => setTestMessage(example)}
                    className="block w-full text-left text-sm p-2 rounded hover:bg-gray-100 text-gray-600"
                  >
                    "{example}"
                  </button>
                ))}
              </div>
            </div>

            <Button onClick={clearMessages} variant="outline" className="w-full">
              Limpar Histórico
            </Button>
          </CardContent>
        </Card>

        {/* Messages Panel */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Histórico de Mensagens</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {messages.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <p>Nenhuma mensagem ainda</p>
                  <p className="text-sm">Envie uma mensagem teste para começar</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{msg.sender}</span>
                        {msg.eventDetected && (
                          <Badge variant="secondary" className="bg-green-100 text-green-800">
                            Evento Detectado
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(msg.timestamp).toLocaleTimeString('pt-BR')}
                      </span>
                    </div>
                    
                    <div className="bg-blue-50 p-3 rounded">
                      <strong>Mensagem:</strong> {msg.message}
                    </div>
                    
                    <div className="bg-green-50 p-3 rounded">
                      <strong>Resposta do Bot:</strong>
                      <div className="whitespace-pre-line mt-1">{msg.response}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Business Config Status */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Status da Configuração</CardTitle>
        </CardHeader>
        <CardContent>
          {businessConfig ? (
            <div className="space-y-4">
              <Alert className="border-green-500 bg-green-50">
                <AlertDescription className="text-green-800">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <strong>Número WhatsApp Business:</strong> {businessConfig.phoneNumber}
                    </div>
                    <div>
                      <strong>Nome da Empresa:</strong> {businessConfig.businessName}
                    </div>
                  </div>
                </AlertDescription>
              </Alert>

              <div>
                <label className="block text-sm font-medium mb-2">Link para Clientes</label>
                <div className="flex gap-2">
                  <Input 
                    readOnly 
                    value={generateWhatsAppLink()}
                    className="flex-1"
                  />
                  <Button 
                    onClick={() => window.open(generateWhatsAppLink(), '_blank')}
                    variant="outline"
                  >
                    Testar
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <Alert className="border-orange-500 bg-orange-50">
              <AlertDescription className="text-orange-800">
                Configure primeiro seu número WhatsApp Business em /whatsapp-config
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Como Funciona na Prática</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-bold mb-3">Para Testes (Agora):</h4>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>Use este simulador para testar mensagens</li>
                <li>Veja como o sistema processa eventos em português</li>
                <li>Teste diferentes formatos de agendamento</li>
                <li>Verifique as respostas automáticas</li>
              </ol>
            </div>

            <div>
              <h4 className="font-bold mb-3">Para Clientes Reais:</h4>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>Clientes acessam seu site</li>
                <li>Clicam em "Usar WhatsApp"</li>
                <li>São redirecionados para seu número Business</li>
                <li>Enviam mensagens e recebem links de calendário</li>
              </ol>
            </div>
          </div>

          <Alert className="mt-4">
            <AlertDescription>
              <strong>Nota:</strong> Este simulador demonstra exatamente como seu sistema processará mensagens reais. 
              O mesmo algoritmo inteligente será usado quando clientes enviarem mensagens para seu WhatsApp Business.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}