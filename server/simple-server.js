import express from 'express';
import qrcode from 'qrcode';
import TelegramBot from 'node-telegram-bot-api';
import * as nodeCrypto from 'crypto';
import { parseBrazilianDateTime, parseBrazilianDateTimeISO } from './utils/dateParser.js';
import { extractEventTitle } from './utils/titleExtractor.js';
import { generateCalendarLinks } from './utils/calendarUtils.js';
import { parseEventWithClaude } from './utils/claudeParser.js';
import { extractEmails, stripEmails } from './utils/attendeeExtractor.js';

const { webcrypto } = nodeCrypto;

const resolvedCrypto = webcrypto || nodeCrypto.webcrypto || nodeCrypto;

if (!globalThis.crypto) {
  globalThis.crypto = resolvedCrypto;
}

if (!global.crypto) {
  global.crypto = globalThis.crypto;
}

const subtle = globalThis.crypto?.subtle || globalThis.crypto?.webcrypto?.subtle;
if (!subtle && nodeCrypto.webcrypto?.subtle) {
  globalThis.crypto = nodeCrypto.webcrypto;
  global.crypto = globalThis.crypto;
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
      const eventResponse = await this.processEventMessage(text, message.from);
      if (eventResponse) {
        await this.sendMessage(message.from, eventResponse);
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

  async processEventMessage(text, userId) {
    console.log('🔍 Processando evento:', text);

    // 1. Tentar parser avançado local (Luxon + heurísticas)
    const primaryResult = parseBrazilianDateTime(text);
    if (primaryResult) {
      const attendees = extractEmails(text);
      const eventMessage = this.formatEventMessage({
        title: extractEventTitle(stripEmails(text)),
        iso: primaryResult.iso,
        readable: primaryResult.readable,
        attendees
      });
      if (eventMessage) {
        console.log('✅ Evento interpretado via parser local');
        return eventMessage;
      }
    }

    // 2. Fallback para Claude/OpenRouter se disponível
    if (process.env.OPENROUTER_API_KEY) {
      try {
        const claudeResult = await parseEventWithClaude(text, 'America/Sao_Paulo');
        console.log('🧠 Claude retornou:', claudeResult);

        if (claudeResult?.isValid && claudeResult.date) {
          const eventDate = new Date(`${claudeResult.date}T${(claudeResult.hour ?? 9).toString().padStart(2, '0')}:${(claudeResult.minute ?? 0).toString().padStart(2, '0')}:00`);
          const attendees = extractEmails(text);
          const eventMessage = this.formatEventMessage({
            title: claudeResult.title || extractEventTitle(stripEmails(text)),
            iso: eventDate.toISOString(),
            readable: primaryResult?.readable || eventDate.toLocaleString('pt-BR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              hour: '2-digit',
              minute: '2-digit'
            }),
            attendees
          });
          if (eventMessage) {
            console.log('✅ Evento interpretado via Claude');
            return eventMessage;
          }
        }
      } catch (error) {
        console.error('❌ Erro ao interpretar evento com Claude:', error.message || error);
      }
    }

    console.log('❌ Não foi possível interpretar o evento');
    return null;
  }

  formatEventMessage(eventData) {
    try {
      if (!eventData?.iso) return null;

      const eventDate = new Date(eventData.iso);
      if (Number.isNaN(eventDate.getTime())) {
        console.log('❌ Data inválida ao formatar evento');
        return null;
      }

      const title = eventData.title?.trim() || extractEventTitle(eventData.readable || 'Evento');

      const calendarLinks = generateCalendarLinks({
        title,
        startDate: eventDate,
        hour: eventDate.getHours(),
        minute: eventDate.getMinutes(),
        attendees: eventData.attendees
      });

      const readableDate = eventData.readable || eventDate.toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Sao_Paulo'
      });

      let message = `✅ *Evento criado!*\n\n` +
        `🎯 *${title}*\n` +
        `📅 ${readableDate}\n\n` +
        `*Adicionar ao calendário:*\n` +
        `🔗 Google Calendar: ${calendarLinks.google}\n\n` +
        `🔗 Outlook: ${calendarLinks.outlook}`;

      if (eventData.attendees?.length) {
        message += `\n\n👥 Convidados: ${eventData.attendees.join(', ')}`;
      }

      return message;
    } catch (error) {
      console.error('❌ Erro ao formatar mensagem de evento:', error);
      return null;
    }
  }

  async sendMessage(to, message) {
    try {
      if (!this.sock) {
        console.error('❌ Socket não está disponível');
        return false;
      }
      
      await this.sock.sendMessage(to, { text: message }, { linkPreview: false });
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
const telegramUserTimezones = new Map();
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
        const attendees = extractEmails(text);
        const cleanText = stripEmails(text);
        const userTimezone = telegramUserTimezones.get(chatId) || 'America/Sao_Paulo';
        const parsed = parseBrazilianDateTime(cleanText, userTimezone);

        if (!parsed) {
          await telegramBot.sendMessage(chatId,
            '❌ *Não consegui entender a data/hora*\n\n' +
            '💡 *Tente algo como:*\n' +
            '• "jantar hoje às 19h"\n' +
            '• "reunião quarta às 15h"',
            { parse_mode: 'Markdown' }
          );
          return;
        }

        const eventTitle = extractEventTitle(cleanText);
        const eventDate = new Date(parsed.iso);

        const calendarLinks = generateCalendarLinks({
          title: eventTitle,
          startDate: eventDate,
          hour: eventDate.getHours(),
          minute: eventDate.getMinutes(),
          attendees
        });

        const replyMarkup = {
          inline_keyboard: [
            [
              { text: '📅 Google Calendar', url: calendarLinks.google },
              { text: '📅 Outlook', url: calendarLinks.outlook }
            ]
          ]
        };

        let message = '✅ *Evento criado!*\n\n' +
          `🎯 *${eventTitle}*\n` +
          `📅 ${parsed.readable}`;

        if (attendees.length) {
          message += `\n\n👥 Convidados: ${attendees.join(', ')}`;
        }

        await telegramBot.sendMessage(chatId, message, {
          parse_mode: 'Markdown',
          reply_markup: replyMarkup
        });

        console.log(`✅ Evento criado via parser compartilhado: ${eventTitle}`);

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

      try {
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
            telegramUserTimezones.set(chatId, selectedTimezone);

            await telegramBot.sendMessage(chatId,
              '✅ *Fuso horário configurado!*\n\n' +
              `🌍 *Novo fuso:* ${timezoneName}\n` +
              `📍 *Código:* \`${selectedTimezone}\`\n\n` +
              'Agora todos os eventos considerarão este fuso horário.',
              { parse_mode: 'Markdown' }
            );

            await telegramBot.answerCallbackQuery(callbackId, {
              text: `Fuso atualizado: ${timezoneName}`,
              show_alert: false
            });

            return;
          }
        }

        console.log('⚠️ Callback query não reconhecida:', callbackData);
        await telegramBot.answerCallbackQuery(callbackId, { text: 'Ação não reconhecida' });
      } catch (error) {
        console.error('❌ Erro ao processar callback:', error);
        try {
          await telegramBot.answerCallbackQuery(callbackId, {
            text: 'Erro interno ao processar a ação',
            show_alert: false
          });
        } catch (answerError) {
          console.error('⚠️ Não foi possível enviar resposta ao callback:', answerError);
        }
      }
    });

  } catch (error) {
    console.error('❌ Erro geral no bot do Telegram:', error);
    telegramBot = null;
  }
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', whatsapp: whatsappBot?.getStatus() ?? null });
});

