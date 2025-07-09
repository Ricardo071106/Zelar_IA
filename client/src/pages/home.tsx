import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { MessageSquare, Phone } from "lucide-react";
import Header from "@/components/Header";
import BotDemoSection from "@/components/BotDemoSection";
import CtaSection from "@/components/CtaSection";

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      
      {/* Hero Section */}
      <section className="pt-20 pb-16 px-4 bg-gradient-to-br from-primary to-secondary text-white">
        <div className="container mx-auto text-center">
          <motion.h1 
            className="text-5xl md:text-6xl font-bold mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            Zelar
          </motion.h1>
          <motion.p 
            className="text-xl md:text-2xl text-white/90 mb-8 max-w-3xl mx-auto"
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
              className="bg-white text-primary hover:bg-gray-100 font-semibold px-8 py-3 rounded-full w-full sm:w-auto"
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
              className="border-2 border-white text-white hover:bg-white hover:text-primary font-semibold px-8 py-3 rounded-full w-full sm:w-auto"
            >
              <a href="https://wa.me/5511999999999?text=Olá,%20gostaria%20de%20usar%20o%20Zelar%20para%20agendar%20meus%20compromissos" target="_blank" rel="noopener noreferrer">
                <Phone className="w-5 h-5 mr-2" />
                Usar no WhatsApp
              </a>
            </Button>
          </motion.div>
        </div>
      </section>

      
      {/* Demo Section */}
      <BotDemoSection />
      
      {/* Call to Action */}
      <CtaSection />
    </div>
  );
}