/**
 * WhatsApp Bot usando Z-API com configuração automática via secrets
 * Funciona igual ao Telegram - sem precisar configurar interface
 */

import axios from 'axios';
import { parseEventWithClaude } from '../utils/claudeParser';
import { DateTime } from 'luxon';

interface WhatsAppMessage {
  phone: string;
  fromMe: boolean;
  text?: {
    message?: string;
  };
  message?: {
    text?: string;
  };
  senderName?: string;
}

interface Event {
  title: string;
  startDate: string;
  description: string;
  displayDate: string;
}

// Configuração automática via environment variables
let ZAPI_INSTANCE_ID: string | undefined;
let ZAPI_TOKEN: string | undefined;
let isConfigured = false;

// Função para recarregar as variáveis de ambiente
function loadEnvironmentVariables() {
  ZAPI_INSTANCE_ID = process.env.ZAPI_INSTANCE_ID;
  ZAPI_TOKEN = process.env.ZAPI_TOKEN;
}

/**
 * Inicializa o WhatsApp Bot automaticamente
 */
export function initAutoZAPI(): boolean {
  // Recarrega as variáveis de ambiente
  loadEnvironmentVariables();
  
  console.log('🔍 Verificando secrets Z-API...');
  console.log('ZAPI_INSTANCE_ID:', ZAPI_INSTANCE_ID ? 'definido' : 'não definido');
  console.log('ZAPI_TOKEN:', ZAPI_TOKEN ? 'definido' : 'não definido');
  
  if (!ZAPI_INSTANCE_ID || !ZAPI_TOKEN) {
    console.log('⚠️ WhatsApp Z-API não configurado (faltam ZAPI_INSTANCE_ID ou ZAPI_TOKEN)');
    return false;
  }

  isConfigured = true;
  console.log(`📱 WhatsApp Z-API configurado automaticamente: ${ZAPI_INSTANCE_ID}`);
  return true;
}

/**
 * Verifica se Z-API está configurado
 */
export function isZAPIConfigured(): boolean {
  loadEnvironmentVariables();
  return isConfigured && !!ZAPI_INSTANCE_ID && !!ZAPI_TOKEN;
}

/**
 * Envia mensagem via Z-API
 */
