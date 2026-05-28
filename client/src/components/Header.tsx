import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import Logo from "./Logo";
import { WHATSAPP_URL } from "@/lib/whatsapp";

const navLinks = [
  { href: "#demo", label: "Demonstração" },
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#beneficios", label: "Benefícios" },
  { href: "#negocios", label: "Para quem é" },
];

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  return (
    <header
      className={`fixed w-full z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/95 backdrop-blur-md shadow-sm border-b border-emerald-100"
          : "bg-white/90 backdrop-blur-sm border-b border-emerald-50"
      }`}
    >
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <Logo />

        <nav className="hidden lg:flex items-center gap-6">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-slate-600 hover:text-emerald-700 transition-colors"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:flex">
          <Button
            asChild
            variant="default"
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-full px-5 py-2 border-0"
          >
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center"
            >
              <FaWhatsapp className="mr-2 text-lg" />
              Começar agora
            </a>
          </Button>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="md:hidden text-emerald-800 focus:outline-none"
          onClick={toggleMobileMenu}
          aria-label="Menu"
        >
          {mobileMenuOpen ? <X /> : <Menu />}
        </Button>
      </div>

      <div
        className={`md:hidden bg-white border-b border-emerald-100 pb-4 px-4 ${mobileMenuOpen ? "block" : "hidden"}`}
      >
        <nav className="flex flex-col space-y-2 pt-2">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMobileMenuOpen(false)}
              className="text-slate-700 font-medium py-2 px-1 hover:text-emerald-700"
            >
              {link.label}
            </a>
          ))}
          <Button
            asChild
            variant="default"
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-full w-full border-0 mt-2"
          >
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMobileMenuOpen(false)}
              className="inline-flex items-center justify-center"
            >
              <FaWhatsapp className="mr-2 text-lg" />
              Testar grátis
            </a>
          </Button>
        </nav>
      </div>
    </header>
  );
}
