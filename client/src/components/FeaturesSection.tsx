import { motion } from "framer-motion";
import { Mic, Bell, Calendar, Bot, Database, Twitter } from "lucide-react";

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
      icon: <Mic className="text-primary text-2xl" />,
      title: "Voice & Text Recognition",
      description: "Send voice messages or text about your commitments, and Zelar will understand and process them automatically."
    },
    {
      icon: <Bell className="text-primary text-2xl" />,
      title: "Smart Reminders",
      description: "Get notifications 24 hours and 30 minutes before your scheduled events, so you're always prepared."
    },
    {
      icon: <Calendar className="text-primary text-2xl" />,
      title: "Calendar Integration",
      description: "Seamlessly sync your events with Google Calendar or Apple Calendar for a centralized scheduling experience."
    },
    {
      icon: <Bot className="text-primary text-2xl" />,
      title: "AI-Powered Understanding",
      description: "Leveraging OpenRouter AI technology to accurately understand your scheduling needs, even from casual conversation."
    },
    {
      icon: <Database className="text-primary text-2xl" />,
      title: "Secure Storage",
      description: "All your events are safely stored in our dedicated database, ensuring you never lose important appointments."
    },
    {
      icon: <Twitter className="text-primary text-2xl" />,
      title: "Telegram Native",
      description: "No new apps to download - Zelar operates entirely within Telegram, the messaging app you already use daily."
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
