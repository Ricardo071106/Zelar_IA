import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { FaWhatsapp } from "react-icons/fa";
import { WHATSAPP_URL } from "@/lib/whatsapp";

export default function HeroSection() {
  return (
    <section className="pt-24 pb-12 md:pt-32 md:pb-20 bg-white relative">
      <div className="container mx-auto px-4">
        <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-16">
          <motion.div
            className="lg:w-1/2 text-center lg:text-left"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-200 px-4 py-1.5 text-sm text-emerald-800 font-medium mb-6">
              <FaWhatsapp className="text-[#25D366] text-base" />
              Organização no WhatsApp
            </div>

            <h1 className="font-mago text-4xl md:text-5xl lg:text-[3.25rem] font-bold mb-6 leading-tight text-slate-900">
              Organize sua agenda e confirme clientes automaticamente no WhatsApp
            </h1>

            <p className="text-lg md:text-xl mb-8 text-slate-600 leading-relaxed max-w-xl mx-auto lg:mx-0">
              Menos faltas, menos mensagens perdidas e mais controle da rotina do seu negócio — sem planilha, sem
              complicação.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center lg:justify-start">
              <Button
                asChild
                variant="default"
                size="lg"
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-full px-8 py-4 text-base shadow-md"
              >
                <a href="#demo" className="inline-flex items-center justify-center">
                  Ver funcionando
                </a>
              </Button>

              <Button
                asChild
                variant="outline"
                size="lg"
                className="border-emerald-300 text-emerald-800 hover:bg-emerald-50 font-semibold rounded-full px-8 py-4 text-base"
              >
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center"
                >
                  <FaWhatsapp className="mr-2 text-lg text-[#25D366]" />
                  Testar grátis
                </a>
              </Button>
            </div>

            <p className="mt-6 text-sm text-slate-500">
              Para barbearias, salões, estúdios, freelancers e profissionais autônomos.
            </p>
          </motion.div>

          <motion.div
            className="lg:w-1/2 flex justify-center"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="relative w-[280px] sm:w-72 md:w-80">
              <div className="absolute -inset-4 bg-emerald-100/60 rounded-[3rem] blur-2xl" />
              <div className="relative bg-slate-900 rounded-[2.5rem] p-2 shadow-2xl">
                <div className="bg-[#ece5dd] rounded-[2rem] overflow-hidden">
                  <div className="bg-[#075E54] py-3 px-4 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold text-sm">
                      Z
                    </div>
                    <div>
                      <p className="text-white font-medium text-sm">Zelar</p>
                      <p className="text-emerald-100 text-xs">online</p>
                    </div>
                  </div>

                  <div className="p-3 space-y-2 min-h-[340px]">
                    <div className="bg-white rounded-lg rounded-tl-none p-2.5 shadow-sm max-w-[85%]">
                      <p className="text-sm text-slate-800">
                        Olá! Sou o Zelar. Me diga o horário — cliente, serviço e dia.
                      </p>
                      <p className="text-[10px] text-slate-400 text-right mt-1">09:12</p>
                    </div>

                    <div className="bg-[#DCF8C6] rounded-lg rounded-tr-none p-2.5 shadow-sm max-w-[85%] ml-auto">
                      <p className="text-sm text-slate-800">Corte com a Ana amanhã às 15h</p>
                      <p className="text-[10px] text-slate-500 text-right mt-1">09:13</p>
                    </div>

                    <div className="bg-white rounded-lg rounded-tl-none p-2.5 shadow-sm max-w-[85%]">
                      <p className="text-sm text-slate-800">Agendado!</p>
                      <div className="mt-2 bg-emerald-50 rounded-lg p-2 border border-emerald-100">
                        <p className="text-xs font-semibold text-emerald-900">Corte · Ana Silva</p>
                        <p className="text-xs text-slate-600">Amanhã · 15:00</p>
                      </div>
                      <p className="text-[10px] text-slate-400 text-right mt-1">09:13</p>
                    </div>

                    <div className="bg-white rounded-lg rounded-tl-none p-2.5 shadow-sm max-w-[85%]">
                      <p className="text-sm text-slate-800">
                        Lembrete enviado para a Ana confirmar o horário.
                      </p>
                      <p className="text-[10px] text-slate-400 text-right mt-1">09:14</p>
                    </div>
                  </div>

                  <div className="bg-[#f0f0f0] px-3 py-2 flex items-center gap-2">
                    <div className="flex-1 bg-white rounded-full py-2 px-4 text-sm text-slate-400">
                      Mensagem
                    </div>
                    <div className="w-9 h-9 rounded-full bg-[#075E54] flex items-center justify-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="white"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="m22 2-7 20-4-9-9-4Z" />
                        <path d="M22 2 11 13" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
