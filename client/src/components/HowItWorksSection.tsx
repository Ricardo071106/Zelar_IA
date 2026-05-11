import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import ChatDemo from "./ChatDemo";

export default function HowItWorksSection() {
  const [activeStep, setActiveStep] = useState(1);

  const steps = [
    {
      number: 1,
      title: "Fale a aula no WhatsApp",
      description:
        "Em português, diga disciplina, aluno, dia e horário — por exemplo: “matemática com o Pedro amanhã às 16h online”.",
    },
    {
      number: 2,
      title: "Interpretação inteligente",
      description:
        "O Zelar entende o texto (e pode usar IA quando preciso) para montar o compromisso na sua agenda com título e horário coerentes.",
    },
    {
      number: 3,
      title: "Calendário conectado",
      description:
        "Com Google ou Microsoft ligados no painel, a aula pode aparecer na mesma agenda que você já compartilha com alunos.",
    },
    {
      number: 4,
      title: "Acompanhe e ajuste",
      description:
        "Liste próximas aulas, altere horários ou cancele pela conversa; no painel você complementa alunos, preços, pacotes e Pluggy se quiser conciliar recebimentos.",
    },
  ];

  return (
    <section id="how-it-works" className="py-16 md:py-24 bg-light">
      <div className="container mx-auto px-4">
        <motion.div 
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Como o Zelar funciona</h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Um fluxo pensado para professor autônomo ou estúdio pequeno: conversa no WhatsApp, organização no painel e
            calendário profissional.
          </p>
        </motion.div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="space-y-12">
              {steps.map((step) => (
                <div className="flex" key={step.number}>
                  <div className="flex-shrink-0 mr-4">
                    <div className="bg-primary text-white rounded-full w-10 h-10 flex items-center justify-center font-semibold">
                      {step.number}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                    <p className="text-gray-600">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
          
          <motion.div 
            className="relative mt-10 lg:mt-0"
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="bg-white p-6 rounded-xl shadow-lg">
              <div className="rounded-lg overflow-hidden bg-gray-200 mb-6">
                <div className="bg-[#f6f6f6] h-[400px] rounded-lg p-4 overflow-hidden">
                  <div className="bg-primary rounded-t-lg p-3">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
                        <span className="text-primary font-bold">Z</span>
                      </div>
                      <div className="ml-3">
                        <p className="text-white font-medium">Zelar</p>
                        <p className="text-white text-xs opacity-80">Aulas no WhatsApp</p>
                      </div>
                    </div>
                  </div>
                  <ChatDemo step={activeStep} />
                </div>
              </div>
              
              <div className="flex flex-wrap gap-3 justify-center">
                {[1, 2, 3, 4].map((step) => (
                  <Button
                    key={step}
                    onClick={() => setActiveStep(step)}
                    variant={activeStep === step ? "default" : "secondary"}
                    className={`rounded-full text-sm ${
                      activeStep === step 
                        ? "bg-primary text-white" 
                        : "bg-gray-200 text-dark"
                    }`}
                  >
                    {step === 1 && "Mensagem"}
                    {step === 2 && "Interpretação"}
                    {step === 3 && "Calendário"}
                    {step === 4 && "Painel"}
                  </Button>
                ))}
              </div>
            </div>
            
            {/* Decorative elements */}
            <div className="absolute -bottom-4 -right-4 w-64 h-64 bg-primary/10 rounded-full -z-10"></div>
            <div className="absolute -top-4 -left-4 w-32 h-32 bg-primary/10 rounded-full -z-10"></div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
