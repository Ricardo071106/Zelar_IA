import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Server, CreditCard, Users } from "lucide-react";

export default function EvolutionGuide() {
  const providers = [
    {
      name: "Conecta Bot",
      url: "https://conectabot.com.br",
      price: "R$ 29,90/mês",
      features: ["Evolution API pronta", "Suporte brasileiro", "Setup automático"],
      recommended: true
    },
    {
      name: "WhatsApp API Brasil",
      url: "https://whatsappapibrasil.com.br",
      price: "R$ 35,00/mês", 
      features: ["API dedicada", "Webhook incluído", "Documentação PT-BR"]
    },
    {
      name: "Bot Evolution",
      url: "https://botevolution.com.br",
      price: "R$ 25,00/mês",
      features: ["Painel simples", "Instância ilimitada", "SSL incluído"]
    }
  ];

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-blue-700">Como Obter Evolution API</h1>
          <p className="text-gray-600 mt-2">Guia completo para conseguir suas credenciais</p>
        </div>

        {/* Opção Recomendada */}
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-800">
              <CreditCard className="w-5 h-5" />
              Opção Mais Simples (Recomendada)
            </CardTitle>
            <CardDescription className="text-green-700">
              Contratar de um provedor brasileiro que já tem tudo pronto
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              {providers.map((provider, index) => (
                <div key={index} className={`p-4 rounded-lg border ${provider.recommended ? 'border-green-300 bg-green-100' : 'border-gray-200 bg-white'}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium text-lg">{provider.name}</h3>
                      {provider.recommended && (
                        <Badge className="bg-green-600 text-white mb-2">Recomendado</Badge>
                      )}
                      <p className="text-sm text-gray-600 mb-2">{provider.price}</p>
                      <ul className="text-sm space-y-1">
                        {provider.features.map((feature, i) => (
                          <li key={i} className="flex items-center gap-1">
                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <Button 
                      size="sm" 
                      onClick={() => window.open(provider.url, '_blank')}
                      className="shrink-0"
                    >
                      <ExternalLink className="w-3 h-3 mr-1" />
                      Visitar
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-800 mb-2">O que você recebe:</h4>
              <div className="text-sm text-blue-700 space-y-1">
                <p><strong>URL:</strong> https://api.seuprovedor.com.br</p>
                <p><strong>Nome da instância:</strong> meu-whatsapp (você escolhe)</p>
                <p><strong>Chave da API:</strong> abc123xyz (eles fornecem)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Servidor Próprio */}
        <Card className="border-orange-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-800">
              <Server className="w-5 h-5" />
              Servidor Próprio (Avançado)
            </CardTitle>
            <CardDescription className="text-orange-700">
              Se você tem VPS ou servidor próprio
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm space-y-2">
              <p><strong>Requisitos:</strong></p>
              <ul className="list-disc list-inside space-y-1 text-gray-600">
                <li>VPS com Ubuntu/Debian</li>
                <li>Mínimo 1GB RAM</li>
                <li>Docker instalado</li>
                <li>Domínio próprio</li>
              </ul>
            </div>

            <div className="bg-orange-50 p-4 rounded-lg">
              <h4 className="font-medium text-orange-800 mb-2">Custo estimado:</h4>
              <div className="text-sm text-orange-700 space-y-1">
                <p>• VPS: R$ 15-30/mês</p>
                <p>• Domínio: R$ 40/ano</p>
                <p>• SSL: Grátis (Let's Encrypt)</p>
              </div>
            </div>

            <Button 
              variant="outline" 
              onClick={() => window.open('https://github.com/EvolutionAPI/evolution-api', '_blank')}
              className="w-full"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Documentação Evolution API
            </Button>
          </CardContent>
        </Card>

        {/* Teste Gratuito */}
        <Card className="border-purple-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-purple-800">
              <Users className="w-5 h-5" />
              Como Testar Antes de Comprar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm space-y-2">
              <p>Muitos provedores oferecem:</p>
              <ul className="list-disc list-inside space-y-1 text-gray-600">
                <li>Teste gratuito de 3-7 dias</li>
                <li>Demonstração online</li>
                <li>Suporte para configuração inicial</li>
                <li>Garantia de reembolso</li>
              </ul>
            </div>

            <div className="bg-purple-50 p-4 rounded-lg">
              <h4 className="font-medium text-purple-800 mb-2">Perguntas para fazer ao provedor:</h4>
              <div className="text-sm text-purple-700 space-y-1">
                <p>• "Vocês fornecem a URL da API e chave?"</p>
                <p>• "Como configuro o webhook?"</p>
                <p>• "Tem suporte em português?"</p>
                <p>• "Posso testar antes de pagar?"</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Próximos Passos */}
        <Card className="border-gray-200">
          <CardHeader>
            <CardTitle>Próximos Passos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div className="text-center">
                <div className="w-8 h-8 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center mx-auto mb-2 font-bold">1</div>
                <h4 className="font-medium">Escolher Provedor</h4>
                <p className="text-gray-600">Contratar Evolution API</p>
              </div>
              <div className="text-center">
                <div className="w-8 h-8 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center mx-auto mb-2 font-bold">2</div>
                <h4 className="font-medium">Receber Credenciais</h4>
                <p className="text-gray-600">URL, instância e chave</p>
              </div>
              <div className="text-center">
                <div className="w-8 h-8 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center mx-auto mb-2 font-bold">3</div>
                <h4 className="font-medium">Configurar Sistema</h4>
                <p className="text-gray-600">Cola as 3 informações aqui</p>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg text-center">
              <p className="text-sm text-gray-600 mb-3">
                Depois de obter as credenciais, volte para:
              </p>
              <Button onClick={() => window.location.href = '/whatsapp'}>
                Configurar WhatsApp Bot
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}