/**
 * Bot WhatsApp integrado ao sistema Zelar
 * Versão robusta com integração Claude AI
 */

import qrcode from 'qrcode-terminal';
import { parseEventWithClaude } from '../utils/claudeParser';
import { storage } from '../storage';
import { generateQRCodeImage } from '../utils/qrCodeGenerator';

// Importação dinâmica do whatsapp-web.js
let Client: any, LocalAuth: any;

let client: any = null;
let isConnected = false;
let qrCodeData = '';
let qrCodeImage = '';
let connectionStatus = 'disconnected';

interface WhatsAppEvent {
  title: string;
  startDate: string;
  description: string;
  displayDate: string;
}

/**
 * Inicia o bot WhatsApp
 */
export async function startWhatsAppBot(): Promise<boolean> {
  try {
    // Importação dinâmica para evitar problemas de ES modules
    if (!Client) {
      const whatsappWeb = await import('whatsapp-web.js');
      Client = whatsappWeb.default?.Client || whatsappWeb.Client;
      LocalAuth = whatsappWeb.default?.LocalAuth || whatsappWeb.LocalAuth;
    }

    if (client) {
      await stopWhatsAppBot();
    }

    console.log('🚀 Iniciando WhatsApp bot...');
    
    client = new Client({
      authStrategy: new LocalAuth({
        clientId: "zelar-bot"
      }),
      puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      }
    });

    // Configurar eventos
    client.on('qr', async (qr) => {
      qrCodeData = qr;
      connectionStatus = 'qr_code';
      console.log('📱 QR Code gerado! Escaneie para conectar.');
      qrcode.generate(qr, { small: true });
      
      // Gerar imagem do QR code
      try {
        qrCodeImage = await generateQRCodeImage(qr);
        console.log('📱 QR Code imagem gerada!');
      } catch (error) {
        console.error('❌ Erro ao gerar QR code imagem:', error);
      }
    });

    client.on('ready', () => {
      console.log('✅ WhatsApp bot conectado!');
      isConnected = true;
      connectionStatus = 'connected';
      qrCodeData = '';
      qrCodeImage = '';
    });

    client.on('authenticated', () => {
      console.log('🔐 WhatsApp autenticado!');
      connectionStatus = 'authenticated';
    });

    client.on('auth_failure', (msg) => {
      console.error('❌ Falha na autenticação:', msg);
      connectionStatus = 'auth_failure';
    });

    client.on('disconnected', (reason) => {
      console.log('📱 WhatsApp desconectado:', reason);
      isConnected = false;
      connectionStatus = 'disconnected';
      qrCodeData = '';
      qrCodeImage = '';
    });

    // Processar mensagens
    client.on('message', handleMessage);

    // Inicializar cliente
    await client.initialize();
    
    return true;
  } catch (error) {
    console.error('❌ Erro ao iniciar WhatsApp bot:', error);
    connectionStatus = 'error';
    return false;
  }
}

/**
 * Processa mensagens recebidas
 */
async function handleMessage(message: any): Promise<void> {
  try {
    // Ignorar mensagens de grupos e próprias mensagens
    if (message.from.includes('@g.us') || message.fromMe) {
      return;
    }

    const messageText = message.body.trim();
    const userPhone = message.from.replace('@c.us', '');

    console.log(`📱 Mensagem recebida de ${userPhone}: ${messageText}`);

    // Comandos especiais
    if (messageText.toLowerCase() === '/start' || messageText.toLowerCase() === '/help') {
      await sendWelcomeMessage(message);
      return;
    }

    // Processar como possível evento
    if (messageText.length > 10) {
      await processEventMessage(message, messageText, userPhone);
    } else {
      await message.reply('Olá! Sou o Zelar, seu assistente de agendamento.\n\nEnvie uma mensagem como:\n"Reunião amanhã às 14h"\n"Dentista sexta-feira 9h"\n\nPara mais ajuda, digite /help');
    }
  } catch (error) {
    console.error('❌ Erro ao processar mensagem:', error);
    await message.reply('Desculpe, houve um erro ao processar sua mensagem. Tente novamente.');
  }
}

/**
 * Processa mensagem como evento
 */
