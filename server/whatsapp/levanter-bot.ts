/**
 * WhatsApp Bot usando Levanter/Baileys
 * Integração com Claude AI para processamento de mensagens
 * Mesma funcionalidade do Telegram Bot aplicada ao WhatsApp
 */

import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  Browsers,
  WAMessage,
  fetchLatestBaileysVersion,
  proto
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import * as QRCode from 'qrcode-terminal';
import pino from 'pino';
import { log } from '../vite';
import { parseEventWithClaude } from '../utils/claudeParser';

let sock: any;
let isConnected = false;

/**
 * Função para processar mensagens do WhatsApp usando Claude AI
 */
async function processWhatsAppMessage(from: string, messageText: string, sock: any): Promise<void> {
  try {
    log(`📱 Processando mensagem WhatsApp de ${from}: ${messageText}`, 'whatsapp');
    
    // Usar o mesmo parser do Telegram
    const result = await parseEventWithClaude(messageText);
    
    if (result.isValid) {
      // Criar evento simples baseado no resultado do parser
      const event = {
        title: result.title,
        startDate: new Date(`${result.date}T${String(result.hour).padStart(2, '0')}:${String(result.minute).padStart(2, '0')}:00`),
        endDate: new Date(`${result.date}T${String(result.hour + 1).padStart(2, '0')}:${String(result.minute).padStart(2, '0')}:00`),
        displayDate: new Date(`${result.date}T${String(result.hour).padStart(2, '0')}:${String(result.minute).padStart(2, '0')}:00`).toLocaleDateString('pt-BR', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      };
      
      // Gerar links para calendário
      const googleCalendarLink = generateGoogleCalendarLink(event);
      const outlookCalendarLink = generateOutlookCalendarLink(event);
      
      // Criar resposta formatada
      const response = `✅ *Evento criado com sucesso!*\n\n` +
        `📅 *${event.title}*\n` +
        `🗓️ ${event.displayDate}\n\n` +
        `🔗 *Adicionar ao calendário:*\n` +
        `📅 Google Calendar: ${googleCalendarLink}\n` +
        `📅 Outlook: ${outlookCalendarLink}\n\n` +
        `💡 _Clique nos links para adicionar automaticamente ao seu calendário!_`;
      
      await sock.sendMessage(from, { text: response });
      log(`✅ Resposta enviada para ${from}`, 'whatsapp');
      
    } else {
      // Mensagem de erro ou não reconhecida
      const errorResponse = `❌ Não consegui entender sua mensagem.\n\n` +
        `💡 *Como usar:*\n` +
        `Envie mensagens como:\n` +
        `• "Reunião com cliente amanhã às 14h"\n` +
        `• "Dentista na sexta-feira às 10h"\n` +
        `• "Festa de aniversário sábado às 19h"\n\n` +
        `🤖 Sou seu assistente para criar eventos no calendário!`;
      
      await sock.sendMessage(from, { text: errorResponse });
    }
    
  } catch (error) {
    log(`❌ Erro ao processar mensagem WhatsApp: ${error}`, 'whatsapp');
    await sock.sendMessage(from, { 
      text: '❌ Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente.' 
    });
  }
}

/**
 * Gera link para Google Calendar
 */
function generateGoogleCalendarLink(event: any): string {
  const startDate = new Date(event.startDate);
  const endDate = new Date(event.endDate || new Date(startDate.getTime() + 60 * 60 * 1000));
  
  const formatDateForGoogle = (date: Date): string => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };
  
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${formatDateForGoogle(startDate)}/${formatDateForGoogle(endDate)}`,
    details: event.description || '',
    location: event.location || ''
  });
  
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Gera link para Outlook
 */
function generateOutlookCalendarLink(event: any): string {
  const startDate = new Date(event.startDate);
  const endDate = new Date(event.endDate || new Date(startDate.getTime() + 60 * 60 * 1000));
  
  const params = new URLSearchParams({
    subject: event.title,
    startdt: startDate.toISOString(),
    enddt: endDate.toISOString(),
    body: event.description || '',
    location: event.location || ''
  });
  
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

/**
 * Conecta ao WhatsApp
 */
async function connectToWhatsApp(): Promise<boolean> {
  try {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_levanter');
    const { version, isLatest } = await fetchLatestBaileysVersion();
    
    log(`🔗 Usando versão do Baileys: ${version}, é a mais recente: ${isLatest}`, 'whatsapp');
    
    sock = makeWASocket({
      version,
      logger: pino({ level: 'silent' }),
      auth: state,
      browser: Browsers.ubuntu('Zelar'),
      printQRInTerminal: true
    });
    
    // Store removido para simplificar a implementação
    
    sock.ev.on('connection.update', (update: any) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        log('📱 QR Code gerado para WhatsApp:', 'whatsapp');
        QRCode.generate(qr, { small: true });
      }
      
      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
        log(`❌ Conexão WhatsApp fechada. Reconectar: ${shouldReconnect}`, 'whatsapp');
        
        if (shouldReconnect) {
          setTimeout(() => connectToWhatsApp(), 5000);
        }
        isConnected = false;
      } else if (connection === 'open') {
        log('✅ WhatsApp conectado com sucesso!', 'whatsapp');
        isConnected = true;
      }
    });
    
    sock.ev.on('creds.update', saveCreds);
    
    // Escutar mensagens
    sock.ev.on('messages.upsert', async (m: any) => {
      const message = m.messages[0];
      
      if (!message.key.fromMe && message.message) {
        const from = message.key.remoteJid;
        const messageText = message.message.conversation || 
                           message.message.extendedTextMessage?.text || '';
        
        if (messageText && from) {
          await processWhatsAppMessage(from, messageText, sock);
        }
      }
    });
    
    return true;
    
  } catch (error) {
    log(`❌ Erro ao conectar WhatsApp: ${error}`, 'whatsapp');
    return false;
  }
}

/**
 * Desconecta do WhatsApp
 */
async function disconnectWhatsApp(): Promise<void> {
  if (sock) {
    await sock.logout();
    isConnected = false;
    log('🔌 WhatsApp desconectado', 'whatsapp');
  }
}

/**
 * Verifica status da conexão
 */
function getWhatsAppStatus(): { connected: boolean, message: string } {
  return {
    connected: isConnected,
    message: isConnected ? 'WhatsApp conectado e funcionando' : 'WhatsApp desconectado'
  };
}

/**
 * Inicia o bot WhatsApp
 */
export async function startWhatsAppBot(): Promise<boolean> {
  log('🚀 Iniciando WhatsApp Bot com Levanter...', 'whatsapp');
  return await connectToWhatsApp();
}

/**
 * Para o bot WhatsApp
 */
export async function stopWhatsAppBot(): Promise<void> {
  await disconnectWhatsApp();
}

/**
 * Exporta funções para uso externo
 */
export {
  getWhatsAppStatus,
  connectToWhatsApp,
  disconnectWhatsApp
};