import { MessageCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface WhatsAppInfo {
  phoneNumber: string;
  connected: boolean;
}

export default function WhatsAppFloatingButton() {
  const { data: whatsappInfo } = useQuery<WhatsAppInfo>({
    queryKey: ['/api/whatsapp/info'],
    refetchInterval: 30000,
  });

  const handleWhatsAppClick = () => {
    if (whatsappInfo?.phoneNumber) {
      const message = encodeURIComponent("Olá! Gostaria de agendar um compromisso 📅");
      const url = `https://wa.me/${whatsappInfo.phoneNumber}?text=${message}`;
      window.open(url, '_blank');
    }
  };

  // Só mostrar se o WhatsApp estiver conectado
  if (!whatsappInfo?.connected) {
    return null;
  }

  return (
    <button
      onClick={handleWhatsAppClick}
      className="fixed bottom-6 right-6 bg-green-500 hover:bg-green-600 text-white p-4 rounded-full shadow-lg transition-all duration-300 hover:scale-110 z-50"
      title="Falar no WhatsApp"
    >
      <MessageCircle size={28} />
    </button>
  );
}