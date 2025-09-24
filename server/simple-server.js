import express from 'express';
import qrcode from 'qrcode';
import TelegramBot from 'node-telegram-bot-api';
import { webcrypto } from 'crypto';

// Polyfill para crypto global
if (!globalThis.crypto) {
  globalThis.crypto = webcrypto;
}

// import { default as makeWASocket, DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys';
// import { Boom } from '@hapi/boom';

const app = express();
const port = process.env.PORT || 8080;

app.use(express.json());
app.use(express.static('dist/public'));

// Classe WhatsAppBot usando Baileys
class WhatsAppBot {
  constructor() {
    this.sock = null;
    this.status = {
      isReady: false,
      isConnected: false,
      qrCode: null,
      qrCodeImage: null,
      clientInfo: null
    };
  }


  async handleMessage(message) {
    try {
      if (message.isStatus || message.from.includes('@g.us') || message.fromMe) {
        return;
      }

      const text = message.body.trim();
      console.log(`📩 Mensagem recebida de ${message.from}: ${text}`);

      // Comando /start
      if (text === '/start') {
        const response = '🤖 *Zelar - Assistente de Agendamento*\n\n' +
          'Bem-vindo! Eu posso te ajudar a criar eventos e lembretes de forma natural.\n\n' +
          '💡 *Como usar:*\n' +
          '• "jantar hoje às 19h"\n' +
          '• "reunião amanhã às 15h"\n' +
          '• "consulta sexta às 10h"\n' +
          '• "almoço com equipe sexta 12h"\n\n' +
          '⚙️ *Comandos:*\n' +
          '/start - Mensagem de boas-vindas\n' +
          '/help - Ver exemplos e instruções\n\n' +
          'Envie qualquer mensagem com data e horário para criar um evento!';
        await this.sendMessage(message.from, response);
        return;
      }

      // Comando /help
      if (text === '/help') {
        const response = '🤖 *Assistente Zelar - Ajuda*\n\n' +
          '📅 *Como usar:*\n' +
          'Envie mensagens naturais como:\n' +
          '• "reunião com cliente amanhã às 14h"\n' +
          '• "jantar com família sexta às 19h30"\n' +
          '• "consulta médica terça-feira às 10h"\n' +
          '• "call de projeto quinta às 15h"\n\n' +
          '⚙️ *Comandos:*\n' +
          '/start - Mensagem inicial\n' +
          '/help - Ver esta ajuda';
        await this.sendMessage(message.from, response);
        return;
      }

      // Processar evento
      const result = this.parseEvent(text);
      if (result) {
        const response = `✅ *Evento criado!*\n\n` +
          `🎯 *${result.title}*\n` +
          `📅 ${result.dateTime}\n\n` +
          `*Adicionar ao calendário:*\n` +
          `🔗 Google Calendar: ${result.googleLink}\n\n` +
          `🔗 Outlook: ${result.outlookLink}`;
        await this.sendMessage(message.from, response);
      } else {
        const response = `👋 Olá! Sou o assistente Zelar.\n\n` +
          `Para criar um evento, envie uma mensagem como:\n` +
          `• "Reunião amanhã às 14h"\n` +
          `• "Consulta médica sexta às 10h30"\n` +
          `• "Jantar com a família domingo às 19h"\n\n` +
          `Ou envie /help para ver exemplos! 🤖`;
        await this.sendMessage(message.from, response);
      }
    } catch (error) {
      console.error('❌ Erro ao processar mensagem:', error);
      await this.sendMessage(message.from, '❌ Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente.');
    }
  }

