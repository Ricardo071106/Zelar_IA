import { motion } from "framer-motion";
import {
  Scissors,
  Sparkles,
  Heart,
  Palette,
  PenTool,
  Dumbbell,
  GraduationCap,
  Stethoscope,
  User,
} from "lucide-react";

const businesses = [
  { icon: Scissors, label: "Barbearias" },
  { icon: Sparkles, label: "Salões de beleza" },
  { icon: Heart, label: "Clínicas de estética" },
  { icon: Palette, label: "Nail designers" },
  { icon: PenTool, label: "Tatuadores" },
  { icon: Sparkles, label: "Studios pequenos" },
  { icon: User, label: "Freelancers" },
  { icon: GraduationCap, label: "Professores particulares" },
  { icon: Dumbbell, label: "Personal trainers" },
  { icon: Stethoscope, label: "Consultórios independentes" },
];

export default function IdealBusinessesSection() {
  return (
    <section id="negocios" className="py-16 md:py-24 bg-emerald-50/50">
      <div className="container mx-auto px-4">
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <p className="text-emerald-700 font-medium text-sm uppercase tracking-wide mb-3">
            Para quem é
          </p>
          <h2 className="font-mago text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            Negócios que vivem de agenda e WhatsApp
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            O Zelar foi pensado para quem atende por hora, marca horários no celular e recebe por Pix — sem precisar
            de um sistema complexo.
          </p>
        </motion.div>

        <div className="flex flex-wrap justify-center gap-3 md:gap-4 max-w-4xl mx-auto">
          {businesses.map((business, index) => {
            const Icon = business.icon;
            return (
              <motion.div
                key={business.label}
                className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm"
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: index * 0.04 }}
              >
                <Icon className="w-4 h-4 text-emerald-600 shrink-0" />
                {business.label}
              </motion.div>
            );
          })}
        </div>

        <motion.p
          className="text-center text-sm text-slate-500 mt-10 max-w-xl mx-auto"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          Se você depende de conversa no WhatsApp, confirmação de horário e relacionamento com clientes, o Zelar
          encaixa na sua rotina.
        </motion.p>
      </div>
    </section>
  );
}
