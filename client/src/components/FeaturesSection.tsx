import { motion } from "framer-motion";
import { CalendarCheck, Bell, MessageCircle, LayoutDashboard, Clock, UserCheck } from "lucide-react";

interface BenefitCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  delay: number;
}

function BenefitCard({ icon, title, description, delay }: BenefitCardProps) {
  return (
    <motion.div
      className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-md hover:border-emerald-200"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
    >
      <div className="bg-emerald-50 rounded-xl w-12 h-12 flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-slate-900 mb-2">{title}</h3>
      <p className="text-slate-600 text-sm leading-relaxed">{description}</p>
    </motion.div>
  );
}

export default function FeaturesSection() {
  const benefits = [
    {
      icon: <MessageCircle className="text-emerald-700 text-xl" />,
      title: "Agende pelo WhatsApp",
      description:
        "Escreva em português, como você fala com o cliente: serviço, horário e nome. O Zelar organiza na sua agenda.",
    },
    {
      icon: <Bell className="text-emerald-700 text-xl" />,
      title: "Confirmações automáticas",
      description:
        "Lembretes enviados no WhatsApp reduzem faltas. Seu cliente recebe aviso — você não precisa cobrar manualmente.",
    },
    {
      icon: <CalendarCheck className="text-emerald-700 text-xl" />,
      title: "Agenda sempre visível",
      description:
        "Veja o que tem hoje, amanhã e na semana. Sem caderno, sem print de conversa, sem adivinhar quem vem.",
    },
    {
      icon: <UserCheck className="text-emerald-700 text-xl" />,
      title: "Clientes organizados",
      description:
        "Histórico de atendimentos e dados dos clientes num painel simples — para você acompanhar quem já veio e quem falta confirmar.",
    },
    {
      icon: <Clock className="text-emerald-700 text-xl" />,
      title: "Menos tempo respondendo",
      description:
        "Pare de repetir horários disponíveis toda hora. Consulte a agenda na conversa e responda com mais rapidez.",
    },
    {
      icon: <LayoutDashboard className="text-emerald-700 text-xl" />,
      title: "Painel simples no celular",
      description:
        "Acesse pelo link que enviamos no WhatsApp. Funciona bem no smartphone — que é onde você já trabalha.",
    },
  ];

  return (
    <section id="beneficios" className="py-16 md:py-24 bg-white">
      <div className="container mx-auto px-4">
        <motion.div
          className="text-center mb-12 md:mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <p className="text-emerald-700 font-medium text-sm uppercase tracking-wide mb-3">Benefícios</p>
          <h2 className="font-mago text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            O que muda na sua rotina
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Organização operacional de verdade — sem promessas de ERP, sem complicação desnecessária.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {benefits.map((benefit, index) => (
            <BenefitCard
              key={benefit.title}
              icon={benefit.icon}
              title={benefit.title}
              description={benefit.description}
              delay={index * 0.08}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
