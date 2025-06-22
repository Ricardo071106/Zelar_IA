/**
 * Bot WhatsApp usando Evolution API
 * Integração completa com interpretação inteligente de datas
 */

import axios from 'axios';
import { parseEventWithClaude } from '../utils/claudeParser';
import { DateTime } from 'luxon';

interface EvolutionConfig {
  baseUrl: string;
  instanceName: string;
  apiKey: string;
}

interface WhatsAppMessage {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  message: {
    conversation?: string;
    extendedTextMessage?: {
      text: string;
    };
  };
  messageTimestamp: number;
  pushName: string;
}

interface Event {
  title: string;
  startDate: string;
  description: string;
  displayDate: string;
}

let evolutionConfig: EvolutionConfig | null = null;

/**
 * Configura a conexão com Evolution API
 */
export function setupEvolutionAPI(baseUrl: string, instanceName: string, apiKey: string): boolean {
  try {
    evolutionConfig = {
      baseUrl: baseUrl.replace(/\/$/, ''), // Remove trailing slash
      instanceName,
      apiKey
    };
    
    console.log(`🔧 Evolution API configurada: ${baseUrl}/${instanceName}`);
    return true;
  } catch (error) {
    console.error('❌ Erro ao configurar Evolution API:', error);
    return false;
  }
}

/**
 * Envia mensagem via Evolution API
 */
