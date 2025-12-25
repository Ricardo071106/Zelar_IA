
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  BaileysEventMap
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import pino from 'pino';
import QRCode from 'qrcode';
import { parseEvent, generateLinks, Event } from '../services/eventParser';
import {
  setUserTimezone,
  getUserTimezone,
  COMMON_TIMEZONES,
  parseUserDateTime
} from '../services/dateService';
import { parseLocalTime, formatLocalTime, TIME_PATTERNS } from '../services/timezoneService';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class WhatsAppBot {
  private sock: any = null;
  private authState: any = null;
  private saveCreds: any = null;
  private isInitializing = false;

  async initialize() {
    if (this.isInitializing) return;
    this.isInitializing = true;

    try {
      console.log('🤖 Inicializando WhatsApp Bot...');

      const authPath = path.resolve(__dirname, 'auth_info_baileys');
      if (!fs.existsSync(authPath)) {
        fs.mkdirSync(authPath, { recursive: true });
      }

      const { state, saveCreds } = await useMultiFileAuthState(authPath);
      this.authState = state;
      this.saveCreds = saveCreds;

      const { version, isLatest } = await fetchLatestBaileysVersion();
      console.log(`WhatsApp version: ${version.join('.')} (latest: ${isLatest})`);

      this.startSock(version);

    } catch (error) {
      console.error('Erro ao inicializar WhatsApp Bot:', error);
    } finally {
      this.isInitializing = false;
    }
  }

  private startSock(version?: any) {
    this.sock = makeWASocket({
      version: version,
      printQRInTerminal: false,
      auth: this.authState,
      logger: pino({ level: 'silent' }) as any,
      browser: ['Zelar IA', 'Chrome', '1.0.0'],
      // connectTimeoutMs: 60000,
      // defaultQueryTimeoutMs: 60000,
    });

    this.sock.ev.on('creds.update', this.saveCreds);

    this.sock.ev.on('connection.update', (update: any) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log('QR Code recebido:');
        QRCode.toString(qr, { type: 'terminal', small: true }, (err, url) => {
          if (err) console.error(err);
          console.log(url);
        });
      }

      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
        console.log('Conexão fechada devido a ', lastDisconnect?.error, ', reconectar: ', shouldReconnect);
        if (shouldReconnect) {
          this.startSock(version);
        }
      } else if (connection === 'open') {
        console.log('✅ Conexão WhatsApp aberta!');
      }
    });

    this.sock.ev.on('messages.upsert', async ({ messages, type }: { messages: any[], type: string }) => {
      if (type !== 'notify') return;

      for (const msg of messages) {
        if (!msg.message || msg.key.fromMe) continue;

        try {
          // Extrair texto da mensagem (pode ser textMessage, extendedTextMessage ou conversation)
          const text = msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || '';

          if (!text) continue;

          console.log(`📩 WhatsApp msg de ${msg.key.remoteJid}: ${text}`);

          const remoteJid = msg.key.remoteJid;
          const userId = remoteJid?.replace(/\D/g, '') || 'unknown'; // Usar número como ID

          await this.handleMessage(remoteJid, userId, text, msg);

        } catch (error) {
          console.error('Erro ao processar mensagem WhatsApp:', error);
        }
      }
    });
  }

  private async handleMessage(remoteJid: string, userId: string, text: string, msg: any) {
    // Comandos
    if (text.startsWith('/')) {
      await this.handleCommand(remoteJid, userId, text);
      return;
    }

    // Processamento de Evento
    const userTimezone = getUserTimezone(userId); // Idioma não disponível facilmente no WS, assumir pt-BR/user default

    // Verificar se precisa configurar fuso (lógica similar ao Telegram)
    if (!getUserTimezone(userId) && (text.includes('às') || text.match(/\d{1,2}h/))) {
      // O getUserTimezone já retorna um default, então isso raramente dispara a menos que mudemos a lógica.
      // Mas se quisermos ser proativos:
      // await this.sendMessage(remoteJid, 'Dica: Configure seu fuso com /fuso se os horários estiverem errados.');
    }

    const event = await parseEvent(text, userId, userTimezone);

    if (event) {
      const links = generateLinks(event);
      const attendeesText = event.attendees && event.attendees.length > 0
        ? '\n👥 *Convidados:*\n' + event.attendees.map(e => `• ${e}`).join('\n')
        : '';

      const response = `✅ *Evento criado com sucesso!*\n\n` +
        `🎯 *${event.title}*\n` +
        `📅 ${event.displayDate}` +
        attendeesText +
        `\n\n📅 *Adicionar ao calendário:*\n` +
        `Google: ${links.google}\n\n` +
        `Outlook: ${links.outlook}`;

      await this.sendMessage(remoteJid, response);
    } else {
      // Fallback: Se não for comando e não for evento, responder com ajuda se for chat privado
      // Ou se o usuário mencionar o bot (lógica futura)

      console.log(`⚠️ Mensagem não interpretada como evento: "${text}"`);

      const isPrivateChat = remoteJid.endsWith('@s.whatsapp.net');

      if (isPrivateChat) {
        const helpParams = [
          '❌ *Não consegui entender a data/hora*',
          '',
          '💡 *Exemplos que entendo:*',
          '• "jantar hoje às 19h"',
          '• "reunião amanhã às 15h"',
          '• "consulta sexta que vem às 10 da manhã"',
          '',
          '🔍 Use `/interpretar sua frase` para testar!',
          '🌍 Use `/fuso` para configurar horários locais!'
        ].join('\n');

        await this.sendMessage(remoteJid, helpParams);
      }
    }
  }

  private async handleCommand(remoteJid: string, userId: string, text: string) {
    if (text.startsWith('/fuso')) {
      const args = text.replace('/fuso', '').trim();
      if (!args) {
        const currentTimezone = getUserTimezone(userId);
        const timezoneList = COMMON_TIMEZONES.slice(0, 6).map(tz => `• ${tz}`).join('\n');
        await this.sendMessage(remoteJid,
          `🌍 *Configuração de Fuso Horário*\n\n` +
          `📍 *Seu fuso atual:* ${currentTimezone}\n\n` +
          `💡 *Para alterar:* /fuso America/Sao_Paulo\n\n` +
          `📋 *Fusos comuns:*\n${timezoneList}`
        );
      } else {
        const success = setUserTimezone(userId, args);
        if (success) {
          await this.sendMessage(remoteJid, `✅ *Fuso horário configurado para:* ${args}`);
        } else {
          await this.sendMessage(remoteJid, `❌ *Fuso horário inválido.*\nTente: America/Sao_Paulo`);
        }
      }
    } else if (text.startsWith('/interpretar')) {
      const args = text.replace('/interpretar', '').trim();
      if (!args) {
        await this.sendMessage(remoteJid, 'Digite uma data após o comando. Ex: /interpretar amanhã às 10h');
        return;
      }
      const result = parseUserDateTime(args, userId);
      if (result) {
        const currentTimezone = getUserTimezone(userId);
        await this.sendMessage(remoteJid,
          `✅ *Entendi!*\n\n` +
          `📝 "${args}"\n` +
          `📅 ${result.readable}\n` +
          `🌍 Fuso: ${currentTimezone}`
        );
      } else {
        await this.sendMessage(remoteJid, `❌ Não entendi "${args}"`);
      }
    }
  }

  private async sendMessage(jid: string, text: string) {
    if (!this.sock) {
      console.error('❌ Tentativa de enviar mensagem sem conexão ativa');
      return;
    }

    try {
      console.log(`📤 Enviando mensagem para ${jid}: ${text.slice(0, 50)}...`);
      await this.sock.sendMessage(jid, { text });
      console.log('✅ Mensagem enviada com sucesso');
    } catch (error) {
      console.error(`❌ Erro ao enviar mensagem para ${jid}:`, error);
    }
  }
}

const botInstance = new WhatsAppBot();

export const getWhatsAppBot = () => botInstance;
