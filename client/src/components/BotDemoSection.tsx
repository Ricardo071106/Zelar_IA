import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { FaWhatsapp } from "react-icons/fa";
import ChatDemo from "@/components/ChatDemo";

export default function BotDemoSection() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (step < 3) {
      const timer = setTimeout(
        () => {
          setStep((prev) => prev + 1);
        },
        step === 0 ? 1000 : 5000,
      );

      return () => clearTimeout(timer);
    }
  }, [step]);

  return (
    <section id="demo" className="py-20 bg-white/60 backdrop-blur-sm">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <motion.h2
            className="font-mago text-3xl md:text-4xl font-bold text-emerald-950 mb-4"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            Veja o Zelar em ação
          </motion.h2>
          <motion.p
            className="text-xl text-slate-600 max-w-3xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            Agende pelo WhatsApp com a mesma naturalidade de uma conversa.
          </motion.p>
        </div>

        <div className="flex flex-col lg:flex-row items-center justify-between gap-8 lg:gap-12">
          <div className="w-full lg:w-1/2">
            <motion.div
              className="rounded-2xl border border-emerald-200/70 bg-white/90 backdrop-blur-md shadow-[0_0_48px_rgba(16,185,129,0.08)] p-4 md:p-6 max-w-lg mx-auto"
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
              <h3 className="text-2xl font-bold text-emerald-950 font-mago">No WhatsApp</h3>
              <p className="text-slate-600">
                O Zelar roda onde você já está. Sem instalar outro app: envie texto ou áudio e receba o evento
                pronto, com links para Google e Outlook.
              </p>

              <div className="space-y-4">
                {[
                  "Eventos com linguagem natural em português",
                  "Lembretes automáticos no WhatsApp",
                  "Integração com Google Calendar e Microsoft",
                  "Painel web para e-mail, fuso e lista de convidados",
                ].map((feature, index) => (
                  <div key={index} className="flex items-start">
                    <div className="flex-shrink-0 h-6 w-6 rounded-full bg-emerald-100 flex items-center justify-center mt-1">
                      <svg
                        className="h-4 w-4 text-emerald-700"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="ml-3 text-slate-600">{feature}</p>
                  </div>
                ))}
              </div>

              <div className="pt-4">
                <Button
                  asChild
                  variant="default"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-full px-8 py-4 text-lg w-full sm:w-auto"
                >
                  <a
                    href="https://wa.me/5511988049268?text=Ol%C3%A1%2C%20gostaria%20de%20usar%20o%20Zelar%20para%20agendar%20meus%20compromissos"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center"
                  >
                    <FaWhatsapp className="mr-3 text-xl" />
                    Abrir WhatsApp
                  </a>
                </Button>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
