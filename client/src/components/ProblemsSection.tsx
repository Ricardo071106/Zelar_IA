import { motion } from "framer-motion";
import { CalendarX, MessageSquareOff, Clock, Users } from "lucide-react";

const problems = [
  {
    icon: <MessageSquareOff className="text-emerald-700 text-2xl" />,
    title: "Mensagens perdidas no WhatsApp",
    description:
      "Cliente pediu horário, você respondeu tarde — e ele já marcou em outro lugar. Sem organização, cada conversa vira uma corrida.",
  },
  {
    icon: <CalendarX className="text-emerald-700 text-2xl" />,
    title: "Faltas e horários esquecidos",
    description:
      "Sem confirmação automática, clientes esquecem. Você reserva a cadeira, a sala ou a agenda — e ninguém aparece.",
  },
  {
    icon: <Clock className="text-emerald-700 text-2xl" />,
    title: "Agenda no caderno ou na cabeça",
    description:
      "Planilha solta, bloco de notas, print de conversa. Difícil saber quem vem hoje, amanhã ou o que ficou pendente.",
  },
  {
    icon: <Users className="text-emerald-700 text-2xl" />,
    title: "Atendimento sem rotina clara",
    description:
      "Você atende bem, mas a operação vive no improviso. Falta um jeito simples de acompanhar clientes e horários.",
  },
];

export default function ProblemsSection() {
  return (
    <section id="problemas" className="py-16 md:py-24 bg-white">
      <div className="container mx-auto px-4">
        <motion.div
          className="text-center mb-12 md:mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <p className="text-emerald-700 font-medium text-sm uppercase tracking-wide mb-3">
            Você reconhece isso?
          </p>
          <h2 className="font-mago text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            O caos do WhatsApp custa clientes
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Pequenos negócios que vivem de agenda e relacionamento perdem tempo — e dinheiro — quando a rotina não
            está organizada.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {problems.map((problem, index) => (
            <motion.div
              key={problem.title}
              className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-6"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.08 }}
            >
              <div className="bg-white rounded-xl w-12 h-12 flex items-center justify-center mb-4 shadow-sm border border-emerald-100">
                {problem.icon}
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">{problem.title}</h3>
              <p className="text-slate-600 text-sm leading-relaxed">{problem.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
