import { motion } from "framer-motion";
import { MessageSquare, Globe2, Users, Link, Brain, Send } from "lucide-react";

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
      title: "Linguagem natural",
      description: "Diga frases como ‘agendar revisão com o time amanhã às 15h’ e o Zelar identifica automaticamente título, data e contexto."
    },
    {
      icon: <Globe2 className="text-primary text-2xl" />,
      title: "Fuso horário inteligente",
      description: "Cada usuário escolhe seu fuso e o bot converte horários, garantindo agenda consistente para times distribuídos."
    },
    {
      icon: <Users className="text-primary text-2xl" />,
      title: "Convites instantâneos",
      description: "Emails mencionados na conversa são reconhecidos e adicionados como convidados nos links de calendário gerados."
    },
    {
      icon: <Link className="text-primary text-2xl" />,
      title: "Links para calendários",
      description: "Receba links prontos para Google Calendar e Outlook com horário, descrição e participantes já preenchidos."
    },
    {
      icon: <Brain className="text-primary text-2xl" />,
      title: "Aprendizado contínuo",
      description: "O Zelar aprende padrões recorrentes e acelera os próximos agendamentos, sem depender de palavras-chave rígidas."
    },
    {
      icon: <Send className="text-primary text-2xl" />,
      title: "100% no Telegram",
      description: "Nenhum aplicativo extra: todos os fluxos — criar, listar ou ajustar eventos — acontecem direto no chat do bot."
    }
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
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Por Que Escolher o Zelar</h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            O Zelar combina o poder da IA com a conveniência do Telegram para tornar o agendamento sem esforço.
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
