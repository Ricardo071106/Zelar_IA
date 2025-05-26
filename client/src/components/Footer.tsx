import Logo from "./Logo";
import { FaTwitter, FaFacebook, FaInstagram, FaLinkedin } from "react-icons/fa";

export default function Footer() {
  const footerLinks = {
    features: [
      { name: "Processamento de Linguagem", href: "#features" },
      { name: "Lembretes Inteligentes", href: "#features" },
      { name: "Integração com Calendários", href: "#features" },
      { name: "Processamento com IA", href: "#features" },
    ],
    resources: [
      { name: "Perguntas Frequentes", href: "#faq" },
      { name: "Blog", href: "#" },
      { name: "Suporte", href: "#" },
      { name: "Documentação", href: "#" },
    ],
    legal: [
      { name: "Termos de Serviço", href: "#" },
      { name: "Política de Privacidade", href: "#" },
      { name: "Proteção de Dados", href: "#" },
      { name: "Política de Cookies", href: "#" },
    ]
  };

  const socialLinks = [
    { icon: <FaTwitter />, href: "#" },
    { icon: <FaFacebook />, href: "#" },
    { icon: <FaInstagram />, href: "#" },
    { icon: <FaLinkedin />, href: "#" },
  ];

  return (
    <footer className="bg-gray-900 text-white py-12">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-1">
            <div className="mb-6">
              <Logo color="white" />
            </div>
            <p className="text-gray-400 mb-6">
              Seu assistente de agenda com IA que funciona perfeitamente dentro do Telegram.
            </p>
            <div className="flex space-x-4">
              {socialLinks.map((link, index) => (
                <a 
                  key={index} 
                  href={link.href} 
                  className="text-gray-400 hover:text-white transition-colors"
                  aria-label={`Social link ${index + 1}`}
                >
                  {link.icon}
                </a>
              ))}
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold mb-4">Recursos</h3>
            <ul className="space-y-2">
              {footerLinks.features.map((link, index) => (
                <li key={index}>
                  <a 
                    href={link.href} 
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold mb-4">Recursos</h3>
            <ul className="space-y-2">
              {footerLinks.resources.map((link, index) => (
                <li key={index}>
                  <a 
                    href={link.href} 
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold mb-4">Legal</h3>
            <ul className="space-y-2">
              {footerLinks.legal.map((link, index) => (
                <li key={index}>
                  <a 
                    href={link.href} 
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
        
        <div className="border-t border-gray-800 mt-12 pt-8 text-center">
          <p className="text-gray-400">&copy; {new Date().getFullYear()} Zelar. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  );
}
