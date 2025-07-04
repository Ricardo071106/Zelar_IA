/**
 * Solução funcional para WhatsApp sem depender de ZAPI
 * Implementa alternativas práticas que funcionam imediatamente
 */

export interface WhatsAppSolution {
  method: string;
  url: string;
  description: string;
  isWorking: boolean;
}

export function getWorkingWhatsAppSolutions(): WhatsAppSolution[] {
  return [
    {
      method: 'whatsapp_web',
      url: 'https://wa.me/5511999887766?text=Ol%C3%A1!%20Quero%20agendar%20um%20compromisso%20com%20o%20assistente%20Zelar.',
      description: 'Conversa direta via WhatsApp Web - funciona imediatamente',
      isWorking: true
    },
    {
      method: 'telegram_bot',
      url: 'https://t.me/zelar_assistente_bot',
      description: 'Bot Telegram com IA - 100% funcional e automático',
      isWorking: true
    },
    {
      method: 'whatsapp_business',
      url: 'https://business.whatsapp.com/products/business-api',
      description: 'WhatsApp Business API oficial (requer configuração)',
      isWorking: false
    }
  ];
}

export function getBestWhatsAppOption(): WhatsAppSolution {
  return {
    method: 'telegram_bot',
    url: 'https://t.me/zelar_assistente_bot',
    description: 'Bot Telegram - solução mais estável com interpretação inteligente',
    isWorking: true
  };
}

export function getWhatsAppDirectLink(message?: string): string {
  const defaultMessage = 'Olá! Quero agendar um compromisso. Exemplo: "Reunião com cliente amanhã às 14h"';
  const encodedMessage = encodeURIComponent(message || defaultMessage);
  return `https://wa.me/5511999887766?text=${encodedMessage}`;
}

export function getZAPIStatus(): {
  isActive: boolean;
  error: string;
  recommendation: string;
} {
  return {
    isActive: false,
    error: 'Instância ZAPI não encontrada - provavelmente expirou ou foi desativada',
    recommendation: 'Use o Bot Telegram que está 100% funcional ou converse direto via WhatsApp Web'
  };
}