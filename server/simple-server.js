import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createServer } from 'http';
import { Server } from 'socket.io';
import TelegramBot from 'node-telegram-bot-api';
import { default as makeWASocket, DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys';
import qrcode from 'qrcode';

import fetch from 'node-fetch';
import multer from 'multer';
import { Pool } from 'pg';
import { config } from 'dotenv';

// Configurar variáveis de ambiente
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuração do Express
const app = express();
const server = createServer(app);
const io = new Server(server);

// Configuração do banco de dados
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Configuração do Telegram Bot
let telegramBot = null;

// Configuração do WhatsApp Bot
class WhatsAppBot {
  constructor() {
    this.sock = null;
    this.isReady = false;
    this.isConnected = false;
    this.qrCode = null;
    this.qrCodeImage = null;
    this.clientInfo = null;
  }

  async initialize() {
    try {
      console.log('🚀 Inicializando WhatsApp Bot...');
      
      // Limpar sessão anterior
      await this.clearSession();
      
      console.log('🔧 Configurando autenticação...');
      const { state, saveCreds } = await useMultiFileAuthState('whatsapp_session');
      
      console.log('🔧 Criando socket Baileys...');
      this.sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        browser: ['Zelar Bot', 'Chrome', '1.0.0'],
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 15000,
        retryRequestDelayMs: 1000,
        maxRetries: 5,
        markOnlineOnConnect: false,
        syncFullHistory: false,
        fireInitQueries: false,
        logger: console,
        version: [2, 2323, 4],
        getMessage: async () => {
          return { conversation: 'hello' }
        },
        shouldIgnoreJid: jid => isJidBroadcast(jid),
        patchMessageBeforeSending: (msg) => {
          const requiresPatch = !!(
            msg.buttonsMessage
            || msg.templateMessage
            || msg.listMessage
          );
          if (requiresPatch) {
            msg = {
              viewOnceMessage: {
                message: {
                  messageContextInfo: {
                    deviceListMetadataVersion: 2,
                    deviceListMetadata: {},
                  },
                  ...msg,
                },
              },
            };
          }
          return msg;
        },
      });

      // Configurar handlers
      this.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
          console.log('📱 QR Code recebido!');
          this.qrCode = qr;
          
          // Log simples do QR code
          console.log('\n' + '='.repeat(60));
          console.log('📱 QR CODE RECEBIDO - ACESSE:');
          console.log('🔗 https://zelar-ia.onrender.com/api/whatsapp/qr');
          console.log('📋 Como conectar:');
          console.log('1. Abra o WhatsApp no seu celular');
          console.log('2. Toque em Menu (3 pontos) → Dispositivos conectados');
          console.log('3. Toque em Conectar dispositivo');
          console.log('4. Acesse o link acima para ver o QR code');
          console.log('='.repeat(60));
        }

        if (connection === 'close') {
          const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
          console.log('❌ Conexão fechada:', lastDisconnect?.error, ', reconectando:', shouldReconnect);
          
          if (shouldReconnect) {
            this.isConnected = false;
            this.isReady = false;
            setTimeout(() => this.initialize(), 3000);
          }
        } else if (connection === 'open') {
          console.log('✅ WhatsApp conectado!');
          this.isConnected = true;
          this.isReady = true;
          this.qrCode = null;
          this.qrCodeImage = null;
        }
      });

      this.sock.ev.on('creds.update', saveCreds);
      
      // Handler para mensagens
      this.sock.ev.on('messages.upsert', async (m) => {
        if (m.messages && m.messages.length > 0) {
          const message = m.messages[0];
          if (message.key && message.key.remoteJid && !message.key.fromMe) {
            try {
              await this.handleMessage(message);
            } catch (error) {
              console.error('❌ Erro ao processar mensagem:', error);
            }
          }
        }
      });
      
      console.log('✅ WhatsApp Bot inicializado com sucesso!');
      
    } catch (error) {
      console.error('❌ Erro ao inicializar WhatsApp Bot:', error);
      this.isReady = false;
      this.isConnected = false;
    }
  }

  async clearSession() {
    try {
      const fs = await import('fs');
      const path = await import('path');
      
      const sessionDir = path.join(__dirname, '..', 'whatsapp_session');
      if (fs.existsSync(sessionDir)) {
        const files = fs.readdirSync(sessionDir);
        for (const file of files) {
          try {
            fs.unlinkSync(path.join(sessionDir, file));
          } catch (fileError) {
            console.log(`⚠️ Erro ao deletar arquivo ${file}:`, fileError.message);
          }
        }
        try {
          fs.rmdirSync(sessionDir);
          console.log('🗑️ Sessão anterior limpa');
        } catch (dirError) {
          console.log('⚠️ Erro ao deletar diretório:', dirError.message);
        }
      } else {
        console.log('ℹ️ Diretório de sessão não existe');
      }
    } catch (error) {
      console.log('⚠️ Erro ao limpar sessão:', error.message);
    }
  }

  getStatus() {
    return {
      isReady: this.isReady,
      isConnected: this.isConnected,
      qrCode: this.qrCode,
      qrCodeImage: this.qrCodeImage,
      clientInfo: this.clientInfo
    };
  }

  async sendMessage(chatId, message) {
    if (!this.sock || !this.isReady) {
      throw new Error('WhatsApp não está conectado');
    }

    try {
      await this.sock.sendMessage(chatId, { text: message });
      return true;
    } catch (error) {
      console.error('❌ Erro ao enviar mensagem WhatsApp:', error);
      return false;
    }
  }

  extractEventTitle(message) {
    const eventKeywords = ['marcar', 'agendar', 'reunião', 'encontro', 'consulta', 'cirurgia', 'evento', 'compromisso'];
    const hasEventKeyword = eventKeywords.some(keyword => 
      message.toLowerCase().includes(keyword)
    );
    
    if (hasEventKeyword) {
      // Extrair título do evento (primeiras palavras após palavras-chave)
      const words = message.split(' ');
      const keywordIndex = words.findIndex(word => 
        eventKeywords.some(keyword => word.toLowerCase().includes(keyword))
      );
      
      if (keywordIndex !== -1 && keywordIndex + 1 < words.length) {
        return words.slice(keywordIndex + 1, keywordIndex + 4).join(' ');
      }
    }
    
    return null;
  }

  async handleMessage(message) {
    try {
      if (message.isStatus || message.from.includes('@g.us') || message.fromMe) {
        return;
      }

      const chatId = message.key.remoteJid;
      const messageText = message.message.conversation || message.message.extendedTextMessage?.text || '';

      if (messageText) {
        console.log(`💬 WhatsApp - De: ${chatId}`);
        console.log(`📝 Mensagem: ${messageText}`);

        // Processar mensagem
        const response = await processMessage(messageText, 'whatsapp');

        try {
          await this.sock.sendMessage(chatId, { text: response });
          console.log('✅ Resposta enviada no WhatsApp!');
        } catch (error) {
          console.error('❌ Erro ao enviar resposta WhatsApp:', error);
        }
      }
    } catch (error) {
      console.error('❌ Erro ao processar mensagem WhatsApp:', error);
    }
  }
}

