import { useState, useEffect } from "react";
import { motion } from "framer-motion";
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
                  "Receba lembretes por mensagem no Telegram",
                  "Consulte sua agenda com comandos simples",
                  "Sincronize com Google Calendar e Apple Calendar"
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
              
              <div className="pt-4">
                <a 
                  href="https://t.me/zelar_assistente_bot" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors duration-200"
                >
                  Começar a usar agora
                  <svg 
                    className="ml-2 -mr-1 h-5 w-5" 
                    xmlns="http://www.w3.org/2000/svg" 
                    viewBox="0 0 20 20" 
                    fill="currentColor"
                  >
                    <path 
                      fillRule="evenodd" 
                      d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" 
                      clipRule="evenodd" 
                    />
                  </svg>
                </a>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}