  parseEvent(text) {
    const lowerText = text.toLowerCase();
    console.log('🔍 Processando evento:', text);
    
    // Extrair título - mais flexível
    let title = 'Evento';
    if (lowerText.includes('jantar')) title = 'Jantar';
    else if (lowerText.includes('almoço') || lowerText.includes('almoco')) title = 'Almoço';
    else if (lowerText.includes('reunião') || lowerText.includes('reuniao')) title = 'Reunião';
    else if (lowerText.includes('consulta')) title = 'Consulta';
    else if (lowerText.includes('academia')) title = 'Academia';
    else if (lowerText.includes('trabalho')) title = 'Trabalho';
    else if (lowerText.includes('café') || lowerText.includes('cafe')) title = 'Café';
    else if (lowerText.includes('encontro')) title = 'Encontro';
    else if (lowerText.includes('call')) title = 'Call';
    else if (lowerText.includes('meeting')) title = 'Meeting';
    else if (lowerText.includes('marque')) title = 'Evento';
    
    // Detectar "com" para adicionar pessoa - mais flexível
    const comMatch = text.match(/(.+?)\s+com\s+(.+)/i);
    if (comMatch) {
      const beforeCom = comMatch[1].trim();
      const afterCom = comMatch[2].trim();
      
      // Se começar com "marque", usar o que vem depois
      if (beforeCom.toLowerCase().includes('marque')) {
        const eventType = beforeCom.toLowerCase().replace(/marque\s*um?\s*/, '').trim();
        if (eventType) {
          title = `${eventType} com ${afterCom}`;
        } else {
          title = `Evento com ${afterCom}`;
        }
      } else {
        title = `${beforeCom} com ${afterCom}`;
      }
    }
    
    console.log('📝 Título extraído:', title);
    
    // Detectar horário - mais flexível
    let hour = 9, minute = 0;
    const timePatterns = [
      /(?:às|as|a)\s*(\d{1,2})(?::(\d{2}))?\s*h?/i,
      /(\d{1,2})(?::(\d{2}))?\s*(?:da\s*manhã|da\s*manha|am)/i,
      /(\d{1,2})(?::(\d{2}))?\s*(?:da\s*tarde|pm)/i,
      /(\d{1,2})(?::(\d{2}))?\s*(?:h|horas?)/i,
      /(\d{1,2})(?::(\d{2}))?\s*(?:da\s*manhã|da\s*manha)/i
    ];
    
    let timeMatch = null;
    for (const pattern of timePatterns) {
      timeMatch = text.match(pattern);
      if (timeMatch) break;
    }
    
    if (timeMatch) {
      hour = parseInt(timeMatch[1]);
      minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
      
      // Ajustar para PM se mencionado
      if (lowerText.includes('tarde') || lowerText.includes('pm')) {
        if (hour < 12) hour += 12;
      }
      
      console.log('⏰ Horário extraído:', `${hour}:${minute.toString().padStart(2, '0')}`);
    }
    
    // Detectar data
    let eventDate = new Date();
    let isValidEvent = false;
    
    // Detectar dia da semana
    const weekdays = {
      'segunda': 1, 'terça': 2, 'terca': 2, 'quarta': 3, 'quinta': 4, 'sexta': 5, 'sábado': 6, 'sabado': 6, 'domingo': 0
    };
    
    for (const [day, dayNum] of Object.entries(weekdays)) {
      if (lowerText.includes(day)) {
        const today = new Date();
        const currentDay = today.getDay();
        let daysToAdd = (dayNum - currentDay + 7) % 7;
        if (daysToAdd === 0) daysToAdd = 7;
        eventDate.setDate(today.getDate() + daysToAdd);
        isValidEvent = true;
        break;
      }
    }
    
    // Detectar "amanhã"
    if (lowerText.includes('amanhã') || lowerText.includes('amanha')) {
      eventDate.setDate(eventDate.getDate() + 1);
      isValidEvent = true;
    }
    
    // Detectar dia do mês (ex: "dia 29", "29", "dia 29 de setembro")
    const dayMatch = text.match(/dia\s*(\d{1,2})/i) || text.match(/\b(\d{1,2})\b/);
    if (dayMatch) {
      const day = parseInt(dayMatch[1]);
      const today = new Date();
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();
      
      // Se o dia já passou este mês, agendar para o próximo mês
      if (day < today.getDate()) {
        eventDate = new Date(currentYear, currentMonth + 1, day);
      } else {
        eventDate = new Date(currentYear, currentMonth, day);
      }
      isValidEvent = true;
      console.log('📅 Data extraída (dia do mês):', eventDate.toLocaleDateString('pt-BR'));
    }
    
    // Se não conseguiu detectar data específica, mas tem horário, usar hoje
    if (!isValidEvent && timeMatch) {
      isValidEvent = true;
    }
    
    if (!isValidEvent) {
      console.log('❌ Evento inválido - não conseguiu detectar data/hora');
      return null;
    }
    
    console.log('✅ Evento válido detectado!');
    
    // Configurar horário (timezone Brasil UTC-3)
    eventDate.setHours(hour, minute, 0, 0);
    console.log('📅 Data final:', eventDate.toLocaleDateString('pt-BR'), eventDate.toLocaleTimeString('pt-BR'));
    
    // Gerar links com timezone correto
    const startDate = new Date(eventDate);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
    
    // Converter para UTC para os links (Brasil é UTC-3)
    const utcStartDate = new Date(startDate.getTime() + (3 * 60 * 60 * 1000));
    const utcEndDate = new Date(endDate.getTime() + (3 * 60 * 60 * 1000));
    
    const formatDate = (date) => date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    
    const googleLink = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${formatDate(utcStartDate)}/${formatDate(utcEndDate)}`;
    const outlookLink = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(title)}&startdt=${utcStartDate.toISOString()}&enddt=${utcEndDate.toISOString()}`;
    
    const dateTime = startDate.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo'
    });
    
    return {
      title,
      dateTime,
      googleLink,
      outlookLink
    };
  }

  async sendMessage(to, message) {
    try {
      if (!this.sock) {
        console.error('❌ Socket não está disponível');
        return false;
      }
      
      await this.sock.sendMessage(to, { text: message });
      return true;
    } catch (error) {
      console.error('❌ Erro ao enviar mensagem:', error);
      return false;
    }
  }

  async initialize() {
    try {
      console.log('🚀 Inicializando WhatsApp Bot...');
      
      // Import dinâmico do Baileys
      console.log('📦 Carregando Baileys...');
      const baileysModule = await import('@whiskeysockets/baileys');
      console.log('✅ Baileys carregado!');
      
      console.log('🔧 Módulo Baileys:', Object.keys(baileysModule));
      console.log('🔧 default:', typeof baileysModule.default);
      
      // Tentar diferentes formas de acessar makeWASocket
      let makeWASocket = baileysModule.default;
      if (!makeWASocket || typeof makeWASocket !== 'function') {
        makeWASocket = baileysModule.makeWASocket;
      }
      if (!makeWASocket || typeof makeWASocket !== 'function') {
        makeWASocket = baileysModule.default?.default;
      }
      
      const { DisconnectReason, useMultiFileAuthState } = baileysModule;
      
      console.log('🔧 makeWASocket final:', typeof makeWASocket);
      console.log('🔧 makeWASocket disponível:', !!makeWASocket);
      
      console.log('📁 Carregando estado de autenticação...');
      console.log('🔧 useMultiFileAuthState disponível:', typeof useMultiFileAuthState);
      
      const authResult = await useMultiFileAuthState('whatsapp_session');
      const { state, saveCreds } = authResult;
      console.log('✅ Estado carregado!');
      
      console.log('🔗 Criando conexão Baileys...');
      this.sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        generateHighQualityLinkPreview: false,
        markOnlineOnConnect: false,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 30000,
        connectTimeoutMs: 60000,
        retryRequestDelayMs: 250,
        maxMsgRetryCount: 5,
        msgRetryCounterCache: new Map(),
        linkPreviewImageThumbnailWidth: 192,
        transactionOpts: {
          maxCommitRetries: 10,
          delayBetweenTriesMs: 3000
        },
        getMessage: async (key) => {
          return {
            conversation: "placeholder"
          }
        }
      });
      console.log('✅ Conexão criada!');

      this.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
          console.log('🔗 QR Code recebido!');
          this.status.qrCode = qr;
          this.status.isConnected = false;
          this.status.isReady = true;
          
          // Gerar QR code visual
          try {
            const qrImage = await qrcode.toString(qr, { type: 'terminal', width: 20, small: true });
            console.log('\n📱 ESCANEIE O QR CODE ABAIXO NO SEU WHATSAPP:\n');
            console.log(qrImage);
            console.log('\n🔗 Ou acesse: https://zelar-ia.onrender.com/api/whatsapp/qr');
            console.log('\n📋 Como conectar:');
            console.log('1. Abra o WhatsApp no seu celular');
            console.log('2. Toque em Menu (3 pontos) → Dispositivos conectados');
            console.log('3. Toque em Conectar dispositivo');
            console.log('4. Aponte a câmera para o QR code acima\n');
          } catch (error) {
            console.log('❌ Erro ao gerar QR code visual:', error);
          }
        }
        
        if (connection === 'close') {
          const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
          console.log('❌ Conexão fechada, reconectando:', shouldReconnect);
          if (shouldReconnect) {
            this.initialize();
          }
        } else if (connection === 'open') {
          console.log('✅ WhatsApp Bot está pronto!');
          this.status.isConnected = true;
          this.status.isReady = true;
          this.status.qrCode = null;
        }
      });

      this.sock.ev.on('creds.update', saveCreds);
      
      // Listener para mensagens recebidas
      this.sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        
        const message = {
          from: msg.key.remoteJid,
          body: msg.message.conversation || msg.message.extendedTextMessage?.text || '',
          isStatus: false,
          fromMe: msg.key.fromMe
        };
        
        await this.handleMessage(message);
      });
      
      console.log('✅ WhatsApp Bot inicializado com sucesso!');
    } catch (error) {
      console.error('❌ Erro ao inicializar WhatsApp Bot:', error);
      console.error('🔍 Detalhes do erro:', error.message);
      this.status.isReady = false;
      
      // Tentar reinicializar após 60 segundos
      setTimeout(() => {
        console.log('🔄 Tentando reinicializar WhatsApp Bot...');
        this.initialize();
      }, 60000);
    }
  }

  getStatus() {
    return this.status;
  }
}