// Instanciar WhatsApp Bot
const whatsappBot = new WhatsAppBot();

// Função para inicializar Telegram Bot
async function initializeTelegramBot() {
  try {
    if (telegramBot) {
      await telegramBot.stopPolling();
    }

    telegramBot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {
      polling: {
        interval: 300,
        autoStart: false
      }
    });

    telegramBot.startPolling();
    console.log('✅ Telegram Bot inicializado!');
    
    // Configurar handlers do Telegram
    telegramBot.on('message', async (msg) => {
      const chatId = msg.chat.id;
      const text = msg.text || '';
      
      if (!text) return;
      
      try {
        const response = await processMessage(text, 'telegram');
        await telegramBot.sendMessage(chatId, response);
      } catch (error) {
        console.error('❌ Erro ao processar mensagem Telegram:', error);
        await telegramBot.sendMessage(chatId, 'Desculpe, ocorreu um erro interno.');
      }
    });
    
  } catch (error) {
    console.error('❌ Erro ao inicializar Telegram Bot:', error);
  }
}

// Função para processar mensagens
async function processMessage(message, platform) {
  try {
    // Extrair informações do evento
    const eventInfo = extractEventInfo(message);
    
    if (!eventInfo) {
      return 'Por favor, forneça informações sobre o evento (data, hora, título).\n\nExemplo: "Marcar reunião amanhã às 14h"';
    }

    // Gerar links de calendário
    const calendarLinks = generateCalendarLinks(eventInfo);
    
    // Gerar link de email
    const emailLink = generateEmailLink(eventInfo);
    
    // Salvar no banco de dados
    await saveEvent(eventInfo, platform);
    
    return `✅ **Evento Agendado!**\n\n` +
           `📅 **Data:** ${eventInfo.formattedDate}\n` +
           `⏰ **Hora:** ${eventInfo.formattedTime}\n` +
           `📝 **Título:** ${eventInfo.title}\n\n` +
           `📱 **Adicionar ao calendário:**\n` +
           `• Google Calendar: ${calendarLinks.google}\n` +
           `• Outlook: ${calendarLinks.outlook}\n\n` +
           `📧 **Enviar convite por email:** ${emailLink}`;
           
  } catch (error) {
    console.error('❌ Erro ao processar mensagem:', error);
    return 'Desculpe, ocorreu um erro ao processar sua solicitação.';
  }
}

