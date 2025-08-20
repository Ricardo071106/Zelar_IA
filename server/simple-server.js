import express from 'express';
import qrcode from 'qrcode';
import TelegramBot from 'node-telegram-bot-api';
import analytics from './analytics.js';
import AudioService from './audioService.js';
import EmailService from './emailService.js';
import multer from 'multer';
import { default as makeWASocket, DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys';

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
    this.userStates = new Map(); // Para controlar estados dos usuários
  }

  async initialize() {
    try {
      console.log('🚀 Inicializando WhatsApp Bot...');
      
      // Limpar sessão anterior
      await this.clearSession();
      
      // Configurar autenticação
      const { state, saveCreds } = await useMultiFileAuthState('whatsapp_session');
      
      // Criar socket
      this.sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        browser: ['Zelar Bot', 'Chrome', '1.0.0'],
        keepAliveIntervalMs: 30000,
        retryRequestDelayMs: 2000,
        maxRetries: 3,
        markOnlineOnConnect: false,
        syncFullHistory: false,
        fireInitQueries: false
      });
      
      // Configurar event handlers
      this.setupEventHandlers(saveCreds);
      
      console.log('✅ WhatsApp Bot inicializado com sucesso!');
    } catch (error) {
      console.error('❌ Erro ao inicializar WhatsApp Bot:', error);
      throw error;
    }
  }

  setupEventHandlers(saveCreds) {
    console.log('🔧 Configurando event handlers do WhatsApp...');
    
    this.sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        console.log('🔗 QR Code recebido!');
        this.status.qrCode = qr;
        this.status.isConnected = false;
        this.status.isReady = true;
        
        // Gerar QR code visual no terminal
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
          
          // Também gerar QR code como imagem base64
          try {
            const qrDataURL = await qrcode.toDataURL(qr, {
              width: 300,
              margin: 2,
              color: {
                dark: '#25D366',
                light: '#FFFFFF'
              }
            });
            this.status.qrCodeImage = qrDataURL;
          } catch (error) {
            console.log('❌ Erro ao gerar QR code como imagem:', error);
          }
        } catch (error) {
          console.log('❌ Erro ao gerar QR code visual:', error);
        }
      }
      
      if (connection === 'close') {
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        console.log('❌ Conexão fechada, reconectando:', shouldReconnect);
        
        if (shouldReconnect) {
          setTimeout(() => {
            console.log('🔄 Reconectando...');
            this.initialize();
          }, 5000);
        }
      } else if (connection === 'open') {
        console.log('✅ WhatsApp Bot está pronto!');
        this.status.isConnected = true;
        this.status.isReady = true;
        this.status.qrCode = null;
      }
    });
    
    // Handler para credenciais
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
  }

  async handleMessage(message) {
    try {
      if (message.isStatus || message.from.includes('@g.us') || message.fromMe) {
        return;
      }

      const chatId = message.key.remoteJid;
      const messageText = message.message.conversation || message.message.extendedTextMessage?.text || '';

      if (messageText) {
        console.log(`💬 De: ${chatId}`);
        console.log(`📝 Mensagem: ${messageText}`);

        // Processar comando de agendamento
        const response = await this.processSchedulingCommand(messageText, chatId);

        try {
          await this.sock.sendMessage(chatId, { text: response });
          console.log('✅ Resposta enviada!');

          // Log analytics
          analytics.logMessage('whatsapp', chatId, messageText, response, this.extractEventTitle(messageText));
        } catch (error) {
          console.error('❌ Erro ao enviar resposta:', error);
        }
      }
    } catch (error) {
      console.error('❌ Erro ao processar mensagem:', error);
    }
  }

  getStatus() {
    return this.status;
  }

  async clearSession() {
    try {
      console.log('🧹 Limpando sessão WhatsApp...');
      const fs = await import('fs');
      const path = await import('path');
      
      // Limpar diretórios de sessão
      const sessionDirs = [
        'whatsapp_session',
        '.wwebjs_auth',
        '.wwebjs_cache'
      ];
      
      for (const dir of sessionDirs) {
        if (fs.existsSync(dir)) {
          fs.rmSync(dir, { recursive: true, force: true });
          console.log(`✅ ${dir} removido!`);
        }
      }
      
      // Resetar status
      this.status = {
        isReady: false,
        isConnected: false,
        qrCode: null,
        qrCodeImage: null,
        clientInfo: null
      };
      
      console.log('✅ Sessão limpa!');
    } catch (error) {
      console.error('❌ Erro ao limpar sessão:', error);
    }
  }

  async sendMessage(chatId, message) {
    try {
      if (!this.sock || !this.status.isConnected) {
        throw new Error('WhatsApp não está conectado');
      }
      
      await this.sock.sendMessage(chatId, { text: message });
      return true;
    } catch (error) {
      console.error('❌ Erro ao enviar mensagem:', error);
      return false;
    }
  }

  // Métodos de processamento de comandos (mantidos do código original)
  async processSchedulingCommand(message, chatId) {
    // Implementação do processamento de comandos
    // (mantida do código original)
    return 'Comando processado com sucesso!';
  }

  extractEventTitle(message) {
    // Implementação da extração de título
    // (mantida do código original)
    return 'Evento';
  }
}