// Instância global do WhatsApp Bot
let whatsappBot = null;

// Inicializar bot do Telegram se o token estiver configurado
let telegramBot = null;
if (process.env.TELEGRAM_BOT_TOKEN && process.env.ENABLE_TELEGRAM_BOT !== 'false') {
  try {
    telegramBot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
    console.log('✅ Bot do Telegram inicializado com sucesso!');
    
    // Configurar comandos completos
    telegramBot.on('message', async (msg) => {
      const chatId = msg.chat.id;
      const text = msg.text;
      
      console.log(`📱 Mensagem recebida: ${text}`);
      
      // Comando /start
      if (text === '/start') {
        await telegramBot.sendMessage(chatId, 
          '🤖 *Zelar - Assistente de Agendamento*\n\n' +
          '💡 *Como usar:*\n' +
          '• "jantar hoje às 19h"\n' +
          '• "reunião amanhã às 15h"\n' +
          '• "consulta sexta às 10h"\n\n' +
          '🌍 *Fuso horário:* Brasil (UTC-3)\n' +
          'Use /timezone para alterar\n\n' +
          '📝 *Comandos:*\n' +
          '/timezone - Alterar fuso horário\n' +
          '/help - Ajuda completa\n\n' +
          'Envie qualquer mensagem com data e horário!',
          { parse_mode: 'Markdown' }
        );
        return;
      }

      // Comando /help
      if (text === '/help') {
        await telegramBot.sendMessage(chatId,
          '🤖 *Assistente Zelar - Ajuda*\n\n' +
          '📅 *Como usar:*\n' +
          'Envie mensagens naturais como:\n' +
          '• "reunião com cliente amanhã às 14h"\n' +
          '• "jantar com família sexta às 19h30"\n' +
          '• "consulta médica terça-feira às 10h"\n' +
          '• "call de projeto quinta às 15h"\n\n' +
          '⚙️ *Comandos:*\n' +
          '/timezone - Alterar fuso horário\n' +
          '/start - Mensagem inicial\n\n' +
          '🌍 *Fuso atual:* Brasil (UTC-3)\n\n' +
          '✨ Processamento com IA Claude!',
          { parse_mode: 'Markdown' }
        );
        return;
      }

      // Comando /timezone
      if (text === '/timezone') {
        const replyMarkup = {
          inline_keyboard: [
            [
              { text: '🇧🇷 Brasil/Argentina (UTC-3)', callback_data: 'tz_brazil' },
              { text: '🇺🇸 EUA Leste/Canadá (UTC-5)', callback_data: 'tz_us_east' }
            ],
            [
              { text: '🇺🇸 EUA Central/México (UTC-6)', callback_data: 'tz_us_central' },
              { text: '🇺🇸 EUA Oeste (UTC-8)', callback_data: 'tz_us_west' }
            ],
            [
              { text: '🇬🇧 Londres/Dublin (UTC+0)', callback_data: 'tz_london' },
              { text: '🇪🇺 Europa Central (UTC+1)', callback_data: 'tz_europe' }
            ],
            [
              { text: '🇷🇺 Moscou/Turquia (UTC+3)', callback_data: 'tz_moscow' },
              { text: '🇮🇳 Índia (UTC+5:30)', callback_data: 'tz_india' }
            ],
            [
              { text: '🇨🇳 China/Singapura (UTC+8)', callback_data: 'tz_china' },
              { text: '🇯🇵 Japão/Coreia (UTC+9)', callback_data: 'tz_japan' }
            ],
            [
              { text: '🇦🇺 Austrália Leste (UTC+10)', callback_data: 'tz_sydney' },
              { text: '🇳🇿 Nova Zelândia (UTC+12)', callback_data: 'tz_newzealand' }
            ]
          ]
        };
        
        await telegramBot.sendMessage(chatId,
          '🌍 *Selecione seu fuso horário:*\n\n' +
          '🇧🇷 Brasil/Argentina: UTC-3\n' +
          '🇺🇸 EUA Leste/Canadá: UTC-5\n' +
          '🇺🇸 EUA Central/México: UTC-6\n' +
          '🇺🇸 EUA Oeste: UTC-8\n' +
          '🇬🇧 Londres/Dublin: UTC+0\n' +
          '🇪🇺 Europa Central (Alemanha, França, Itália, Espanha): UTC+1\n' +
          '🇷🇺 Moscou/Turquia: UTC+3\n' +
          '🇮🇳 Índia: UTC+5:30\n' +
          '🇨🇳 China/Singapura: UTC+8\n' +
          '🇯🇵 Japão/Coreia: UTC+9\n' +
          '🇦🇺 Austrália Leste: UTC+10\n' +
          '🇳🇿 Nova Zelândia: UTC+12',
          { parse_mode: 'Markdown', reply_markup: replyMarkup }
        );
        return;
      }

      if (text.startsWith('/')) return;

      try {
        // Processamento simples de mensagens
        const lowerText = text.toLowerCase();
        
        // Detectar padrões básicos
        let eventTitle = 'Evento';
        let eventDate = new Date();
        let isValidEvent = false;
        
        // Extrair título básico
        if (lowerText.includes('jantar')) eventTitle = 'Jantar';
        else if (lowerText.includes('almoço') || lowerText.includes('almoco')) eventTitle = 'Almoço';
        else if (lowerText.includes('reunião') || lowerText.includes('reuniao')) eventTitle = 'Reunião';
        else if (lowerText.includes('consulta')) eventTitle = 'Consulta';
        else if (lowerText.includes('academia')) eventTitle = 'Academia';
        else if (lowerText.includes('trabalho')) eventTitle = 'Trabalho';
        else eventTitle = 'Evento';
        
        // Detectar "com" para adicionar pessoa
        const comMatch = text.match(/(.+?)\s+com\s+(.+)/i);
        if (comMatch) {
          eventTitle = `${comMatch[1].trim()} com ${comMatch[2].trim()}`;
        }
        
        // Detectar horário básico
        const timeMatch = text.match(/(?:às|as|a)\s*(\d{1,2})(?::(\d{2}))?\s*h?/i);
        if (timeMatch) {
          const hour = parseInt(timeMatch[1]);
          const minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
          eventDate.setHours(hour, minute, 0, 0);
          isValidEvent = true;
        }
        
        // Detectar dia da semana
        const weekdays = {
          'segunda': 1, 'terça': 2, 'terca': 2, 'quarta': 3, 'quinta': 4, 'sexta': 5, 'sábado': 6, 'sabado': 6, 'domingo': 0
        };
        
        for (const [day, dayNum] of Object.entries(weekdays)) {
          if (lowerText.includes(day)) {
            const today = new Date();
            const currentDay = today.getDay();
            let daysToAdd = (dayNum - currentDay + 7) % 7;
            if (daysToAdd === 0) daysToAdd = 7; // Se for hoje, agendar para próxima semana
            eventDate.setDate(today.getDate() + daysToAdd);
            isValidEvent = true;
            break;
          }
        }
        
        // Detectar "amanhã"
        if (lowerText.includes('amanhã') || lowerText.includes('amanha')) {
          eventDate.setDate(eventDate.getDate() + 1);
          isValidEvent = true;
        }
        
        if (!isValidEvent) {
          await telegramBot.sendMessage(chatId,
            '❌ *Não consegui entender a data/hora*\n\n' +
            '💡 *Tente algo como:*\n' +
            '• "jantar hoje às 19h"\n' +
            '• "reunião quarta às 15h"',
            { parse_mode: 'Markdown' }
          );
          return;
        }
        
        // Gerar links do calendário
        const startDate = new Date(eventDate);
        const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
        
        const formatDate = (date) => date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        
        const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(eventTitle)}&dates=${formatDate(startDate)}/${formatDate(endDate)}`;
        const outlookUrl = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(eventTitle)}&startdt=${startDate.toISOString()}&enddt=${endDate.toISOString()}`;

        const replyMarkup = {
          inline_keyboard: [
            [
              { text: '📅 Google Calendar', url: googleUrl },
              { text: '📅 Outlook', url: outlookUrl }
            ]
          ]
        };

        const displayDate = startDate.toLocaleDateString('pt-BR', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          hour: '2-digit',
          minute: '2-digit'
        });

        await telegramBot.sendMessage(chatId,
          '✅ *Evento criado!*\n\n' +
          `🎯 *${eventTitle}*\n` +
          `📅 ${displayDate}`,
          { parse_mode: 'Markdown', reply_markup: replyMarkup }
        );

        console.log(`✅ Evento criado: ${eventTitle}`);

      } catch (error) {
        console.error('❌ Erro ao processar:', error);
        await telegramBot.sendMessage(chatId, '❌ Erro interno. Tente novamente.');
      }
    });

    // Configurar callback queries (botões inline)
    telegramBot.on('callback_query', async (callbackQuery) => {
      const callbackData = callbackQuery.data;
      const chatId = callbackQuery.message.chat.id;
      const callbackId = callbackQuery.id;
      
      console.log(`🔘 Callback: "${callbackData}" do chat ${chatId}`);
      
      // Processar seleção de fuso horário
      if (callbackData?.startsWith('tz_')) {
        const timezoneMap = {
          'tz_brazil': 'America/Sao_Paulo',
          'tz_us_east': 'America/New_York',
          'tz_us_central': 'America/Chicago',
          'tz_us_west': 'America/Los_Angeles',
          'tz_london': 'Europe/London',
          'tz_europe': 'Europe/Berlin',
          'tz_moscow': 'Europe/Moscow',
          'tz_india': 'Asia/Kolkata',
          'tz_china': 'Asia/Shanghai',
          'tz_japan': 'Asia/Tokyo',
          'tz_sydney': 'Australia/Sydney',
          'tz_newzealand': 'Pacific/Auckland'
        };

        const timezoneNames = {
          'tz_brazil': 'Brasil/Argentina (UTC-3)',
          'tz_us_east': 'EUA Leste/Canadá (UTC-5)',
          'tz_us_central': 'EUA Central/México (UTC-6)',
          'tz_us_west': 'EUA Oeste (UTC-8)',
          'tz_london': 'Londres/Dublin (UTC+0)',
          'tz_europe': 'Europa Central (UTC+1)',
          'tz_moscow': 'Moscou/Turquia (UTC+3)',
          'tz_india': 'Índia (UTC+5:30)',
          'tz_china': 'China/Singapura (UTC+8)',
          'tz_japan': 'Japão/Coreia (UTC+9)',
          'tz_sydney': 'Austrália Leste (UTC+10)',
          'tz_newzealand': 'Nova Zelândia (UTC+12)'
        };

        const selectedTimezone = timezoneMap[callbackData];
        const timezoneName = timezoneNames[callbackData];
        
        if (selectedTimezone) {
          await telegramBot.sendMessage(chatId,
            `✅ *Fuso horário atualizado!*\n\n` +
            `🌍 Região: ${timezoneName}\n` +
            `⏰ Agora todos os eventos serão criados neste fuso horário.\n\n` +
            `💡 Envie uma mensagem como "reunião amanhã às 14h" para testar!`,
            { parse_mode: 'Markdown' }
          );
          
          await telegramBot.answerCallbackQuery(callbackId, { text: `Fuso horário definido: ${timezoneName}` });
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Erro ao inicializar bot do Telegram:', error);
  }
}

app.use(express.json());

// Health check simples
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'TelegramScheduler is running!',
    timestamp: new Date().toISOString(),
    port: port,
    telegramBot: !!process.env.TELEGRAM_BOT_TOKEN,
    database: !!process.env.DATABASE_URL
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'TelegramScheduler API',
    version: '1.0.0',
    status: 'running',
    telegramBot: !!process.env.TELEGRAM_BOT_TOKEN,
    database: !!process.env.DATABASE_URL
  });
});

