import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { MessageSquare, Phone } from "lucide-react";
import ChatDemo from "@/components/ChatDemo";

export default function BotDemoSection() {
  const [step, setStep] = useState(0);
  
  // Avança automaticamente pelos passos da demonstração
  useEffect(() => {
    if (step < 3) {
      const timer = setTimeout(() => {
        setStep(prev => prev + 1);
      }, step === 0 ? 1000 : 5000);
      
      return () => clearTimeout(timer);
    }
  }, [step]);

  return (
    <section id="demo" className="py-20 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <motion.h2 
            className="text-3xl md:text-4xl font-bold text-gray-900 mb-4"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            Veja o Zelar em ação
          </motion.h2>
          <motion.p 
            className="text-xl text-gray-600 max-w-3xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            Experimente como é fácil agendar seus compromissos usando o Zelar.
          </motion.p>
        </div>
        
        <div className="flex flex-col lg:flex-row items-center justify-between gap-8 lg:gap-12">
          <div className="w-full lg:w-1/2">
            <motion.div
              className="bg-white rounded-2xl shadow-lg p-4 md:p-6 max-w-lg mx-auto"
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <ChatDemo step={step} />
            </motion.div>
          </div>
          
          <div className="w-full lg:w-1/2">
            <motion.div
              className="space-y-6 max-w-lg mx-auto"
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <h3 className="text-2xl font-bold text-gray-900">Escolha sua plataforma</h3>
              <p className="text-gray-600">
                O assistente Zelar funciona tanto no Telegram quanto no WhatsApp.
                Escolha a plataforma que você mais usa e comece a organizar seus compromissos.
              </p>
              
              <div className="space-y-4">
                {[
                  "Crie eventos com facilidade usando linguagem natural",
                  "Funciona no Telegram e WhatsApp",
                  "Integração com Google Calendar, Outlook e Apple Calendar", 
                  "Links diretos para adicionar eventos ao calendário"
                ].map((feature, index) => (
                  <div key={index} className="flex items-start">
                    <div className="flex-shrink-0 h-6 w-6 rounded-full bg-primary-100 flex items-center justify-center mt-1">
                      <svg 
                        className="h-4 w-4 text-primary-600" 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                      >
                        <path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          strokeWidth={2} 
                          d="M5 13l4 4L19 7" 
                        />
                      </svg>
                    </div>
                    <p className="ml-3 text-gray-600">{feature}</p>
                  </div>
                ))}
              </div>
              
              <div className="pt-4 space-y-3">
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button 
                    asChild
                    variant="default"
                    className="bg-primary hover:bg-secondary text-white font-medium rounded-full flex-1"
                  >
                    <a href="https://t.me/zelar_assistente_bot" target="_blank" rel="noopener noreferrer">
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Usar no Telegram
                    </a>
                  </Button>
                  <Button 
                    asChild
                    variant="outline"
                    className="border-primary text-primary hover:bg-primary hover:text-white font-medium rounded-full flex-1"
                  >
                    <a href="https://wa.me/5511999999999?text=Olá,%20gostaria%20de%20usar%20o%20Zelar%20para%20agendar%20meus%20compromissos" target="_blank" rel="noopener noreferrer">
                      <Phone className="w-4 h-4 mr-2" />
                      Usar no WhatsApp
                    </a>
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}