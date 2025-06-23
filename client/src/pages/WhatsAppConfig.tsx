import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function WhatsAppConfig() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [isConfigured, setIsConfigured] = useState(false);
  const [message, setMessage] = useState('');

  const handleSave = async () => {
    if (!phoneNumber || !businessName) {
      setMessage('Preencha todos os campos');
      return;
    }

    try {
      const response = await fetch('/api/whatsapp-business/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber, businessName })
      });

      if (response.ok) {
        setIsConfigured(true);
        setMessage('Configuração salva com sucesso!');
      } else {
        setMessage('Erro ao salvar configuração');
      }
    } catch (error) {
      setMessage('Erro de conexão');
    }
  };

  const generateWhatsAppLink = (customMessage = '') => {
    const defaultMessage = customMessage || 'Olá! Gostaria de agendar um evento usando o Zelar Assistant.';
    return `https://wa.me/${phoneNumber}?text=${encodeURIComponent(defaultMessage)}`;
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-green-600 mb-4">📱 Configuração WhatsApp Business</h1>
        <p className="text-xl text-gray-600">Configure seu número para receber clientes do site</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Configurar Número Business</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Número WhatsApp Business</label>
              <Input
                type="text"
                placeholder="5511999999999"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
              />
              <p className="text-xs text-gray-500 mt-1">Formato: DDI + DDD + Número (sem espaços)</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Nome da Empresa</label>
              <Input
                type="text"
                placeholder="Minha Empresa"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
              />
            </div>

            <Button onClick={handleSave} className="w-full bg-green-600 hover:bg-green-700">
              Salvar Configuração
            </Button>

            {message && (
              <Alert className={isConfigured ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}>
                <AlertDescription className={isConfigured ? 'text-green-800' : 'text-red-800'}>
                  {message}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Como Funciona</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start p-4 bg-green-50 rounded-lg">
                <div className="bg-green-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold mr-4 flex-shrink-0">1</div>
                <div>
                  <h3 className="font-bold">Configure seu número</h3>
                  <p className="text-gray-600 text-sm">Insira o número WhatsApp Business que você comprou</p>
                </div>
              </div>

              <div className="flex items-start p-4 bg-green-50 rounded-lg">
                <div className="bg-green-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold mr-4 flex-shrink-0">2</div>
                <div>
                  <h3 className="font-bold">Conecte o bot ao número</h3>
                  <p className="text-gray-600 text-sm">Execute o script e escaneie QR Code uma única vez</p>
                </div>
              </div>

              <div className="flex items-start p-4 bg-green-50 rounded-lg">
                <div className="bg-green-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold mr-4 flex-shrink-0">3</div>
                <div>
                  <h3 className="font-bold">Clientes acessam pelo site</h3>
                  <p className="text-gray-600 text-sm">Botão "Usar WhatsApp" redireciona para seu número</p>
                </div>
              </div>

              <div className="flex items-start p-4 bg-green-50 rounded-lg">
                <div className="bg-green-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold mr-4 flex-shrink-0">4</div>
                <div>
                  <h3 className="font-bold">Bot processa automaticamente</h3>
                  <p className="text-gray-600 text-sm">Mensagens são interpretadas e eventos criados</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {isConfigured && phoneNumber && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Links de Teste</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-2">Link WhatsApp (para site)</label>
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

              <div>
                <label className="block text-sm font-medium mb-2">Comando para conectar bot</label>
                <div className="bg-gray-100 p-3 rounded font-mono text-sm">
                  node whatsapp-business-integration.js
                </div>
              </div>
            </div>

            <Alert className="mt-4">
              <AlertDescription>
                <strong>Próximos passos:</strong>
                <br />1. Execute o comando acima no terminal
                <br />2. Escaneie o QR Code com seu WhatsApp Business  
                <br />3. Teste enviando uma mensagem como "Reunião amanhã às 14h"
                <br />4. O bot responderá automaticamente com links de calendário
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}
    </div>
  );
}