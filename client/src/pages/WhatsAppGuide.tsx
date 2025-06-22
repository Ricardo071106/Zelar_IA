import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, ExternalLink } from "lucide-react";
import { useState } from "react";

export default function WhatsAppGuide() {
  const [copied, setCopied] = useState(false);
  const webhookUrl = `${window.location.origin}/api/zapi/webhook`;

  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-green-700">WhatsApp Business Bot</h1>
          <p className="text-gray-600 mt-2">Configuração do webhook Z-API - Passo a passo</p>
        </div>

        <Card className="border-green-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="bg-green-100 text-green-800 w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold">1</span>
              Acesse o Painel Z-API
            </CardTitle>
            <CardDescription>
              Entre no painel da Z-API onde você criou sua instância
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => window.open('https://developer.z-api.io/', '_blank')}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Abrir Painel Z-API
            </Button>
            <p className="text-sm text-gray-600">
              Faça login com sua conta Z-API e localize sua instância do WhatsApp Business
            </p>
          </CardContent>
        </Card>

        <Card className="border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="bg-blue-100 text-blue-800 w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold">2</span>
              Configure o Webhook
            </CardTitle>
            <CardDescription>
              Adicione a URL do webhook nas configurações da sua instância
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm font-medium mb-2">URL do Webhook:</p>
              <div className="flex items-center gap-2">
                <code className="bg-white px-3 py-2 rounded border flex-1 text-sm">
                  {webhookUrl}
                </code>
                <Button size="sm" onClick={copyWebhook}>
                  <Copy className="w-4 h-4" />
                  {copied ? "Copiado!" : "Copiar"}
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium">No painel Z-API:</h4>
              <ol className="space-y-2 text-sm">
                <li className="flex gap-2">
                  <Badge variant="outline">a</Badge>
                  Clique na sua instância do WhatsApp Business
                </li>
                <li className="flex gap-2">
                  <Badge variant="outline">b</Badge>
                  Procure por "Webhook" ou "Configurações de Webhook"
                </li>
                <li className="flex gap-2">
                  <Badge variant="outline">c</Badge>
                  Cole a URL do webhook acima no campo "URL do Webhook"
                </li>
                <li className="flex gap-2">
                  <Badge variant="outline">d</Badge>
                  Marque "Mensagens" ou "Receber Mensagens" como ativo
                </li>
                <li className="flex gap-2">
                  <Badge variant="outline">e</Badge>
                  Salve as configurações
                </li>
              </ol>
            </div>
          </CardContent>
        </Card>

        <Card className="border-purple-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="bg-purple-100 text-purple-800 w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold">3</span>
              Ative a Instância
            </CardTitle>
            <CardDescription>
              Certifique-se que sua instância está conectada e ativa
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <h4 className="font-medium">Verificações importantes:</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  Status da instância deve estar "Conectado" ou "Online"
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  QR Code deve ter sido escaneado com seu WhatsApp Business
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  Webhook deve estar configurado e ativo
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card className="border-orange-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="bg-orange-100 text-orange-800 w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold">4</span>
              Teste o Bot
            </CardTitle>
            <CardDescription>
              Envie uma mensagem para testar se está funcionando
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium mb-2">Mensagens de teste:</h4>
              <div className="space-y-1 text-sm">
                <p><code>"reunião amanhã às 15h"</code></p>
                <p><code>"dentista terça às 9h30"</code></p>
                <p><code>"almoço sexta às 12h"</code></p>
              </div>
            </div>

            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <h4 className="font-medium text-green-800 mb-2">O que esperar:</h4>
              <ul className="text-sm text-green-700 space-y-1">
                <li>• Bot interpretará sua mensagem</li>
                <li>• Criará um evento com data e hora</li>
                <li>• Enviará links para Google Calendar, Outlook e arquivo ICS</li>
                <li>• Você poderá adicionar o evento ao seu calendário</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-200">
          <CardHeader>
            <CardTitle>Localizações Comuns do Webhook</CardTitle>
            <CardDescription>
              Dependendo da versão do painel Z-API, o webhook pode estar em:
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <h4 className="font-medium mb-2">Painel Novo:</h4>
                <ul className="space-y-1 text-gray-600">
                  <li>• Menu lateral → Instâncias</li>
                  <li>• Clique na instância → Webhook</li>
                  <li>• Ou: Configurações → Webhook</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">Painel Antigo:</h4>
                <ul className="space-y-1 text-gray-600">
                  <li>• Dashboard → Sua instância</li>
                  <li>• Aba "Webhook" ou "Configurações"</li>
                  <li>• Seção "Receive Messages"</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}