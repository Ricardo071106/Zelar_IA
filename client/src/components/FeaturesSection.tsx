import { motion } from "framer-motion";
import { MessageSquare, Globe2, Users, Link, Wallet, Send } from "lucide-react";

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  delay: number;
}

function FeatureCard({ icon, title, description, delay }: FeatureCardProps) {
  return (
    <motion.div 
      className="feature-card bg-light rounded-xl p-6 shadow-md transition-all duration-300 hover:translate-y-[-5px] hover:shadow-lg"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
    >
      <div className="bg-primary/10 rounded-full w-14 h-14 flex items-center justify-center mb-5">
        {icon}
      </div>
      <h3 className="text-xl font-semibold mb-3">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </motion.div>
  );
}

export default function FeaturesSection() {
  const features = [
    {
      icon: <MessageSquare className="text-primary text-2xl" />,
      title: "Aulas em português natural",
      description:
        "Diga “aula de violão com o Lucas sábado às 10h” ou use pacotes nomeados no WhatsApp: o Zelar monta o evento na sua agenda.",
    },
    {
      icon: <Globe2 className="text-primary text-2xl" />,
      title: "Fuso horário certo",
      description:
        "Você define o fuso no painel ou no bot; horários de aula e lembretes respeitam a região do professor e do compromisso.",
    },
    {
      icon: <Users className="text-primary text-2xl" />,
      title: "Alunos e grupos no painel",
      description:
        "Planilha de convidados, grupos para marcar vários alunos de uma vez e dados que acompanham a rotina de aulas — sem planilha solta fora do fluxo.",
    },
    {
      icon: <Link className="text-primary text-2xl" />,
      title: "Google e Microsoft Calendar",
      description:
        "Conecte o calendário no painel: as aulas criadas pelo WhatsApp podem ir para a mesma agenda que você já usa com alunos.",
    },
    {
      icon: <Wallet className="text-primary text-2xl" />,
      title: "Preços, pacotes e Pluggy (opcional)",
      description:
        "Defina valor por aula e pacotes no painel. Com Pluggy (Open Finance), o sistema pode usar movimentações da conta para apoiar a marcação de aulas como pagas, conforme as regras configuradas.",
    },
    {
      icon: <Send className="text-primary text-2xl" />,
      title: "Lembretes no WhatsApp",
      description:
        "Sem outro app para o professor: criar, listar e ajustar aulas na conversa, com lembretes enviados pelo próprio WhatsApp.",
    },
  ];

  return (
    <section id="features" className="py-16 md:py-24 bg-white">
      <div className="container mx-auto px-4">
        <motion.div 
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Feito para quem dá aula</h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            O Zelar une WhatsApp, calendário e painel do organizador: menos troca de app, mais clareza para você e
            para o aluno.
          </p>
        </motion.div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <FeatureCard 
              key={index}
              icon={feature.icon}
              title={feature.title}
              description={feature.description}
              delay={index * 0.1}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
