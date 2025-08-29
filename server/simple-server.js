import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createServer } from 'http';
import { Server } from 'socket.io';
import TelegramBot from 'node-telegram-bot-api';
import { default as makeWASocket, DisconnectReason, useMultiFileAuthState, isJidBroadcast } from '@whiskeysockets/baileys';
import qrcode from 'qrcode';

import fetch from 'node-fetch';
import multer from 'multer';
import pkg from 'pg';
const { Pool } = pkg;
import { config } from 'dotenv';
import AudioService from './audio-service.js';

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

// Configuração do Audio Service
const audioService = new AudioService();

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
      try {
        this.sock = makeWASocket({
          auth: state,
          printQRInTerminal: true,
          browser: ['Zelar Bot', 'Chrome', '1.0.0'],
          logger: console,
          version: [2, 2323, 4],
          connectTimeoutMs: 30000,
          keepAliveIntervalMs: 10000,
        });
        console.log('✅ Socket Baileys criado com sucesso!');
        
              // Forçar reconexão após 5 segundos
      setTimeout(() => {
        console.log('🔄 Forçando reconexão...');
        if (this.sock) {
          this.sock.end();
        }
      }, 5000);
      
      // Forçar QR code após 10 segundos se não aparecer
      setTimeout(() => {
        if (!this.qrCode) {
          console.log('🔄 Forçando geração de QR code...');
          this.initialize();
        }
      }, 10000);
        
      } catch (error) {
        console.error('❌ Erro ao criar socket Baileys:', error);
        throw error;
      }

      // Configurar handlers
      this.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        console.log('🔄 Connection update:', { connection, hasQR: !!qr });
        
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
        console.log(`\n💬 WhatsApp - De: ${chatId}`);
        console.log(`📝 Mensagem: "${messageText}"`);
        console.log(`🕐 Timestamp: ${new Date().toLocaleString('pt-BR')}`);

        try {
          // Processar mensagem
          const response = await processMessage(messageText, 'whatsapp');
          console.log(`🤖 Resposta gerada com sucesso!`);
          console.log(`📤 Enviando resposta para WhatsApp...`);

          // Enviar resposta formatada para WhatsApp
          await this.sendFormattedMessage(chatId, response);
          console.log('✅ Resposta enviada no WhatsApp!');
          console.log('─'.repeat(50));
        } catch (error) {
          console.error('❌ Erro ao processar mensagem WhatsApp:', error);
          await this.sock.sendMessage(chatId, { text: 'Desculpe, ocorreu um erro interno.' });
        }
      }
    } catch (error) {
      console.error('❌ Erro ao processar mensagem WhatsApp:', error);
    }
  }

  async sendFormattedMessage(chatId, response) {
    try {
      // Dividir a resposta em partes para melhor formatação no WhatsApp
      const lines = response.split('\n');
      const formattedResponse = lines.map(line => {
        // Converter tags HTML para formatação do WhatsApp
        return line
          .replace(/<b>(.*?)<\/b>/g, '*$1*') // Negrito
          .replace(/<code>(.*?)<\/code>/g, '`$1`') // Código
          .replace(/<a href="(.*?)">(.*?)<\/a>/g, '$2\n$1'); // Links
      }).join('\n');

      await this.sock.sendMessage(chatId, { text: formattedResponse });
    } catch (error) {
      console.error('❌ Erro ao enviar mensagem formatada:', error);
      // Fallback: enviar como texto simples
      await this.sock.sendMessage(chatId, { text: response });
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
    
    // Verificar serviço de áudio
    if (audioService.isAvailable()) {
      console.log('🎤 AudioService inicializado com sucesso');
    } else {
      console.log('⚠️ AudioService não disponível - configure OPENROUTER_API_KEY ou OPENAI_API_KEY');
    }
    
    // Configurar handlers do Telegram
    telegramBot.on('message', async (msg) => {
      const chatId = msg.chat.id;
      const text = msg.text || '';
      const voice = msg.voice;
      const audio = msg.audio;
      
      console.log(`\n💬 Telegram - De: ${msg.from.first_name} (${msg.from.id})`);
      console.log(`🕐 Timestamp: ${new Date().toLocaleString('pt-BR')}`);
      
      try {
        let messageText = text;
        let shouldSendAudio = false;
        
        // Processar mensagem de voz
        console.log(`🔍 Verificando tipo de mensagem:`);
        console.log(`📝 Text: ${!!text}`);
        console.log(`🎤 Voice: ${!!voice}`);
        console.log(`🎵 Audio: ${!!audio}`);
        console.log(`🎤 AudioService disponível: ${audioService.isAvailable()}`);
        
        if (voice && audioService.isAvailable()) {
          console.log(`🎤 Mensagem de voz recebida`);
          console.log(`📁 Voice file_id: ${voice.file_id}`);
          try {
            messageText = await audioService.processVoiceMessage(telegramBot, chatId, voice.file_id);
            shouldSendAudio = true;
            console.log(`📝 Transcrição: "${messageText}"`);
          } catch (error) {
            console.error('❌ Erro ao processar voz:', error);
            await telegramBot.sendMessage(chatId, 'Desculpe, não consegui entender a mensagem de voz. Pode enviar como texto?');
            return;
          }
        } else if (audio && audioService.isAvailable()) {
          console.log(`🎵 Arquivo de áudio recebido`);
          console.log(`📁 Audio file_id: ${audio.file_id}`);
          try {
            messageText = await audioService.processVoiceMessage(telegramBot, chatId, audio.file_id);
            shouldSendAudio = true;
            console.log(`📝 Transcrição: "${messageText}"`);
          } catch (error) {
            console.error('❌ Erro ao processar áudio:', error);
            await telegramBot.sendMessage(chatId, 'Desculpe, não consegui entender o arquivo de áudio. Pode enviar como texto?');
            return;
          }
        } else if (!text) {
          console.log(`❌ Mensagem sem texto e sem áudio`);
          if (voice && !audioService.isAvailable()) {
            console.log(`⚠️ Mensagem de voz recebida, mas AudioService não disponível`);
            await telegramBot.sendMessage(chatId, 'Funcionalidade de áudio não está configurada. Configure OPENROUTER_API_KEY ou OPENAI_API_KEY.');
          }
          return;
        }
        
        console.log(`📝 Mensagem processada: "${messageText}"`);
        
        const response = await processMessage(messageText, 'telegram');
        console.log(`🤖 Resposta gerada com sucesso!`);
        console.log(`📤 Enviando resposta para ${msg.from.first_name}...`);
        
        // Enviar resposta
        if (shouldSendAudio && audioService.isAvailable()) {
          // Enviar resposta em áudio
          await audioService.sendAudioResponse(telegramBot, chatId, response);
        } else {
          // Enviar resposta em texto
          await telegramBot.sendMessage(chatId, response, { parse_mode: 'HTML' });
        }
        
        console.log('✅ Resposta enviada no Telegram!');
        console.log('─'.repeat(50));
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
    console.log(`🔍 Processando mensagem: "${message}"`);
    console.log(`📱 Plataforma: ${platform}`);
    
    // Extrair email da mensagem
    const emailMatch = message.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
    const recipientEmail = emailMatch ? emailMatch[0] : '';
    
    console.log(`📧 Email extraído: "${recipientEmail}"`);
    console.log(`📧 Email encontrado: ${!!recipientEmail}`);
    console.log(`📧 Email match: ${emailMatch ? emailMatch[0] : 'null'}`);
    console.log(`📧 Mensagem original: "${message}"`);
    
    // Extrair informações do evento
    const eventInfo = await extractEventInfo(message);
    
    if (!eventInfo) {
      console.log('❌ Não foi possível extrair informações do evento');
      return 'Por favor, forneça informações sobre o evento (data, hora, título).\n\nExemplo: "Marcar reunião amanhã às 14h para joao@email.com"';
    }
    
    console.log(`✅ Informações extraídas:`, {
      title: eventInfo.title,
      date: eventInfo.date,
      formattedDate: eventInfo.formattedDate,
      formattedTime: eventInfo.formattedTime,
      recipientEmail
    });

    // Gerar links de calendário
    const calendarLinks = generateCalendarLinks(eventInfo);
    console.log(`🔗 Google Calendar link: ${calendarLinks.google}`);
    console.log(`🔗 Outlook link: ${calendarLinks.outlook}`);
    
    // Gerar links de email
    let emailLinks = '';
    let mailtoLink = '';
    
    if (recipientEmail) {
      const gmailLink = generateGmailInviteLink(eventInfo, recipientEmail);
      const alternativeLink = generateAlternativeEmailLink(eventInfo, recipientEmail);
      mailtoLink = generateEmailLink(eventInfo, recipientEmail);
      
      console.log(`🔗 Link Gmail gerado: ${gmailLink}`);
      console.log(`🔗 Link Alternativo gerado: ${alternativeLink}`);
      console.log(`🔗 Link Mailto gerado: ${mailtoLink}`);
      
      emailLinks = `📧 <b>Enviar convite por email:</b>\n` +
                   `• <a href="${gmailLink}">📨 Gmail (com convite)</a>\n` +
                   `• <a href="${alternativeLink}">📧 Gmail (alternativo)</a>\n` +
                   `• <a href="${mailtoLink}">📧 Email (cliente padrão)</a>\n` +
                   `• <b>Link mailto para copiar:</b>\n<code>${mailtoLink}</code>`;
    } else {
      // Se não há email, é um compromisso pessoal - não mostrar links de email
      console.log(`📝 Compromisso pessoal detectado - sem links de email`);
      emailLinks = `📝 <b>Compromisso pessoal agendado</b>`;
    }
    
    // Salvar no banco de dados
    await saveEvent(eventInfo, platform);
    
    const finalResponse = `✅ <b>Evento Agendado!</b>\n\n` +
           `📅 <b>Data:</b> ${eventInfo.formattedDate}\n` +
           `⏰ <b>Hora:</b> ${eventInfo.formattedTime}\n` +
           `📝 <b>Título:</b> ${eventInfo.title}\n` +
           `${recipientEmail ? `📧 <b>Para:</b> ${recipientEmail}\n` : ''}\n` +
           `📱 <b>Adicionar ao calendário:</b>\n` +
           `• <a href="${calendarLinks.google}">📅 Google Calendar</a>\n` +
           `• <a href="${calendarLinks.outlook}">📅 Outlook</a>\n\n` +
           emailLinks;
    
    console.log(`🤖 Resposta final gerada:`);
    console.log(`📧 Contém Gmail link: ${finalResponse.includes('Gmail (com convite)')}`);
    console.log(`📧 Contém mailto link: ${finalResponse.includes('mailto:')}`);
    console.log(`📧 Contém Google Calendar: ${finalResponse.includes('Google Calendar')}`);
    console.log(`📧 Tipo de evento: ${recipientEmail ? 'Com email' : 'Compromisso pessoal'}`);
    if (mailtoLink) {
      console.log(`📧 Link mailto completo: ${mailtoLink}`);
    }
    
    return finalResponse;
           
  } catch (error) {
    console.error('❌ Erro ao processar mensagem:', error);
    return 'Desculpe, ocorreu um erro ao processar sua solicitação.';
  }
}

// Função para extrair informações do evento
async function extractEventInfo(message) {
  const lowerMessage = message.toLowerCase();
  
  // Extrair título com melhor lógica
  let title = '';
  
  // Remover email da mensagem para extrair título
  const messageWithoutEmail = message.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '').trim();
  
  // Verificar se contém palavras-chave específicas
  if (messageWithoutEmail.toLowerCase().includes('almoço')) {
    // Extrair "almoço com [nome]" se existir
    const almocoMatch = messageWithoutEmail.match(/almoço\s+com\s+(?:o\s+)?([a-zA-ZÀ-ÿ]+)/i);
    if (almocoMatch && almocoMatch[1]) {
      title = `Almoço com ${almocoMatch[1]}`;
    } else {
      title = 'Almoço';
    }
  } else if (messageWithoutEmail.toLowerCase().includes('reunião')) {
    title = 'Reunião';
  } else if (messageWithoutEmail.toLowerCase().includes('consulta')) {
    title = 'Consulta';
  } else if (messageWithoutEmail.toLowerCase().includes('encontro')) {
    title = 'Encontro';
  } else if (messageWithoutEmail.toLowerCase().includes('evento')) {
    title = 'Evento';
  } else if (messageWithoutEmail.toLowerCase().includes('compromisso')) {
    title = 'Compromisso';
  } else {
    // Tentar extrair com padrões mais específicos
    const titlePatterns = [
      /(?:marcar|agendar|marque)\s+(.+?)(?:\s+(?:para|no|em|às|dia|amanhã|hoje|próximo|próxima|segunda|terça|quarta|quinta|sexta|sábado|domingo|\d{1,2}|\d{1,2}\/\d{1,2}))?/i,
      /(?:um\s+)(.+?)(?:\s+(?:para|no|em|às|dia|amanhã|hoje|próximo|próxima|segunda|terça|quarta|quinta|sexta|sábado|domingo|\d{1,2}|\d{1,2}\/\d{1,2}))?/i
    ];
    
    for (const pattern of titlePatterns) {
      const match = messageWithoutEmail.match(pattern);
      if (match && match[1]) {
        title = match[1].trim();
        // Limpar o título de palavras desnecessárias
        title = title.replace(/\s+(?:para|no|em|às|dia|amanhã|hoje|próximo|próxima|segunda|terça|quarta|quinta|sexta|sábado|domingo)\s*$/i, '').trim();
        break;
      }
    }
    
    // Se ainda não tem título, usar "Evento"
    if (!title) {
      title = "Evento";
    }
  }
  
  if (!title) return null;
  
  // Extrair data usando chrono-node para melhor precisão
  let date = new Date();
  
  // Verificar se há dias da semana na mensagem
  const weekdays = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  let weekdayFound = false;
  
  for (let i = 0; i < weekdays.length; i++) {
    if (lowerMessage.includes(weekdays[i])) {
      const currentDay = new Date().getDay();
      const targetDay = i;
      let daysToAdd = targetDay - currentDay;
      
      // Se for hoje, vai para próxima semana
      if (daysToAdd <= 0) daysToAdd += 7;
      
      // Calcular a data corretamente
      date.setDate(date.getDate() + daysToAdd);
      console.log(`📅 Data calculada para ${weekdays[i]}: +${daysToAdd} dias`);
      weekdayFound = true;
      break;
    }
  }
  
  // Se não encontrou dia da semana, usar chrono
  if (!weekdayFound) {
    try {
      const chrono = await import('chrono-node');
      const parsed = chrono.parse(message, new Date(), { forwardDate: true });
      
      if (parsed && parsed.length > 0) {
        date = parsed[0].start.date();
        console.log(`📅 Data extraída pelo chrono: ${date.toISOString()}`);
      }
    } catch (error) {
      console.error('❌ Erro ao usar chrono:', error);
    }
  }
  
  // Fallback para outros padrões de data
  if (lowerMessage.includes('amanhã')) {
    date.setDate(date.getDate() + 1);
  } else if (lowerMessage.includes('hoje')) {
    // Mantém a data atual
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
  
  // CORREÇÃO: Formato correto para Google Calendar (sem Z para horário local)
  const formatDateForGoogle = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    // Remover o Z para que o Google Calendar interprete como horário local
    return `${year}${month}${day}T${hours}${minutes}${seconds}`;
  };
  
  const googleLink = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(eventInfo.title)}&dates=${formatDateForGoogle(startDate)}/${formatDateForGoogle(endDate)}&ctz=America/Sao_Paulo`;
  
  const outlookLink = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(eventInfo.title)}&startdt=${startDate.toISOString()}&enddt=${endDate.toISOString()}&timezone=America/Sao_Paulo`;
  
  return { google: googleLink, outlook: outlookLink };
}

// Função para gerar link de email com destinatário
function generateEmailLink(eventInfo, recipientEmail = '') {
  const startDate = new Date(eventInfo.date);
  const endDate = new Date(startDate.getTime() + (60 * 60 * 1000));
  
  const subject = encodeURIComponent(`Convite de Calendário: ${eventInfo.title}`);
  const body = encodeURIComponent(
    `Olá!\n\n` +
    `Você está convidado para:\n\n` +
    `📅 ${eventInfo.title}\n` +
    `📆 ${eventInfo.formattedDate}\n` +
    `⏰ ${eventInfo.formattedTime}\n\n` +
    `Este é um convite de calendário que pode ser adicionado diretamente ao seu calendário.\n\n` +
    `Atenciosamente,\nZelar Bot`
  );
  
  if (recipientEmail) {
    return `mailto:${recipientEmail}?subject=${subject}&body=${body}`;
  } else {
    return `mailto:?subject=${subject}&body=${body}`;
  }
}

// Função para gerar link de convite pronto para Gmail
function generateGmailInviteLink(eventInfo, recipientEmail) {
  const startDate = new Date(eventInfo.date);
  const endDate = new Date(startDate.getTime() + (60 * 60 * 1000));
  
  // Criar link de convite de calendário do Gmail
  const eventTitle = encodeURIComponent(eventInfo.title);
  const eventDescription = encodeURIComponent(`Convite para ${eventInfo.title} em ${eventInfo.formattedDate} às ${eventInfo.formattedTime}`);
  
  // Formato de data para Gmail Calendar
  const formatDateForGmail = (date) => {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  };
  
  // Link direto para criar evento no Gmail Calendar
  const gmailCalendarLink = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${eventTitle}&dates=${formatDateForGmail(startDate)}/${formatDateForGmail(endDate)}&details=${eventDescription}&ctz=America/Sao_Paulo`;
  
  // Link para Gmail com convite
  const subject = encodeURIComponent(`Convite de Calendário: ${eventInfo.title}`);
  const body = encodeURIComponent(
    `Olá!\n\n` +
    `Você está convidado para:\n\n` +
    `📅 ${eventInfo.title}\n` +
    `📆 ${eventInfo.formattedDate}\n` +
    `⏰ ${eventInfo.formattedTime}\n\n` +
    `Para adicionar ao seu calendário, clique no link abaixo:\n` +
    `${gmailCalendarLink}\n\n` +
    `Atenciosamente,\nZelar Bot`
  );
  
  const gmailLink = `https://mail.google.com/mail/u/0/#compose?to=${encodeURIComponent(recipientEmail)}&subject=${subject}&body=${body}`;
  
  return gmailLink;
}

// Função para gerar link alternativo de email (mais compatível com Telegram)
function generateAlternativeEmailLink(eventInfo, recipientEmail) {
  const startDate = new Date(eventInfo.date);
  const endDate = new Date(startDate.getTime() + (60 * 60 * 1000));
  
  // Criar link direto para o Google Calendar
  const eventTitle = encodeURIComponent(eventInfo.title);
  const formatDateForCalendar = (date) => {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  };
  
  const calendarLink = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${eventTitle}&dates=${formatDateForCalendar(startDate)}/${formatDateForCalendar(endDate)}&ctz=America/Sao_Paulo`;
  
  // Link para Gmail com instruções claras
  const subject = encodeURIComponent(`Convite: ${eventInfo.title}`);
  const body = encodeURIComponent(
    `Olá!\n\n` +
    `Você está convidado para:\n\n` +
    `📅 ${eventInfo.title}\n` +
    `📆 ${eventInfo.formattedDate}\n` +
    `⏰ ${eventInfo.formattedTime}\n\n` +
    `Para adicionar ao seu calendário:\n` +
    `${calendarLink}\n\n` +
    `Atenciosamente,\nZelar Bot`
  );
  
  return `https://mail.google.com/mail/u/0/#compose?to=${encodeURIComponent(recipientEmail)}&subject=${subject}&body=${body}`;
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
    database: !!pool,
    uptime: process.uptime()
  });
});