async function sendMessage(phone: string, message: string, buttons?: any[]): Promise<boolean> {
  if (!evolutionConfig) {
    console.error('❌ Evolution API não configurada');
    return false;
  }

  try {
    const payload: any = {
      number: phone,
      text: message
    };

    // Adicionar botões se fornecidos
    if (buttons && buttons.length > 0) {
      payload.buttons = buttons;
    }

    const response = await axios.post(
      `${evolutionConfig.baseUrl}/message/sendText/${evolutionConfig.instanceName}`,
      payload,
      {
        headers: {
          'apikey': evolutionConfig.apiKey,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`✅ Mensagem enviada para ${phone}`);
    return response.status === 200 || response.status === 201;
  } catch (error) {
    console.error('❌ Erro ao enviar mensagem:', error);
    return false;
  }
}

/**
 * Extrai título limpo do evento removendo comandos e expressões temporais
 */
function extractEventTitle(text: string): string {
  let cleanTitle = text.toLowerCase();
  
  // Remover comandos e expressões
  const patterns = [
    /\b(me\s+lembre\s+de|lembre\s+me\s+de|me\s+lembrar\s+de)\b/gi,
    /\b(marque|agende|coloque|anote|lembre|crie|faça|criar|fazer)\b/gi,
    /\b(às|as)\s+\d{1,2}(:\d{2})?\s?(h|horas?|pm|am)?\b/gi,
    /\b(amanhã|hoje|ontem|segunda|terça|quarta|quinta|sexta|sábado|domingo)(-feira)?\b/gi,
    /\b(da\s+manhã|da\s+tarde|da\s+noite|de\s+manhã|de\s+tarde|de\s+noite)\b/gi,
    /\b(daqui|em)\s+\d+\s+(dias?|semanas?|meses?)\b/gi,
    /\b(próxima|proxima|que\s+vem|depois|antes)\b/gi
  ];

  patterns.forEach(pattern => {
    cleanTitle = cleanTitle.replace(pattern, ' ');
  });

  // Limpeza final
  cleanTitle = cleanTitle
    .replace(/\s+/g, ' ')
    .replace(/^\s*(o|a|os|as|um|uma|no|na|em|de|da|do|às|as)\s+/i, '')
    .trim();

  return cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);
}

/**
 * Gera links para calendários
 */
function generateCalendarLinks(event: Event) {
  const eventDateTime = DateTime.fromISO(event.startDate);
  const endDateTime = eventDateTime.plus({ hours: 1 });
  
  // Google Calendar (UTC)
  const startUTC = eventDateTime.toUTC();
  const endUTC = endDateTime.toUTC();
  const startFormatted = startUTC.toFormat('yyyyMMdd\'T\'HHmmss\'Z\'');
  const endFormatted = endUTC.toFormat('yyyyMMdd\'T\'HHmmss\'Z\'');
  
  const googleLink = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${startFormatted}/${endFormatted}`;
  const outlookLink = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(event.title)}&startdt=${eventDateTime.toISO()}&enddt=${endDateTime.toISO()}`;
  
  return { googleLink, outlookLink };
}

/**
 * Processa mensagem de evento usando Claude + fallback local
 */
async function processEventMessage(text: string, phone: string): Promise<Event | null> {
  try {
    console.log(`🔍 Processando WhatsApp: "${text}"`);
    
    const userTimezone = 'America/Sao_Paulo';
    
    // Tentar Claude primeiro
    try {
      const claudeResult = await parseEventWithClaude(text, userTimezone);
      if (claudeResult.isValid) {
        console.log('🤖 Claude interpretou com sucesso');
        
        const eventDateTime = DateTime.fromISO(claudeResult.date).setZone(userTimezone);
        
        return {
          title: claudeResult.title,
          startDate: eventDateTime.toISO()!,
          description: `Evento criado via WhatsApp`,
          displayDate: eventDateTime.toFormat('dd/MM/yyyy HH:mm')
        };
      }
    } catch (error) {
      console.log('❌ Claude falhou, usando fallback local');
    }

    // Fallback local básico
    const title = extractEventTitle(text);
    const now = DateTime.now().setZone(userTimezone);
    let targetDate = now.plus({ hours: 1 }); // Padrão: 1 hora a partir de agora

    // Detectar "amanhã"
    if (text.includes('amanhã')) {
      targetDate = now.plus({ days: 1 }).set({ hour: 9, minute: 0 });
    }

    return {
      title,
      startDate: targetDate.toISO()!,
      description: `Evento criado via WhatsApp`,
      displayDate: targetDate.toFormat('dd/MM/yyyy HH:mm')
    };

  } catch (error) {
    console.error('❌ Erro ao processar mensagem:', error);
    return null;
  }
}

/**
 * Processa mensagens recebidas do webhook
 */
export async function processWhatsAppMessage(messageData: WhatsAppMessage): Promise<void> {
  try {
    // Ignorar mensagens próprias
    if (messageData.key.fromMe) return;

    // Extrair texto da mensagem
    const messageText = messageData.message.conversation || 
                       messageData.message.extendedTextMessage?.text || '';
    
    if (!messageText.trim()) return;

    const phone = messageData.key.remoteJid.replace('@s.whatsapp.net', '');
    const userName = messageData.pushName || 'Usuário';

    console.log(`📱 Mensagem WhatsApp de ${userName} (${phone}): ${messageText}`);

    // Comando /start
    if (messageText.toLowerCase().includes('/start') || messageText.toLowerCase().includes('iniciar')) {
      const welcomeMessage = 
        `🤖 *Zelar - Assistente de Agendamentos*\n\n` +
        `Olá ${userName}! Sou seu assistente para criar eventos automaticamente!\n\n` +
        `📝 *Exemplos que entendo:*\n` +
        `• "me lembre de ligar para João amanhã às 15h"\n` +
        `• "reunião com cliente sexta às 10"\n` +
        `• "consulta médica daqui 3 dias às 14:30"\n\n` +
        `✅ Vou criar links diretos para seus calendários!`;

      await sendMessage(phone, welcomeMessage);
      return;
    }

    // Tentar processar como evento
    const event = await processEventMessage(messageText, phone);
    
    if (event) {
      const { googleLink, outlookLink } = generateCalendarLinks(event);
      
      const responseMessage = 
        `✅ *Evento criado!*\n\n` +
        `🎯 *${event.title}*\n` +
        `📅 ${event.displayDate}\n\n` +
        `📅 *Adicionar ao calendário:*\n` +
        `• Google: ${googleLink}\n` +
        `• Outlook: ${outlookLink}`;

      await sendMessage(phone, responseMessage);
    } else {
      const helpMessage = 
        `❌ *Não consegui entender essa data/hora*\n\n` +
        `📝 *Você disse:* "${messageText}"\n\n` +
        `💡 *Tente algo como:*\n` +
        `• "me lembre de pagar conta amanhã às 15h"\n` +
        `• "reunião hoje às 10"\n` +
        `• "consulta sexta às 14:30"`;

      await sendMessage(phone, helpMessage);
    }

  } catch (error) {
    console.error('❌ Erro ao processar mensagem WhatsApp:', error);
  }
}

/**
 * Configura webhook para receber mensagens
 */
export async function setupWhatsAppWebhook(webhookUrl: string): Promise<boolean> {
  if (!evolutionConfig) {
    console.error('❌ Evolution API não configurada');
    return false;
  }

  try {
    const response = await axios.post(
      `${evolutionConfig.baseUrl}/webhook/set/${evolutionConfig.instanceName}`,
      {
        url: webhookUrl,
        events: ['messages.upsert']
      },
      {
        headers: {
          'apikey': evolutionConfig.apiKey,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`✅ Webhook configurado: ${webhookUrl}`);
    return response.status === 200 || response.status === 201;
  } catch (error) {
    console.error('❌ Erro ao configurar webhook:', error);
    return false;
  }
}

/**
 * Verifica status da instância
 */
export async function checkInstanceStatus(): Promise<{ connected: boolean, qrCode?: string }> {
  if (!evolutionConfig) {
    return { connected: false };
  }

  try {
    const response = await axios.get(
      `${evolutionConfig.baseUrl}/instance/connectionState/${evolutionConfig.instanceName}`,
      {
        headers: {
          'apikey': evolutionConfig.apiKey
        }
      }
    );

    const isConnected = response.data?.instance?.state === 'open';
    
    if (!isConnected) {
      // Tentar obter QR Code
      try {
        const qrResponse = await axios.get(
          `${evolutionConfig.baseUrl}/instance/connect/${evolutionConfig.instanceName}`,
          {
            headers: {
              'apikey': evolutionConfig.apiKey
            }
          }
        );
        
        return { 
          connected: false, 
          qrCode: qrResponse.data?.qrcode?.code 
        };
      } catch (qrError) {
        console.log('Não foi possível obter QR Code');
      }
    }

    return { connected: isConnected };
  } catch (error) {
    console.error('❌ Erro ao verificar status:', error);
    return { connected: false };
  }
}