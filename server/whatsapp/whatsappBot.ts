/**
 * WhatsApp Bot usando whatsapp-web.js
 * Implementação robusta seguindo documentação oficial
 */
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
import { parseEventWithClaude } from '../utils/claudeParser';
import { generateCalendarLinks } from '../utils/calendarUtils';
import { parseUserDateTime, extractEventTitle } from '../telegram/utils/parseDate';
import qrcode from 'qrcode-terminal';
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
  private client: any;
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
        executablePath: process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : undefined,
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
          '--disable-logging',
          '--disable-permissions-api',
          '--disable-features=VizDisplayCompositor',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--disable-background-networking',
          '--disable-background-timer-throttling',
          '--disable-client-side-phishing-detection',
          '--disable-component-extensions-with-background-pages',
          '--disable-default-apps',
          '--disable-domain-reliability',
          '--disable-features=AudioServiceOutOfProcess',
          '--disable-hang-monitor',
          '--disable-ipc-flooding-protection',
          '--disable-prompt-on-repost',
          '--disable-renderer-backgrounding',
          '--disable-sync',
          '--force-color-profile=srgb',
          '--metrics-recording-only',
          '--no-first-run',
          '--password-store=basic',
          '--use-mock-keychain'
        ]
      }
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    console.log('🔧 Configurando event handlers do WhatsApp...');
    
    // QR Code para autenticação
    this.client.on('qr', async (qr: string) => {
      console.log('🔗 QR Code recebido, gerando no terminal...');
      console.log('\n🔗 CONECTAR WHATSAPP BOT:');
      console.log('Escaneie o QR code abaixo com seu WhatsApp para conectar o bot:\n');
      (qrcode as any).generate(qr, { small: true });
      console.log('\n📱 Abra o WhatsApp > Menu > Dispositivos conectados > Conectar dispositivo');
      console.log('🔍 Escaneie o QR code acima para ativar o bot WhatsApp\n');
      
      // Salvar QR code atual
      this.status.qrCode = qr;
      
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
    this.client.on('auth_failure', (msg: any) => {
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
    this.client.on('disconnected', (reason: any) => {
      console.log('📱 WhatsApp desconectado:', reason);
      this.status.isConnected = false;
      this.status.isReady = false;
      this.notifyStatusChange();
    });

    // Processar mensagens recebidas
    this.client.on('message', async (message: any) => {
      console.log('📩 Evento de mensagem disparado');
      await this.handleMessage(message);
    });
    
    console.log('✅ Event handlers configurados com sucesso!');
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

      const text = message.body.trim();
      console.log(`📩 Mensagem recebida de ${message.from}: ${text}`);

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
        await this.sendMessage(message.from, response);
        return;
      }

      // Comando /fuso
      if (text.startsWith('/fuso')) {
        const timezone = text.replace('/fuso', '').trim();
        if (!timezone) {
          await this.sendMessage(
            message.from,
            '🌍 *Configuração de Fuso Horário*\n\n' +
              '💡 Para alterar, envie: /fuso America/Sao_Paulo\n' +
              'Exemplo: /fuso America/Sao_Paulo\n' +
              'Fusos comuns: America/Sao_Paulo, America/Buenos_Aires, Europe/Lisbon, America/New_York'
          );
        } else {
          // Aqui você pode salvar o fuso horário do usuário em um storage se desejar
          await this.sendMessage(
            message.from,
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
        await this.sendMessage(message.from, response);
        return;
      }

      // Usar parser local primeiro (que funciona melhor para títulos)
      console.log(`🔍 [DEBUG] Processando mensagem: "${text}"`);
      const userId = message.from || 'unknown';
      const result = parseUserDateTime(text, userId);
      console.log(`🔍 [DEBUG] Resultado do parser:`, result);
      // EXTRAÇÃO DE TÍTULO COM LOGS DETALHADOS
      const cleanTitle = extractEventTitle(text);
      console.log(`🟢 [DEBUG] Texto original recebido: "${text}"`);
      console.log(`🟢 [DEBUG] Título limpo por extractEventTitle: "${cleanTitle}"`);
      if (result) {
        let response = `✅ *Evento criado!*\n\n`;
        response += `🎯 *${cleanTitle}*\n`;
        const date = new Date(result.iso);
        const dateTime = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
        response += `📅 ${dateTime}\n\n`;
        response += `*Adicionar ao calendário:*\n`;
        // Gerar links de calendário
        const calendarLinks = generateCalendarLinks({ title: cleanTitle, startDate: date, hour: date.getHours(), minute: date.getMinutes() });
        response += `🔗 Google Calendar: ${calendarLinks.google}\n\n`;
        response += `🔗 Outlook: ${calendarLinks.outlook}`;
        console.log(`🟢 [DEBUG] Resposta final enviada ao usuário: \n${response}`);
        await this.sendMessage(message.from, response);
      } else {
        // Resposta para mensagens não reconhecidas como eventos
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

  /**
   * Extrai título inteligente do evento focando na ação principal
   * Inspirado na limpeza avançada do Telegram
   * DICA: Não apague a pasta whatsapp_session/session-zelar-whatsapp-bot/ para não perder a sessão do WhatsApp!
   */
  private extractEventInfo(text: string): { title: string; dateTime: string } {
    console.log(`🔍 [DEBUG] Extraindo informações de: "${text}"`);
    // 1. EXTRAIR NOME DO EVENTO USANDO A MESMA LÓGICA DO TELEGRAM
    const title = extractEventTitle(text);
    // 2. EXTRAIR DATA E HORA (mantém igual)
    let dateTime = "Não especificado";
    const userId = 'whatsapp'; // WhatsApp não tem userId real, mas não afeta parseUserDateTime
    const result = parseUserDateTime(text, userId);
    if (result) {
      const date = new Date(result.iso);
      dateTime = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    }
    console.log(`🔍 [DEBUG] Título extraído: "${title}"`);
    console.log(`🔍 [DEBUG] Data/Hora extraída: "${dateTime}"`);
    return { title, dateTime };
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
      
      // Verificar se o Chrome está disponível no macOS
      if (process.platform === 'darwin') {
        const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
        if (!fs.existsSync(chromePath)) {
          console.error('❌ Google Chrome não encontrado em:', chromePath);
          console.error('💡 Instale o Google Chrome para usar o WhatsApp Bot');
          throw new Error('Google Chrome não encontrado');
        }
        console.log('✅ Google Chrome encontrado:', chromePath);
      }
      
      console.log('📱 Configurações do cliente:', {
        authStrategy: 'LocalAuth',
        clientId: 'zelar-whatsapp-bot',
        dataPath: './whatsapp_session'
      });
      
      // Tentar inicializar com timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout na inicialização do WhatsApp')), 60000);
      });
      
      const initPromise = this.client.initialize();
      
      await Promise.race([initPromise, timeoutPromise]);
      console.log('✅ WhatsApp Bot inicializado com sucesso!');
    } catch (error) {
      console.error('❌ Erro ao inicializar WhatsApp Bot:', error);
      console.error('❌ Detalhes do erro:', error instanceof Error ? error.message : String(error));
      
      // Se for erro de protocolo, tentar reinicializar
      if (error instanceof Error && error.message.includes('Protocol error')) {
        console.log('🔄 Tentando reinicializar após erro de protocolo...');
        try {
          await this.client.destroy();
          await new Promise(resolve => setTimeout(resolve, 2000));
          await this.client.initialize();
          console.log('✅ WhatsApp Bot reinicializado com sucesso!');
          return;
        } catch (retryError) {
          console.error('❌ Falha na reinicialização:', retryError);
        }
      }
      
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