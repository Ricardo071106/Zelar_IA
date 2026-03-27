import { motion } from "framer-motion";
import { Star } from "lucide-react";

interface TestimonialProps {
  stars: number;
  text: string;
  initials: string;
  name: string;
  role: string;
  delay: number;
}

function Testimonial({ stars, text, initials, name, role, delay }: TestimonialProps) {
  return (
    <motion.div 
      className="bg-white rounded-xl p-6 shadow-md"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
    >
      <div className="flex items-center mb-4">
        <div className="text-primary">
          {Array(Math.floor(stars)).fill(0).map((_, i) => (
            <Star key={i} className="inline-block fill-current" size={16} />
          ))}
          {stars % 1 > 0 && (
            <svg 
              className="inline-block text-primary" 
              width="16" 
              height="16" 
              viewBox="0 0 24 24" 
              fill="none" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path 
                d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" 
                fill="currentColor" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
                clipPath="inset(0 50% 0 0)"
              />
              <path 
                d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>
      </div>
      <p className="text-gray-600 mb-6">{text}</p>
      <div className="flex items-center">
        <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center text-primary font-semibold">
          {initials}
        </div>
        <div className="ml-3">
          <h4 className="font-medium">{name}</h4>
          <p className="text-sm text-gray-500">{role}</p>
        </div>
      </div>
    </motion.div>
  );
}

export default function TestimonialsSection() {
  const testimonials = [
    {
      stars: 5,
      text: "\"O Zelar transformou completamente como gerencio minha agenda. Basta eu enviar uma mensagem rápida sobre meus compromissos e tudo é organizado automaticamente. Os lembretes salvam minha vida!\"",
      initials: "MR",
      name: "Maria Rodrigues",
      role: "Diretora de Marketing"
    },
    {
      stars: 5,
      text: "\"Como empresário ocupado, acompanhar reuniões sempre foi um desafio. O Zelar torna isso sem esforço. Falo com ele como falaria com um assistente, e entende o contexto perfeitamente. A integração com calendário é impecável.\"",
      initials: "JL",
      name: "João Silva",
      role: "Empreendedor de Tecnologia"
    },
    {
      stars: 4.5,
      text: "\"Adoro não precisar de outro app - o Zelar funciona direto no Telegram onde já converso com amigos e colegas. A IA é impressionante ao entender até meus pedidos de agenda mais complicados. Os lembretes garantem que nunca perca compromissos.\"",
      initials: "SK",
      name: "Sarah Costa",
      role: "Gerente de Projetos"
    }
  ];

  return (
    <section id="testimonials" className="py-16 md:py-24 bg-light">
      <div className="container mx-auto px-4">
        <motion.div 
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">O Que Nossos Usuários Dizem</h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Junte-se a milhares de usuários satisfeitos que simplificaram seus agendamentos com o Zelar.
          </p>
        </motion.div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <Testimonial 
              key={index}
              stars={testimonial.stars}
              text={testimonial.text}
              initials={testimonial.initials}
              name={testimonial.name}
              role={testimonial.role}
              delay={index * 0.1}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
