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
      question: "How do I get started with Zelar?",
      answer: "Getting started is easy! Just click the \"Start Using Zelar\" button on this page, which will open a chat with the Zelar bot on Telegram. Follow the simple setup instructions to connect your calendar, and you're ready to start scheduling with voice or text messages."
    },
    {
      question: "Which calendar apps does Zelar support?",
      answer: "Zelar currently supports seamless integration with Google Calendar and Apple Calendar. We're working on adding support for more calendar services in the future. The integration process is simple and secure, requiring just a few authentication steps."
    },
    {
      question: "Is my scheduling data secure?",
      answer: "Absolutely! Security is our top priority. All your scheduling data is encrypted and stored securely in our dedicated database. We use industry-standard security practices to protect your information, and we never share your data with third parties without your explicit consent."
    },
    {
      question: "Can Zelar understand different languages?",
      answer: "Yes, Zelar's AI-powered system can understand and process schedules in multiple languages. Currently, we support English, Spanish, Portuguese, French, and German, with more languages being added regularly to enhance accessibility for users worldwide."
    },
    {
      question: "Is Zelar free to use?",
      answer: "Zelar offers a free tier with essential scheduling features. For power users, we offer a premium plan with advanced features like recurring events, multiple calendar support, and custom reminder times. Visit our bot on Telegram for current pricing information."
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
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Frequently Asked Questions</h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Find answers to common questions about Zelar.
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
