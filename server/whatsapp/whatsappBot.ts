/**
 * WhatsApp Bot usando Baileys
 * Implementação robusta seguindo documentação oficial
 */
import { makeWASocket, DisconnectReason, useMultiFileAuthState, WASocket, proto } from '@whiskeysockets/baileys';
import { parseEventWithClaude } from '../utils/claudeParser';
import { generateCalendarLinks } from '../utils/calendarUtils';
import { parseUserDateTime, extractEventTitle } from '../telegram/utils/parseDate';
import qrcode from 'qrcode';
import fs from 'fs';
import path from 'path';

interface WhatsAppBotStatus {
  isReady: boolean;
  isConnected: boolean;
  qrCode?: string;
  qrCodeImage?: string;
  clientInfo?: any;
}

export class WhatsAppBot {
  private sock: WASocket | null = null;
  private status: WhatsAppBotStatus = {
    isReady: false,
    isConnected: false
  };
  private qrCodeCallbacks: Set<(qr: string) => void> = new Set();
  private statusCallbacks: Set<(status: WhatsAppBotStatus) => void> = new Set();

  constructor() {
    // Baileys não precisa de inicialização no construtor
    console.log('🔧 WhatsApp Bot criado (Baileys)');
  }

  private async setupEventHandlers(sock: WASocket, saveCreds: () => Promise<void>): Promise<void> {
    console.log('🔧 Configurando event handlers do WhatsApp...');
    
    // Listener de conexão
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        console.log('🔗 QR Code recebido!');
        this.status.qrCode = qr;
        this.status.isConnected = false;
        this.status.isReady = true;
        
        try {
          const qrCodeString = await qrcode.toString(qr, { type: 'terminal', small: true });
          console.log('\n� ESCANEIE O QR CODE ABAIXO NO SEU WHATSAPP:\n');
          console.log(qrCodeString);
          console.log('\n📋 Como conectar:');
          console.log('1. Abra o WhatsApp no seu celular');
          console.log('2. Toque em Menu (3 pontos) → Dispositivos conectados');
          console.log('3. Toque em Conectar dispositivo');
          console.log('4. Aponte a câmera para o QR code acima\n');
        } catch (error) {
          console.error('❌ Erro ao gerar QR code visual:', error);
        }
        
        this.qrCodeCallbacks.forEach(callback => callback(qr));
        this.notifyStatusChange();
      }
      
      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect?.error as any)?.output?.statusCode !== DisconnectReason.loggedOut;
        console.log('❌ Conexão fechada, reconectando:', shouldReconnect);
        
        if (shouldReconnect) {
          setTimeout(() => this.initialize(), 3000);
        } else {
          this.status.isConnected = false;
          this.status.isReady = false;
          this.notifyStatusChange();
        }
      } else if (connection === 'open') {
        console.log('✅ WhatsApp Bot está pronto!');
        this.status.isConnected = true;
        this.status.isReady = true;
        this.status.qrCode = undefined;
        this.notifyStatusChange();
      }
    });

    // Listener de credenciais
    sock.ev.on('creds.update', saveCreds);
    
    // Listener para mensagens recebidas
    sock.ev.on('messages.upsert', async (m) => {
      const msg = m.messages[0];
      if (!msg.message || msg.key.fromMe) return;
      
      await this.handleMessage(msg);
    });
    
    console.log('✅ Event handlers configurados com sucesso!');
  }

  private async handleMessage(msg: proto.IWebMessageInfo): Promise<void> {
    try {
      // Extrair informações da mensagem
      const from = msg.key.remoteJid;
      if (!from) return;

      // Ignorar grupos
      if (from.includes('@g.us')) return;

      // Extrair texto da mensagem
      const text = msg.message?.conversation || 
                   msg.message?.extendedTextMessage?.text || '';
      
      if (!text) return;

      console.log(`📩 Mensagem recebida de ${from}: ${text}`);

      // Comando /start ou mensagem de boas-vindas
      if (text === '/start' || text.toLowerCase().includes('olá, gostaria de usar o zelar para agendar meus compromissos')) {
        const response =
          '🤖 *Zelar - Assistente de Agendamento*\n\n' +
          'Bem-vindo! Eu posso te ajudar a criar eventos e lembretes de forma natural.\n\n' +
          '💡 *Como usar:*\n' +
          '• "jantar hoje às 19h"\n' +
          '• "reunião amanhã às 15h"\n' +
          '• "consulta sexta às 10h"\n' +
          '• "almoço com equipe sexta 12h"\n' +
          '• "marque entrega da semana sexta às 15"\n\n' +
          '⚙️ *Comandos disponíveis:*\n' +
          '/start - Mensagem de boas-vindas\n' +
          '/help - Ver exemplos e instruções\n' +
          '/fuso - Alterar fuso horário (ex: /fuso America/Sao_Paulo)\n\n' +
          'Envie qualquer mensagem com data e horário para criar um evento!';
        await this.sendMessage(from, response);
        return;
      }

      // Comando /fuso
      if (text.startsWith('/fuso')) {
        const timezone = text.replace('/fuso', '').trim();
        if (!timezone) {
          await this.sendMessage(
            from,
            '🌍 *Configuração de Fuso Horário*\n\n' +
              '💡 Para alterar, envie: /fuso America/Sao_Paulo\n' +
              'Exemplo: /fuso America/Sao_Paulo\n' +
              'Fusos comuns: America/Sao_Paulo, America/Buenos_Aires, Europe/Lisbon, America/New_York'
          );
        } else {
          await this.sendMessage(
            from,
            `✅ *Fuso horário atualizado!*\n\n🌍 Novo fuso: ${timezone}\nAgora todos os seus eventos serão criados neste fuso horário.`
          );
        }
        return;
      }

      // Comando /help
      if (text === '/help') {
        const response =
          '🤖 *Assistente Zelar - Ajuda*\n\n' +
          '📅 *Como usar:*\n' +
          'Envie mensagens naturais como:\n' +
          '• "reunião com cliente amanhã às 14h"\n' +
          '• "jantar com família sexta às 19h30"\n' +
          '• "consulta médica terça-feira às 10h"\n' +
          '• "call de projeto quinta às 15h"\n\n' +
          '⚙️ *Comandos:*\n' +
          '/fuso - Alterar fuso horário\n' +
          '/start - Mensagem inicial';
        await this.sendMessage(from, response);
        return;
      }

      // Processar evento
      console.log(`🔍 [DEBUG] Processando mensagem: "${text}"`);
      const userId = from;
      const result = parseUserDateTime(text, userId);
      console.log(`🔍 [DEBUG] Resultado do parser:`, result);
      
      const cleanTitle = extractEventTitle(text);
      console.log(`🟢 [DEBUG] Título limpo: "${cleanTitle}"`);
      
      if (result) {
        let response = `✅ *Evento criado!*\n\n`;
        response += `🎯 *${cleanTitle}*\n`;
        const date = new Date(result.iso);
        const dateTime = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
        response += `📅 ${dateTime}\n\n`;
        response += `*Adicionar ao calendário:*\n`;
        
        const calendarLinks = generateCalendarLinks({ 
          title: cleanTitle, 
          startDate: date, 
          hour: date.getHours(), 
          minute: date.getMinutes() 
        });
        
        response += `🔗 Google Calendar: ${calendarLinks.google}\n\n`;
        response += `🔗 Outlook: ${calendarLinks.outlook}`;
        
        console.log(`🟢 [DEBUG] Resposta enviada`);
        await this.sendMessage(from, response);
      } else {
        const response = `👋 Olá! Sou o assistente Zelar.\n\n` +
          `Para criar um evento, envie uma mensagem como:\n` +
          `• "Reunião amanhã às 14h"\n` +
          `• "Consulta médica sexta às 10h30"\n` +
          `• "Jantar com a família domingo às 19h"\n\n` +
          `Ou envie /help para ver exemplos! 🤖`;
        await this.sendMessage(from, response);
      }
    } catch (error) {
      console.error('❌ Erro ao processar mensagem:', error);
      const from = msg.key.remoteJid;
      if (from) {
        await this.sendMessage(from, '❌ Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente.');
      }
    }
  }

  public async sendMessage(to: string, message: string): Promise<boolean> {
    try {
      if (!this.sock || !this.status.isReady) {
        throw new Error('WhatsApp não está pronto');
      }

      await this.sock.sendMessage(to, { text: message });
      console.log(`📤 Mensagem enviada para ${to}`);
      return true;
    } catch (error) {
      console.error('❌ Erro ao enviar mensagem:', error);
      return false;
    }
  }

  public async initialize(): Promise<void> {
    try {
      console.log('� Inicializando WhatsApp Bot (Baileys)...');
      
      // Carregar estado de autenticação
      console.log('📁 Carregando estado de autenticação...');
      const { state, saveCreds } = await useMultiFileAuthState('whatsapp_session');
      console.log('✅ Estado carregado!');
      
      // Criar conexão Baileys
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
        getMessage: async (key) => {
          return {
            conversation: "placeholder"
          };
        }
      });
      console.log('✅ Conexão criada!');

      // Configurar event handlers
      await this.setupEventHandlers(this.sock, saveCreds);
      
      console.log('✅ WhatsApp Bot inicializado com sucesso!');
    } catch (error) {
      console.error('❌ Erro ao inicializar WhatsApp Bot:', error);
      console.error('❌ Detalhes:', error instanceof Error ? error.message : String(error));
      
      this.status.isReady = false;
      this.status.isConnected = false;
      
      // Tentar reinicializar após 60 segundos
      setTimeout(() => {
        console.log('🔄 Tentando reinicializar WhatsApp Bot...');
        this.initialize();
      }, 60000);
      
      throw error;
    }
  }

  public async destroy(): Promise<void> {
    try {
      console.log('🛑 Desconectando WhatsApp Bot...');
      if (this.sock) {
        this.sock.end(undefined);
        this.sock = null;
      }
      this.status.isReady = false;
      this.status.isConnected = false;
      this.notifyStatusChange();
    } catch (error) {
      console.error('❌ Erro ao desconectar WhatsApp Bot:', error);
    }
  }

  public getStatus(): WhatsAppBotStatus {
    return { ...this.status };
  }

  public onQRCode(callback: (qr: string) => void): void {
    this.qrCodeCallbacks.add(callback);
  }

  public onStatusChange(callback: (status: WhatsAppBotStatus) => void): void {
    this.statusCallbacks.add(callback);
  }

  public removeQRCodeCallback(callback: (qr: string) => void): void {
    this.qrCodeCallbacks.delete(callback);
  }

  public removeStatusCallback(callback: (status: WhatsAppBotStatus) => void): void {
    this.statusCallbacks.delete(callback);
  }

  private notifyStatusChange(): void {
    this.statusCallbacks.forEach(callback => callback(this.getStatus()));
  }
}

// Instância singleton
let whatsappBot: WhatsAppBot | null = null;

export function getWhatsAppBot(): WhatsAppBot {
  if (!whatsappBot) {
    whatsappBot = new WhatsAppBot();
  }
  return whatsappBot;
}

export async function initializeWhatsAppBot(): Promise<WhatsAppBot> {
  const bot = getWhatsAppBot();
  await bot.initialize();
  return bot;
}

export async function destroyWhatsAppBot(): Promise<void> {
  if (whatsappBot) {
    await whatsappBot.destroy();
    whatsappBot = null;
  }
}

// Export direto da instância para compatibilidade
export { getWhatsAppBot as whatsappBot };