// Rota para a página do QR Code
app.get('/qr', (req, res) => {
  res.sendFile('qr-display.html', { root: 'public' });
});

// Endpoint para obter QR code do WhatsApp
app.get('/api/whatsapp/qr', async (req, res) => {
  try {
    if (!whatsappBot) {
      return res.status(404).json({ error: 'Bot do WhatsApp não encontrado' });
    }

    const status = whatsappBot.getStatus();
    
    if (status.isConnected) {
      return res.json({
        status: 'connected',
        message: 'WhatsApp já está conectado!',
        clientInfo: status.clientInfo
      });
    }

    if (status.qrCode) {
      // Gerar QR code como imagem
      const qrImage = await qrcode.toDataURL(status.qrCode, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      return res.json({
        status: 'qr_ready',
        qrCode: status.qrCode,
        qrImage: qrImage,
        message: 'Escaneie o QR code com seu WhatsApp'
      });
    }

    return res.json({
      status: 'waiting',
      message: 'Aguardando QR code... Tente novamente em alguns segundos'
    });
  } catch (error) {
    console.error('Erro ao gerar QR code:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Endpoint para status do WhatsApp
app.get('/api/whatsapp/status', async (req, res) => {
  try {
    if (!whatsappBot) {
      return res.status(404).json({ error: 'Bot do WhatsApp não encontrado' });
    }

    const status = whatsappBot.getStatus();
    res.json(status);
  } catch (error) {
    console.error('Erro ao obter status do WhatsApp:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Endpoint para enviar mensagem via WhatsApp
app.post('/api/whatsapp/send', async (req, res) => {
  try {
    const { to, message } = req.body;
    
    if (!to || !message) {
      return res.status(400).json({ error: 'Número de destino e mensagem são obrigatórios' });
    }

    if (!whatsappBot) {
      return res.status(404).json({ error: 'Bot do WhatsApp não encontrado' });
    }

    const success = await whatsappBot.sendMessage(to, message);
    
    if (success) {
      res.json({ success: true, message: 'Mensagem enviada com sucesso' });
    } else {
      res.status(500).json({ error: 'Falha ao enviar mensagem' });
    }
  } catch (error) {
    console.error('Erro ao enviar mensagem WhatsApp:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Start server
app.listen(port, async () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log(`📊 Health check: http://localhost:${port}/health`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🤖 Telegram Bot: ${process.env.TELEGRAM_BOT_TOKEN ? 'Configured' : 'Not configured'}`);
  console.log(`🗄️ Database: ${process.env.DATABASE_URL ? 'Configured' : 'Not configured'}`);
  console.log(`📱 WhatsApp QR: http://localhost:${port}/api/whatsapp/qr`);
  
  // Inicializar WhatsApp Bot
  try {
    whatsappBot = new WhatsAppBot();
    await whatsappBot.initialize();
    console.log('✅ WhatsApp Bot inicializado!');
  } catch (error) {
    console.error('❌ Erro ao inicializar WhatsApp Bot:', error);
  }
});

export default app; 