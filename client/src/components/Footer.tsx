import { MessageSquare, Phone, Mail, Globe, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Logo e Descrição */}
          <div className="md:col-span-2">
            <h3 className="text-2xl font-bold mb-4">Zelar</h3>
            <p className="text-gray-300 mb-6 max-w-md">
              Seu assistente inteligente para agendamento de compromissos. 
              Simplifique sua agenda com processamento de linguagem natural em português.
            </p>
            <div className="flex space-x-4">
              <Button 
                asChild
                variant="default"
                className="bg-primary hover:bg-secondary text-white font-medium rounded-full"
              >
                <a href="https://t.me/zelar_assistente_bot" target="_blank" rel="noopener noreferrer">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Telegram
                </a>
              </Button>
              <Button 
                asChild
                variant="outline"
                className="border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white font-medium rounded-full"
              >
                <a href="https://wa.me/5511999999999?text=Olá,%20gostaria%20de%20usar%20o%20Zelar%20para%20agendar%20meus%20compromissos" target="_blank" rel="noopener noreferrer">
                  <Phone className="w-4 h-4 mr-2" />
                  WhatsApp
                </a>
              </Button>
            </div>
          </div>

          {/* Recursos */}
          <div>
            <h4 className="text-lg font-semibold mb-4">Recursos</h4>
            <ul className="space-y-2 text-gray-300">
              <li>Linguagem Natural</li>
              <li>Calendário Integrado</li>
              <li>Processamento com IA</li>
              <li>Lembretes Automáticos</li>
              <li>Múltiplas Plataformas</li>
            </ul>
          </div>

          {/* Contato */}
          <div>
            <h4 className="text-lg font-semibold mb-4">Contato</h4>
            <div className="space-y-3 text-gray-300">
              <div className="flex items-center">
                <MessageSquare className="w-4 h-4 mr-2" />
                <span>@zelar_assistente_bot</span>
              </div>
              <div className="flex items-center">
                <Phone className="w-4 h-4 mr-2" />
                <span>WhatsApp Bot</span>
              </div>
              <div className="flex items-center">
                <Globe className="w-4 h-4 mr-2" />
                <span>Brasil</span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-12 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-400 mb-4 md:mb-0">
              © 2025 Zelar. Todos os direitos reservados.
            </p>
            <div className="flex items-center text-gray-400">
              <span>Feito com</span>
              <Heart className="w-4 h-4 mx-2 text-red-500" />
              <span>para o Brasil</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}