// Servir arquivos estáticos do frontend
app.use(express.static(join(__dirname, '..', 'dist', 'public')));

// Rota para servir o frontend
app.get('/', (req, res) => {
  res.sendFile(join(__dirname, '..', 'dist', 'public', 'index.html'));
});

// Rota de fallback para SPA
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, '..', 'dist', 'public', 'index.html'));
});

// API WhatsApp
app.get('/api/whatsapp/status', (req, res) => {
  const status = whatsappBot.getStatus();
  res.json({
    ...status,
    message: status.isConnected 
      ? 'WhatsApp conectado e pronto para uso!' 
      : status.qrCode 
        ? 'QR Code disponível para escaneamento' 
        : 'Aguardando inicialização...'
  });
});

// API Email
app.post('/api/email/preview', async (req, res) => {
  try {
    const { title, date, time, location, description, organizer } = req.body;
    
    if (!title || !date || !time) {
      return res.status(400).json({ error: 'Título, data e hora são obrigatórios' });
    }
    
    // Criar evento temporário para gerar preview
    const eventInfo = {
      title,
      date: new Date(`${date}T${time}`),
      formattedDate: new Date(`${date}T${time}`).toLocaleDateString('pt-BR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      formattedTime: new Date(`${date}T${time}`).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
      })
    };
    
    const subject = `Convite: ${title}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333;">📅 ${title}</h2>
        <p><strong>Data:</strong> ${eventInfo.formattedDate}</p>
        <p><strong>Hora:</strong> ${eventInfo.formattedTime}</p>
        ${location ? `<p><strong>Local:</strong> ${location}</p>` : ''}
        ${description ? `<p><strong>Descrição:</strong> ${description}</p>` : ''}
        <p style="margin-top: 30px;">Aguardo sua confirmação!</p>
        <p>Atenciosamente,<br>${organizer || 'Zelar Bot'}</p>
      </div>
    `;
    
    res.json({ subject, html });
  } catch (error) {
    console.error('❌ Erro ao gerar preview:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.post('/api/email/mailto', async (req, res) => {
  try {
    const { eventData, recipientEmail } = req.body;
    
    if (!eventData.title || !eventData.date || !eventData.time) {
      return res.status(400).json({ error: 'Dados do evento incompletos' });
    }
    
    // Criar evento temporário
    const eventInfo = {
      title: eventData.title,
      date: new Date(`${eventData.date}T${eventData.time}`),
      formattedDate: new Date(`${eventData.date}T${eventData.time}`).toLocaleDateString('pt-BR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      formattedTime: new Date(`${eventData.date}T${eventData.time}`).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
      })
    };
    
    let mailtoLink;
    
    if (recipientEmail) {
      mailtoLink = generateEmailLink(eventInfo, recipientEmail);
    } else {
      mailtoLink = generateEmailLink(eventInfo);
    }
    
    res.json({ mailtoLink });
  } catch (error) {
    console.error('❌ Erro ao gerar mailto link:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota de teste para verificar as correções
app.post('/api/test-message', async (req, res) => {
  try {
    const { message, platform } = req.body;
    
    // Extrair email da mensagem
    const emailMatch = message.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
    const recipientEmail = emailMatch ? emailMatch[0] : '';
    
    // Extrair informações do evento
    const eventInfo = await extractEventInfo(message);
    
    if (!eventInfo) {
      return res.status(400).json({ error: 'Não foi possível extrair informações do evento' });
    }
    
    // Gerar links de email
    let gmailLink = null;
    if (recipientEmail) {
      gmailLink = generateGmailInviteLink(eventInfo, recipientEmail);
    }
    
    res.json({
      title: eventInfo.title,
      date: eventInfo.date,
      formattedDate: eventInfo.formattedDate,
      formattedTime: eventInfo.formattedTime,
      recipientEmail,
      gmailLink
    });
  } catch (error) {
    console.error('❌ Erro no teste:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
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