// Função para extrair informações do evento
function extractEventInfo(message) {
  const lowerMessage = message.toLowerCase();
  
  // Extrair título
  let title = '';
  const titlePatterns = [
    /(?:marcar|agendar|reunião|encontro|consulta|cirurgia|evento|compromisso)\s+(.+?)(?:\s+(?:para|no|em|às|dia|amanhã|hoje|próximo|próxima|segunda|terça|quarta|quinta|sexta|sábado|domingo|\d{1,2}|\d{1,2}\/\d{1,2}))?/i,
    /(.+?)(?:\s+(?:para|no|em|às|dia|amanhã|hoje|próximo|próxima|segunda|terça|quarta|quinta|sexta|sábado|domingo|\d{1,2}|\d{1,2}\/\d{1,2}))/i
  ];
  
  for (const pattern of titlePatterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      title = match[1].trim();
      break;
    }
  }
  
  if (!title) return null;
  
  // Extrair data
  let date = new Date();
  
  // Padrões de data
  if (lowerMessage.includes('amanhã')) {
    date.setDate(date.getDate() + 1);
  } else if (lowerMessage.includes('hoje')) {
    // Mantém a data atual
  } else if (lowerMessage.includes('próximo') || lowerMessage.includes('próxima')) {
    const weekdays = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
    for (let i = 0; i < weekdays.length; i++) {
      if (lowerMessage.includes(weekdays[i])) {
        const currentDay = date.getDay();
        const targetDay = i;
        let daysToAdd = targetDay - currentDay;
        if (daysToAdd <= 0) daysToAdd += 7;
        date.setDate(date.getDate() + daysToAdd);
        break;
      }
    }
  } else if (lowerMessage.includes('dia')) {
    const dayMatch = message.match(/dia\s+(\d{1,2})/i);
    if (dayMatch) {
      const day = parseInt(dayMatch[1]);
      const currentDay = date.getDate();
      const currentMonth = date.getMonth();
      const currentYear = date.getFullYear();
      
      if (day < currentDay) {
        // Se o dia já passou neste mês, assume próximo mês
        date = new Date(currentYear, currentMonth + 1, day);
      } else {
        date = new Date(currentYear, currentMonth, day);
      }
    }
  } else if (lowerMessage.includes('daqui')) {
    const weeksMatch = message.match(/daqui\s+(\d+)\s+(?:semanas?|domingos?|segundas?|terças?|quartas?|quintas?|sextas?|sábados?)/i);
    if (weeksMatch) {
      const weeks = parseInt(weeksMatch[1]);
      date.setDate(date.getDate() + (weeks * 7));
    }
  }
  
  // Extrair hora
  let hour = 9; // Hora padrão
  let minute = 0;
  
  const timePatterns = [
    /(\d{1,2})[h:](\d{2})/i,
    /(\d{1,2})[h:]/i,
    /às\s+(\d{1,2})/i
  ];
  
  for (const pattern of timePatterns) {
    const match = message.match(pattern);
    if (match) {
      hour = parseInt(match[1]);
      if (match[2]) minute = parseInt(match[2]);
      break;
    }
  }
  
  // Configurar data e hora
  date.setHours(hour, minute, 0, 0);
  
  // Formatação
  const formattedDate = date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  const formattedTime = date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit'
  });
  
  return {
    title,
    date,
    formattedDate,
    formattedTime,
    originalMessage: message
  };
}

// Função para gerar links de calendário
function generateCalendarLinks(eventInfo) {
  const startDate = new Date(eventInfo.date);
  const endDate = new Date(startDate.getTime() + (60 * 60 * 1000)); // +1 hora
  
  const formatDate = (date) => {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  };
  
  const googleLink = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(eventInfo.title)}&dates=${formatDate(startDate)}/${formatDate(endDate)}&ctz=America/Sao_Paulo`;
  
  const outlookLink = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(eventInfo.title)}&startdt=${startDate.toISOString()}&enddt=${endDate.toISOString()}&timezone=America/Sao_Paulo`;
  
  return { google: googleLink, outlook: outlookLink };
}

