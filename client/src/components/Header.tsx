import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { FaTelegram, FaWhatsapp } from "react-icons/fa";
import Logo from "./Logo";

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
    <header className={`bg-white fixed w-full z-50 transition-shadow duration-300 ${scrolled ? "shadow-md" : "shadow-sm"}`}>
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <Logo />
        
        <div className="hidden md:flex space-x-3">
          <Button 
            asChild
            variant="default"
            className="bg-white text-primary hover:bg-gray-100 font-semibold rounded-full px-6 py-2"
          >
            <a href="https://t.me/zelar_assistente_bot" target="_blank" rel="noopener noreferrer" className="inline-flex items-center">
              <FaTelegram className="mr-2 text-lg" />
              Telegram
            </a>
          </Button>
          <Button 
            asChild
            variant="default"
            className="bg-green-500 hover:bg-green-600 text-white font-semibold rounded-full px-6 py-2 border-0"
          >
            <a href="https://wa.me/5511988049268?text=Ol%C3%A1%2C%20gostaria%20de%20usar%20o%20Zelar%20para%20agendar%20meus%20compromissos" target="_blank" rel="noopener noreferrer" className="inline-flex items-center">
              <FaWhatsapp className="mr-2 text-lg" />
              WhatsApp
            </a>
          </Button>
        </div>
        
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden text-primary focus:outline-none"
          onClick={toggleMobileMenu}
          aria-label="Menu"
        >
          {mobileMenuOpen ? <X /> : <Menu />}
        </Button>
      </div>
      
      {/* Mobile Menu */}
      <div className={`md:hidden bg-white pb-4 px-4 ${mobileMenuOpen ? "block" : "hidden"}`}>
        <nav className="flex flex-col space-y-3">
          <Button 
            asChild
            variant="default"
            className="bg-white text-primary hover:bg-gray-100 font-semibold rounded-full w-full"
          >
            <a 
              href="https://t.me/zelar_assistente_bot" 
              target="_blank" 
              rel="noopener noreferrer"
              onClick={() => setMobileMenuOpen(false)}
              className="inline-flex items-center"
            >
              <FaTelegram className="mr-2 text-lg" />
              Usar no Telegram
            </a>
          </Button>
          <Button 
            asChild
            variant="default"
            className="bg-green-500 hover:bg-green-600 text-white font-semibold rounded-full w-full border-0"
          >
            <a 
              href="https://wa.me/5511988049268?text=Ol%C3%A1%2C%20gostaria%20de%20usar%20o%20Zelar%20para%20agendar%20meus%20compromissos" 
              target="_blank" 
              rel="noopener noreferrer"
              onClick={() => setMobileMenuOpen(false)}
              className="inline-flex items-center"
            >
              <FaWhatsapp className="mr-2 text-lg" />
              Usar no WhatsApp
            </a>
          </Button>
        </nav>
      </div>
    </header>
  );
}
