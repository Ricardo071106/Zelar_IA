import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";

interface FaqItemProps {
  question: string;
  answer: string;
  isOpen: boolean;
  onClick: () => void;
  delay: number;
}

function FaqItem({ question, answer, isOpen, onClick, delay }: FaqItemProps) {
  return (
    <motion.div 
      className="border border-gray-200 rounded-lg overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
    >
      <button 
        className="w-full text-left p-4 flex justify-between items-center focus:outline-none"
        onClick={onClick}
        aria-expanded={isOpen}
      >
        <span className="font-medium">{question}</span>
        <ChevronDown 
          className={`text-primary transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} 
        />
      </button>
      <div 
        className={`p-4 pt-0 border-t border-gray-200 ${isOpen ? "block" : "hidden"}`}
      >
        <p className="text-gray-600">{answer}</p>
      </div>
    </motion.div>
  );
}

export default function FaqSection() {
  const [openItem, setOpenItem] = useState<number | null>(null);

  const faqItems = [
    {
      question: "Como começar a usar o Zelar?",
      answer: "Começar é fácil! Basta clicar no botão \"Começar a Usar o Zelar\" nesta página, que abrirá um chat com o bot Zelar no Telegram. Siga as instruções simples de configuração e você estará pronto para começar a agendar com mensagens de texto."
    },
    {
      question: "Quais aplicativos de calendário o Zelar suporta?",
      answer: "O Zelar oferece integração perfeita com Google Calendar, Outlook e Apple Calendar através de links diretos. O processo é simples e funciona com apenas um clique para adicionar eventos ao seu calendário preferido."
    },
    {
      question: "Meus dados de agendamento estão seguros?",
      answer: "Absolutamente! A segurança é nossa prioridade máxima. Todos os seus dados de agendamento são criptografados e armazenados com segurança em nosso banco de dados dedicado. Usamos práticas de segurança padrão da indústria para proteger suas informações."
    },
    {
      question: "O Zelar entende português brasileiro?",
      answer: "Sim! O sistema de IA do Zelar foi especialmente otimizado para entender e processar agendamentos em português brasileiro de forma natural. Você pode falar normalmente como 'reunião amanhã às 15h' que o bot entenderá perfeitamente."
    },
    {
      question: "O Zelar é gratuito?",
      answer: "Sim, o Zelar é completamente gratuito! Oferecemos todas as funcionalidades essenciais de agendamento sem custo. Basta acessar nosso bot no Telegram e começar a usar imediatamente."
    }
  ];

  const handleToggle = (index: number) => {
    if (openItem === index) {
      setOpenItem(null);
    } else {
      setOpenItem(index);
    }
  };

  return (
    <section id="faq" className="py-16 md:py-24 bg-white">
      <div className="container mx-auto px-4">
        <motion.div 
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Perguntas Frequentes</h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Encontre respostas para dúvidas comuns sobre o Zelar.
          </p>
        </motion.div>
        
        <div className="max-w-3xl mx-auto">
          <div className="space-y-6">
            {faqItems.map((item, index) => (
              <FaqItem 
                key={index}
                question={item.question}
                answer={item.answer}
                isOpen={openItem === index}
                onClick={() => handleToggle(index)}
                delay={index * 0.1}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
