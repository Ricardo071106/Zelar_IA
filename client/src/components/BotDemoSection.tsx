import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
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
              <h3 className="text-2xl font-bold text-gray-900">Experimente agora mesmo</h3>
              <p className="text-gray-600">
                O assistente Zelar entende comandos simples em linguagem natural, seja por texto ou áudio.
                Você pode criar eventos, consultar sua agenda e receber lembretes, tudo de forma conversacional.
              </p>
              
              <div className="space-y-4">
                {[
                  "Crie eventos com facilidade usando linguagem natural",
                  "Funciona no Telegram",
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
                  <a 
                    href="https://t.me/zelar_assistente_bot" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
                  >
                    <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.03-1.99 1.27-5.63 3.73-.53.37-.51.88-.01.99.91.2 1.99.44 1.99.44s.73.46 1.74.14c1.01-.32 2.21-.5 2.21-.5s1.45-.92.76-1.84z"/>
                    </svg>
                    Usar Telegram
                  </a>
                  

                  

                </div>
                
                <Link 
                  href="/dashboard"
                  className="inline-flex items-center justify-center w-full px-6 py-3 border-2 border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200"
                >
                  <svg 
                    className="w-5 h-5 mr-2" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" 
                    />
                  </svg>
                  Painel de Controle
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}