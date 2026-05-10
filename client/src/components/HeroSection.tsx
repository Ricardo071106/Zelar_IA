import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { FaWhatsapp } from "react-icons/fa";

export default function HeroSection() {
  return (
    <section className="pt-24 pb-16 md:pt-32 md:pb-24 bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-800 text-white relative">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center">
          <motion.div
            className="md:w-1/2 mb-10 md:mb-0"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="font-mago text-4xl md:text-5xl font-bold mb-6 leading-tight">
              Sua agenda inteligente no WhatsApp
            </h1>
            <p className="text-lg md:text-xl mb-8 text-white/90">
              Agende por mensagem em português, conecte Google ou Microsoft no painel e receba lembretes no
              WhatsApp — sem app extra.
            </p>
            <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
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
                  Começar no WhatsApp
                </a>
              </Button>
            </div>
          </motion.div>

          <motion.div
            className="md:w-1/2 flex justify-center md:justify-end"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="relative w-72 h-[500px] md:w-80 md:h-[560px]">
              <div className="absolute inset-0 bg-black rounded-[40px] shadow-xl" />
              <div className="absolute inset-2 bg-white rounded-[32px] overflow-hidden">
                <div className="bg-[#e8f7f0] h-full flex flex-col">
                  <div className="bg-emerald-700 py-3 px-4 flex items-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="white"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="mr-3"
                    >
                      <path d="m15 19-7-7 7-7" />
                    </svg>
                    <div>
                      <p className="text-white font-medium">Zelar</p>
                      <p className="text-white text-xs opacity-80">WhatsApp</p>
                    </div>
                  </div>

                  <div className="flex-1 p-3 overflow-y-auto">
                    <div className="bg-white rounded-lg p-3 shadow-sm mb-3 max-w-[80%]">
                      <p className="text-sm text-slate-700">
                        Olá! Sou o Zelar. Diga o que precisa agendar em linguagem natural.
                      </p>
                    </div>

                    <div className="bg-emerald-600 rounded-lg p-3 shadow-sm mb-3 ml-auto max-w-[80%]">
                      <p className="text-sm text-white">
                        Reunião com João amanhã às 15h na sala de conferências
                      </p>
                    </div>

                    <div className="bg-white rounded-lg p-3 shadow-sm mb-3 max-w-[80%]">
                      <p className="text-sm text-slate-700">Evento criado com sucesso!</p>
                      <div className="mt-2 bg-emerald-50 rounded-md p-2">
                        <p className="text-xs font-medium text-emerald-900">Reunião com João</p>
                        <p className="text-xs text-slate-600">Amanhã · 15:00</p>
                        <p className="text-xs text-slate-600">Sala de conferências</p>
                      </div>
                    </div>

                    <div className="bg-white rounded-lg p-3 shadow-sm mb-3 max-w-[80%]">
                      <p className="text-sm text-slate-700">Adicione ao calendário:</p>
                      <div className="mt-2 flex flex-col gap-1">
                        <div className="bg-emerald-600 text-white text-xs px-2 py-1 rounded">Google</div>
                        <div style={{ height: "8px" }} />
                        <div className="bg-sky-600 text-white text-xs px-2 py-1 rounded">Outlook</div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-emerald-100/80 p-3 flex items-center">
                    <div className="bg-white rounded-full flex-1 py-2 px-4 flex items-center border border-emerald-200">
                      <span className="text-slate-400 text-sm">Mensagem</span>
                    </div>
                    <button
                      type="button"
                      className="ml-2 bg-emerald-600 text-white rounded-full w-10 h-10 flex items-center justify-center"
                      aria-label="Enviar"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="m22 2-7 20-4-9-9-4Z" />
                        <path d="M22 2 11 13" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 w-full overflow-hidden line-height-0">
        <svg
          data-name="Layer 1"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 1200 120"
          preserveAspectRatio="none"
          className="relative block w-[calc(100%+1.3px)] h-[70px]"
        >
          <path
            d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z"
            fill="#ffffff"
          />
        </svg>
      </div>
    </section>
  );
}