// Função para gerar link de email
function generateEmailLink(eventInfo) {
  const startDate = new Date(eventInfo.date);
  const endDate = new Date(startDate.getTime() + (60 * 60 * 1000));
  
  const subject = encodeURIComponent(`Convite: ${eventInfo.title}`);
  const body = encodeURIComponent(
    `Olá!\n\n` +
    `Você está convidado para:\n\n` +
    `📅 ${eventInfo.title}\n` +
    `📆 ${eventInfo.formattedDate}\n` +
    `⏰ ${eventInfo.formattedTime}\n\n` +
    `Aguardo sua confirmação!\n\n` +
    `Atenciosamente,\nZelar Bot`
  );
  
  return `mailto:?subject=${subject}&body=${body}`;
}

// Função para salvar evento no banco
async function saveEvent(eventInfo, platform) {
  try {
    const query = `
      INSERT INTO events (title, event_date, platform, created_at)
      VALUES ($1, $2, $3, NOW())
    `;
    
    await pool.query(query, [
      eventInfo.title,
      eventInfo.date,
      platform
    ]);
    
    console.log(`✅ Evento salvo no banco: ${eventInfo.title}`);
  } catch (error) {
    console.error('❌ Erro ao salvar evento:', error);
  }
}

// Middleware
app.use(express.json());
app.use(express.static(join(__dirname, '..', 'dist')));

// Configurar multer para upload de arquivos
const upload = multer({ dest: 'uploads/' });

// Rotas
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'TelegramScheduler is running!',
    timestamp: new Date().toISOString(),
    port: process.env.PORT || 3000,
    telegramBot: !!telegramBot,
    database: !!pool
  });
});

// Rota para servir o frontend
app.get('/', (req, res) => {
  res.sendFile(join(__dirname, '..', 'dist', 'index.html'));
});

// API WhatsApp
app.get('/api/whatsapp/status', (req, res) => {
  res.json(whatsappBot.getStatus());
});

app.get('/api/whatsapp/qr', async (req, res) => {
  const status = whatsappBot.getStatus();
  
  if (status.qrCode) {
    try {
      const qrImage = await qrcode.toDataURL(status.qrCode, {
        width: 300,
        margin: 2,
        color: {
          dark: '#25D366',
          light: '#FFFFFF'
        }
      });
      
      res.json({
        status: 'qr_ready',
        qrImage,
        message: 'QR Code disponível para escaneamento'
      });
    } catch (error) {
      res.json({
        status: 'qr_error',
        message: 'Erro ao gerar QR code'
      });
    }
  } else if (status.isConnected) {
    res.json({
      status: 'connected',
      message: 'WhatsApp já está conectado'
    });
  } else {
    res.json({
      status: 'waiting',
      message: 'Aguardando QR code... Tente novamente em alguns segundos'
    });
  }
});

app.post('/api/whatsapp/clear', async (req, res) => {
  try {
    await whatsappBot.clearSession();
    await whatsappBot.initialize();
    res.json({ success: true, message: 'Sessão limpa e reinicializada' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// API para processar mensagens
app.post('/api/process-message', async (req, res) => {
  try {
    const { message, platform } = req.body;
    const response = await processMessage(message, platform);
    res.json({ success: true, response });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// WebSocket para atualizações em tempo real
io.on('connection', (socket) => {
  console.log('🔌 Cliente conectado via WebSocket');
  
  socket.on('disconnect', () => {
    console.log('🔌 Cliente desconectado');
  });
});

// Inicializar bots
async function initializeBots() {
  console.log('🚀 Inicializando bots...');
  
  try {
    // Inicializar WhatsApp
    console.log('📱 Inicializando WhatsApp Bot...');
    await whatsappBot.initialize();
    console.log('✅ WhatsApp Bot inicializado!');
  } catch (error) {
    console.error('❌ Erro ao inicializar WhatsApp Bot:', error);
  }
  
  try {
    // Inicializar Telegram
    console.log('📱 Inicializando Telegram Bot...');
    await initializeTelegramBot();
    console.log('✅ Telegram Bot inicializado!');
  } catch (error) {
    console.error('❌ Erro ao inicializar Telegram Bot:', error);
  }
  
  console.log('✅ Inicialização dos bots concluída!');
}

// Inicializar servidor
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  initializeBots();
});

// Tratamento de erros não capturados
process.on('uncaughtException', (error) => {
  console.error('❌ Erro não capturado:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promise rejeitada não tratada:', reason);
}); 