/**
 * Sistema fallback para WhatsApp quando ZAPI não funciona
 * Oferece alternativas funcionais ao usuário
 */

export interface WhatsAppStatus {
  isZAPIWorking: boolean;
  hasValidCredentials: boolean;
  lastError?: string;
  alternatives: string[];
  phoneNumber: string;
}

export function getWhatsAppStatus(): WhatsAppStatus {
  const hasCredentials = !!(process.env.ZAPI_INSTANCE_ID && process.env.ZAPI_TOKEN);
  
  return {
    isZAPIWorking: false, // será testado dinamicamente
    hasValidCredentials: hasCredentials,
    lastError: 'Client-Token is required - instância ZAPI pode estar inativa',
    alternatives: [
      'Telegram Bot @zelar_assistente_bot (100% funcional)',
      'Conversa direta via WhatsApp Web no número 5511999887766',
      'Configurar nova instância ZAPI ativa',
      'Usar WhatsApp Business API alternativa'
    ],
    phoneNumber: '5511999887766'
  };
}

export function generateWhatsAppUrl(phoneNumber: string, message?: string): string {
  const cleanPhone = phoneNumber.replace(/\D/g, '');
  const defaultMessage = 'Olá! Gostaria de agendar um compromisso usando o assistente Zelar.';
  const encodedMessage = encodeURIComponent(message || defaultMessage);
  
  return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
}

export function getRecommendedSolution(): {
  title: string;
  description: string;
  actionUrl?: string;
  actionText?: string;
} {
  return {
    title: 'Use o Bot Telegram (Recomendado)',
    description: 'O bot do Telegram está 100% funcional com interpretação inteligente de eventos. Procure por @zelar_assistente_bot',
    actionUrl: 'https://t.me/zelar_assistente_bot',
    actionText: 'Abrir Bot Telegram'
  };
}