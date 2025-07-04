import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, MessageCircle, Bot, Phone, CheckCircle, Copy, AlertCircle } from 'lucide-react';

export default function WhatsAppSetup() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [generatedLink, setGeneratedLink] = useState('');
  const [copied, setCopied] = useState(false);

  const formatPhoneNumber = (phone: string) => {
    // Remove todos os caracteres não numéricos
    const cleaned = phone.replace(/\D/g, '');
    
    // Adiciona código do país se não tiver
    if (cleaned.length === 11 && cleaned.startsWith('11')) {
      return `55${cleaned}`; // Brasil
    } else if (cleaned.length === 10) {
      return `5511${cleaned}`; // São Paulo
    } else if (cleaned.length >= 13) {
      return cleaned;
    }
    
    return cleaned;
  };

  const generateWhatsAppLink = () => {
    const formattedPhone = formatPhoneNumber(phoneNumber);
    const message = encodeURIComponent('Olá! Quero usar o assistente Zelar para agendamentos. Como funciona?');
    const link = `https://wa.me/${formattedPhone}?text=${message}`;
    setGeneratedLink(link);
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generatedLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Erro ao copiar:', error);
    }
  };

  const openTelegramBot = () => {
    window.open('https://t.me/zelar_assistente_bot', '_blank');
  };

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">WhatsApp com IA Integrada</h1>
        <p className="text-gray-600">Mesma inteligência artificial do Telegram, agora no WhatsApp</p>
        <div className="mt-4">
          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
            Processamento Automático com Claude AI
          </Badge>
        </div>
      </div>

      {/* Opção Recomendada */}
      <Card className="mb-8 border-green-500 bg-green-50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-green-600" />
            <CardTitle className="text-green-800">Opção Recomendada: Bot Telegram</CardTitle>
            <Badge variant="secondary" className="bg-green-100 text-green-800">100% Funcional</Badge>
          </div>
          <CardDescription className="text-green-700">
            O bot Telegram está totalmente operacional com IA integrada
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Button onClick={openTelegramBot} className="bg-green-600 hover:bg-green-700">
              <Bot className="h-4 w-4 mr-2" />
              Abrir Bot Telegram
            </Button>
            <div className="text-sm text-green-700">
              Procure por <strong>@zelar_assistente_bot</strong> no Telegram
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configuração WhatsApp */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Configurar WhatsApp Manual
          </CardTitle>
          <CardDescription>
            Configure seu número WhatsApp para receber mensagens de agendamento
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">
              Seu número WhatsApp (com DDD)
            </label>
            <div className="flex gap-2">
              <Input
                placeholder="Ex: 11999887766"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="flex-1"
              />
              <Button 
                onClick={generateWhatsAppLink}
                disabled={!phoneNumber}
                variant="outline"
              >
                Gerar Link
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Digite apenas números (DDD + número). Ex: 11999887766
            </p>
          </div>

          {generatedLink && (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-2 block">Link gerado:</label>
                <div className="flex gap-2">
                  <Input
                    value={generatedLink}
                    readOnly
                    className="flex-1"
                  />
                  <Button
                    onClick={copyToClipboard}
                    variant="outline"
                    size="sm"
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    {copied ? 'Copiado!' : 'Copiar'}
                  </Button>
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-blue-800 mb-2">Como usar:</h4>
                <ol className="text-sm text-blue-700 space-y-1">
                  <li>1. Compartilhe este link com seus clientes</li>
                  <li>2. Quando clicarem, abrirá uma conversa no WhatsApp com você</li>
                  <li>3. Eles podem enviar mensagens como: "Reunião amanhã às 14h"</li>
                  <li>4. Você processa manualmente e cria os eventos</li>
                </ol>
              </div>

              <Button
                onClick={() => window.open(generatedLink, '_blank')}
                className="w-full"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Testar Link WhatsApp
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Comparação de Soluções */}
      <Card>
        <CardHeader>
          <CardTitle>Comparação de Soluções</CardTitle>
          <CardDescription>Entenda as diferenças entre as opções disponíveis</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-blue-600" />
                <h4 className="font-medium">Bot Telegram</h4>
                <Badge variant="secondary" className="bg-green-100 text-green-800">Automático</Badge>
              </div>
              <ul className="text-sm space-y-1">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  IA integrada (Claude)
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  Interpretação automática
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  Criação de eventos automática
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  Links para calendário
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-green-600" />
                <h4 className="font-medium">WhatsApp com IA</h4>
                <Badge variant="secondary" className="bg-green-100 text-green-800">Automático</Badge>
              </div>
              <ul className="text-sm space-y-1">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  IA integrada (Claude)
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  Interpretação automática
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  Criação de eventos automática
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  Links para calendário
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Instrução Final */}
      <Alert className="mt-8">
        <CheckCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Novidade:</strong> Agora o WhatsApp também processa mensagens automaticamente com a mesma IA do Telegram! 
          Ambas as plataformas oferecem interpretação inteligente e criação automática de eventos no calendário.
        </AlertDescription>
      </Alert>
    </div>
  );
}