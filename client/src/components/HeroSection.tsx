import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { FaTelegram, FaWhatsapp } from "react-icons/fa";

export default function HeroSection() {
  return (
    <section className="pt-24 pb-16 md:pt-32 md:pb-24 bg-gradient-to-br from-primary to-secondary text-white relative">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center">
          <motion.div 
            className="md:w-1/2 mb-10 md:mb-0"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
              Seu Assistente de Agenda Inteligente no Telegram
            </h1>
            <p className="text-lg md:text-xl mb-8 text-white/90">
              Agende compromissos e gerencie eventos através de mensagens naturais em português. O Zelar entende o que você diz e cria eventos automaticamente.
            </p>
            <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
              <Button 
                asChild
                variant="default"
                size="lg"
                className="bg-white text-primary hover:bg-gray-100 font-semibold rounded-full px-8 py-4 text-lg"
              >
                <a 
                  href="https://t.me/zelar_assistente_bot" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center"
                >
                  <FaTelegram className="mr-3 text-xl" />
                  Usar no Telegram
                </a>
              </Button>
              <Button 
                asChild
                variant="default"
                size="lg"
                className="bg-green-500 hover:bg-green-600 text-white font-semibold rounded-full px-8 py-4 text-lg border-0"
              >
                <a 
                  href="https://wa.me/5511988049268?text=Ol%C3%A1%2C%20gostaria%20de%20usar%20o%20Zelar%20para%20agendar%20meus%20compromissos" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center"
                >
                  <FaWhatsapp className="mr-3 text-xl" />
                  Usar no WhatsApp
                </a>
              </Button>
            </div>
          </motion.div>
          
          <motion.div 
            className="md:w-1/2 flex justify-center md:justify-end"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            {/* Smartphone mockup */}
            <div className="relative w-72 h-[500px] md:w-80 md:h-[560px]">
              <div className="absolute inset-0 bg-black rounded-[40px] shadow-xl"></div>
              <div className="absolute inset-2 bg-white rounded-[32px] overflow-hidden">
                <div className="bg-[#f6f6f6] h-full flex flex-col">
                  {/* Header */}
                  <div className="bg-primary py-3 px-4 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-3">
                      <path d="m15 19-7-7 7-7" />
                    </svg>
                    <div>
                      <p className="text-white font-medium">Zelar Bot</p>
                      <p className="text-white text-xs opacity-80">Online</p>
                    </div>
                  </div>
                  
                  {/* Chat area */}
                  <div className="flex-1 p-3 overflow-y-auto">
                    <div className="bg-white rounded-lg p-3 shadow-sm mb-3 max-w-[80%]">
                      <p className="text-sm">👋 Olá! Sou o Zelar, seu assistente de agenda. Você pode me dizer o que precisa agendar usando linguagem natural.</p>
                    </div>
                    
                    <div className="bg-primary rounded-lg p-3 shadow-sm mb-3 ml-auto max-w-[80%]">
                      <p className="text-sm text-white">Agendar reunião com João amanhã às 15h na sala de conferências</p>
                    </div>
                    
                    <div className="bg-white rounded-lg p-3 shadow-sm mb-3 max-w-[80%]">
                      <p className="text-sm">✅ Evento criado com sucesso!</p>
                      <div className="mt-2 bg-gray-100 rounded-md p-2">
                        <p className="text-xs font-medium">Reunião com João</p>
                        <p className="text-xs text-gray-600">Amanhã • 15:00</p>
                        <p className="text-xs text-gray-600">📍 Sala de conferências</p>
                      </div>
                    </div>
                    
                    <div className="bg-white rounded-lg p-3 shadow-sm mb-3 max-w-[80%]">
                      <p className="text-sm">📅 Adicione ao seu calendário:</p>
                      <div className="mt-2 flex flex-col gap-1">
                        <div className="bg-green-500 text-white text-xs px-2 py-1 rounded">Google</div>
                        <div style={{ height: '8px' }} />
                        <div className="bg-blue-500 text-white text-xs px-2 py-1 rounded">Outlook</div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Message input */}
                  <div className="bg-gray-100 p-3 flex items-center">
                    <div className="bg-white rounded-full flex-1 py-2 px-4 flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary mr-2">
                        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                        <line x1="12" x2="12" y1="19" y2="22" />
                      </svg>
                      <span className="text-gray-400 text-sm">Digite sua mensagem</span>
                    </div>
                    <button className="ml-2 bg-primary text-white rounded-full w-10 h-10 flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m22 2-7 20-4-9-9-4Z" />
                        <path d="M22 2 11 13" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
      
      {/* Wave SVG */}
      <div className="absolute bottom-0 left-0 w-full overflow-hidden line-height-0">
        <svg data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 120" preserveAspectRatio="none" className="relative block w-[calc(100%+1.3px)] h-[70px]">
          <path d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z" fill="#FFFFFF" />
        </svg>
      </div>
    </section>
  );
}
