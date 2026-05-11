import { Mail, Heart } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { Button } from "@/components/ui/button";

const CONTACT_EMAIL = "zelar.ia.messages@gmail.com";

export default function Footer() {
  return (
    <footer className="relative overflow-hidden bg-gradient-to-b from-emerald-950 to-slate-900 text-white border-t border-emerald-800/50">
      <div className="pointer-events-none absolute -right-20 bottom-0 h-48 w-48 rounded-full bg-emerald-500/20 blur-3xl" />
      <div className="container mx-auto px-4 py-12 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-2">
            <h3 className="font-mago text-2xl font-bold mb-4 text-emerald-100">Zelar</h3>
            <p className="text-emerald-100/80 mb-6 max-w-md leading-relaxed">
              Assistente para professores e autônomos: aulas pelo WhatsApp, calendário Google ou Microsoft, painel
              com alunos e preços — e Pluggy opcional para apoiar a conferência de recebimentos.
            </p>
            <Button
              asChild
              variant="default"
              className="bg-emerald-500 hover:bg-emerald-400 text-white font-semibold rounded-full px-6 py-2 border-0"
            >
              <a
                href="https://wa.me/5511988049268?text=Ol%C3%A1%2C%20quero%20usar%20o%20Zelar%20para%20organizar%20minhas%20aulas%20e%20alunos"
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
            <h4 className="text-lg font-semibold mb-4 text-emerald-100">Recursos</h4>
            <ul className="space-y-2 text-emerald-100/75">
              <li>Aulas em linguagem natural</li>
              <li>Google e Microsoft Calendar</li>
              <li>Alunos, grupos e pacotes no painel</li>
              <li>Pluggy (Open Finance) opcional</li>
            </ul>
          </div>

          <div>
            <h4 className="text-lg font-semibold mb-4 text-emerald-100">Contato</h4>
            <div className="space-y-4 text-emerald-100/85">
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="flex items-start gap-2 hover:text-white transition-colors"
              >
                <Mail className="w-5 h-5 mt-0.5 shrink-0" />
                <span className="break-all">{CONTACT_EMAIL}</span>
              </a>
              <p className="text-sm text-emerald-200/70">
                Use este e-mail para suporte, parcerias e comunicação oficial.
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-emerald-800/60 mt-12 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-emerald-200/60 text-sm">© {new Date().getFullYear()} Zelar. Todos os direitos reservados.</p>
            <div className="flex items-center text-emerald-200/60 text-sm">
              <span>Feito com</span>
              <Heart className="w-4 h-4 mx-2 text-emerald-400" />
              <span>para o Brasil</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
