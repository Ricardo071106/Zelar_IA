import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X, MessageSquare, Phone } from "lucide-react";
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
            className="bg-primary hover:bg-secondary text-white font-medium rounded-full"
          >
            <a href="https://t.me/zelar_assistente_bot" target="_blank" rel="noopener noreferrer">
              <MessageSquare className="w-4 h-4 mr-2" />
              Telegram
            </a>
          </Button>
          <Button 
            asChild
            variant="outline"
            className="border-primary text-primary hover:bg-primary hover:text-white font-medium rounded-full"
          >
            <a href="https://wa.me/5511999999999?text=Olá,%20gostaria%20de%20usar%20o%20Zelar%20para%20agendar%20meus%20compromissos" target="_blank" rel="noopener noreferrer">
              <Phone className="w-4 h-4 mr-2" />
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
            className="bg-primary hover:bg-secondary text-white font-medium rounded-full w-full"
          >
            <a 
              href="https://t.me/zelar_assistente_bot" 
              target="_blank" 
              rel="noopener noreferrer"
              onClick={() => setMobileMenuOpen(false)}
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Usar no Telegram
            </a>
          </Button>
          <Button 
            asChild
            variant="outline"
            className="border-primary text-primary hover:bg-primary hover:text-white font-medium rounded-full w-full"
          >
            <a 
              href="https://wa.me/5511999999999?text=Olá,%20gostaria%20de%20usar%20o%20Zelar%20para%20agendar%20meus%20compromissos" 
              target="_blank" 
              rel="noopener noreferrer"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Phone className="w-4 h-4 mr-2" />
              Usar no WhatsApp
            </a>
          </Button>
        </nav>
      </div>
    </header>
  );
}
