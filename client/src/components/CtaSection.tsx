import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { FaWhatsapp } from "react-icons/fa";
import { WHATSAPP_URL } from "@/lib/whatsapp";

export default function CtaSection() {
  return (
    <section className="py-16 md:py-24 bg-emerald-600 text-white relative overflow-hidden">
      <div className="pointer-events-none absolute right-0 top-0 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute left-0 bottom-0 h-48 w-48 rounded-full bg-emerald-500/30 blur-3xl" />

      <div className="container mx-auto px-4 text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="font-mago text-3xl md:text-4xl font-bold mb-4">
            Pronto para organizar seu negócio?
          </h2>
          <p className="text-lg md:text-xl text-emerald-50 mb-10 max-w-2xl mx-auto leading-relaxed">
            Comece pelo WhatsApp e sinta na prática: menos caos, mais rotina funcionando — sem planilha, sem
            complicação.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                asChild
                variant="default"
                size="lg"
                className="bg-white text-emerald-800 hover:bg-emerald-50 font-semibold rounded-full px-8 py-4 text-base shadow-lg"
              >
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center"
                >
                  <FaWhatsapp className="mr-2 text-xl text-[#25D366]" />
                  Começar agora
                </a>
              </Button>
            </motion.div>

            <Button
              asChild
              variant="outline"
              size="lg"
              className="border-white/40 text-white hover:bg-white/10 font-semibold rounded-full px-8 py-4 text-base bg-transparent"
            >
              <a href="#demo" className="inline-flex items-center">
                Ver funcionando
              </a>
            </Button>
          </div>

          <p className="mt-6 text-sm text-emerald-100/80">Sem cartão. Sem instalação. Só conversar no WhatsApp.</p>
        </motion.div>
      </div>
    </section>
  );
}
