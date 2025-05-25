import { motion } from "framer-motion";
import { MessageSquare, Calendar, Bot, Trash2, Eye, Twitter } from "lucide-react";

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
      title: "Natural Language Processing",
      description: "Simplesmente diga 'agendar reunião amanhã às 15h' e o Zelar entenderá automaticamente usando inteligência artificial."
    },
    {
      icon: <Calendar className="text-primary text-2xl" />,
      title: "Links Diretos para Calendários",
      description: "Receba links prontos para adicionar eventos ao Google Calendar, Outlook ou Apple Calendar com apenas um clique."
    },
    {
      icon: <Eye className="text-primary text-2xl" />,
      title: "Visualizar Eventos",
      description: "Diga 'mostrar meus eventos' ou use o comando /eventos para ver todos os seus compromissos agendados."
    },
    {
      icon: <Bot className="text-primary text-2xl" />,
      title: "IA Avançada com OpenRouter",
      description: "Tecnologia de ponta para entender suas mensagens em português de forma natural e precisa."
    },
    {
      icon: <Trash2 className="text-primary text-2xl" />,
      title: "Cancelar Eventos",
      description: "Cancele compromissos facilmente dizendo 'cancelar reunião de amanhã' - o bot entenderá qual evento você quer remover."
    },
    {
      icon: <Twitter className="text-primary text-2xl" />,
      title: "100% no Telegram",
      description: "Nenhum app para baixar - o Zelar funciona completamente dentro do Telegram que você já usa todos os dias."
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
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Why Choose Zelar</h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Zelar combines the power of AI with the convenience of Telegram to make scheduling effortless.
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