async function sendZAPIMessage(phone: string, message: string): Promise<boolean> {
  if (!isZAPIConfigured()) {
    console.error('❌ Z-API não configurado');
    return false;
  }

  try {
    const cleanPhone = phone.replace(/\D/g, '');
    
    const response = await axios.post(
      `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`,
      {
        phone: cleanPhone,
        message: message
      },
      {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`✅ Mensagem WhatsApp enviada para ${phone}`);
    return response.status === 200;
  } catch (error: any) {
    console.error('❌ Erro ao enviar WhatsApp:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Extrai título limpo do evento
 */
function extractEventTitle(text: string): string {
  let cleanTitle = text.toLowerCase();
  
  const patterns = [
    /\b(me\s+lembre\s+de|lembre\s+me\s+de|me\s+lembrar\s+de)\b/gi,
    /\b(marque|agende|coloque|anote|lembre|crie|faça|criar|fazer)\b/gi,
    /\b(às|as)\s+\d{1,2}(:\d{2})?\s?(h|horas?|pm|am)?\b/gi,
    /\b(amanhã|hoje|ontem|segunda|terça|quarta|quinta|sexta|sábado|domingo)(-feira)?\b/gi,
    /\b(da\s+manhã|da\s+tarde|da\s+noite|de\s+manhã|de\s+tarde|de\s+noite)\b/gi,
    /\b(daqui|em)\s+\d+\s+(dias?|semanas?|meses?)\b/gi,
  ];

  patterns.forEach(pattern => {
    cleanTitle = cleanTitle.replace(pattern, ' ');
  });

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
  
  const startUTC = eventDateTime.toUTC();
  const endUTC = endDateTime.toUTC();
  const startFormatted = startUTC.toFormat('yyyyMMdd\'T\'HHmmss\'Z\'');
  const endFormatted = endUTC.toFormat('yyyyMMdd\'T\'HHmmss\'Z\'');
  
  const googleLink = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${startFormatted}/${endFormatted}`;
  const outlookLink = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(event.title)}&startdt=${eventDateTime.toISO()}&enddt=${endDateTime.toISO()}`;
  
  return { googleLink, outlookLink };
}

/**
 * Processa mensagem de evento usando Claude ou fallback local
 */
async function processEventMessage(text: string): Promise<Event | null> {
  try {
    // Tenta usar Claude primeiro
    const claudeResult = await parseEventWithClaude(text);
    
    if (claudeResult && claudeResult.isValid) {
      const eventDateTime = DateTime.fromISO(claudeResult.date)
        .set({ hour: claudeResult.hour, minute: claudeResult.minute })
        .setZone('America/Sao_Paulo');

      return {
        title: claudeResult.title,
        startDate: eventDateTime.toISO()!,
        description: `Evento criado via WhatsApp: ${text}`,
        displayDate: eventDateTime.toFormat('dd/MM/yyyy HH:mm')
      };
    }
  } catch (error) {
    console.log('Claude não disponível, usando fallback local');
  }

  // Fallback local simples
  const title = extractEventTitle(text);
  const now = DateTime.now().setZone('America/Sao_Paulo');
  let eventDate = now.plus({ hours: 1 }); // 1 hora a partir de agora como padrão

  // Detecção simples de "amanhã"
  if (text.includes('amanhã')) {
    eventDate = now.plus({ days: 1 }).set({ hour: 9, minute: 0 });
  }

  // Detecção simples de horário
  const timeMatch = text.match(/(\d{1,2}):?(\d{2})?\s?(h|horas?)?/i);
  if (timeMatch) {
    const hour = parseInt(timeMatch[1]);
    const minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
    eventDate = eventDate.set({ hour, minute });
  }

  return {
    title,
    startDate: eventDate.toISO()!,
    description: `Evento criado via WhatsApp: ${text}`,
    displayDate: eventDate.toFormat('dd/MM/yyyy HH:mm')
  };
}

/**
 * Processa mensagem recebida via webhook
 */
export async function processZAPIWebhook(data: WhatsAppMessage): Promise<void> {
  if (!isZAPIConfigured()) {
    console.log('⚠️ Z-API não configurado, ignorando mensagem WhatsApp');
    return;
  }

  try {
    // Ignora mensagens próprias
    if (data.fromMe) {
      return;
    }

    // Extrai texto da mensagem
    const messageText = data.text?.message || data.message?.text;
    if (!messageText) {
      return;
    }

    const phone = data.phone;
    console.log(`📱 WhatsApp recebido de ${phone}: ${messageText}`);

    // Comando inicial
    if (messageText.toLowerCase().includes('iniciar') || messageText.toLowerCase().includes('oi') || messageText.toLowerCase().includes('olá')) {
      const welcomeMessage = 
        `🤖 *Olá! Sou o Zelar Bot WhatsApp*\n\n` +
        `📅 *Como usar:*\n` +
        `Digite mensagens naturais como:\n` +
        `• "me lembre de pagar conta amanhã às 15h"\n` +
        `• "reunião hoje às 10"\n` +
        `• "consulta sexta às 14:30"\n\n` +
        `✨ Vou criar eventos automaticamente com links para Google Calendar e Outlook!`;

      await sendZAPIMessage(phone, welcomeMessage);
      return;
    }

    // Processar como evento
    const event = await processEventMessage(messageText);
    
    if (event) {
      const { googleLink, outlookLink } = generateCalendarLinks(event);
      
      const responseMessage = 
        `✅ *Evento criado!*\n\n` +
        `🎯 *${event.title}*\n` +
        `📅 ${event.displayDate}\n\n` +
        `📅 *Adicionar ao calendário:*\n` +
        `🔗 Google: ${googleLink}\n\n` +
        `🔗 Outlook: ${outlookLink}`;

      await sendZAPIMessage(phone, responseMessage);
    } else {
      const helpMessage = 
        `❌ *Não consegui entender essa data/hora*\n\n` +
        `📝 *Você disse:* "${messageText}"\n\n` +
        `💡 *Tente algo como:*\n` +
        `• "me lembre de pagar conta amanhã às 15h"\n` +
        `• "reunião hoje às 10"\n` +
        `• "consulta sexta às 14:30"`;

      await sendZAPIMessage(phone, helpMessage);
    }

  } catch (error) {
    console.error('❌ Erro ao processar WhatsApp:', error);
  }
}

/**
 * Verifica status da conexão
 */
export async function checkZAPIConnection(): Promise<{ connected: boolean, message: string }> {
  if (!isZAPIConfigured()) {
    return { connected: false, message: 'Z-API não configurado via secrets' };
  }

  try {
    const response = await axios.get(
      `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/status`,
      { timeout: 8000 }
    );

    const connected = response.data?.connected === true;
    
    return {
      connected,
      message: connected ? 'WhatsApp conectado automaticamente' : 'WhatsApp desconectado - conecte pelo painel Z-API'
    };
  } catch (error: any) {
    return {
      connected: false,
      message: `Erro: Verifique credenciais Z-API nos secrets`
    };
  }
}

/**
 * Gera QR Code para conexão
 */
export async function generateZAPIQRCode(): Promise<{ success: boolean, qrCode?: string, message: string }> {
  if (!isZAPIConfigured()) {
    return { success: false, message: 'Configure ZAPI_INSTANCE_ID e ZAPI_TOKEN nos secrets' };
  }

  try {
    const response = await axios.get(
      `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/qr-code`,
      {
        timeout: 15000,
        headers: { 'Content-Type': 'application/json' }
      }
    );

    const qrCode = response.data?.qrcode || response.data?.value;

    if (qrCode) {
      return {
        success: true,
        qrCode: qrCode,
        message: 'QR Code gerado com sucesso'
      };
    } else {
      return {
        success: false,
        message: 'QR Code não retornado - tente novamente'
      };
    }
  } catch (error: any) {
    return {
      success: false,
      message: `Erro ao gerar QR Code: ${error.response?.data?.message || error.message}`
    };
  }
}