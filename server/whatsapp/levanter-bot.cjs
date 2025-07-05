/**
 * WhatsApp Bot usando Levanter/Baileys
 * Versão JavaScript para compatibilidade
 */

const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  Browsers,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');

const QRCode = require('qrcode-terminal');
const pino = require('pino');

let sock;
let isConnected = false;

/**
 * Função para processar mensagens do WhatsApp usando Claude AI
 */
async function processWhatsAppMessage(from, messageText, sock) {
  try {
    console.log(`📱 Processando mensagem WhatsApp de ${from}: ${messageText}`);
    
    // Usar o mesmo parser do Telegram (importação dinâmica)
    const { parseEventWithClaude } = await import('../utils/claudeParser.js');
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
      console.log(`✅ Resposta enviada para ${from}`);
      
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
    console.log(`❌ Erro ao processar mensagem WhatsApp: ${error}`);
    await sock.sendMessage(from, { 
      text: '❌ Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente.' 
    });
  }
}

/**
 * Gera link para Google Calendar
 */
function generateGoogleCalendarLink(event) {
  const startDate = new Date(event.startDate);
  const endDate = new Date(event.endDate || new Date(startDate.getTime() + 60 * 60 * 1000));
  
  const formatDateForGoogle = (date) => {
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
function generateOutlookCalendarLink(event) {
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
async function connectToWhatsApp() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_levanter');
    const { version, isLatest } = await fetchLatestBaileysVersion();
    
    console.log(`🔗 Usando versão do Baileys: ${version}, é a mais recente: ${isLatest}`);
    
    sock = makeWASocket({
      version,
      logger: pino({ level: 'silent' }),
      auth: state,
      browser: Browsers.ubuntu('Zelar'),
      printQRInTerminal: true
    });
    
    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        console.log('📱 QR Code gerado para WhatsApp:');
        QRCode.generate(qr, { small: true });
      }
      
      if (connection === 'close') {
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        console.log(`❌ Conexão WhatsApp fechada. Reconectar: ${shouldReconnect}`);
        
        if (shouldReconnect) {
          setTimeout(() => connectToWhatsApp(), 5000);
        }
        isConnected = false;
      } else if (connection === 'open') {
        console.log('✅ WhatsApp conectado com sucesso!');
        isConnected = true;
      }
    });
    
    sock.ev.on('creds.update', saveCreds);
    
    // Escutar mensagens
    sock.ev.on('messages.upsert', async (m) => {
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
    console.log(`❌ Erro ao conectar WhatsApp: ${error}`);
    return false;
  }
}

/**
 * Desconecta do WhatsApp
 */
async function disconnectWhatsApp() {
  if (sock) {
    await sock.logout();
    isConnected = false;
    console.log('🔌 WhatsApp desconectado');
  }
}

/**
 * Verifica status da conexão
 */
function getWhatsAppStatus() {
  return {
    connected: isConnected,
    message: isConnected ? 'WhatsApp conectado e funcionando' : 'WhatsApp desconectado'
  };
}

/**
 * Inicia o bot WhatsApp
 */
async function startWhatsAppBot() {
  console.log('🚀 Iniciando WhatsApp Bot com Levanter...');
  return await connectToWhatsApp();
}

/**
 * Para o bot WhatsApp
 */
async function stopWhatsAppBot() {
  await disconnectWhatsApp();
}

module.exports = {
  startWhatsAppBot,
  stopWhatsAppBot,
  getWhatsAppStatus,
  connectToWhatsApp,
  disconnectWhatsApp
};