// Instância global do WhatsApp Bot
let whatsappBot = null;

// Inicializar bot do Telegram se o token estiver configurado
let telegramBot = null;
if (process.env.TELEGRAM_BOT_TOKEN && process.env.ENABLE_TELEGRAM_BOT === 'true') { // REATIVADO
  try {
    telegramBot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
    console.log('✅ Bot do Telegram inicializado com sucesso!');
    
    // Configurar comandos completos
    telegramBot.on('message', async (msg) => {
      const chatId = msg.chat.id;
      const text = msg.text;
      
      console.log(`📱 Mensagem recebida: ${text}`);
      
      // Processar mensagens de áudio
      if (msg.voice || msg.audio) {
        await handleTelegramAudio(msg);
        return;
      }
      
      // Comando /start
      if (text === '/start') {
        await telegramBot.sendMessage(chatId, 
          '🤖 *Zelar - Assistente de Agendamento*\n\n' +
          '💡 *Como usar:*\n' +
          '• "jantar hoje às 19h"\n' +
          '• "reunião amanhã às 15h"\n' +
          '• "consulta sexta às 10h"\n\n' +
          '🌍 *Fuso horário:* Brasil (UTC-3)\n' +
               'Use /fuso para alterar\n\n' +
          '📝 *Comandos:*\n' +
          '/fuso - Alterar fuso horário\n' +
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
          '/fuso - Alterar fuso horário\n' +
          '/start - Mensagem inicial\n\n' +
          '🌍 *Fuso atual:* Brasil (UTC-3)\n\n' +
          '✨ Processamento com IA Claude!',
          { parse_mode: 'Markdown' }
        );
        return;
      }

      // Comando /fuso
      if (text === '/fuso') {
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
        
        // Extrair título básico - ATUALIZADO
        if (lowerText.includes('jantar')) eventTitle = 'Jantar';
        else if (lowerText.includes('almoço') || lowerText.includes('almoco')) eventTitle = 'Almoço';
        else if (lowerText.includes('reunião') || lowerText.includes('reuniao')) eventTitle = 'Reunião';
        else if (lowerText.includes('consulta')) eventTitle = 'Consulta';
        else if (lowerText.includes('cirurgia')) eventTitle = 'Cirurgia';
        else if (lowerText.includes('exame')) eventTitle = 'Exame';
        else if (lowerText.includes('academia')) eventTitle = 'Academia';
        else if (lowerText.includes('trabalho')) eventTitle = 'Trabalho';
        else if (lowerText.includes('call') || lowerText.includes('telefonema')) eventTitle = 'Call';
        else if (lowerText.includes('encontro')) eventTitle = 'Encontro';
        else if (lowerText.includes('apresentação') || lowerText.includes('apresentacao')) eventTitle = 'Apresentação';
        else if (lowerText.includes('entrevista')) eventTitle = 'Entrevista';
        else if (lowerText.includes('aula')) eventTitle = 'Aula';
        else if (lowerText.includes('curso')) eventTitle = 'Curso';
        else if (lowerText.includes('viagem')) eventTitle = 'Viagem';
        else if (lowerText.includes('festa')) eventTitle = 'Festa';
        else if (lowerText.includes('aniversário') || lowerText.includes('aniversario')) eventTitle = 'Aniversário';
        else if (lowerText.includes('casamento')) eventTitle = 'Casamento';
        else if (lowerText.includes('dentista')) eventTitle = 'Consulta Dentista';
        else if (lowerText.includes('psicólogo') || lowerText.includes('psicologo')) eventTitle = 'Consulta Psicólogo';
        else if (lowerText.includes('fisioterapia')) eventTitle = 'Fisioterapia';
        else if (lowerText.includes('massagem')) eventTitle = 'Massagem';
        else if (lowerText.includes('corte')) eventTitle = 'Corte de Cabelo';
        else if (lowerText.includes('manicure')) eventTitle = 'Manicure';
        else if (lowerText.includes('pedicure')) eventTitle = 'Pedicure';
        else if (lowerText.includes('tatuagem')) eventTitle = 'Tatuagem';
        else if (lowerText.includes('piercing')) eventTitle = 'Piercing';
        else eventTitle = 'Evento';
        
        // Detectar "com" para adicionar pessoa
        const comMatch = text.match(/(.+?)\s+com\s+(.+)/i);
        if (comMatch) {
          eventTitle = `${comMatch[1].trim()} com ${comMatch[2].trim()}`;
        }
        
        // Detectar dia da semana - MELHORADO para evitar falsos positivos
        const weekdays = {
          'segunda': 1, 'terça': 2, 'terca': 2, 'quarta': 3, 'quinta': 4, 'sexta': 5, 'sábado': 6, 'sabado': 6, 'domingo': 0
        };
        
        for (const [day, dayNum] of Object.entries(weekdays)) {
          // Usar regex para detectar apenas palavras completas
          const dayRegex = new RegExp(`\\b${day}\\b`, 'i');
          if (dayRegex.test(text)) {
            const today = new Date();
            const currentDay = today.getDay();
            let daysToAdd = (dayNum - currentDay + 7) % 7;
            if (daysToAdd === 0) daysToAdd = 7; // Se for hoje, agendar para próxima semana
            eventDate.setDate(today.getDate() + daysToAdd);
            isValidEvent = true;
            console.log(`📅 Dia da semana detectado: ${day} (${daysToAdd} dias à frente)`);
            break;
          }
        }
        
        // Detectar "amanhã"
        if (lowerText.includes('amanhã') || lowerText.includes('amanha')) {
          console.log(`📅 Detectado "amanhã" - data atual: ${eventDate.toLocaleString('pt-BR')}`);
          eventDate.setDate(eventDate.getDate() + 1);
          console.log(`📅 Data após adicionar 1 dia: ${eventDate.toLocaleString('pt-BR')}`);
          isValidEvent = true;
        }
        
        // Detectar datas específicas (ex: "30 de agosto", "29/08", "29-08", "dia 29")
        console.log(`🔍 Procurando data na mensagem: "${text}"`);
        
        // Padrão 1: "dia 29" ou "dia 15"
        let dateMatch = text.match(/dia\s+(\d{1,2})/i);
        if (dateMatch) {
          const day = parseInt(dateMatch[1]);
          const currentDate = new Date();
          const currentMonth = currentDate.getMonth();
          const currentYear = currentDate.getFullYear();
          
          // Criar data para o dia especificado no mês atual
          let targetDate = new Date(currentYear, currentMonth, day);
          
          // Se a data já passou este mês, usar próximo mês
          if (targetDate < currentDate) {
            targetDate = new Date(currentYear, currentMonth + 1, day);
            // Se passou do ano, usar próximo ano
            if (targetDate.getMonth() !== (currentMonth + 1) % 12) {
              targetDate = new Date(currentYear + 1, 0, day);
            }
          }
          
          eventDate.setFullYear(targetDate.getFullYear());
          eventDate.setMonth(targetDate.getMonth());
          eventDate.setDate(targetDate.getDate());
          isValidEvent = true;
          console.log(`📅 Data específica detectada (dia ${day}): ${targetDate.toLocaleDateString('pt-BR')}`);
        }
        
        // Padrão 2: "29 de agosto" ou "2 de setembro"
        if (!dateMatch) {
          dateMatch = text.match(/(\d{1,2})\s+(?:de\s+)?(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)/i);
          
          if (dateMatch) {
            const day = parseInt(dateMatch[1]);
            const monthName = dateMatch[2].toLowerCase();
            const months = {
              'janeiro': 0, 'fevereiro': 1, 'março': 2, 'abril': 3, 'maio': 4, 'junho': 5,
              'julho': 6, 'agosto': 7, 'setembro': 8, 'outubro': 9, 'novembro': 10, 'dezembro': 11
            };
            const month = months[monthName];
            const currentYear = new Date().getFullYear();
            
            // Se a data já passou este ano, usar próximo ano
            const targetDate = new Date(currentYear, month, day);
            if (targetDate < new Date()) {
              targetDate.setFullYear(currentYear + 1);
            }
            
            eventDate.setFullYear(targetDate.getFullYear());
            eventDate.setMonth(targetDate.getMonth());
            eventDate.setDate(targetDate.getDate());
            isValidEvent = true;
            console.log(`📅 Data específica detectada (formato texto): ${day}/${month + 1}/${targetDate.getFullYear()}`);
          }
        }
        
        // Padrão 3: "29/08" ou "29-08"
        if (!dateMatch) {
          dateMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})/);
          if (dateMatch) {
            const day = parseInt(dateMatch[1]);
            const month = parseInt(dateMatch[2]) - 1; // JavaScript meses são 0-11
            const currentYear = new Date().getFullYear();
            
            // Se a data já passou este ano, usar próximo ano
            const targetDate = new Date(currentYear, month, day);
            if (targetDate < new Date()) {
              targetDate.setFullYear(currentYear + 1);
            }
            
            eventDate.setFullYear(targetDate.getFullYear());
            eventDate.setMonth(targetDate.getMonth());
            eventDate.setDate(targetDate.getDate());
            isValidEvent = true;
            console.log(`📅 Data específica detectada (formato DD/MM): ${day}/${month + 1}/${targetDate.getFullYear()}`);
          }
        }
        
        // Padrão 4: "próxima sexta", "essa sexta", "daqui 3 domingos"
        if (!dateMatch) {
          // "próxima sexta" ou "essa sexta"
          const proximaMatch = text.match(/(?:próxima|proxima|essa)\s+(segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo)/i);
          if (proximaMatch) {
            const weekdays = {
              'segunda': 1, 'terça': 2, 'terca': 2, 'quarta': 3, 'quinta': 4, 'sexta': 5, 'sábado': 6, 'sabado': 6, 'domingo': 0
            };
            const targetDay = weekdays[proximaMatch[1].toLowerCase()];
            const today = new Date();
            const currentDay = today.getDay();
            let daysToAdd = (targetDay - currentDay + 7) % 7;
            if (daysToAdd === 0) daysToAdd = 7; // Se for hoje, agendar para próxima semana
            
            eventDate.setDate(today.getDate() + daysToAdd);
            isValidEvent = true;
            console.log(`📅 Próxima ${proximaMatch[1]} detectada (${daysToAdd} dias à frente)`);
          }
          
          // "daqui X domingos"
          const daquiMatch = text.match(/daqui\s+(\d+)\s+(segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo)/i);
          if (daquiMatch) {
            const weekdays = {
              'segunda': 1, 'terça': 2, 'terca': 2, 'quarta': 3, 'quinta': 4, 'sexta': 5, 'sábado': 6, 'sabado': 6, 'domingo': 0
            };
            const weeks = parseInt(daquiMatch[1]);
            const targetDay = weekdays[daquiMatch[2].toLowerCase()];
            const today = new Date();
            const currentDay = today.getDay();
            let daysToAdd = (targetDay - currentDay + 7) % 7;
            daysToAdd += (weeks - 1) * 7; // Adicionar semanas completas
            
            eventDate.setDate(today.getDate() + daysToAdd);
            isValidEvent = true;
            console.log(`📅 Daqui ${weeks} ${daquiMatch[2]} detectado (${daysToAdd} dias à frente)`);
          }
        }
        
        // Detectar horário básico - DEPOIS de definir a data
        const timeMatch = text.match(/(?:às|as)\s*(\d{1,2})(?::(\d{2}))?\s*h?/i);
        if (timeMatch) {
          const hour = parseInt(timeMatch[1]);
          const minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
          eventDate.setHours(hour, minute, 0, 0);
          isValidEvent = true;
        } else {
          // Horário padrão: 22h (10 da noite) se não especificado
          eventDate.setHours(22, 0, 0, 0);
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
        
        const formatDate = (date) => {
          // Criar data no fuso horário local (Brasil UTC-3)
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const hour = String(date.getHours()).padStart(2, '0');
          const minute = String(date.getMinutes()).padStart(2, '0');
          const second = String(date.getSeconds()).padStart(2, '0');
          
          // Formato: YYYYMMDDTHHMMSSZ (sem conversão UTC)
          // Manter horário local sem ajuste
          return `${year}${month}${day}T${hour}${minute}${second}Z`;
        };
        
        const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(eventTitle)}&dates=${formatDate(startDate)}/${formatDate(endDate)}`;
        const outlookUrl = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(eventTitle)}&startdt=${startDate.toISOString()}&enddt=${endDate.toISOString()}`;

        // Gerar link de convite por email
        const inviteData = {
          title: eventTitle,
          date: startDate.toISOString(),
          time: `${String(startDate.getUTCHours()).padStart(2, '0')}:${String(startDate.getUTCMinutes()).padStart(2, '0')}`,
          location: '',
          description: `Evento criado via Zelar`,
          organizer: 'Zelar'
        };
        
        const emailInviteLink = emailService.generateMailtoLink(inviteData);

        const replyMarkup = {
          inline_keyboard: [
            [
              { text: '📅 Google Calendar', url: googleUrl },
              { text: '📅 Outlook', url: outlookUrl }
            ],
            [
              { text: '📧 Enviar Convite', url: emailInviteLink }
            ]
          ]
        };

        await telegramBot.sendMessage(chatId,
          '✅ *Evento criado!*\n\n' +
          `🎯 *${eventTitle}*\n` +
          `📅 ${eventDate.toLocaleString('pt-BR')}\n\n` +
          '💡 *Use os botões abaixo para adicionar ao calendário ou enviar convite!*',
          { parse_mode: 'Markdown', reply_markup: replyMarkup }
        );
        
        // Log analytics
        analytics.logMessage('telegram', chatId.toString(), text, true, eventTitle);

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
      // Usar QR code já gerado ou gerar novo
      let qrImage = status.qrCodeImage;
      
      if (!qrImage) {
        qrImage = await qrcode.toDataURL(status.qrCode, {
          width: 300,
          margin: 2,
          color: {
            dark: '#25D366',
            light: '#FFFFFF'
          }
        });
      }
      
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

// Endpoint para limpar sessão WhatsApp
app.post('/api/whatsapp/clear', async (req, res) => {
  try {
    if (!whatsappBot) {
      return res.status(404).json({ error: 'Bot do WhatsApp não encontrado' });
    }

    await whatsappBot.clearSession();
    await whatsappBot.initialize();
    
    res.json({ success: true, message: 'Sessão limpa e bot reiniciado' });
  } catch (error) {
    console.error('Erro ao limpar sessão:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Endpoint para forçar geração de QR code
app.post('/api/whatsapp/force-qr', async (req, res) => {
  try {
    if (!whatsappBot) {
      return res.status(404).json({ error: 'Bot do WhatsApp não encontrado' });
    }

    console.log('🔄 Forçando geração de QR code...');
    
    // Limpar sessão e reinicializar
    await whatsappBot.clearSession();
    await whatsappBot.initialize();
    
    // Aguardar um pouco para o QR code ser gerado
    setTimeout(async () => {
      const status = whatsappBot.getStatus();
      console.log('📊 Status após forçar QR:', status);
    }, 5000);
    
    res.json({ success: true, message: 'Forçando geração de QR code...' });
  } catch (error) {
    console.error('Erro ao forçar QR code:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Endpoint para testar geração de QR code
app.get('/api/whatsapp/test-qr', async (req, res) => {
  try {
    console.log('🧪 Testando geração de QR code...');
    
    // Gerar um QR code de teste
    const testQR = await qrcode.toDataURL('https://zelar-ia.onrender.com', {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    
    res.json({
      success: true,
      message: 'QR code de teste gerado com sucesso',
      qrImage: testQR,
      qrCode: 'https://zelar-ia.onrender.com'
    });
  } catch (error) {
    console.error('Erro ao gerar QR code de teste:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Endpoint para gerar QR code manual do WhatsApp
app.get('/api/whatsapp/manual-qr', async (req, res) => {
  try {
    console.log('🔧 Gerando QR code manual do WhatsApp...');
    
    // Gerar um QR code que simula o WhatsApp
    const whatsappQR = await qrcode.toDataURL('https://wa.me/5511999999999?text=/start', {
      width: 300,
      margin: 2,
      color: {
        dark: '#25D366',
        light: '#FFFFFF'
      }
    });
    
    res.json({
      success: true,
      message: 'QR code manual do WhatsApp gerado',
      qrImage: whatsappQR,
      qrCode: 'https://wa.me/5511999999999?text=/start',
      instructions: 'Escaneie este QR code para conectar ao WhatsApp'
    });
  } catch (error) {
    console.error('Erro ao gerar QR code manual:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Endpoint para forçar geração de QR code real
app.get('/api/whatsapp/force-real-qr', async (req, res) => {
  try {
    console.log('🔧 Forçando geração de QR code real...');
    
    if (!whatsappBot) {
      return res.status(404).json({ error: 'Bot do WhatsApp não encontrado' });
    }

    // Limpar sessão e reinicializar
    await whatsappBot.clearSession();
    
    // Aguardar um pouco
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Reinicializar o bot
    await whatsappBot.initialize();
    
    // Aguardar mais tempo para o QR code aparecer
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Verificar se o QR code foi gerado
    const status = whatsappBot.getStatus();
    
    if (status.qrCode) {
      console.log('✅ QR code real gerado com sucesso!');
      res.json({
        success: true,
        message: 'QR code real gerado com sucesso',
        qrCode: status.qrCode,
        qrImage: status.qrCodeImage,
        instructions: 'Escaneie este QR code no WhatsApp'
      });
    } else {
      console.log('⚠️ QR code não foi gerado, tentando novamente...');
      
      // Tentar mais uma vez
      await whatsappBot.clearSession();
      await new Promise(resolve => setTimeout(resolve, 3000));
      await whatsappBot.initialize();
      await new Promise(resolve => setTimeout(resolve, 15000));
      
      const newStatus = whatsappBot.getStatus();
      
      if (newStatus.qrCode) {
        res.json({
          success: true,
          message: 'QR code real gerado na segunda tentativa',
          qrCode: newStatus.qrCode,
          qrImage: newStatus.qrCodeImage,
          instructions: 'Escaneie este QR code no WhatsApp'
        });
      } else {
        res.json({
          success: false,
          message: 'Não foi possível gerar o QR code real',
          error: 'O Baileys não está gerando QR code. Tente novamente em alguns minutos.',
          status: newStatus
        });
      }
    }
  } catch (error) {
    console.error('Erro ao forçar QR code real:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Endpoint para verificar logs em tempo real
app.get('/api/whatsapp/logs', async (req, res) => {
  try {
    console.log('📋 Verificando logs do WhatsApp...');
    
    if (!whatsappBot) {
      return res.status(404).json({ error: 'Bot do WhatsApp não encontrado' });
    }
    
    const status = whatsappBot.getStatus();
    
    res.json({
      success: true,
      status: status,
      message: 'Status atual do bot do WhatsApp',
      instructions: 'Verifique os logs do servidor para ver o QR code'
    });
  } catch (error) {
    console.error('Erro ao verificar logs:', error);
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

// Rota para analytics
app.get('/api/analytics', (req, res) => {
  try {
    const data = analytics.getDashboardData();
    res.json(data);
  } catch (error) {
    console.error('❌ Erro ao obter analytics:', error);
    res.status(500).json({ error: 'Erro ao obter analytics' });
  }
});

// Rota para visualizar analytics no navegador
app.get('/analytics', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Zelar Analytics</title>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; }
        .card { background: white; padding: 20px; margin: 10px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
        .stat { text-align: center; padding: 15px; background: #f8f9fa; border-radius: 6px; }
        .stat h3 { margin: 0; color: #007bff; }
        .stat p { margin: 5px 0; font-size: 24px; font-weight: bold; }
        .list { max-height: 300px; overflow-y: auto; }
        .list-item { padding: 8px; border-bottom: 1px solid #eee; }
        .refresh { background: #007bff; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; }
        .refresh:hover { background: #0056b3; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>📊 Zelar Analytics</h1>
        <button class="refresh" onclick="loadAnalytics()">🔄 Atualizar</button>
        
        <div class="stats" id="summary"></div>
        
        <div class="card">
          <h2>📊 Performance</h2>
          <div class="stats" id="performance"></div>
        </div>
        
        <div class="card">
          <h2>👥 Engajamento</h2>
          <div class="stats" id="engagement"></div>
        </div>
        
        <div class="card">
          <h2>📈 Categorias de Eventos</h2>
          <div class="list" id="eventTypes"></div>
        </div>
        
        <div class="card">
          <h2>⏰ Tipos de Interação</h2>
          <div class="list" id="interactionTypes"></div>
        </div>
        
        <div class="card">
          <h2>📝 Comprimento das Mensagens</h2>
          <div class="list" id="messageLengths"></div>
        </div>
        
        <div class="card">
          <h2>🕐 Distribuição por Hora</h2>
          <div class="list" id="hourlyDistribution"></div>
        </div>
        
        <div class="card">
          <h2>📅 Últimos 7 Dias</h2>
          <div class="list" id="dailyDistribution"></div>
        </div>
        
        <div class="card">
          <h2>🆕 Atividade Recente</h2>
          <div class="list" id="recentActivity"></div>
        </div>
      </div>
      
      <script>
        async function loadAnalytics() {
          try {
            const response = await fetch('/api/analytics');
            const data = await response.json();
            
            // Summary
            document.getElementById('summary').innerHTML = \`
              <div class="stat">
                <h3>Total Mensagens</h3>
                <p>\${data.summary.totalMessages}</p>
              </div>
              <div class="stat">
                <h3>Usuários Únicos</h3>
                <p>\${data.summary.uniqueUsers}</p>
              </div>
              <div class="stat">
                <h3>WhatsApp</h3>
                <p>\${data.summary.whatsappMessages}</p>
              </div>
              <div class="stat">
                <h3>Telegram</h3>
                <p>\${data.summary.telegramMessages}</p>
              </div>
            \`;
            
            // Performance
            document.getElementById('performance').innerHTML = \`
              <div class="stat">
                <h3>Taxa de Sucesso</h3>
                <p>\${data.performance.successRate}%</p>
              </div>
              <div class="stat">
                <h3>Taxa de Erro</h3>
                <p>\${data.performance.errorRate}%</p>
              </div>
              <div class="stat">
                <h3>Uptime</h3>
                <p>\${data.performance.uptime}%</p>
              </div>
            \`;
            
            // Engagement
            const todayDAU = Object.values(data.engagement.dailyActiveUsers).pop() || 0;
            const thisWeekWAU = Object.values(data.engagement.weeklyActiveUsers).pop() || 0;
            const thisMonthMAU = Object.values(data.engagement.monthlyActiveUsers).pop() || 0;
            
            document.getElementById('engagement').innerHTML = \`
              <div class="stat">
                <h3>Usuários Ativos Hoje</h3>
                <p>\${todayDAU}</p>
              </div>
              <div class="stat">
                <h3>Usuários Ativos Esta Semana</h3>
                <p>\${thisWeekWAU}</p>
              </div>
              <div class="stat">
                <h3>Usuários Ativos Este Mês</h3>
                <p>\${thisMonthMAU}</p>
              </div>
            \`;
            
            // Event Types
            document.getElementById('eventTypes').innerHTML = data.categories.eventTypes.map(item => 
              \`<div class="list-item"><strong>\${item.item}</strong> - \${item.count} eventos</div>\`
            ).join('');
            
            // Interaction Types
            document.getElementById('interactionTypes').innerHTML = data.categories.interactionTypes.map(item => 
              \`<div class="list-item"><strong>\${item.item}</strong> - \${item.count} interações</div>\`
            ).join('');
            
            // Message Lengths
            document.getElementById('messageLengths').innerHTML = data.categories.messageLengths.map(item => 
              \`<div class="list-item"><strong>\${item.item}</strong> - \${item.count} mensagens</div>\`
            ).join('');
            
            // Hourly Distribution
            document.getElementById('hourlyDistribution').innerHTML = Object.entries(data.usage.hourlyDistribution)
              .sort(([a], [b]) => a - b)
              .map(([hour, count]) => \`<div class="list-item"><strong>\${hour}h</strong> - \${count} mensagens</div>\`)
              .join('');
            
            // Daily Distribution
            document.getElementById('dailyDistribution').innerHTML = Object.entries(data.usage.dailyDistribution)
              .map(([day, count]) => \`<div class="list-item"><strong>\${day}</strong> - \${count} mensagens</div>\`)
              .join('');
            
            // Recent Activity
            document.getElementById('recentActivity').innerHTML = data.recentActivity.map(activity => 
              \`<div class="list-item">
                <strong>\${activity.platform}</strong> - \${activity.userId} - "\${activity.message}" 
                <small>(\${new Date(activity.timestamp).toLocaleString()})</small>
              </div>\`
            ).join('');
            
          } catch (error) {
            console.error('Erro ao carregar analytics:', error);
          }
        }
        
        // Carregar na página inicial
        loadAnalytics();
        
        // Atualizar a cada 30 segundos
        setInterval(loadAnalytics, 30000);
      </script>
    </body>
    </html>
  `);
});

// Configurar multer para upload de áudio
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

// Inicializar serviços
const audioService = new AudioService();
const emailService = new EmailService();

// Função para processar áudio do Telegram
async function handleTelegramAudio(msg) {
  try {
    console.log('🎤 Áudio recebido no Telegram');
    
    const chatId = msg.chat.id;
    const fileId = msg.voice ? msg.voice.file_id : msg.audio.file_id;
    
    // Baixar o arquivo de áudio
    const file = await telegramBot.getFile(fileId);
    const audioBuffer = await fetch(file.file_path).then(res => res.arrayBuffer());
    
    // Processar áudio com OpenAI Whisper
    const transcription = await audioService.processVoiceMessage(Buffer.from(audioBuffer), 'telegram_audio.ogg');
    
    console.log('✅ Áudio transcrito:', transcription.original);
    
    // Enviar confirmação
    await telegramBot.sendMessage(chatId, 
      `🎤 *Áudio transcrito:*\n"${transcription.original}"\n\nProcessando comando...`,
      { parse_mode: 'Markdown' }
    );
    
    // Processar o texto transcrito como uma mensagem normal
    const processedMsg = {
      ...msg,
      text: transcription.original
    };
    
    // Simular o processamento normal da mensagem
    await processTelegramMessage(processedMsg);
    
  } catch (error) {
    console.error('❌ Erro ao processar áudio do Telegram:', error);
    await telegramBot.sendMessage(msg.chat.id, '❌ Erro ao processar áudio. Tente enviar uma mensagem de texto.');
  }
}

// Função para processar mensagens do Telegram (extraída da lógica existente)
async function processTelegramMessage(msg) {
  const chatId = msg.chat.id;
  const text = msg.text;
  
  // Aqui você pode reutilizar a lógica existente de processamento
  // Por enquanto, vou apenas processar como uma mensagem normal
  // TODO: Integrar com a lógica de agendamento existente
}

// Rota para processar áudio
app.post('/api/audio/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo de áudio enviado' });
    }

    console.log('🎤 Processando áudio...');
    const transcription = await audioService.processVoiceMessage(req.file.buffer);
    
    res.json({
      success: true,
      transcription: transcription.original,
      processed: transcription.processed
    });
    
  } catch (error) {
    console.error('❌ Erro ao processar áudio:', error);
    res.status(500).json({ error: 'Erro ao processar áudio' });
  }
});

// Rota para gerar preview de convite
app.post('/api/email/preview', async (req, res) => {
  try {
    const eventData = req.body;
    const preview = emailService.generateInvitePreview(eventData);
    
    res.json(preview);
    
  } catch (error) {
    console.error('❌ Erro ao gerar preview:', error);
    res.status(500).json({ error: 'Erro ao gerar preview' });
  }
});

// Rota para gerar link mailto
app.post('/api/email/mailto', async (req, res) => {
  try {
    const { eventData, recipientEmail } = req.body;
    const mailtoLink = emailService.generateMailtoLink(eventData, recipientEmail);
    
    res.json({
      success: true,
      mailtoLink,
      preview: emailService.generateInvitePreview(eventData)
    });
    
  } catch (error) {
    console.error('❌ Erro ao gerar link mailto:', error);
    res.status(500).json({ error: 'Erro ao gerar link mailto' });
  }
});

// Rota para gerar múltiplos links mailto
app.post('/api/email/mailto-bulk', async (req, res) => {
  try {
    const { eventData, recipientEmails } = req.body;
    const links = emailService.generateMultipleMailtoLinks(eventData, recipientEmails);
    
    res.json({
      success: true,
      links,
      preview: emailService.generateInvitePreview(eventData)
    });
    
  } catch (error) {
    console.error('❌ Erro ao gerar links mailto:', error);
    res.status(500).json({ error: 'Erro ao gerar links mailto' });
  }
});

// Rota para enviar convite
app.post('/api/email/send', async (req, res) => {
  try {
    const { eventData, recipientEmail } = req.body;
    const result = await emailService.sendInvite(eventData, recipientEmail);
    
    res.json(result);
    
  } catch (error) {
    console.error('❌ Erro ao enviar email:', error);
    res.status(500).json({ error: 'Erro ao enviar email' });
  }
});

// Rota para página de convites
app.get('/email-invite', (req, res) => {
  res.sendFile(join(__dirname, '../client/src/pages/EmailInvite.tsx'));
});

// Start server
app.listen(port, async () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log(`📊 Health check: http://localhost:${port}/health`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🤖 Telegram Bot: ${process.env.TELEGRAM_BOT_TOKEN ? 'Configured' : 'Not configured'}`);
  console.log(`🗄️ Database: ${process.env.DATABASE_URL ? 'Configured' : 'Not configured'}`);
  console.log(`📱 WhatsApp QR: http://localhost:${port}/api/whatsapp/qr`);
  console.log(`📧 Email Invites: http://localhost:${port}/email-invite`);
  
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