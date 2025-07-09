/**
 * WhatsApp Bot usando whatsapp-web.js
 * Implementação robusta seguindo documentação oficial
 */
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
import { parseEventWithClaude } from '../utils/claudeParser';
import { generateCalendarLinks } from '../utils/calendarUtils';
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
  private client: Client;
  private status: WhatsAppBotStatus = {
    isReady: false,
    isConnected: false
  };
  private qrCodeCallbacks: Set<(qr: string) => void> = new Set();
  private statusCallbacks: Set<(status: WhatsAppBotStatus) => void> = new Set();

  constructor() {
    // Inicializar cliente com LocalAuth para persistência
    this.client = new Client({
      authStrategy: new LocalAuth({
        clientId: 'zelar-whatsapp-bot',
        dataPath: './whatsapp_session'
      }),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-extensions',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-features=TranslateUI',
          '--disable-ipc-flooding-protection',
          '--disable-default-apps',
          '--disable-sync',
          '--disable-translate',
          '--hide-scrollbars',
          '--mute-audio',
          '--no-default-browser-check',
          '--no-first-run',
          '--disable-logging',
          '--disable-permissions-api',
          '--disable-features=VizDisplayCompositor',
          '--single-process'
        ]
      }
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // QR Code para autenticação
    this.client.on('qr', async (qr) => {
      console.log('\n🔗 CONECTAR WHATSAPP BOT:');
      console.log('Escaneie o QR code abaixo com seu WhatsApp para conectar o bot:\n');
      qrcode.generate(qr, { small: true });
      console.log('\n📱 Abra o WhatsApp > Menu > Dispositivos conectados > Conectar dispositivo');
      console.log('🔍 Escaneie o QR code acima para ativar o bot WhatsApp\n');
      
      // Salvar QR code atual
      this.status.qrCode = qr;
      this.status.qrCodeImage = await qrcode.toDataURL(qr);
      
      // Notificar callbacks
      this.qrCodeCallbacks.forEach(callback => callback(qr));
      this.notifyStatusChange();
    });

    // Cliente autenticado
    this.client.on('authenticated', () => {
      console.log('✅ WhatsApp autenticado com sucesso');
      this.status.qrCode = undefined;
      this.status.qrCodeImage = undefined;
    });

    // Falha na autenticação
    this.client.on('auth_failure', (msg) => {
      console.error('❌ Falha na autenticação WhatsApp:', msg);
      this.status.isConnected = false;
      this.status.isReady = false;
      this.notifyStatusChange();
    });

    // Cliente pronto
    this.client.on('ready', () => {
      console.log('🚀 WhatsApp Bot está pronto!');
      this.status.isReady = true;
      this.status.isConnected = true;
      this.status.qrCode = undefined;
      this.status.qrCodeImage = undefined;
      
      // Remover arquivo QR code se existir
      const qrPath = path.join(process.cwd(), 'public', 'whatsapp-qr.png');
      if (fs.existsSync(qrPath)) {
        fs.unlinkSync(qrPath);
      }
      
      this.notifyStatusChange();
    });

    // Desconectado
    this.client.on('disconnected', (reason) => {
      console.log('📱 WhatsApp desconectado:', reason);
      this.status.isConnected = false;
      this.status.isReady = false;
      this.notifyStatusChange();
    });

    // Processar mensagens recebidas
    this.client.on('message', async (message) => {
      await this.handleMessage(message);
    });
  }

  private async handleMessage(message: any): Promise<void> {
    try {
      // Ignorar mensagens de status e grupos por enquanto
      if (message.isStatus || message.from.includes('@g.us')) {
        return;
      }

      // Ignorar mensagens próprias
      if (message.fromMe) {
        return;
      }

      console.log(`📩 Mensagem recebida de ${message.from}: ${message.body}`);

      // Processar mensagem com Claude AI
      const parseResult = await parseEventWithClaude(message.body);
      
      if (parseResult.isValid && parseResult.title) {
        // Criar evento
        const eventData = {
          title: parseResult.title,
          startDate: new Date(parseResult.date),
          hour: parseResult.hour,
          minute: parseResult.minute
        };

        // Gerar links de calendário
        const calendarLinks = generateCalendarLinks(eventData);

        // Resposta com evento criado
        let response = `✅ *Evento criado com sucesso!*\n\n`;
        response += `📅 *${eventData.title}*\n`;
        response += `🕐 ${this.formatDateTime(eventData.startDate, eventData.hour, eventData.minute)}\n\n`;
        response += `*Adicionar ao calendário:*\n`;
        response += `🔗 Google Calendar: ${calendarLinks.google}\n`;
        response += `🔗 Outlook: ${calendarLinks.outlook}\n`;
        response += `🔗 Apple Calendar: ${calendarLinks.apple}`;

        await this.sendMessage(message.from, response);
      } else {
        // Resposta para mensagens não reconhecidas como eventos
        const response = `👋 Olá! Sou o assistente Zelar.\n\n` +
          `Para criar um evento, envie uma mensagem como:\n` +
          `• "Reunião amanhã às 14h"\n` +
          `• "Consulta médica sexta às 10h30"\n` +
          `• "Jantar com a família domingo às 19h"\n\n` +
          `Vou processar sua mensagem e criar o evento automaticamente! 🤖`;

        await this.sendMessage(message.from, response);
      }
    } catch (error) {
      console.error('❌ Erro ao processar mensagem:', error);
      await this.sendMessage(message.from, '❌ Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente.');
    }
  }

  private formatDateTime(date: Date, hour: number, minute: number): string {
    const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Aug', 'Set', 'Out', 'Nov', 'Dez'];
    
    const dayName = days[date.getDay()];
    const day = date.getDate();
    const month = months[date.getMonth()];
    const hourStr = hour.toString().padStart(2, '0');
    const minStr = minute.toString().padStart(2, '0');
    
    return `${dayName}, ${day} de ${month} às ${hourStr}:${minStr}`;
  }

  public async sendMessage(to: string, message: string): Promise<boolean> {
    try {
      if (!this.status.isReady) {
        throw new Error('WhatsApp não está pronto');
      }

      await this.client.sendMessage(to, message);
      console.log(`📤 Mensagem enviada para ${to}`);
      return true;
    } catch (error) {
      console.error('❌ Erro ao enviar mensagem:', error);
      return false;
    }
  }

  public async initialize(): Promise<void> {
    try {
      console.log('🔄 Inicializando WhatsApp Bot...');
      await this.client.initialize();
    } catch (error) {
      console.error('❌ Erro ao inicializar WhatsApp Bot:', error);
      throw error;
    }
  }

  public async destroy(): Promise<void> {
    try {
      console.log('🛑 Desconectando WhatsApp Bot...');
      await this.client.destroy();
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