app.get('/api/whatsapp/status', (req, res) => {
  res.json(whatsappBot?.getStatus() || { isReady: false, isConnected: false });
});

app.get('/api/whatsapp/qr', async (req, res) => {
  try {
    if (!whatsappBot || !whatsappBot.getStatus().qrCode) {
      return res.status(404).json({ error: 'QR code não disponível' });
    }

    const status = whatsappBot.getStatus();
    const svg = await qrcode.toString(status.qrCode, { type: 'svg' });

    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(svg);
  } catch (error) {
    console.error('❌ Erro ao gerar QR via API:', error);
    res.status(500).json({ error: 'Erro interno ao gerar QR code' });
  }
});

app.post('/api/whatsapp/restart', async (req, res) => {
  try {
    if (!whatsappBot) {
      whatsappBot = new WhatsAppBot();
    }

    await whatsappBot.initialize();
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Erro ao reiniciar WhatsApp Bot:', error);
    res.status(500).json({ error: 'Falha ao reiniciar o bot' });
  }
});

(async () => {
  whatsappBot = new WhatsAppBot();
  await whatsappBot.initialize();
})();

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log(`📊 Health check: http://localhost:${port}/health`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🤖 Telegram Bot: ${telegramBot ? 'Configured' : 'Not configured'}`);
  console.log(`🗄️ Database: ${process.env.DATABASE_URL ? 'Configured' : 'Not configured'}`);
  console.log(`📱 WhatsApp QR: http://localhost:${port}/api/whatsapp/qr`);
});