import express from 'express';
import qrcode from 'qrcode';
import TelegramBot from 'node-telegram-bot-api';
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

  setupEventHandlers() {
    console.log('🔧 Configurando event handlers do WhatsApp...');
    
    this.client.on('qr', async (qr) => {
      console.log('🔗 QR Code recebido!');
      this.status.qrCode = qr;
      this.status.isConnected = false;
      this.status.isReady = true;
      
      // Gerar QR code visual no terminal
      try {
        const qrImage = await qrcode.toString(qr, { type: 'terminal', width: 40 });
        console.log('\n📱 ESCANEIE O QR CODE ABAIXO NO SEU WHATSAPP:\n');
        console.log(qrImage);
        console.log('\n🔗 Ou acesse: http://localhost:' + (process.env.PORT || 8080) + '/api/whatsapp/qr');
        console.log('\n📋 Como conectar:');
        console.log('1. Abra o WhatsApp no seu celular');
        console.log('2. Toque em Menu (3 pontos) → Dispositivos conectados');
        console.log('3. Toque em Conectar dispositivo');
        console.log('4. Aponte a câmera para o QR code acima\n');
      } catch (error) {
        console.log('❌ Erro ao gerar QR code visual:', error);
      }
    });

    this.client.on('ready', () => {
      console.log('✅ WhatsApp Bot está pronto!');
      this.status.isConnected = true;
      this.status.isReady = true;
      this.status.qrCode = null;
    });

    this.client.on('authenticated', () => {
      console.log('🔐 WhatsApp autenticado!');
    });

    this.client.on('auth_failure', (msg) => {
      console.error('❌ Falha na autenticação WhatsApp:', msg);
    });

    this.client.on('disconnected', (reason) => {
      console.log('🔌 WhatsApp desconectado:', reason);
      this.status.isConnected = false;
      this.status.isReady = false;
    });

    this.client.on('error', (error) => {
      console.error('❌ Erro no WhatsApp:', error);
      this.status.isConnected = false;
      this.status.isReady = false;
    });

    this.client.on('message', async (message) => {
      await this.handleMessage(message);
    });
  }

  async handleMessage(message) {
    try {
      if (message.isStatus || message.from.includes('@g.us') || message.fromMe) {
        return;
      }

      const text = message.body.trim();
      console.log(`📩 Mensagem recebida de ${message.from}: ${text}`);

      // Comando /start
      if (text === '/start' || text.toLowerCase().includes('olá, gostaria de usar o zelar')) {
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
    
    // Extrair título
    let title = 'Evento';
    if (lowerText.includes('jantar')) title = 'Jantar';
    else if (lowerText.includes('almoço') || lowerText.includes('almoco')) title = 'Almoço';
    else if (lowerText.includes('reunião') || lowerText.includes('reuniao')) title = 'Reunião';
    else if (lowerText.includes('consulta')) title = 'Consulta';
    else if (lowerText.includes('academia')) title = 'Academia';
    else if (lowerText.includes('trabalho')) title = 'Trabalho';
    
    // Detectar "com" para adicionar pessoa
    const comMatch = text.match(/(.+?)\s+com\s+(.+)/i);
    if (comMatch) {
      title = `${comMatch[1].trim()} com ${comMatch[2].trim()}`;
    }
    
    // Detectar horário
    const timeMatch = text.match(/(?:às|as|a)\s*(\d{1,2})(?::(\d{2}))?\s*h?/i);
    if (!timeMatch) return null;
    
    const hour = parseInt(timeMatch[1]);
    const minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
    
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
    
    if (!isValidEvent) return null;
    
    // Configurar horário
    eventDate.setHours(hour, minute, 0, 0);
    
    // Gerar links
    const startDate = new Date(eventDate);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
    
    const formatDate = (date) => date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    
    const googleLink = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${formatDate(startDate)}/${formatDate(endDate)}`;
    const outlookLink = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(title)}&startdt=${startDate.toISOString()}&enddt=${endDate.toISOString()}`;
    
    const dateTime = startDate.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit'
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
      await this.client.sendMessage(to, message);
      return true;
    } catch (error) {
      console.error('❌ Erro ao enviar mensagem:', error);
      return false;
    }
  }

  async initialize() {
    try {
      console.log('🚀 Inicializando WhatsApp Bot...');
      
      // Limpar sessão anterior se houver problemas
      console.log('🧹 Verificando sessão anterior...');
      
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
      const authResult = await useMultiFileAuthState('whatsapp_session');
      const { state, saveCreds } = authResult;
      console.log('✅ Estado carregado!');
      
      console.log('🔗 Criando conexão Baileys...');
      this.sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 25000,
        retryRequestDelayMs: 2000,
        maxRetries: 3,
        shouldIgnoreJid: jid => jid.includes('@broadcast'),
        patchMessageBeforeSending: (msg) => {
          const requiresPatch = !!(
            msg.buttonsMessage ||
            msg.templateMessage ||
            msg.listMessage
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

      // Listener para mensagens recebidas
      this.sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        
        if (!msg.key.fromMe && msg.message) {
          console.log('📨 Mensagem recebida:', msg.message);
          
          const chatId = msg.key.remoteJid;
          const messageText = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
          
          if (messageText) {
            console.log(`💬 De: ${chatId}`);
            console.log(`📝 Mensagem: ${messageText}`);
            
            // Processar comando de agendamento
            const response = await this.processSchedulingCommand(messageText, chatId);
            
            try {
              await this.sock.sendMessage(chatId, { text: response });
              console.log('✅ Resposta enviada!');
            } catch (error) {
              console.error('❌ Erro ao enviar resposta:', error);
            }
          }
        }
      });

      this.sock.ev.on('creds.update', saveCreds);
      
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

  async clearSession() {
    try {
      console.log('🧹 Limpando sessão WhatsApp...');
      const fs = await import('fs');
      const path = await import('path');
      
      // Limpar diretório de sessão
      const sessionDir = 'whatsapp_session';
      if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true });
        console.log('✅ Diretório de sessão limpo!');
      }
      
      // Limpar outros arquivos de sessão
      const filesToDelete = [
        'session-zelar-whatsapp-bot',
        'whatsapp_session',
        '.wwebjs_auth',
        '.wwebjs_cache'
      ];
      
      for (const file of filesToDelete) {
        if (fs.existsSync(file)) {
          fs.rmSync(file, { recursive: true, force: true });
          console.log(`✅ ${file} removido!`);
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
      
      // Fechar conexão se existir
      if (this.sock) {
        try {
          await this.sock.logout();
          console.log('✅ Conexão fechada!');
        } catch (error) {
          console.log('⚠️ Erro ao fechar conexão:', error.message);
        }
        this.sock = null;
      }
      
      console.log('✅ Sessão completamente limpa!');
    } catch (error) {
      console.error('❌ Erro ao limpar sessão:', error);
    }
  }

  async sendMessage(to, message) {
    try {
      if (!this.sock || !this.status.isConnected) {
        console.log('❌ WhatsApp não está conectado');
        return false;
      }

      console.log(`📤 Enviando mensagem para ${to}: ${message}`);
      
      // Formatar número
      const formattedNumber = to.includes('@s.whatsapp.net') ? to : `${to}@s.whatsapp.net`;
      
      // Enviar mensagem
      await this.sock.sendMessage(formattedNumber, { text: message });
      
      console.log('✅ Mensagem enviada com sucesso!');
      return true;
    } catch (error) {
      console.error('❌ Erro ao enviar mensagem:', error);
      return false;
    }
  }

  async processSchedulingCommand(message, chatId) {
    try {
      console.log(`🤖 Processando comando WhatsApp: ${message}`);
      console.log(`🔍 Chat ID: ${chatId}`);
      console.log(`📝 Mensagem original: "${message}"`);
      
      // Comandos básicos
      if (message === '/start') {
        return '🤖 *Zelar - Assistente de Agendamento*\n\n' +
               '💡 *Como usar:*\n' +
               '• "jantar hoje às 19h"\n' +
               '• "reunião amanhã às 15h"\n' +
               '• "consulta sexta às 10h"\n\n' +
               '🌍 *Fuso horário:* Brasil (UTC-3)\n' +
               'Use /timezone para alterar\n\n' +
               '📝 *Comandos:*\n' +
               '/timezone - Alterar fuso horário\n' +
               '/help - Ajuda completa\n\n' +
               'Envie qualquer mensagem com data e horário!';
      }

      if (message === '/help') {
        return '🤖 *Assistente Zelar - Ajuda*\n\n' +
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
               '✨ Processamento com IA Claude!';
      }

      if (message === '/timezone') {
        return '🌍 *Selecione seu fuso horário:*\n\n' +
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
               '🇳🇿 Nova Zelândia: UTC+12';
      }

      if (message.startsWith('/')) return '';

      // Processamento igual ao Telegram
      const lowerText = message.toLowerCase();
      
      // Detectar padrões básicos
      let eventTitle = 'Evento';
      let eventDate = new Date();
      let isValidEvent = false;
      
      // Detectar "com" para adicionar pessoa - MELHORADO
      const comMatch = message.match(/(.+?)\s+com\s+([^0-9\s]+(?:\s+[^0-9\s]+)*)/i);
      console.log(`🔍 ComMatch encontrado:`, comMatch);
      
      // Extrair título básico - MELHORADO
      let baseTitle = 'Evento';
      if (lowerText.includes('jantar')) baseTitle = 'Jantar';
      else if (lowerText.includes('almoço') || lowerText.includes('almoco')) baseTitle = 'Almoço';
      else if (lowerText.includes('reunião') || lowerText.includes('reuniao')) baseTitle = 'Reunião';
      else if (lowerText.includes('consulta')) baseTitle = 'Consulta';
      else if (lowerText.includes('academia')) baseTitle = 'Academia';
      else if (lowerText.includes('trabalho')) baseTitle = 'Trabalho';
      
      console.log(`🎯 Título base: ${baseTitle}`);
      
      // Se não encontrou "com", usar o título básico
      if (!comMatch) {
        eventTitle = baseTitle;
        console.log(`📝 Título final (sem "com"): ${eventTitle}`);
      }
      if (comMatch) {
        const beforeCom = comMatch[1].trim();
        const afterCom = comMatch[2].trim();
        
        console.log(`🔍 Antes do "com": "${beforeCom}"`);
        console.log(`🔍 Depois do "com": "${afterCom}"`);
        
        // Extrair apenas a palavra principal antes do "com"
        const mainWord = beforeCom.split(' ').pop(); // Pega a última palavra
        eventTitle = `${mainWord} com ${afterCom}`;
        
        console.log(`📝 Palavra principal: "${mainWord}"`);
        console.log(`📝 Título final (com "com"): ${eventTitle}`);
      }
      
      // Detectar horário básico
      const timeMatch = message.match(/(?:às|as|a)\s*(\d{1,2})(?::(\d{2}))?\s*h?/i);
      console.log(`🕐 TimeMatch encontrado:`, timeMatch);
      if (timeMatch) {
        const hour = parseInt(timeMatch[1]);
        const minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
        eventDate.setHours(hour, minute, 0, 0);
        isValidEvent = true;
        console.log(`🕐 Horário definido: ${hour}:${minute}`);
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
      
      console.log(`✅ Evento válido: ${isValidEvent}`);
      console.log(`📅 Data final: ${eventDate.toLocaleString('pt-BR')}`);
      
      if (!isValidEvent) {
        console.log(`❌ Evento inválido - retornando erro`);
        return '❌ *Não consegui entender a data/hora*\n\n' +
               '💡 *Tente algo como:*\n' +
               '• "jantar hoje às 19h"\n' +
               '• "reunião quarta às 15h"';
      }
      
      // Gerar links do calendário
      const startDate = new Date(eventDate);
      const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
      
      const formatDate = (date) => date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      
      const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(eventTitle)}&dates=${formatDate(startDate)}/${formatDate(endDate)}`;
      const outlookUrl = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(eventTitle)}&startdt=${startDate.toISOString()}&enddt=${endDate.toISOString()}`;

      const displayDate = startDate.toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit'
      });

      const finalResponse = '✅ *Evento criado!*\n\n' +
             `🎯 *${eventTitle}*\n` +
             `📅 ${displayDate}\n\n` +
             '📅 *Links do Calendário:*\n' +
             `• Google Calendar: ${googleUrl}\n` +
             `• Outlook: ${outlookUrl}`;
      
      console.log(`🎉 Resposta final gerada com sucesso!`);
      console.log(`📝 Título do evento: ${eventTitle}`);
      console.log(`📅 Data de exibição: ${displayDate}`);
      
      return finalResponse;

    } catch (error) {
      console.error('❌ Erro ao processar WhatsApp:', error);
      console.error('❌ Stack trace:', error.stack);
      console.error('❌ Mensagem que causou erro:', message);
      return '❌ Erro interno. Tente novamente.';
    }
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