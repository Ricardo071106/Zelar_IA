import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { FaWhatsapp } from "react-icons/fa";
import ChatDemo from "@/components/ChatDemo";
import { WHATSAPP_URL } from "@/lib/whatsapp";

export default function BotDemoSection() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (step < 3) {
      const timer = setTimeout(
        () => {
          setStep((prev) => prev + 1);
        },
        step === 0 ? 1200 : 4500,
      );

      return () => clearTimeout(timer);
    }
  }, [step]);

  return (
    <section id="demo" className="py-16 md:py-24 bg-white border-y border-emerald-100/80">
      <div className="container mx-auto px-4">
        <div className="text-center mb-10 md:mb-14">
          <motion.div
            className="inline-flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-200 px-4 py-1.5 text-sm text-emerald-800 font-medium mb-4"
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <FaWhatsapp className="text-[#25D366]" />
            Demonstração
          </motion.div>
          <motion.h2
            className="font-mago text-3xl md:text-4xl font-bold text-slate-900 mb-4"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            Veja como funciona no WhatsApp
          </motion.h2>
          <motion.p
            className="text-lg text-slate-600 max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            Marque um horário, confirme com o cliente e consulte sua agenda — tudo na conversa que você já usa
            todo dia.
          </motion.p>
        </div>

        <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-14">
          <motion.div
            className="w-full lg:w-1/2 max-w-md mx-auto lg:max-w-none"
            initial={{ opacity: 0, scale: 0.97 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="rounded-2xl border border-emerald-200 bg-white shadow-lg overflow-hidden">
              <ChatDemo step={step} />
            </div>
          </motion.div>

          <motion.div
            className="w-full lg:w-1/2 max-w-lg mx-auto lg:mx-0"
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.15 }}
          >
            <h3 className="text-xl font-semibold text-slate-900 mb-4">Na prática, você ganha:</h3>

            <div className="space-y-4 mb-8">
              {[
                "Agenda organizada sem sair do WhatsApp",
                "Confirmações e lembretes automáticos para clientes",
                "Menos mensagens perdidas e menos faltas",
                "Painel simples para consultar a semana no celular",
              ].map((item, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="flex-shrink-0 h-6 w-6 rounded-full bg-emerald-100 flex items-center justify-center mt-0.5">
                    <svg
                      className="h-3.5 w-3.5 text-emerald-700"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-slate-600">{item}</p>
                </div>
              ))}
            </div>

            <Button
              asChild
              variant="default"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-full px-8 py-4 text-base w-full sm:w-auto"
            >
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center"
              >
                <FaWhatsapp className="mr-2 text-xl text-white" />
                Começar agora
              </a>
            </Button>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
