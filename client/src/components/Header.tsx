import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
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

  const navItems = [
    { name: "Sistema", href: "/system" },
  ];

  return (
    <header className={`bg-white fixed w-full z-50 transition-shadow duration-300 ${scrolled ? "shadow-md" : "shadow-sm"}`}>
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <Logo />
        
        <nav className="hidden md:flex space-x-8">
          {navItems.map((item) => (
            <a 
              key={item.name}
              href={item.href} 
              className="text-dark hover:text-primary transition-colors"
            >
              {item.name}
            </a>
          ))}
        </nav>
        
        <div>
          <Button 
            asChild
            variant="default"
            className="hidden md:inline-flex bg-primary hover:bg-secondary text-white font-medium rounded-full"
          >
            <a href="https://t.me/zelar_assistente_bot" target="_blank" rel="noopener noreferrer">
              Começar a Usar o Zelar
            </a>
          </Button>
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
      </div>
      
      {/* Mobile Menu */}
      <div className={`md:hidden bg-white pb-4 px-4 ${mobileMenuOpen ? "block" : "hidden"}`}>
        <nav className="flex flex-col space-y-3">
          {navItems.map((item) => (
            <a 
              key={item.name}
              href={item.href} 
              className="text-dark hover:text-primary transition-colors py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              {item.name}
            </a>
          ))}
          <Button 
            asChild
            variant="default"
            className="bg-primary hover:bg-secondary text-white font-medium rounded-full mt-2 w-full"
          >
            <a 
              href="https://t.me/zelar_assistente_bot" 
              target="_blank" 
              rel="noopener noreferrer"
              onClick={() => setMobileMenuOpen(false)}
            >
              Começar a Usar o Zelar
            </a>
          </Button>
        </nav>
      </div>
    </header>
  );
}
