import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { MessageSquare, Phone, Calendar, Clock, Zap, Shield } from "lucide-react";
import Header from "@/components/Header";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <Header />
      
      {/* Hero Section */}
      <section className="pt-20 pb-16 px-4">
        <div className="container mx-auto text-center">
          <motion.h1 
            className="text-5xl md:text-6xl font-bold text-gray-900 mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            Zelar
          </motion.h1>
          <motion.p 
            className="text-xl md:text-2xl text-gray-600 mb-8 max-w-3xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            Seu assistente inteligente para agendamento de compromissos.
            Crie eventos com linguagem natural no Telegram ou WhatsApp.
          </motion.p>
          
          <motion.div 
            className="flex flex-col sm:flex-row gap-4 justify-center items-center max-w-md mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Button 
              asChild
              size="lg"
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-full w-full sm:w-auto"
            >
              <a href="https://t.me/zelar_assistente_bot" target="_blank" rel="noopener noreferrer">
                <MessageSquare className="w-5 h-5 mr-2" />
                Usar no Telegram
              </a>
            </Button>
            
            <Button 
              asChild
              size="lg"
              variant="outline"
              className="border-2 border-green-600 text-green-600 hover:bg-green-600 hover:text-white font-semibold px-8 py-3 rounded-full w-full sm:w-auto"
            >
              <a href="https://wa.me/message/XXXXXXXXXXXXXXX" target="_blank" rel="noopener noreferrer">
                <Phone className="w-5 h-5 mr-2" />
                Usar no WhatsApp
              </a>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4">
        <div className="container mx-auto">
          <motion.h2 
            className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            Como funciona
          </motion.h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: <MessageSquare className="w-8 h-8 text-blue-600" />,
                title: "Linguagem Natural",
                description: "Escreva como você fala: 'Reunião amanhã às 14h' ou 'Médico sexta de manhã'"
              },
              {
                icon: <Calendar className="w-8 h-8 text-green-600" />,
                title: "Calendário Integrado",
                description: "Links diretos para Google Calendar, Outlook e Apple Calendar"
              },
              {
                icon: <Clock className="w-8 h-8 text-purple-600" />,
                title: "Respostas Rápidas",
                description: "Processamento instantâneo com IA avançada Claude"
              }
            ].map((feature, index) => (
              <motion.div
                key={index}
                className="bg-white rounded-lg p-6 shadow-md hover:shadow-lg transition-shadow"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <div className="flex items-center mb-4">
                  {feature.icon}
                  <h3 className="text-xl font-semibold text-gray-900 ml-3">{feature.title}</h3>
                </div>
                <p className="text-gray-600">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Demo Section */}
      <section className="py-16 px-4 bg-white">
        <div className="container mx-auto text-center">
          <motion.h2 
            className="text-3xl md:text-4xl font-bold text-gray-900 mb-8"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            Experimente agora
          </motion.h2>
          
          <motion.div 
            className="bg-gray-100 rounded-lg p-8 max-w-2xl mx-auto mb-8"
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="text-left space-y-4">
              <div className="bg-blue-500 text-white p-3 rounded-lg inline-block">
                "Reunião com cliente quinta às 15h"
              </div>
              <div className="bg-white p-3 rounded-lg shadow-sm">
                ✅ Evento criado: <strong>Reunião com cliente</strong><br/>
                📅 Data: Quinta-feira, 15:00<br/>
                🔗 <a href="#" className="text-blue-600">Adicionar ao Google Calendar</a>
              </div>
            </div>
          </motion.div>
          
          <motion.div 
            className="flex flex-col sm:flex-row gap-4 justify-center items-center max-w-md mx-auto"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Button 
              asChild
              size="lg"
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-full w-full sm:w-auto"
            >
              <a href="https://t.me/zelar_assistente_bot" target="_blank" rel="noopener noreferrer">
                <MessageSquare className="w-5 h-5 mr-2" />
                Começar no Telegram
              </a>
            </Button>
            
            <Button 
              asChild
              size="lg"
              variant="outline"
              className="border-2 border-green-600 text-green-600 hover:bg-green-600 hover:text-white font-semibold px-8 py-3 rounded-full w-full sm:w-auto"
            >
              <a href="https://wa.me/message/XXXXXXXXXXXXXXX" target="_blank" rel="noopener noreferrer">
                <Phone className="w-5 h-5 mr-2" />
                Começar no WhatsApp
              </a>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="container mx-auto">
          <motion.h2 
            className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            Por que usar o Zelar?
          </motion.h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: <Zap className="w-8 h-8 text-yellow-600" />,
                title: "Simples e Rápido",
                description: "Sem aplicativos para baixar. Use direto no seu mensageiro favorito."
              },
              {
                icon: <Shield className="w-8 h-8 text-green-600" />,
                title: "Seguro e Confiável",
                description: "Seus dados ficam seguros. Não armazenamos conversas pessoais."
              },
              {
                icon: <Calendar className="w-8 h-8 text-blue-600" />,
                title: "Compatível",
                description: "Funciona com todos os principais aplicativos de calendário."
              }
            ].map((benefit, index) => (
              <motion.div
                key={index}
                className="text-center"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <div className="flex justify-center mb-4">{benefit.icon}</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{benefit.title}</h3>
                <p className="text-gray-600">{benefit.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 bg-gray-900 text-white">
        <div className="container mx-auto text-center">
          <p className="text-gray-400">
            © 2025 Zelar. Seu assistente inteligente para agendamento.
          </p>
        </div>
      </footer>
    </div>
  );
}