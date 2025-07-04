/**
 * Bot WhatsApp inteligente com as mesmas funcionalidades do Telegram
 * Processa mensagens automaticamente usando Claude AI
 */

import { parseEventWithClaude } from '../utils/claudeParser';
import { DateTime } from 'luxon';

interface WhatsAppEvent {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  location: string;
  description: string;
  displayDate: string;
  calendarLinks: {
    google: string;
    outlook: string;
    apple: string;
  };
}

/**
 * Processa uma mensagem do WhatsApp usando Claude AI
 * Funcionalidade idêntica ao bot Telegram
 */
export async function processWhatsAppMessageAuto(phone: string, message: string): Promise<{
  success: boolean;
  response: string;
  event?: WhatsAppEvent;
  error?: string;
}> {
  try {
    console.log(`📱 Processando mensagem WhatsApp de ${phone}: ${message.substring(0, 100)}...`);

    // Usar o mesmo parser do Telegram
    const parseResult = await parseEventWithClaude(message);
    
    if (!parseResult.isValid) {
      const response = parseResult.error || 
        "Não consegui identificar um evento na sua mensagem. " +
        "Tente algo como: 'Reunião com cliente amanhã às 14h' ou 'Jantar sexta-feira às 19h30'";
      
      return {
        success: false,
        response,
        error: parseResult.error
      };
    }

    // Construir DateTime a partir dos dados do parser
    const startDateTime = DateTime.fromISO(parseResult.date, { zone: 'America/Sao_Paulo' })
      .set({ hour: parseResult.hour, minute: parseResult.minute });
    
    const endDateTime = startDateTime.plus({ hours: 1 });

    // Criar objeto de evento WhatsApp
    const whatsappEvent: WhatsAppEvent = {
      id: `wa-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: parseResult.title,
      startDate: startDateTime.toISO() || '',
      endDate: endDateTime.toISO() || '',
      location: '',
      description: `Evento criado via WhatsApp de ${phone}`,
      displayDate: startDateTime.toLocaleString(DateTime.DATETIME_FULL, { locale: 'pt-BR' }),
      calendarLinks: generateCalendarLinks(parseResult.title, startDateTime, endDateTime)
    };

    // Gerar resposta de confirmação (igual ao Telegram)
    const response = `✅ Evento criado com sucesso!

📅 *${whatsappEvent.title}*
🕐 ${whatsappEvent.displayDate}

*Adicionar ao calendário:*
🗓️ Google Calendar: ${whatsappEvent.calendarLinks.google}
📆 Outlook: ${whatsappEvent.calendarLinks.outlook}
🍎 Apple Calendar: ${whatsappEvent.calendarLinks.apple}

_Powered by Zelar AI Assistant_`;

    console.log(`✅ Evento WhatsApp criado: ${whatsappEvent.title} - ${whatsappEvent.displayDate}`);

    return {
      success: true,
      response,
      event: whatsappEvent
    };

  } catch (error) {
    console.error('❌ Erro ao processar mensagem WhatsApp:', error);
    
    return {
      success: false,
      response: "Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente em alguns instantes.",
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Gera links para calendários (mesma função do Telegram)
 */
function generateCalendarLinks(title: string, startDate: DateTime, endDate: DateTime) {
  const formatForGoogle = (date: DateTime) => date.toUTC().toFormat("yyyyMMdd'T'HHmmss'Z'");
  const formatForOutlook = (date: DateTime) => date.toUTC().toISO();

  const encodedTitle = encodeURIComponent(title);
  const encodedDescription = encodeURIComponent('Evento criado pelo Assistente Zelar');

  return {
    google: `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodedTitle}&dates=${formatForGoogle(startDate)}/${formatForGoogle(endDate)}&details=${encodedDescription}`,
    
    outlook: `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodedTitle}&startdt=${formatForOutlook(startDate)}&enddt=${formatForOutlook(endDate)}&body=${encodedDescription}`,
    
    apple: `data:text/calendar;charset=utf8,BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Zelar//Zelar Assistant//EN
BEGIN:VEVENT
UID:${Date.now()}@zelar.app
DTSTAMP:${formatForGoogle(DateTime.now())}
DTSTART:${formatForGoogle(startDate)}
DTEND:${formatForGoogle(endDate)}
SUMMARY:${title}
DESCRIPTION:${encodedDescription}
END:VEVENT
END:VCALENDAR`
  };
}

/**
 * Verifica se uma mensagem é um comando ou evento
 */
export function isEventMessage(message: string): boolean {
  const eventKeywords = [
    'reunião', 'meeting', 'encontro', 'compromisso', 'agendamento',
    'consulta', 'evento', 'jantar', 'almoço', 'café', 'call',
    'ligação', 'apresentação', 'workshop', 'treinamento', 'curso',
    'entrevista', 'dentista', 'médico', 'viagem', 'voo'
  ];

  const timeKeywords = [
    'hoje', 'amanhã', 'depois', 'próxima', 'próximo',
    'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo',
    'às', 'as', 'hora', 'horas', 'h', 'min', 'minutos',
    'manhã', 'tarde', 'noite', 'madrugada'
  ];

  const lowerMessage = message.toLowerCase();
  
  const hasEventKeyword = eventKeywords.some(keyword => lowerMessage.includes(keyword));
  const hasTimeKeyword = timeKeywords.some(keyword => lowerMessage.includes(keyword));
  const hasTimePattern = /\d{1,2}[h:]\d{0,2}/.test(lowerMessage);

  return hasEventKeyword || hasTimeKeyword || hasTimePattern;
}

/**
 * Gera resposta para mensagens que não são eventos
 */
export function generateHelpResponse(): string {
  return `👋 Olá! Eu sou o assistente Zelar para WhatsApp!

🤖 Posso criar eventos no seu calendário automaticamente usando inteligência artificial.

*Exemplos de mensagens:*
• "Reunião com cliente amanhã às 14h"
• "Jantar sexta-feira às 19h30 no restaurante"
• "Consulta médica terça às 10h"
• "Call de projeto quinta às 15h"

📝 Basta me enviar uma mensagem descrevendo seu compromisso que eu crio o evento e gero os links para seu calendário!

_Mesma tecnologia do @zelar_assistente_bot do Telegram_`;
}