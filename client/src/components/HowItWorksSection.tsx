import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import ChatDemo from "./ChatDemo";

export default function HowItWorksSection() {
  const [activeStep, setActiveStep] = useState(1);

  const steps = [
    {
      number: 1,
      title: "Converse no WhatsApp",
      description:
        "Mande uma mensagem com o horário — como você já faz com clientes. Exemplo: “Manicure com a Carla sexta às 14h”.",
    },
    {
      number: 2,
      title: "O Zelar organiza",
      description:
        "O horário entra na sua agenda com cliente, serviço e data. Tudo registrado, sem anotar em outro lugar.",
    },
    {
      number: 3,
      title: "Cliente recebe confirmação",
      description:
        "Lembretes automáticos ajudam a confirmar presença. Menos faltas, menos buracos na agenda.",
    },
    {
      number: 4,
      title: "Acompanhe no painel",
      description:
        "Quando precisar, abra o painel pelo celular: veja a semana, consulte clientes e ajuste horários com calma.",
    },
  ];

  return (
    <section id="como-funciona" className="py-16 md:py-24 bg-emerald-50/40">
      <div className="container mx-auto px-4">
        <motion.div
          className="text-center mb-12 md:mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <p className="text-emerald-700 font-medium text-sm uppercase tracking-wide mb-3">Como funciona</p>
          <h2 className="font-mago text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            Simples como mandar uma mensagem
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Você continua no WhatsApp. O Zelar cuida da organização por trás.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="space-y-8">
              {steps.map((step) => (
                <div className="flex gap-4" key={step.number}>
                  <div className="flex-shrink-0">
                    <div className="bg-emerald-600 text-white rounded-full w-10 h-10 flex items-center justify-center font-semibold text-sm">
                      {step.number}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-1">{step.title}</h3>
                    <p className="text-slate-600 text-sm leading-relaxed">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            className="relative"
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="bg-white rounded-2xl border border-emerald-100 shadow-lg overflow-hidden">
              <div className="bg-[#075E54] p-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-white rounded-full flex items-center justify-center">
                    <span className="text-emerald-700 font-bold text-sm">Z</span>
                  </div>
                  <div>
                    <p className="text-white font-medium text-sm">Zelar</p>
                    <p className="text-emerald-100 text-xs">Agenda no WhatsApp</p>
                  </div>
                </div>
              </div>
              <ChatDemo step={activeStep} />
            </div>

            <div className="flex flex-wrap gap-2 justify-center mt-4">
              {[1, 2, 3, 4].map((step) => (
                <Button
                  key={step}
                  onClick={() => setActiveStep(step)}
                  variant={activeStep === step ? "default" : "secondary"}
                  size="sm"
                  className={`rounded-full text-xs sm:text-sm ${
                    activeStep === step
                      ? "bg-emerald-600 text-white hover:bg-emerald-700"
                      : "bg-white text-slate-700 border border-emerald-100"
                  }`}
                >
                  {step === 1 && "Mensagem"}
                  {step === 2 && "Agenda"}
                  {step === 3 && "Confirmação"}
                  {step === 4 && "Consulta"}
                </Button>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
