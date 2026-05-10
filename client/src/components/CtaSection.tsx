import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { FaWhatsapp } from "react-icons/fa";

export default function CtaSection() {
  return (
    <section className="py-16 md:py-24 bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-800 text-white relative overflow-hidden">
      <div className="pointer-events-none absolute left-1/4 top-0 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
      <div className="container mx-auto px-4 text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="font-mago text-3xl md:text-4xl font-bold mb-6">Pronto para organizar sua agenda?</h2>
          <p className="text-xl text-white/90 mb-10 max-w-2xl mx-auto">
            Fale com o Zelar no WhatsApp e, quando quiser, abra o painel pelo link que enviamos para conectar
            seu calendário.
          </p>

          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
            <Button
              asChild
              variant="default"
              size="lg"
              className="bg-white text-emerald-800 hover:bg-emerald-50 font-semibold rounded-full px-8 py-4 text-lg shadow-lg"
            >
              <a
                href="https://wa.me/5511988049268?text=Ol%C3%A1%2C%20gostaria%20de%20usar%20o%20Zelar%20para%20agendar%20meus%20compromissos"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center"
              >
                <FaWhatsapp className="mr-3 text-xl" />
                Usar no WhatsApp
              </a>
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
