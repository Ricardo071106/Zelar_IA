import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  MessageSquare, 
  Globe, 
  Copy,
  CheckCircle,
  AlertCircle,
  Calendar,
  Clock
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function DocumentationSection() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("commands");

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado!",
      description: "Comando copiado para a área de transferência",
    });
  };

  const timezones = [
    {
      region: "Américas",
      zones: [
        { name: "Brasil (São Paulo)", code: "America/Sao_Paulo", offset: "UTC-3" },
        { name: "Brasil (Manaus)", code: "America/Manaus", offset: "UTC-4" },
        { name: "Brasil (Rio Branco)", code: "America/Rio_Branco", offset: "UTC-5" },
        { name: "Argentina", code: "America/Argentina/Buenos_Aires", offset: "UTC-3" },
        { name: "México", code: "America/Mexico_City", offset: "UTC-6" },
        { name: "EUA (Nova York)", code: "America/New_York", offset: "UTC-5" },
        { name: "EUA (Los Angeles)", code: "America/Los_Angeles", offset: "UTC-8" },
        { name: "Canadá (Toronto)", code: "America/Toronto", offset: "UTC-5" },
        { name: "Chile", code: "America/Santiago", offset: "UTC-3" },
        { name: "Colômbia", code: "America/Bogota", offset: "UTC-5" },
        { name: "Peru", code: "America/Lima", offset: "UTC-5" },
        { name: "Venezuela", code: "America/Caracas", offset: "UTC-4" }
      ]
    },
    {
      region: "Europa",
      zones: [
        { name: "Reino Unido", code: "Europe/London", offset: "UTC+0" },
        { name: "França/Alemanha", code: "Europe/Paris", offset: "UTC+1" },
        { name: "Espanha", code: "Europe/Madrid", offset: "UTC+1" },
        { name: "Itália", code: "Europe/Rome", offset: "UTC+1" },
        { name: "Rússia (Moscou)", code: "Europe/Moscow", offset: "UTC+3" },
        { name: "Portugal", code: "Europe/Lisbon", offset: "UTC+0" },
        { name: "Holanda", code: "Europe/Amsterdam", offset: "UTC+1" },
        { name: "Suíça", code: "Europe/Zurich", offset: "UTC+1" },
        { name: "Suécia", code: "Europe/Stockholm", offset: "UTC+1" },
        { name: "Noruega", code: "Europe/Oslo", offset: "UTC+1" },
        { name: "Dinamarca", code: "Europe/Copenhagen", offset: "UTC+1" },
        { name: "Polônia", code: "Europe/Warsaw", offset: "UTC+1" }
      ]
    },
    {
      region: "Ásia",
      zones: [
        { name: "Japão", code: "Asia/Tokyo", offset: "UTC+9" },
        { name: "China", code: "Asia/Shanghai", offset: "UTC+8" },
        { name: "Coreia do Sul", code: "Asia/Seoul", offset: "UTC+9" },
        { name: "Índia", code: "Asia/Kolkata", offset: "UTC+5:30" },
        { name: "Singapura", code: "Asia/Singapore", offset: "UTC+8" },
        { name: "Tailândia", code: "Asia/Bangkok", offset: "UTC+7" },
        { name: "Vietnã", code: "Asia/Ho_Chi_Minh", offset: "UTC+7" },
        { name: "Malásia", code: "Asia/Kuala_Lumpur", offset: "UTC+8" },
        { name: "Indonésia (Jacarta)", code: "Asia/Jakarta", offset: "UTC+7" },
        { name: "Filipinas", code: "Asia/Manila", offset: "UTC+8" },
        { name: "Taiwan", code: "Asia/Taipei", offset: "UTC+8" },
        { name: "Hong Kong", code: "Asia/Hong_Kong", offset: "UTC+8" }
      ]
    },
    {
      region: "Oceania",
      zones: [
        { name: "Austrália (Sydney)", code: "Australia/Sydney", offset: "UTC+10" },
        { name: "Austrália (Melbourne)", code: "Australia/Melbourne", offset: "UTC+10" },
        { name: "Austrália (Perth)", code: "Australia/Perth", offset: "UTC+8" },
        { name: "Austrália (Brisbane)", code: "Australia/Brisbane", offset: "UTC+10" },
        { name: "Austrália (Adelaide)", code: "Australia/Adelaide", offset: "UTC+9:30" },
        { name: "Nova Zelândia", code: "Pacific/Auckland", offset: "UTC+12" },
        { name: "Fiji", code: "Pacific/Fiji", offset: "UTC+12" },
        { name: "Papua Nova Guiné", code: "Pacific/Port_Moresby", offset: "UTC+10" }
      ]
    },
    {
      region: "África",
      zones: [
        { name: "África do Sul", code: "Africa/Johannesburg", offset: "UTC+2" },
        { name: "Egito", code: "Africa/Cairo", offset: "UTC+2" },
        { name: "Nigéria", code: "Africa/Lagos", offset: "UTC+1" },
        { name: "Quênia", code: "Africa/Nairobi", offset: "UTC+3" },
        { name: "Marrocos", code: "Africa/Casablanca", offset: "UTC+1" },
        { name: "Gana", code: "Africa/Accra", offset: "UTC+0" },
        { name: "Tunísia", code: "Africa/Tunis", offset: "UTC+1" },
        { name: "Argélia", code: "Africa/Algiers", offset: "UTC+1" }
      ]
    }
  ];

  return (
    <section className="py-16 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Como Usar o Zelar
          </h2>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            Aprenda a usar o Zelar para agendar compromissos de forma natural e rápida
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2">
            <TabsTrigger value="commands" className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Comandos
            </TabsTrigger>
            <TabsTrigger value="timezones" className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Fusos Horários
            </TabsTrigger>
          </TabsList>

          <TabsContent value="commands" className="space-y-6">
            <Card className="max-w-2xl mx-auto">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  Exemplo de Uso
                </CardTitle>
                <CardDescription>
                  Veja como é fácil agendar compromissos com linguagem natural
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <Card className="border-l-4 border-l-primary">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="secondary" className="font-mono text-sm text-white">
                              marque um almoço com a ordem daqui dois sábados às 13h
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard("marque um almoço com a ordem daqui dois sábados às 13h")}
                              className="h-6 w-6 p-0"
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>
                          <p className="text-gray-600 text-sm mb-2">
                            Agenda um almoço para o segundo sábado a partir de hoje às 13h
                          </p>
                          <div className="flex items-center gap-2 text-sm">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            <span className="text-gray-700 font-medium">
                              Evento: Almoço com ordem | Data: Sábado (2 semanas) às 13h
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-blue-900 mb-2">Dicas de Uso</h4>
                        <ul className="text-blue-800 text-sm space-y-1">
                          <li>• O horário padrão é 9h se não especificado</li>
                          <li>• Use "amanhã", "hoje", ou dias da semana</li>
                          <li>• Horários podem ser escritos como "15h", "15:00", ou "3pm"</li>
                          <li>• Expressões como "daqui dois sábados" são suportadas</li>
                          <li>• O sistema remove automaticamente palavras temporais do título do evento</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="timezones" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="w-5 h-5" />
                  Fusos Horários Suportados
                </CardTitle>
                <CardDescription>
                  Lista completa de fusos horários disponíveis no sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-8">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-green-900 mb-2">Configuração Automática</h4>
                      <p className="text-green-800 text-sm">
                        O sistema detecta automaticamente seu fuso horário baseado no idioma do dispositivo. 
                        Para configurar manualmente, use o comando <code className="bg-green-100 px-1 rounded">/timezone [fuso]</code> 
                        no Telegram ou WhatsApp.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-8">
                  {timezones.map((region, index) => (
                    <div key={index}>
                      <h3 className="text-xl font-semibold text-gray-900 mb-4">
                        {region.region}
                      </h3>
                      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {region.zones.map((zone, zoneIndex) => (
                          <Card key={zoneIndex} className="border hover:shadow-md transition-shadow">
                            <CardContent className="pt-4">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-medium text-gray-900 text-sm">{zone.name}</p>
                                  <p className="text-xs text-gray-500 font-mono">{zone.code}</p>
                                </div>
                                <Badge variant="outline" className="text-xs">
                                  {zone.offset}
                                </Badge>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </section>
  );
} 