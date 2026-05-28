import { Mail, Heart } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { Button } from "@/components/ui/button";
import { WHATSAPP_URL } from "@/lib/whatsapp";

const CONTACT_EMAIL = "zelar.ia.messages@gmail.com";

export default function Footer() {
  return (
    <footer className="relative overflow-hidden bg-slate-900 text-white border-t border-emerald-900/30">
      <div className="container mx-auto px-4 py-12 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-2">
            <h3 className="font-mago text-2xl font-bold mb-4 text-white">Zelar</h3>
            <p className="text-slate-400 mb-6 max-w-md leading-relaxed text-sm">
              O sistema simples que organiza negócios movidos por WhatsApp e Pix. Agenda, confirmações e atendimento —
              sem ERP, sem complicação.
            </p>
            <Button
              asChild
              variant="default"
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-full px-6 py-2 border-0"
            >
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center"
              >
                <FaWhatsapp className="mr-2 text-lg" />
                Falar no WhatsApp
              </a>
            </Button>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-4 text-white uppercase tracking-wide">O que faz</h4>
            <ul className="space-y-2 text-slate-400 text-sm">
              <li>Agenda no WhatsApp</li>
              <li>Confirmações automáticas</li>
              <li>Lembretes para clientes</li>
              <li>Painel simples no celular</li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-4 text-white uppercase tracking-wide">Contato</h4>
            <div className="space-y-4 text-slate-400 text-sm">
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="flex items-start gap-2 hover:text-white transition-colors"
              >
                <Mail className="w-4 h-4 mt-0.5 shrink-0" />
                <span className="break-all">{CONTACT_EMAIL}</span>
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-800 mt-12 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-slate-500 text-sm">© {new Date().getFullYear()} Zelar. Todos os direitos reservados.</p>
            <div className="flex items-center text-slate-500 text-sm">
              <span>Feito com</span>
              <Heart className="w-4 h-4 mx-2 text-emerald-500" />
              <span>para o Brasil</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
