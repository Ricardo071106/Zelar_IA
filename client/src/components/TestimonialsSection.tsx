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
      className="bg-white rounded-2xl p-6 border border-emerald-100 shadow-sm"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
    >
      <div className="flex items-center mb-4">
        <div className="text-emerald-600">
          {Array(Math.floor(stars))
            .fill(0)
            .map((_, i) => (
              <Star key={i} className="inline-block fill-current" size={16} />
            ))}
        </div>
      </div>
      <p className="text-slate-600 mb-6 text-sm leading-relaxed">{text}</p>
      <div className="flex items-center">
        <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700 font-semibold text-sm">
          {initials}
        </div>
        <div className="ml-3">
          <h4 className="font-medium text-slate-900 text-sm">{name}</h4>
          <p className="text-xs text-slate-500">{role}</p>
        </div>
      </div>
    </motion.div>
  );
}

export default function TestimonialsSection() {
  const testimonials = [
    {
      stars: 5,
      text: "Antes eu anotava tudo no WhatsApp e no caderno. Agora marco corte pelo Zelar e mando confirmação automática. Parou de faltar cliente.",
      initials: "RF",
      name: "Rafael F.",
      role: "Dono de barbearia",
    },
    {
      stars: 5,
      text: "Uso no salão todo dia. Escrevo 'escova com a Patrícia amanhã 10h' e pronto. A agenda fica organizada e eu não perco mensagem.",
      initials: "CM",
      name: "Camila M.",
      role: "Salão de beleza",
    },
    {
      stars: 5,
      text: "Dou aula particular e atendo pelo WhatsApp. O Zelar me ajuda a confirmar horário com aluno e ver a semana no painel. Simples demais.",
      initials: "AL",
      name: "Ana L.",
      role: "Professora particular",
    },
  ];

  return (
    <section id="depoimentos" className="py-16 md:py-24 bg-emerald-50/40">
      <div className="container mx-auto px-4">
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <p className="text-emerald-700 font-medium text-sm uppercase tracking-wide mb-3">Depoimentos</p>
          <h2 className="font-mago text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            Quem usa, sente a diferença na rotina
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Pequenos negócios que organizaram atendimento e agenda sem complicação.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
