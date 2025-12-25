
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
import { DateTime } from 'luxon';
import { parseEvent, generateLinks, Event as ParsedEvent } from '../services/eventParser';
import {
  setUserTimezone,
  getUserTimezone,
  COMMON_TIMEZONES,
  parseUserDateTime
} from '../services/dateService';
import { storage } from '../storage';
import {
  addEventToGoogleCalendar,
  generateAuthUrl,
  cancelGoogleCalendarEvent,
  setTokens
} from '../telegram/googleCalendarIntegration';
import { reminderService } from '../services/reminderService';

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
          const text = msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || '';

          if (!text) continue;

          console.log(`📩 WhatsApp msg de ${msg.key.remoteJid}: ${text}`);

          const whatsappId = msg.key.remoteJid.replace(/\D/g, ''); // Número como ID

          console.log(`Debugger: Calling handleMessage for ${whatsappId}...`);
          await this.handleMessage(msg.key.remoteJid, whatsappId, text, msg);
          console.log(`Debugger: handleMessage returned.`);

        } catch (error) {
          console.error('Erro ao processar mensagem WhatsApp:', error);
        }
      }
    });
  }

  private async getOrCreateUser(whatsappId: string, name?: string) {
    console.log(`Debugger: Entered getOrCreateUser for ${whatsappId}`);
    let user = await storage.getUserByWhatsApp(whatsappId);
    console.log(`Debugger: getUserByWhatsApp returned: ${user ? 'User found' : 'null'}`);

    if (!user) {
      // Tentar buscar por username caso tenha sido criado manualmente
      console.log(`Debugger: Trying getUserByUsername...`);
      user = await storage.getUserByUsername(whatsappId);
      console.log(`Debugger: getUserByUsername returned: ${user ? 'User found' : 'null'}`);
    }

    if (!user) {
      console.log(`👤 Criando novo usuário WhatsApp: ${whatsappId}`);
      user = await storage.createUser({
        username: whatsappId,
        password: `whatsapp_${whatsappId}`,
        name: name || `User ${whatsappId}`,
        email: `${whatsappId}@whatsapp.user`, // Placeholder
      });
      console.log(`Debugger: User created.`);

      // Criar configurações padrão
      await storage.createUserSettings({
        userId: user.id,
        notificationsEnabled: true,
        reminderTimes: [12],
        language: 'pt-BR',
        timeZone: 'America/Sao_Paulo',
      });
      console.log(`Debugger: Settings created.`);
    }
    return user;
  }

  private async handleMessage(remoteJid: string, whatsappId: string, text: string, msg: any) {
    const user = await this.getOrCreateUser(whatsappId, msg.pushName);

    // Comandos
    if (text.startsWith('/')) {
      const command = text.split(' ')[0].toLowerCase();
      const args = text.substring(command.length).trim();
      await this.handleCommand(remoteJid, user, command, args);
      return;
    }

    // Processamento de Evento
    const userSettings = await storage.getUserSettings(user.id);
    const userTimezone = userSettings?.timeZone || getUserTimezone(whatsappId);

    const event = await parseEvent(text, whatsappId, userTimezone);

    if (event) {
      // 1. Salvar no Banco de Dados
      const newEvent = await storage.createEvent({
        userId: user.id,
        title: event.title,
        description: event.description || '',
        startDate: new Date(event.startDate),
        rawData: JSON.parse(JSON.stringify(event)),
      });

      let responseText = `✅ *Evento criado com sucesso!*\n\n` +
        `🎯 *${event.title}*\n` +
        `📅 ${event.displayDate}\n` +
        `🆔 ID: ${newEvent.id}`;

      if (event.attendees && event.attendees.length > 0) {
        responseText += '\n👥 *Convidados:*\n' + event.attendees.map(e => `• ${e}`).join('\n');
      }

      // 2. Integração com Google Calendar (se conectado)
      let googleLink = '';
      if (userSettings?.googleTokens) {
        try {
          setTokens(user.id, JSON.parse(userSettings.googleTokens));
          const googleResult = await addEventToGoogleCalendar({
            ...newEvent,
            startDate: new Date(event.startDate),
            endDate: null // addEventToGoogleCalendar calcula o fim se nulo
          }, user.id);

          if (googleResult.success) {
            responseText += `\n\n✅ *Adicionado ao Google Calendar*`;
            if (googleResult.conferenceLink) {
              responseText += `\n📹 Link da reunião: ${googleResult.conferenceLink}`;
              // Atualizar evento com link
              await storage.updateEvent(newEvent.id, { conferenceLink: googleResult.conferenceLink });
            }
            if (googleResult.calendarEventId) {
              await storage.updateEvent(newEvent.id, { calendarId: googleResult.calendarEventId });
            }
          } else {
            responseText += `\n\n⚠️ *Falha ao adicionar ao Google Calendar:* ${googleResult.message}`;
            // Fallback para links manuais
            const links = generateLinks(event);
            googleLink = links.google;
          }
        } catch (error) {
          console.error('Erro Google Calendar:', error);
          const links = generateLinks(event);
          googleLink = links.google;
        }
      } else {
        // Fallback: Links manuais
        const links = generateLinks(event);
        googleLink = links.google;
        responseText += `\n\n📅 *Adicionar ao calendário:*\n` +
          `Google: ${links.google}\n` +
          `Outlook: ${links.outlook}`;
      }

      await this.sendMessage(remoteJid, responseText);
    } else {
      // Fallback: Ajuda
      console.log(`⚠️ Mensagem não interpretada como evento: "${text}"`);
      const isPrivateChat = remoteJid.endsWith('@s.whatsapp.net');

      if (isPrivateChat) {
        await this.sendHelpMessage(remoteJid);
      }
    }
  }

  private async sendHelpMessage(remoteJid: string) {
    await this.sendMessage(remoteJid,
      '🤖 *Zelar - Assistente de Agendamento*\n\n' +
      'Não entendi sua mensagem como um evento. Veja como posso ajudar:\n\n' +
      '💡 *Exemplos de uso:*\n' +
      '• "jantar hoje às 19h"\n' +
      '• "reunião amanhã às 15h"\n' +
      '• "consulta sexta às 10h"\n\n' +
      '📝 *Comandos disponíveis:*\n' +
      '• `/eventos` - Ver seus próximos eventos\n' +
      '• `/deletar` - Deletar um evento (ex: /deletar 123)\n' +
      '• `/conectar` - Conectar Google Calendar\n' +
      '• `/status` - Ver status da conexão\n' +
      '• `/fuso` - Configurar fuso horário\n' +
      '• `/ajuda` - Ver esta mensagem'
    );
  }

  private async handleCommand(remoteJid: string, user: any, command: string, args: string) {
    console.log(`🤖 Executando comando: ${command} [args: "${args}"] para ${user.username}`);
    try {
      switch (command) {
        case '/start':
        case '/help':
        case '/ajuda':
          await this.sendHelpMessage(remoteJid);
          break;

        case '/fuso':
        case '/timezone':
          if (!args) {
            const settings = await storage.getUserSettings(user.id);
            const current = settings?.timeZone || 'America/Sao_Paulo';
            await this.sendMessage(remoteJid,
              `🌍 *Configuração de Fuso Horário*\n\n` +
              `📍 *Atual:* ${current}\n\n` +
              `Para alterar, digite:\n` +
              `/fuso America/Sao_Paulo\n\n` +
              `Outros exemplos:\n` +
              `• America/New_York\n` +
              `• Europe/Lisbon`
            );
          } else {
            const success = setUserTimezone(user.username, args); // Helper valida
            if (success) {
              await storage.updateUserSettings(user.id, { timeZone: args });
              await this.sendMessage(remoteJid, `✅ Fuso horário alterado para: ${args}`);
            } else {
              await this.sendMessage(remoteJid, `❌ Fuso horário inválido.`);
            }
          }
          break;

        case '/eventos':
        case '/events':
          const upcoming = await storage.getUpcomingEvents(user.id, 5);
          if (upcoming.length === 0) {
            await this.sendMessage(remoteJid, '📭 Nenhum evento próximo encontrado.');
          } else {
            let msg = '📅 *Seus próximos eventos:*\n\n';
            upcoming.forEach(ev => {
              const date = DateTime.fromJSDate(ev.startDate).setZone(getUserTimezone(user.username));
              msg += `🆔 *${ev.id}* - ${ev.title}\n`;
              msg += `📅 ${date.toFormat('dd/MM HH:mm')}\n\n`;
            });
            await this.sendMessage(remoteJid, msg);
          }
          break;

        case '/deletar':
        case '/delete':
        case '/apagar':
          const eventId = parseInt(args);
          if (!eventId || isNaN(eventId)) {
            // Se não forneceu ID, listar eventos
            const events = await storage.getUpcomingEvents(user.id, 5);
            if (events.length === 0) {
              await this.sendMessage(remoteJid, '📭 Nenhum evento para deletar.');
              return;
            }
            let list = '🗑️ *Qual evento deseja deletar?*\nDigite `/deletar ID` (ex: /deletar 10)\n\n';
            events.forEach(ev => {
              const date = DateTime.fromJSDate(ev.startDate).setZone(getUserTimezone(user.username));
              list += `🆔 *${ev.id}* - ${ev.title} (${date.toFormat('dd/MM')})\n`;
            });
            await this.sendMessage(remoteJid, list);
          } else {
            // Deletar evento específico
            const ev = await storage.getEvent(eventId);
            if (!ev) {
              await this.sendMessage(remoteJid, '❌ Evento não encontrado.');
              return;
            }
            if (ev.userId !== user.id) {
              await this.sendMessage(remoteJid, '❌ Você não tem permissão para deletar este evento.');
              return;
            }

            // Deletar do Google
            if (ev.calendarId) {
              const settings = await storage.getUserSettings(user.id);
              if (settings?.googleTokens) {
                setTokens(user.id, JSON.parse(settings.googleTokens));
                await cancelGoogleCalendarEvent(ev.calendarId, user.id);
              }
            }

            await storage.deleteEvent(eventId);
            await this.sendMessage(remoteJid, `✅ Evento "${ev.title}" deletado com sucesso.`);
          }
          break;

        case '/conectar':
          const settings = await storage.getUserSettings(user.id);
          if (settings?.googleTokens) {
            await this.sendMessage(remoteJid, '✅ Você já está conectado ao Google Calendar.\nUse /desconectar se desejar sair.');
          } else {
            const authUrl = generateAuthUrl(user.id, 'whatsapp');
            // Adicionar parâmetro para identificar origem se necessário, mas o state é o userId
            await this.sendMessage(remoteJid,
              '🔐 *Conectar Google Calendar*\n\n' +
              'Acesse o link abaixo para autorizar:\n' +
              `${authUrl}\n\n` +
              'Após autorizar, seus eventos serão sincronizados automaticamente!'
            );
          }
          break;

        case '/desconectar':
          await storage.updateUserSettings(user.id, { googleTokens: null });
          await this.sendMessage(remoteJid, '✅ Google Calendar desconectado.');
          break;

        case '/status':
          const st = await storage.getUserSettings(user.id);
          const status = st?.googleTokens ? '✅ Conectado' : '❌ Desconectado';
          await this.sendMessage(remoteJid, `📊 *Status da conexão:*\nGoogle Calendar: ${status}`);
          break;

        case '/interpretar':
          const interpret = await parseUserDateTime(args, user.username);
          if (interpret) {
            await this.sendMessage(remoteJid, `✅ *Interpretação:*\n📅 ${interpret.readable}\n(ISO: ${interpret.iso})`);
          } else {
            await this.sendMessage(remoteJid, '❌ Não entendi a data.');
          }
          break;

        default:
          console.warn(`⚠️ Comando não reconhecido: ${command}`);
          await this.sendMessage(remoteJid, '❌ Comando não reconhecido. Use /ajuda.');
      }
    } catch (err) {
      console.error(`Erro no comando ${command}:`, err);
      await this.sendMessage(remoteJid, '❌ Ocorreu um erro ao processar o comando.');
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
      // console.log('✅ Mensagem enviada com sucesso');
    } catch (error) {
      console.error(`❌ Erro ao enviar mensagem para ${jid}:`, error);
    }
  }
}

const botInstance = new WhatsAppBot();

export const getWhatsAppBot = () => botInstance;
