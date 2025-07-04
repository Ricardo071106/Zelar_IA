import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ExternalLink, MessageCircle, Bot, Send, CheckCircle, Copy } from 'lucide-react';

export default function WhatsAppDemo() {
  const [testMessage, setTestMessage] = useState('Reunião com cliente amanhã às 14h');
  const [processedResult, setProcessedResult] = useState<any>(null);
  const [processing, setProcessing] = useState(false);
  const [whatsappLink, setWhatsappLink] = useState('');

  useEffect(() => {
    // Gerar link WhatsApp automaticamente
    const message = 'Olá! Quero testar o Assistente Zelar. Como funciona?';
    const phone = '5511999887766'; // número exemplo
    const encodedMessage = encodeURIComponent(message);
    setWhatsappLink(`https://wa.me/${phone}?text=${encodedMessage}`);
  }, []);

  const processTestMessage = async () => {
    if (!testMessage) return;
    
    setProcessing(true);
    try {
      console.log('Enviando mensagem:', testMessage);
      
      // Processar mensagem usando a mesma IA do Telegram
      const response = await fetch('/api/whatsapp/test-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          phone: '5511999999999', // número exemplo
          message: testMessage 
        })
      });
      
      console.log('Status da resposta:', response.status);
      
      if (response.ok) {
        const result = await response.json();
        console.log('Resultado:', result);
        setProcessedResult(result);
      } else {
        const errorText = await response.text();
        console.error('Erro na resposta:', errorText);
        setProcessedResult({
          success: false,
          response: `Erro ${response.status}: ${errorText}`
        });
      }
    } catch (error) {
      console.error('Erro de conexão:', error);
      setProcessedResult({
        success: false,
        response: `Erro de conexão: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
      });
    } finally {
      setProcessing(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.error('Erro ao copiar:', error);
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">WhatsApp com IA - Demonstração</h1>
        <p className="text-gray-600">Teste a inteligência artificial do Zelar processando suas mensagens</p>
        <div className="mt-4">
          <Badge variant="secondary" className="bg-green-100 text-green-800">
            Mesmo processamento do Bot Telegram
          </Badge>
        </div>
      </div>

      {/* Teste de Mensagem */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-blue-600" />
            Teste da IA - Processamento Automático
          </CardTitle>
          <CardDescription>
            Digite uma mensagem como se fosse enviar no WhatsApp e veja como a IA processa
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder='Ex: "Reunião com cliente amanhã às 14h"'
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              className="flex-1"
              onKeyDown={(e) => e.key === 'Enter' && processTestMessage()}
            />
            <Button 
              onClick={processTestMessage}
              disabled={!testMessage || processing}
            >
              <Send className="h-4 w-4 mr-2" />
              {processing ? 'Processando...' : 'Testar IA'}
            </Button>
          </div>

          {/* Resultado do processamento */}
          {processedResult && (
            <div className="mt-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">🤖 Resultado do processamento:</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    {processedResult.success ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <div className="h-4 w-4 rounded-full bg-red-500" />
                    )}
                    <span className="text-sm font-medium">
                      {processedResult.success ? 'Evento processado com sucesso!' : 'Erro no processamento'}
                    </span>
                  </div>
                  
                  <div className="bg-white p-3 rounded border text-sm">
                    <pre className="whitespace-pre-wrap">{processedResult.response}</pre>
                  </div>

                  {processedResult.success && processedResult.event && (
                    <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                      <h5 className="font-bold text-green-800 mb-2">📅 Evento criado:</h5>
                      <p className="text-sm text-green-700 mb-3">
                        <strong>{processedResult.event.title}</strong><br />
                        {processedResult.event.displayDate}
                      </p>
                      
                      <div className="mt-3">
                        <p className="text-sm font-medium text-green-800 mb-2">Clique para adicionar ao calendário:</p>
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                            onClick={() => {
                              console.log('Abrindo Google Calendar:', processedResult.event.calendarLinks.google);
                              window.open(processedResult.event.calendarLinks.google, '_blank');
                            }}
                          >
                            📅 Google Calendar
                          </Button>
                          <Button 
                            size="sm" 
                            className="bg-orange-600 hover:bg-orange-700 text-white"
                            onClick={() => {
                              console.log('Abrindo Outlook:', processedResult.event.calendarLinks.outlook);
                              window.open(processedResult.event.calendarLinks.outlook, '_blank');
                            }}
                          >
                            📆 Outlook
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Botão de teste direto */}
          <div className="mt-4">
            <Button 
              onClick={() => {
                setProcessedResult({
                  success: true,
                  response: "✅ Evento criado com sucesso!\n\n📅 *Reunião com cliente*\n🕐 5 de julho de 2025 às 14:00 BRT",
                  event: {
                    title: "Reunião com cliente",
                    displayDate: "5 de julho de 2025 às 14:00 BRT",
                    calendarLinks: {
                      google: "https://calendar.google.com/calendar/render?action=TEMPLATE&text=Reunião%20com%20cliente&dates=20250705T170000Z/20250705T180000Z",
                      outlook: "https://outlook.live.com/calendar/0/deeplink/compose?subject=Reunião%20com%20cliente&startdt=2025-07-05T17:00:00.000Z&enddt=2025-07-05T18:00:00.000Z"
                    }
                  }
                });
              }}
              variant="outline"
              className="text-xs"
            >
              🧪 Teste Visual (Botões de Calendário)
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Link WhatsApp Real */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-green-600" />
            WhatsApp Web Direto
          </CardTitle>
          <CardDescription>
            Use este link para conversar diretamente via WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-green-50 p-4 rounded-lg">
            <h4 className="font-medium text-green-800 mb-2">Como funciona:</h4>
            <ol className="text-sm text-green-700 space-y-1">
              <li>1. Clique no botão abaixo para abrir WhatsApp</li>
              <li>2. Envie mensagens como: "Reunião amanhã às 14h"</li>
              <li>3. O sistema processará automaticamente com IA</li>
              <li>4. Você receberá links para adicionar ao calendário</li>
            </ol>
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={() => window.open(whatsappLink, '_blank')}
              className="bg-green-600 hover:bg-green-700"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Abrir WhatsApp Web
            </Button>
            <Button
              variant="outline"
              onClick={() => copyToClipboard(whatsappLink)}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copiar Link
            </Button>
          </div>

          <div className="text-xs text-gray-500">
            Link: {whatsappLink}
          </div>
        </CardContent>
      </Card>

      {/* Exemplos de Uso */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Exemplos de Mensagens</CardTitle>
          <CardDescription>Teste estas mensagens para ver como a IA interpreta</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              'Reunião com cliente amanhã às 14h',
              'Jantar com família sexta às 19h30',
              'Consulta médica terça às 10h',
              'Call de projeto quinta às 15h',
              'Dentista segunda às 9h',
              'Apresentação na empresa às 16h'
            ].map((example, index) => (
              <div 
                key={index}
                className="p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
                onClick={() => setTestMessage(example)}
              >
                <div className="text-sm">"{example}"</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Informação sobre o Sistema */}
      <Alert>
        <Bot className="h-4 w-4" />
        <AlertDescription>
          <strong>Sistema Inteligente:</strong> O WhatsApp usa a mesma inteligência artificial Claude do Bot Telegram, 
          processando mensagens em português brasileiro e criando eventos automaticamente no calendário.
        </AlertDescription>
      </Alert>
    </div>
  );
}