async function processEventMessage(message: any, text: string, userPhone: string): Promise<void> {
  try {
    // Usar Claude para interpretar o evento
    const claudeResult = await parseEventWithClaude(text);
    
    if (!claudeResult || !claudeResult.isValid) {
      await message.reply('Não consegui entender sua mensagem como um evento. Tente algo como:\n"Reunião amanhã às 14h"\n"Dentista sexta-feira 9h"');
      return;
    }

    // Criar evento
    const event: WhatsAppEvent = {
      title: claudeResult.title,
      startDate: claudeResult.date,
      description: `Evento criado via WhatsApp por ${userPhone}`,
      displayDate: new Date(claudeResult.date).toLocaleString('pt-BR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    };

    // Gerar links do calendário
    const calendarLinks = generateCalendarLinks(event);

    // Resposta com o evento criado
    const response = `✅ *Evento Criado!*

📅 *${event.title}*
🗓️ ${event.displayDate}

*Adicionar ao calendário:*
📱 Google Calendar: ${calendarLinks.google}
📧 Outlook: ${calendarLinks.outlook}
🍎 Apple Calendar: ${calendarLinks.apple}

Digite /help para mais comandos.`;

    await message.reply(response);
    
    console.log(`✅ Evento criado: ${event.title} para ${userPhone}`);
  } catch (error) {
    console.error('❌ Erro ao processar evento:', error);
    await message.reply('Houve um erro ao processar seu evento. Tente novamente ou digite /help para assistência.');
  }
}

/**
 * Envia mensagem de boas-vindas
 */
async function sendWelcomeMessage(message: any): Promise<void> {
  const welcomeText = `🤖 *Olá! Sou o Zelar*

Seu assistente inteligente de agendamento!

*Como usar:*
📝 Envie mensagens naturais como:
• "Reunião amanhã às 14h"
• "Dentista sexta-feira 9h"
• "Almoço com Maria domingo 12h"

*Funcionalidades:*
✅ Criação automática de eventos
📅 Links para Google Calendar, Outlook e Apple
🤖 Interpretação inteligente de datas em português
📱 Integração perfeita com seus calendários

*Comandos:*
/help - Mostrar esta ajuda
/start - Reiniciar bot

Digite sua mensagem e eu criarei o evento para você!`;

  await message.reply(welcomeText);
}

/**
 * Para o bot WhatsApp
 */
export async function stopWhatsAppBot(): Promise<void> {
  try {
    if (client) {
      await client.destroy();
      client = null;
    }
    isConnected = false;
    connectionStatus = 'disconnected';
    qrCodeData = '';
    qrCodeImage = '';
    console.log('🛑 WhatsApp bot parado');
  } catch (error) {
    console.error('❌ Erro ao parar WhatsApp bot:', error);
  }
}

/**
 * Envia mensagem via WhatsApp
 */
export async function sendWhatsAppMessage(phone: string, message: string): Promise<boolean> {
  try {
    if (!client || !isConnected) {
      return false;
    }

    const chatId = phone.includes('@c.us') ? phone : `${phone}@c.us`;
    await client.sendMessage(chatId, message);
    return true;
  } catch (error) {
    console.error('❌ Erro ao enviar mensagem:', error);
    return false;
  }
}

/**
 * Obtém status do WhatsApp
 */
export function getWhatsAppStatus(): any {
  return {
    connected: isConnected,
    status: connectionStatus,
    qrCode: qrCodeData,
    qrCodeImage: qrCodeImage,
    hasQrCode: qrCodeData.length > 0,
    hasQrCodeImage: qrCodeImage.length > 0
  };
}

/**
 * Função auxiliar para gerar links de calendário
 */
function generateCalendarLinks(event: WhatsAppEvent) {
  const startDate = new Date(event.startDate);
  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1 hora depois
  
  const formatDate = (date: Date) => date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  
  return {
    google: `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${formatDate(startDate)}/${formatDate(endDate)}&details=${encodeURIComponent(event.description)}`,
    outlook: `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(event.title)}&startdt=${formatDate(startDate)}&enddt=${formatDate(endDate)}&body=${encodeURIComponent(event.description)}`,
    apple: `data:text/calendar;charset=utf8,BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:${formatDate(startDate)}
DTEND:${formatDate(endDate)}
SUMMARY:${event.title}
DESCRIPTION:${event.description}
END:VEVENT
END:VCALENDAR`
  };
}