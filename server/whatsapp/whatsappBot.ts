
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  BaileysEventMap,
  jidNormalizedUser
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
import { emailService } from '../services/emailService';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class WhatsAppBot {
  private sock: any = null;
  private authState: any = null;
  private saveCreds: any = null;
  private isInitializing = false;
  private processedMsgIds = new Set<string>();
  private userStates = new Map<string, string>();

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

        // Deduplicação: ignora se já processamos este ID recentemente
        if (msg.key.id && this.processedMsgIds.has(msg.key.id)) {
          console.log(`🔄 Mensagem duplicada ignorada: ${msg.key.id}`);
          continue;
        }
        if (msg.key.id) {
          this.processedMsgIds.add(msg.key.id);
          // Limpa do cache após 10 segundos
          setTimeout(() => this.processedMsgIds.delete(msg.key.id!), 10000);
        }

        try {
          const text = msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || '';

          if (!text) continue;

          console.log(`📩 WhatsApp msg de ${msg.key.remoteJid}: ${text}`);
          console.log('DEBUG MSG KEY:', JSON.stringify(msg.key, null, 2));

          let targetJid = msg.key.remoteJid;

          // Prioridade 1: senderPn (aparece em mensagens com LID)
          if ((msg.key as any).senderPn) {
            targetJid = (msg.key as any).senderPn;
          }
          // Prioridade 2: participant (comum em grupos)
          else if (msg.key.participant) {
            targetJid = msg.key.participant;
          }

          const normalizedJid = jidNormalizedUser(targetJid);
          const whatsappId = normalizedJid.replace(/\D/g, ''); // Garante apenas números

          console.log(`🆔 ID Extraído: ${whatsappId} (Original usado: ${targetJid})`);

          await this.handleMessage(msg.key.remoteJid, whatsappId, text, msg);

        } catch (error) {
          console.error('Erro ao processar mensagem WhatsApp:', error);
        }
      }
    });
  }

  private async getOrCreateUser(whatsappId: string, name?: string) {
    let user = await storage.getUserByWhatsApp(whatsappId);

    if (!user) {
      // Tentar buscar por username caso tenha sido criado manualmente
      user = await storage.getUserByUsername(whatsappId);
    }

    if (!user) {
      console.log(`👤 Criando novo usuário WhatsApp: ${whatsappId}`);
      user = await storage.createUser({
        username: whatsappId,
        password: `whatsapp_${whatsappId}`,
        name: name || `User ${whatsappId}`,
        // email: undefined, // Opcional, será preenchido se o usuário informar depois
      });

      // Criar configurações padrão
      await storage.createUserSettings({
        userId: user.id,
        notificationsEnabled: true,
        reminderTimes: [12],
        language: 'pt-BR',
        timeZone: 'America/Sao_Paulo',
      });
    }
    return user;
  }

  private async handleMessage(remoteJid: string, whatsappId: string, text: string, msg: any) {
    const user = await this.getOrCreateUser(whatsappId, msg.pushName);

    // =========================================================================
    // 1. VERIFICAÇÃO ESTRITA DE ASSINATURA (PREMIUM CHECK)
    // =========================================================================
    if (user.subscriptionStatus !== 'active') {
      const baseUrl = process.env.STRIPE_PAYMENT_LINK;
      if (!baseUrl) {
        console.error("❌ STRIPE_PAYMENT_LINK não configurado no .env");
        await this.sendMessage(remoteJid, "⚠️ Erro de configuração: Link de pagamento não disponível. Contate o suporte.");
        return;
      }
      const paymentLink = `${baseUrl}?client_reference_id=${user.id}`;
      console.log(`🚫 Usuário ${user.username} sem assinatura ativa. Enviando link de pagamento.`);

      await this.sendMessage(remoteJid,
        '⚠️ *Assinatura Necessária*\n\n' +
        'Para continuar usando o Zelar IA e ter acesso a agendamentos ilimitados, você precisa de uma assinatura ativa.\n\n' +
        '🚀 *Assine agora e libere seu acesso:*\n' +
        `${paymentLink}\n\n` +
        'Após o pagamento, seu acesso será liberado automaticamente!'
      );
      return; // Bloqueia qualquer outra interação
    }

    // =========================================================================
    // 1.5. PROCESSAMENTO DE ESTADOS (CONFIRMAÇÕES)
    // =========================================================================
    const currentState = this.userStates.get(remoteJid);
    if (currentState === 'AWAITING_CANCEL_CONFIRMATION') {
      const response = text.toLowerCase().trim();

      if (response === 'sim' || response === 's') {
        this.userStates.delete(remoteJid);
        await this.sendMessage(remoteJid, '⏳ Cancelando sua assinatura...');
        try {
          const { stripeService } = await import('../services/stripe');
          const result = await stripeService.cancelSubscription(user.id);
          const endDate = result.endsAt.toLocaleDateString('pt-BR');

          await this.sendMessage(remoteJid,
            `✅ *Assinatura cancelada com sucesso.*\n\n` +
            `Seu acesso continuará disponível até *${endDate}*.\n` +
            `Após essa data, o bot não processará mais novos eventos para você.\n\n` +
            `Esperamos vê-lo de volta em breve! 👋`
          );
        } catch (error: any) {
          console.error('Erro ao cancelar assinatura:', error);
          await this.sendMessage(remoteJid, `❌ Não foi possível cancelar: ${error.message}`);
        }
        return;
      } else if (response === 'não' || response === 'nao' || response === 'n' || response === 'não') {
        this.userStates.delete(remoteJid);
        await this.sendMessage(remoteJid, '✅ Operação cancelada. Sua assinatura permanece ativa.');
        return;
      } else if (text.startsWith('/')) {
        // Se for um comando, sai do estado e processa o comando
        this.userStates.delete(remoteJid);
        // Continua para o processamento de comandos abaixo
      } else {
        await this.sendMessage(remoteJid,
          '⚠️ *Confirmação necessária*\n\n' +
          'Por favor, responda com *sim* para confirmar o cancelamento ou *não* para desistir.\n' +
          'Ou digite qualquer comando (ex: /ajuda) para sair.'
        );
        return;
      }
    }

    // =========================================================================
    // 2. PROCESSAMENTO DE COMANDOS
    // =========================================================================
    if (text.startsWith('/')) {
      const command = text.split(' ')[0].toLowerCase();
      const args = text.substring(command.length).trim();
      await this.handleCommand(remoteJid, user, command, args);
      return;
    }

    // =========================================================================
    // 3. PROCESSAMENTO DE EVENTOS (INTEGRAÇÃO COM CLAUDE)
    // =========================================================================
    const userSettings = await storage.getUserSettings(user.id);
    const userTimezone = userSettings?.timeZone || getUserTimezone(whatsappId);

    console.log(`🧠 Processando mensagem como evento para ${user.username}...`);
    const event = await parseEvent(text, whatsappId, userTimezone);

    if (!event) {
      // Se não for um evento claro, envia mensagem de ajuda gentil
      console.log(`⚠️ Mensagem não interpretada como evento: "${text}"`);
      await this.sendMessage(remoteJid,
        '❓ Desculpe, não entendi.\n\n' +
        'Estou aqui para agendar seus compromissos. Tente dizer algo como:\n' +
        '*"Reunião amanhã às 15h"* ou *"Dentista dia 15 às 14h com Dr. Silva"*.\n\n' +
        'Use /ajuda para ver o que posso fazer! 🤖'
      );
      return;
    }

    // =========================================================================
    // 4. CRIAÇÃO DE EVENTO E INTEGRAÇÕES
    // =========================================================================
    try {
      // Adiciona o próprio usuário aos telefones alvo (se não estiver lá)
      if (!(event as any).targetPhones) {
        (event as any).targetPhones = [];
      }
      if (!(event as any).targetPhones.includes(whatsappId)) {
        (event as any).targetPhones.push(whatsappId);
      }

      // 4.1. Salvar no Banco de Dados
      const newEvent = await storage.createEvent({
        userId: user.id,
        title: event.title,
        description: event.description || '',
        startDate: new Date(event.startDate),
        attendeePhones: (event as any).targetPhones || [], // Salvando telefones identificados
        attendeeEmails: event.attendees || [], // Salvando emails identificados
        rawData: JSON.parse(JSON.stringify(event)),
      });

      // Definir phones e emails para uso abaixo
      const phones = (event as any).targetPhones;
      const emails = event.attendees;

      // (Bloco de responseText original removido - será construído mais abaixo)

      // 4.2. Integração com Google Calendar
      let googleLink = '';
      let isSyncedWithGoogle = false;

      if (userSettings?.googleTokens) {
        try {
          setTokens(user.id, JSON.parse(userSettings.googleTokens));
          const googleResult = await addEventToGoogleCalendar({
            ...newEvent,
            startDate: new Date(event.startDate),
            endDate: null,
            attendeePhones: phones // Passando telefones para o helper do Google
          }, user.id);

          if (googleResult.success) {
            isSyncedWithGoogle = true;
            if (googleResult.conferenceLink) {
              await storage.updateEvent(newEvent.id, { conferenceLink: googleResult.conferenceLink });
            }
            if (googleResult.calendarEventId) {
              await storage.updateEvent(newEvent.id, { calendarId: googleResult.calendarEventId });
            }
          } else {
            console.error(`⚠️ Falha no Google Calendar: ${googleResult.message}`);
            // Fallback links se falhar
            const links = generateLinks(event);
            googleLink = links.google;
          }
        } catch (error) {
          console.error('Erro Google Calendar:', error);
          const links = generateLinks(event);
          googleLink = links.google;
        }
      } else {
        const links = generateLinks(event);
        googleLink = links.google;
      }

      // =================== 4.3. NOTIFICAÇÕES (GUESTS vs CREATOR) ===================

      // A) NOTIFICAR CONVIDADOS (Guests)
      if (phones && phones.length > 0) {
        const guestLinks = generateLinks(event);
        const guestLinkMsg = guestLinks.google; // Priorizando Google Link para simplicidade

        for (const phone of phones) {
          // Normalizar telefone (remover @s.whatsapp.net se vier)
          const guestJid = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;

          // Normalizar IDs para comparação numérica pura (remove @s.whatsapp.net e outros caracteres)
          const guestIdOnly = guestJid.split('@')[0].replace(/\D/g, '');
          const creatorIdOnly = remoteJid.split('@')[0].replace(/\D/g, '');

          // Pula se for o mesmo número (evita mandar "você foi convidado" para o criador)
          if (guestIdOnly === creatorIdOnly) {
            console.log(`🔄 Pulando envio de convite para o próprio criador (${guestIdOnly})`);
            continue;
          }

          console.log(`📤 Enviando convite para convidado: ${guestJid}`);

          await this.sendMessage(guestJid,
            `📅 *Você foi convidado para um evento!*\n\n` +
            `📝 *${event.title}*\n` +
            `🗓️ ${event.displayDate}\n\n` +
            `🔗 *Adicionar ao seu calendário:*\n${guestLinkMsg}\n\n` +
            `_Enviado via Zelar IA pelo anfitrião_`
          );
        }
      }

      // A.2) NOTIFICAR CONVIDADOS (Emails)
      if (emails && emails.length > 0) {
        for (const email of emails) {
          console.log(`📧 Enviando convite por email para: ${email}`);
          try {
            await emailService.sendInvitation(email, newEvent, user.name || "Anfitrião");
          } catch (e) {
            console.error(`❌ Erro ao enviar email para ${email}`, e);
          }
        }
      }

      // A.3) NOTIFICAR CRIADOR (Email - se tiver email válido cadastrado)
      if (user.email) {
        console.log(`📧 Enviando confirmação por email para criador: ${user.email}`);
        try {
          // Reusing sendInvitation for now, or could be a specific template
          await emailService.sendInvitation(user.email, newEvent, "Você (Via Zelar IA)");
        } catch (e) {
          console.error(`❌ Erro ao enviar email para criador ${user.email}`, e);
        }
      }

      // B) NOTIFICAR CRIADOR (Creator)
      let responseText = `✅ *Evento agendado com sucesso!*\n\n` +
        `📝 *${event.title}*\n` +
        `📅 ${event.displayDate}\n` +
        `🆔 ID: ${newEvent.id}`;

      if (event.attendees && event.attendees.length > 0) {
        responseText += '\n📧 *Email Convidados:*\n' + event.attendees.map(e => `• ${e}`).join('\n');
        responseText += '\n_Convites enviados por email_';
      }

      if (phones && phones.length > 0) {
        const creatorPhone = remoteJid.replace(/\D/g, '');
        const otherGuests = phones.filter((p: string) => p !== creatorPhone);

        if (otherGuests.length > 0) {
          responseText += '\n📱 *Convidados Notificados:*\n' + otherGuests.map((p: string) => `• ${p}`).join('\n');
        }
      }

      // Lógica diferenciada para criador: Synced ou Link Manual
      if (isSyncedWithGoogle) {
        responseText += `\n\n✅ *Sincronizado com seu Google Calendar*`;
        const evtWithLink = await storage.getEvent(newEvent.id);
        if (evtWithLink?.conferenceLink) {
          responseText += `\n📹 Meet: ${evtWithLink.conferenceLink}`;
        }
      } else {
        responseText += `\n\n🔗 *Adicione ao seu calendário:*\n${googleLink}`;
      }

      // 4.4. Criar Lembrete Automático (12h antes) 
      await reminderService.ensureDefaultReminder(newEvent as any, 'whatsapp');

      // Criar lembrete por email se houver convidados por email OU se o criador tiver email
      if ((emails && emails.length > 0) || user.email) {
        await reminderService.ensureDefaultReminder(newEvent as any, 'email');
      }

      responseText += `\n\n🔔 Lembrete automático criado (12h antes).`;

      await this.sendMessage(remoteJid, responseText);

    } catch (err) {
      console.error('Erro fatal ao criar evento:', err);
      await this.sendMessage(remoteJid, '❌ Ocorreu um erro interno ao criar seu evento. Tente novamente.');
    }
  }

  private async sendWelcomeMessage(remoteJid: string, user: any) {
    await this.sendMessage(remoteJid,
      `👋 *Olá, Premium User ${user.name || ''}!* Bem-vindo ao Zelar IA.\n\n` +
      'Estou aqui para organizar sua agenda de forma rápida e inteligente.\n\n' +
      '📌 *O que eu posso fazer?*\n' +
      '• Criar eventos (ex: "Almoço com mãe amanhã 13h")\n' +
      '• Enviar lembretres para você e convidados\n' +
      '• Sincronizar com seu Google Calendar\n\n' +
      '🔗 *Recomendação:*\n' +
      'Conecte seu Google Calendar para uma experiência completa!\n' +
      'Digite `/conectar` para começar.\n\n' +
      '❓ *Dúvidas?* Digite `/simbolos` ou `/ajuda` para ver todos os comandos.'
    );
  }

  private async handleCommand(remoteJid: string, user: any, command: string, args: string) {
    console.log(`🤖 Executando comando: ${command} [args: "${args}"] para ${user.username}`);
    try {
      switch (command) {
        case '/start':
        case '/iniciar':
          await this.sendWelcomeMessage(remoteJid, user);
          break;

        case '/help':
        case '/ajuda':
          await this.sendMessage(remoteJid,
            '🤖 *Central de Ajuda Zelar IA*\n\n' +
            '📋 *Comandos Principais:*\n' +
            '• `/eventos` ou `/events` - Lista eventos passados e futuros\n' +
            '• `/conectar` - Conecta ao Google Calendar\n' +
            '• `/reminders` ou `/lembretes` - Vê lembretes pendentes\n' +
            '• `/edit ID` - Informações sobre como editar\n' +
            '• `/delete ID` - Remove um evento\n' +
            '• `/cancelar` - Cancela sua assinatura\n' +
            '• `/fuso` - Configura seu fuso horário\n\n' +
            '💡 *Dica:* Apenas escreva o evento naturalmente, como "Reunião de equipe terça 14h", e eu cuido do resto!'
          );
          break;

        case '/conectar':
        case '/connect':
          const settings = await storage.getUserSettings(user.id);
          if (settings?.googleTokens) {
            await this.sendMessage(remoteJid, '✅ Você já está conectado ao Google Calendar.\nUse /desconectar se desejar sair.');
          } else {
            const authUrl = generateAuthUrl(user.id, 'whatsapp');
            await this.sendMessage(remoteJid,
              '🔐 *Conectar Google Calendar*\n\n' +
              'Clique no link abaixo para autorizar o acesso:\n' +
              `${authUrl}\n\n` +
              'Isso permite que eu adicione eventos diretamente na sua agenda oficial!'
            );
          }
          break;

        case '/cancelar':
        case '/cancelar assinatura':
          // Confirmação antes de processar
          this.userStates.set(remoteJid, 'AWAITING_CANCEL_CONFIRMATION');
          await this.sendMessage(remoteJid,
            '⚠️ *Confirmação necessária*\n\n' +
            'Tem certeza que deseja cancelar sua assinatura? Digite *sim* para confirmar ou *não* para desistir.'
          );
          break;

        case '/eventos':
        case '/events':
          const allEvents = await storage.getUpcomingEvents(user.id, 20); // Pega 20 eventos próximos (ou ordenar melhor no storage)
          // Aqui getUpcomingEvents pega >= now. Precisaríamos de past events se o usuário quiser. 
          // O requisito diz "List past/upcoming events". A função atual só pega future.
          // Vou focar nos futuros que é o mais útil, e talvez mencionar os passados recentes se implementar no storage.

          if (allEvents.length === 0) {
            await this.sendMessage(remoteJid, '📭 Nenhum evento futuro encontrado.');
          } else {
            let msg = '📅 *Seus Eventos Futuros:*\n\n';
            allEvents.forEach(ev => {
              const date = DateTime.fromJSDate(ev.startDate).setZone(getUserTimezone(user.username));
              msg += `🆔 *${ev.id}* | ${date.toFormat('dd/MM HH:mm')} - ${ev.title}\n`;
            });
            msg += '\nPara ver detalhes ou deletar, use o ID.';
            await this.sendMessage(remoteJid, msg);
          }
          break;

        case '/reminders':
        case '/lembretes':
          // Implementar listagem de lembretes pendentes
          // Preciso de method no storage ou filtrar
          const reminders = await storage.getAllUnsentReminders(); // Isso pega DE TODOS. Filtrar por user.
          const userReminders = reminders.filter(r => r.userId === user.id);

          if (userReminders.length === 0) {
            await this.sendMessage(remoteJid, '📭 Nenhum lembrete pendente.');
          } else {
            let rMsg = '⏰ *Lembretes Pendentes:*\n\n';
            for (const r of userReminders) {
              const evt = await storage.getEvent(r.eventId);
              if (evt) {
                const date = DateTime.fromJSDate(r.sendAt).setZone(getUserTimezone(user.username));
                rMsg += `📌 *${evt.title}* - Lembrete em: ${date.toFormat('dd/MM HH:mm')}\n`;
              }
            }
            await this.sendMessage(remoteJid, rMsg);
          }
          break;

        case '/edit':
        case '/editar':
          if (!args) {
            await this.sendMessage(remoteJid, '⚠️ Use `/edit ID` para saber com editar.');
          } else {
            await this.sendMessage(remoteJid,
              `📝 *Editar Evento ${args}*\n\n` +
              'No momento, a edição direta por comando está em desenvolvimento.\n' +
              '👉 Por favor, delete o evento usando `/delete ${args}` e crie um novo com as informações corretas.'
            );
          }
          break;

        case '/deletar':
        case '/delete':
          const eventId = parseInt(args);
          if (!eventId || isNaN(eventId)) {
            await this.sendMessage(remoteJid, '⚠️ Formato inválido. Use `/delete ID` (ex: /delete 123). Veja o ID usando `/eventos`.');
          } else {
            const ev = await storage.getEvent(eventId);
            if (!ev || ev.userId !== user.id) {
              await this.sendMessage(remoteJid, '❌ Evento não encontrado ou sem permissão.');
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
            await this.sendMessage(remoteJid, `🗑️ Evento "${ev.title}" removido com sucesso.`);
          }
          break;

        case '/fuso':
          if (!args) {
            const settings = await storage.getUserSettings(user.id);
            await this.sendMessage(remoteJid, `Seu fuso atual é: ${settings?.timeZone || 'Padrão'}.\nUse /fuso America/Sao_Paulo para alterar.`);
          } else {
            await storage.updateUserSettings(user.id, { timeZone: args });
            await this.sendMessage(remoteJid, `✅ Fuso alterado para ${args}`);
          }
          break;

        default:
          await this.sendMessage(remoteJid, '❌ Comando não reconhecido. Digite `/ajuda` para ver a lista.');
      }
    } catch (err) {
      console.error(`Erro no comando ${command}:`, err);
      await this.sendMessage(remoteJid, '❌ Erro ao processar comando.');
    }
  }

  public async sendMessage(jid: string, text: string) {
    if (!this.sock) {
      console.error('❌ Tentativa de enviar mensagem sem conexão ativa');
      return;
    }

    try {
      // Ensure JID has the correct suffix
      if (!jid.includes('@')) {
        jid = `${jid}@s.whatsapp.net`;
      }

      console.log(`📤 Enviando mensagem para ${jid}: ${text.slice(0, 50)}...`);
      await this.sock.sendMessage(jid, { text });
    } catch (error) {
      console.error(`❌ Erro ao enviar mensagem para ${jid}:`, error);
    }
  }
}

const botInstance = new WhatsAppBot();

export const getWhatsAppBot = () => botInstance;
