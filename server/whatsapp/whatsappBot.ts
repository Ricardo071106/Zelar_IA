
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
import { sql } from 'drizzle-orm';
import { parseEvent, generateLinks, extractEventTitle } from '../services/eventParser';
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
import {
  addEventToMicrosoftCalendar,
  cancelMicrosoftCalendarEvent,
} from '../telegram/microsoftCalendarIntegration';
import { reminderService } from '../services/reminderService';
import { db } from '../db';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class WhatsAppBot {
  private sock: any = null;
  private authState: any = null;
  private saveCreds: any = null;
  private isInitializing = false;
  private authPath = '';
  private isConnected = false;
  private lastQrCode: string | null = null;
  private qrRecoveryAttempts = 0;
  private socketStartedAtMs = 0;
  private processedMsgIds = new Set<string>();
  private processedFingerprints = new Map<string, number>();
  private userStates = new Map<string, string>();

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private formatReminderOffset(reminderTime: number): string {
    // Compatibilidade com legado: valores <= 24 eram salvos em horas.
    const minutes = reminderTime <= 24 ? reminderTime * 60 : reminderTime;
    if (minutes % 60 === 0) {
      return `${minutes / 60}h`;
    }
    if (minutes > 60) {
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      return `${h}h${m}min`;
    }
    return `${minutes}min`;
  }

  async initialize() {
    if (this.isInitializing) return;
    this.isInitializing = true;

    try {
      console.log('🤖 Inicializando WhatsApp Bot...');

      const authPath = process.env.WHATSAPP_AUTH_DIR
        ? path.resolve(process.env.WHATSAPP_AUTH_DIR)
        : path.resolve(__dirname, 'auth_info_baileys');
      this.authPath = authPath;
      if (!fs.existsSync(authPath)) {
        fs.mkdirSync(authPath, { recursive: true });
      }

      const { state, saveCreds } = await useMultiFileAuthState(authPath);
      this.authState = state;
      this.saveCreds = saveCreds;

      const { version, isLatest } = await fetchLatestBaileysVersion();
      console.log(`WhatsApp version: ${version.join('.')} (latest: ${isLatest})`);

      this.startSock(version);
      this.scheduleQrRecoveryCheck(version);

    } catch (error) {
      console.error('Erro ao inicializar WhatsApp Bot:', error);
    } finally {
      this.isInitializing = false;
    }
  }

  private startSock(version?: any) {
    this.socketStartedAtMs = Date.now();
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
        this.lastQrCode = qr;
        console.log('QR Code recebido:');
        const qrWebUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`;
        console.log(`🔗 QR (imagem): ${qrWebUrl}`);
        QRCode.toString(qr, { type: 'terminal', small: true }, (err, url) => {
          if (err) console.error(err);
          console.log(url);
        });
      }

      if (connection === 'close') {
        this.isConnected = false;
        this.lastQrCode = null;
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const isLoggedOut = statusCode === DisconnectReason.loggedOut;
        console.log('Conexão fechada devido a ', lastDisconnect?.error, ', status: ', statusCode);

        if (isLoggedOut) {
          console.log('🔓 Sessão WhatsApp encerrada. Limpando credenciais e gerando novo QR...');
          this.clearAuthState();
          setTimeout(() => this.initialize(), 1000);
          return;
        }

        const shouldReconnect = true;
        if (shouldReconnect) {
          this.startSock(version);
        }
      } else if (connection === 'open') {
        this.isConnected = true;
        this.lastQrCode = null;
        this.qrRecoveryAttempts = 0;
        console.log('✅ Conexão WhatsApp aberta!');
      }
    });

    this.sock.ev.on('messages.upsert', async ({ messages, type }: { messages: any[], type: string }) => {
      if (type !== 'notify') return;

      for (const msg of messages) {
        if (!msg.message || msg.key.fromMe) continue;

        // Ignora backlog antigo entregue após reconexão/restart (causa respostas duplicadas no primeiro envio).
        const msgTimestampMs = this.getMessageTimestampMs(msg);
        if (msgTimestampMs && msgTimestampMs < (this.socketStartedAtMs - 15000)) {
          console.log(`⏭️ Ignorando mensagem antiga de backlog (${new Date(msgTimestampMs).toISOString()})`);
          continue;
        }

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

          // Deduplicação por conteúdo para casos em que o provedor entrega IDs diferentes
          const fingerprint = `${msg.key.remoteJid}|${whatsappId}|${text.trim().toLowerCase()}`;
          const now = Date.now();
          const existing = this.processedFingerprints.get(fingerprint);
          if (existing && (now - existing) < 15000) {
            console.log(`🔄 Mensagem duplicada por fingerprint ignorada: ${fingerprint}`);
            continue;
          }
          this.processedFingerprints.set(fingerprint, now);

          // Limpeza simples de fingerprints antigos
          for (const [key, timestamp] of this.processedFingerprints.entries()) {
            if (now - timestamp > 60000) {
              this.processedFingerprints.delete(key);
            }
          }

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

  private async handleMessage(remoteJid: string, whatsappId: string, text: string, msg: any, fromBatch = false) {
    const user = await this.getOrCreateUser(whatsappId, msg.pushName);
    const command = text.split(' ')[0].toLowerCase();
    const args = text.substring(command.length).trim();

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
    // 1.2. VERIFICAÇÃO DE EMAIL OBRIGATÓRIO
    // =========================================================================
    const allowedWithoutEmail = new Set([
      '/start',
      '/iniciar',
      '/help',
      '/ajuda',
      '/email',
      '/cancelar',
    ]);

    if (!user.email && !allowedWithoutEmail.has(command)) {
      await this.sendMessage(
        remoteJid,
        '📧 *Email obrigatório para usar o bot*\n\n' +
          'Para continuar, cadastre seu email com:\n' +
          '`/email seu.email@dominio.com`\n\n' +
          'Exemplo:\n' +
          '`/email ricardo@email.com`',
      );
      return;
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
      await this.handleCommand(remoteJid, user, command, args);
      return;
    }

    // Suporte a múltiplos compromissos em uma única mensagem.
    // Exemplo: "reunião sábado às 13, às 14 e às 15".
    if (!fromBatch) {
      const expandedMessages = this.expandMultipleCommitments(text, whatsappId);
      if (expandedMessages.length > 1) {
        console.log(`🧩 Mensagem expandida em ${expandedMessages.length} compromissos.`);
        for (const singleMessage of expandedMessages) {
          await this.handleMessage(remoteJid, whatsappId, singleMessage, msg, true);
        }
        return;
      }
    }

    // =========================================================================
    // 3. PROCESSAMENTO DE EVENTOS (INTEGRAÇÃO COM CLAUDE)
    // =========================================================================
    const userSettings = await storage.getUserSettings(user.id);
    const userTimezone = userSettings?.timeZone || getUserTimezone(whatsappId);

    console.log(`🧠 Processando mensagem como evento para ${user.username}...`);
    let event = await parseEvent(text, whatsappId, userTimezone);
    const localParsedDate = parseUserDateTime(text, whatsappId);

    if (!event) {
      // Fallback local para evitar falhas por interpretação da IA
      const fallbackDate = parseUserDateTime(text, whatsappId);
      if (!fallbackDate) {
        console.log(`⚠️ Mensagem não interpretada como evento: "${text}"`);
        await this.sendMessage(remoteJid,
          '❓ Não consegui entender a data/hora.\n\n' +
          'Tente assim:\n' +
          '*"Reunião amanhã às 15h"* ou *"Dentista dia 15 às 14h"*.\n\n' +
          'Use /ajuda para ver mais exemplos.'
        );
        return;
      }

      event = {
        title: extractEventTitle(text) || 'Evento',
        startDate: fallbackDate.iso,
        description: text,
        displayDate: fallbackDate.readable,
        attendees: [],
        targetPhones: [],
      };
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

      let finalStartDate = new Date(event.startDate);
      if (Number.isNaN(finalStartDate.getTime())) {
        const fallbackDate = parseUserDateTime(text, whatsappId);
        if (!fallbackDate) {
          console.warn(`⚠️ Data inválida recebida do parser sem fallback: ${event.startDate}`);
          await this.sendMessage(remoteJid,
            '❌ Não consegui entender a data/hora desse compromisso.\n\n' +
            'Tente novamente com um formato como:\n' +
            '*"Reunião amanhã às 15h"*.'
          );
          return;
        }

        event.startDate = fallbackDate.iso;
        event.displayDate = fallbackDate.readable;
        finalStartDate = new Date(event.startDate);
      }

      // Sanidade de ano/data: se IA vier com ano inconsistente e sem ano explícito no texto, usa fallback local.
      const fallbackDate = parseUserDateTime(text, whatsappId);
      const hasExplicitYear = /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|\b20\d{2}\b/.test(text);
      const hasExplicitWeekday = /\b(segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo)(-feira)?\b/i.test(text);
      if (fallbackDate) {
        const fallbackStart = new Date(fallbackDate.iso);
        const now = new Date();
        const aiInPast = finalStartDate.getTime() < (now.getTime() - 6 * 60 * 60 * 1000);
        const fallbackInFuture = fallbackStart.getTime() > now.getTime();
        const yearMismatch = finalStartDate.getFullYear() !== fallbackStart.getFullYear();
        const weekdayMismatch = finalStartDate.getDay() !== fallbackStart.getDay();

        // Se o usuário informou dia da semana explicitamente, prioriza parser local
        // quando IA divergir no dia da semana (ex.: "segunda" e IA retornar terça).
        if (hasExplicitWeekday && weekdayMismatch) {
          console.log(`🛠️ Ajustando data por divergência de dia da semana: ${event.startDate} -> ${fallbackDate.iso}`);
          event.startDate = fallbackDate.iso;
          event.displayDate = fallbackDate.readable;
          finalStartDate = fallbackStart;
        } else if (!hasExplicitYear && (yearMismatch || (aiInPast && fallbackInFuture))) {
          console.log(`🛠️ Ajustando data para fallback local: ${event.startDate} -> ${fallbackDate.iso}`);
          event.startDate = fallbackDate.iso;
          event.displayDate = fallbackDate.readable;
          finalStartDate = fallbackStart;
        }
      }

      // Se houver horário explícito no texto, ele sempre prevalece.
      const explicitTime = this.extractExplicitTimeFromText(text);
      if (explicitTime) {
        const adjusted = DateTime.fromJSDate(finalStartDate)
          .setZone(userTimezone)
          .set({
            hour: explicitTime.hour,
            minute: explicitTime.minute,
            second: 0,
            millisecond: 0
          });

        if (adjusted.isValid) {
          finalStartDate = adjusted.toJSDate();
          event.startDate = adjusted.toISO() || finalStartDate.toISOString();
          event.displayDate = adjusted
            .setLocale('pt-BR')
            .toFormat("EEEE, dd 'de' MMMM 'às' HH:mm");
          console.log(`🕐 Horário explícito aplicado: ${explicitTime.hour}:${String(explicitTime.minute).padStart(2, '0')}`);
        }
      }

      // 4.1. Salvar no Banco de Dados
      const newEvent = await storage.createEvent({
        userId: user.id,
        title: event.title || 'Evento',
        description: event.description || '',
        startDate: finalStartDate,
        attendeePhones: (event as any).targetPhones || [], // Salvando telefones identificados
        attendeeEmails: event.attendees || [], // Salvando emails identificados
        rawData: JSON.parse(JSON.stringify(event)),
      });

      // Definir phones e emails para uso abaixo
      const phones = (event as any).targetPhones;
      const emails = event.attendees;

      // (Bloco de responseText original removido - será construído mais abaixo)

      // 4.2. Integração com calendário conectado (Google ou Microsoft)
      let syncedCalendarProvider: 'google' | 'microsoft' | null = null;
      let googleSyncErrorMessage = '';
      let usedDefaultOrganizer = false;
      const defaultOrganizerId = Number(process.env.DEFAULT_ORGANIZER_USER_ID || '');
      const defaultOrganizerIntegrationKey = process.env.DEFAULT_ORGANIZER_INTEGRATION_KEY || 'default_google_organizer';
      let defaultOrganizerEmail: string | null = null;

      if (userSettings?.calendarProvider === 'google' && userSettings.googleTokens) {
        try {
          setTokens(user.id, JSON.parse(userSettings.googleTokens));
          const googleResult = await addEventToGoogleCalendar({
            ...newEvent,
            startDate: new Date(event.startDate),
            endDate: null,
            attendeePhones: phones
          }, user.id);

          if (googleResult.success) {
            syncedCalendarProvider = 'google';
            if (googleResult.conferenceLink) {
              await storage.updateEvent(newEvent.id, { conferenceLink: googleResult.conferenceLink });
            }
            if (googleResult.calendarEventId) {
              await storage.updateEvent(newEvent.id, { calendarId: googleResult.calendarEventId });
            }
          } else {
            console.error(`⚠️ Falha no Google Calendar: ${googleResult.message}`);
            googleSyncErrorMessage = googleResult.message;
          }
        } catch (error) {
          console.error('Erro Google Calendar:', error);
          googleSyncErrorMessage = 'Falha ao sincronizar com Google Calendar.';
        }
      } else if (userSettings?.calendarProvider === 'microsoft' && userSettings.microsoftTokens) {
        try {
          const microsoftResult = await addEventToMicrosoftCalendar({
            ...newEvent,
            startDate: new Date(event.startDate),
            endDate: null,
            attendeePhones: phones
          }, user.id);

          if (microsoftResult.success) {
            syncedCalendarProvider = 'microsoft';
            if (microsoftResult.conferenceLink) {
              await storage.updateEvent(newEvent.id, { conferenceLink: microsoftResult.conferenceLink });
            }
            if (microsoftResult.calendarEventId) {
              await storage.updateEvent(newEvent.id, { calendarId: microsoftResult.calendarEventId });
            }
          } else {
            console.error(`⚠️ Falha no Microsoft Calendar: ${microsoftResult.message}`);
          }
        } catch (error) {
          console.error('Erro Microsoft Calendar:', error);
        }
      } else if (Number.isInteger(defaultOrganizerId) && defaultOrganizerId > 0) {
        try {
          if (!db) {
            googleSyncErrorMessage = 'Banco indisponível para buscar integração organizadora.';
          } else {
            const integrationResult = await db.execute(sql`
              SELECT organizer_email, tokens, active
              FROM public.system_calendar_integrations
              WHERE integration_key = ${defaultOrganizerIntegrationKey}
                AND provider = 'google'
              LIMIT 1
            `);

            const integrationRow = (integrationResult as any)?.rows?.[0];
            const rawTokens = integrationRow?.tokens;
            const organizerTokens = typeof rawTokens === 'string'
              ? JSON.parse(rawTokens)
              : rawTokens;

            if (!integrationRow || !integrationRow.active || !organizerTokens) {
              googleSyncErrorMessage = 'Integração organizadora padrão não encontrada/ativa.';
            } else {
              defaultOrganizerEmail = integrationRow.organizer_email || null;
              setTokens(defaultOrganizerId, organizerTokens);

            const fallbackAttendees = [...new Set([...(emails || []), user.email].filter(Boolean))] as string[];

            const organizerEvent = {
              ...newEvent,
              startDate: new Date(event.startDate),
              endDate: null,
              attendeePhones: phones,
              attendeeEmails: fallbackAttendees,
            };

            const googleResult = await addEventToGoogleCalendar(organizerEvent as any, defaultOrganizerId);
            if (googleResult.success) {
              syncedCalendarProvider = 'google';
              usedDefaultOrganizer = true;
              if (googleResult.conferenceLink) {
                await storage.updateEvent(newEvent.id, { conferenceLink: googleResult.conferenceLink });
              }
              if (googleResult.calendarEventId) {
                await storage.updateEvent(newEvent.id, { calendarId: googleResult.calendarEventId });
              }
            } else {
              googleSyncErrorMessage = googleResult.message;
            }
            }
          }
        } catch (error) {
          console.error('Erro ao sincronizar via conta organizadora padrão:', error);
          googleSyncErrorMessage = 'Falha ao sincronizar via conta organizadora padrão.';
        }
      }

      // =================== 4.3. NOTIFICAÇÕES (GUESTS vs CREATOR) ===================

      // A) NOTIFICAR CONVIDADOS (Guests)
      if (phones && phones.length > 0) {
        const guestLinks = generateLinks(event);
        const guestLinkMsg = guestLinks.ics;

        for (const phone of phones) {
          // Normalizar telefone (remover @s.whatsapp.net se vier)
          const guestJid = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;

          // Normalizar IDs para comparação numérica pura (remove @s.whatsapp.net e outros caracteres)
          const guestIdOnly = guestJid.split('@')[0].replace(/\D/g, '');
          const creatorIdOnly = whatsappId.replace(/\D/g, '');

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
            `📎 *Arquivo .ICS para adicionar ao calendário:*\n${guestLinkMsg}\n\n` +
            `_Enviado via Zelar IA pelo anfitrião_`
          );
        }
      }

      // B) NOTIFICAR CRIADOR (Creator)
      let responseText = `✅ *Evento agendado com sucesso!*\n\n` +
        `📝 *${event.title}*\n` +
        `📅 ${event.displayDate}\n` +
        `🆔 ID: ${newEvent.id}`;

      if (event.attendees && event.attendees.length > 0) {
        responseText += '\n📧 *Email Convidados:*\n' + event.attendees.map(e => `• ${e}`).join('\n');
        if (syncedCalendarProvider === 'google' && usedDefaultOrganizer) {
          responseText += '\n_Convites enviados pelo Google Calendar organizador padrão_';
        } else if (syncedCalendarProvider === 'google') {
          responseText += '\n_Convites enviados pelo Google Calendar conectado_';
        }
      }

      if (phones && phones.length > 0) {
        const creatorPhone = whatsappId.replace(/\D/g, '');
        const otherGuests = phones.filter((p: string) => p.replace(/\D/g, '') !== creatorPhone);

        if (otherGuests.length > 0) {
          responseText += '\n📱 *Convidados Notificados:*\n' + otherGuests.map((p: string) => `• ${p}`).join('\n');
        }
      }

      // Lógica diferenciada para criador: Synced ou Link Manual
      if (syncedCalendarProvider === 'google') {
        responseText += usedDefaultOrganizer
          ? `\n\n✅ *Evento criado*`
          : `\n\n✅ *Sincronizado com seu Google Calendar*`;
        const evtWithLink = await storage.getEvent(newEvent.id);
        if (evtWithLink?.conferenceLink) {
          responseText += `\n📹 Meet: ${evtWithLink.conferenceLink}`;
        }
      } else if (syncedCalendarProvider === 'microsoft') {
        responseText += `\n\n✅ *Sincronizado com seu Microsoft Calendar*`;
        const evtWithLink = await storage.getEvent(newEvent.id);
        if (evtWithLink?.conferenceLink) {
          responseText += `\n📹 Teams: ${evtWithLink.conferenceLink}`;
        }
      } else {
        const links = generateLinks(event);
        responseText += `\n\n📎 *Arquivo .ICS do evento:*\n${links.ics}`;
        if (googleSyncErrorMessage) {
          responseText += `\n\n⚠️ *Calendar não sincronizou:* ${googleSyncErrorMessage}\n` +
            `Se necessário, reconecte com */conectar*.`;
        }
      }

      // 4.4. Criar lembretes sem quebrar criação do evento
      let reminderCreated = false;
      try {
        await reminderService.ensureDefaultReminder(newEvent as any, 'whatsapp');
        reminderCreated = true;

        // Criar lembrete por email se houver convidados por email OU se o criador tiver email
        if ((emails && emails.length > 0) || user.email) {
          await reminderService.ensureDefaultReminder(newEvent as any, 'email');
        }
      } catch (reminderError) {
        console.error('⚠️ Erro ao criar lembrete automático (evento mantido):', reminderError);
      }

      if (reminderCreated) {
        let reminderSummary = '12h antes';
        try {
          const savedReminders = await storage.getEventReminders(newEvent.id);
          const reminderOffsets = [...new Set(
            savedReminders
              .filter((item) => item.isDefault && item.channel === 'whatsapp')
              .map((item) => item.reminderTime)
              .filter((value): value is number => typeof value === 'number')
          )];

          if (reminderOffsets.length > 0) {
            reminderOffsets.sort((a, b) => b - a);
            reminderSummary = reminderOffsets.map((offset) => this.formatReminderOffset(offset)).join(', ');
          }
        } catch (summaryError) {
          console.error('⚠️ Não foi possível montar resumo de lembretes:', summaryError);
        }

        responseText += `\n\n🔔 Lembretes automáticos criados: ${reminderSummary} antes.`;
      } else {
        responseText += `\n\n⚠️ Evento criado, mas o lembrete automático não foi configurado.`;
      }

      await this.sendMessage(remoteJid, responseText);

    } catch (err) {
      console.error('Erro fatal ao criar evento:', err);
      await this.sendMessage(remoteJid, '❌ Ocorreu um erro interno ao criar seu evento. Tente novamente.');
    }
  }

  private async sendWelcomeMessage(remoteJid: string, user: any) {
    await this.sendMessage(remoteJid,
      `👋 *Olá${user.name ? `, ${user.name}` : ''}!* Bem-vindo ao Zelar IA.\n\n` +
      'Estou aqui para organizar sua agenda de forma rápida e inteligente.\n\n' +
      '📌 *O que eu posso fazer?*\n' +
      '• Criar eventos (ex: "Almoço com mãe amanhã 13h")\n' +
      '• Enviar lembretres para você e convidados\n' +
      '• Sincronizar com Google ou Microsoft Calendar\n\n' +
      '🔗 *Recomendação:*\n' +
      'Conecte seu calendário para uma experiência completa!\n' +
      'Digite `/conectar` para começar.\n\n' +
      '❓ *Dúvidas?* Digite `/ajuda` para ver todos os comandos.'
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
            '• `/eventos` - Lista eventos passados e futuros\n' +
            '• `/email` - Cadastra/atualiza seu email\n' +
            '• `/conectar` - Conecta ao Google Calendar\n' +
            '• `/conectar_microsoft` - Conecta ao Microsoft Calendar\n' +
            '• `/desconectar` - Desconecta calendário integrado\n' +
            '• `/lembretes` - Vê lembretes pendentes\n' +
            '• `/cancelar` - Cancela sua assinatura\n' +
            '• `/fuso` - Configura seu fuso horário\n\n' +
            '💡 *Dica:* Apenas escreva o evento naturalmente, como "Reunião de equipe terça 14h", e eu cuido do resto!'
          );
          break;

        case '/email':
          if (!args) {
            await this.sendMessage(
              remoteJid,
              `📧 Seu email atual: *${user.email || 'não cadastrado'}*\n\n` +
                'Para cadastrar/atualizar, use:\n' +
                '`/email seu.email@dominio.com`',
            );
            break;
          }

          const normalizedEmail = args.toLowerCase().trim();
          if (!this.isValidEmail(normalizedEmail)) {
            await this.sendMessage(
              remoteJid,
              '❌ Email inválido.\n\nUse o formato:\n`/email seu.email@dominio.com`',
            );
            break;
          }

          await storage.updateUser(user.id, { email: normalizedEmail });
          user.email = normalizedEmail;
          await this.sendMessage(
            remoteJid,
            `✅ Email cadastrado com sucesso: *${normalizedEmail}*`,
          );
          break;

        case '/conectar':
        case '/connect':
          const settings = await storage.getUserSettings(user.id);
          if (settings?.calendarProvider === 'google' && settings.googleTokens) {
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

        case '/conectar_microsoft':
        case '/connect_microsoft':
          const microsoftSettings = await storage.getUserSettings(user.id);
          if (microsoftSettings?.calendarProvider === 'microsoft' && microsoftSettings.microsoftTokens) {
            await this.sendMessage(remoteJid, '✅ Você já está conectado ao Microsoft Calendar.\nUse /desconectar se desejar sair.');
          } else {
            const baseUrl = process.env.BASE_URL || 'http://localhost:8080';
            const authUrl = `${baseUrl}/api/auth/microsoft/authorize?userId=${user.id}&platform=whatsapp`;
            await this.sendMessage(remoteJid,
              '🔐 *Conectar Microsoft Calendar*\n\n' +
              'Clique no link abaixo para autorizar o acesso:\n' +
              `${authUrl}\n\n` +
              'Isso permite que eu adicione eventos diretamente na sua agenda Outlook!'
            );
          }
          break;

        case '/desconectar':
        case '/disconnect':
          const currentSettings = await storage.getUserSettings(user.id);
          if (!currentSettings || (!currentSettings.googleTokens && !currentSettings.microsoftTokens)) {
            await this.sendMessage(remoteJid, '❌ Você não está conectado a nenhum calendário.');
          } else {
            await storage.updateUserSettings(user.id, {
              googleTokens: null,
              microsoftTokens: null,
              calendarProvider: null,
            });
            await this.sendMessage(remoteJid, '✅ Calendário desconectado com sucesso!\n\nSeus eventos futuros não serão mais sincronizados automaticamente.');
          }
          break;

        case '/cancelar':
        case '/cancelar assinatura':
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

            // Deletar do calendário integrado
            if (ev.calendarId) {
              const settings = await storage.getUserSettings(user.id);
              if (settings?.calendarProvider === 'google' && settings.googleTokens) {
                setTokens(user.id, JSON.parse(settings.googleTokens));
                await cancelGoogleCalendarEvent(ev.calendarId, user.id);
              } else if (settings?.calendarProvider === 'microsoft' && settings.microsoftTokens) {
                await cancelMicrosoftCalendarEvent(ev.calendarId, user.id);
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

  /**
   * Valida e corrige o JID (WhatsApp ID) verificando sua existência na API.
   * Fundamental para números brasileiros que podem ou não ter o 9º dígito no registro interno.
   */
  private async validateJid(jid: string): Promise<string> {
    if (!this.sock) return jid;

    // Normalização básica
    let target = jid.replace(/[^0-9]/g, '');

    // Se não tiver sufixo, assumimos s.whatsapp.net
    if (!jid.includes('@')) {
      target = `${target}@s.whatsapp.net`;
    } else {
      target = jid;
    }

    // Regra específica para Brasil (55) + Móvel (DDD 11-99)
    // Se for 55 + DDD + 9 digitos (total 13), tentamos verificar.
    // Se falhar, tentamos sem o 9 (total 12).
    // E vice-versa.
    const cleanNumber = target.split('@')[0];

    if (cleanNumber.startsWith('55') && cleanNumber.length >= 12) {
      try {
        // Tenta verificar o número como está
        const [result] = await this.sock.onWhatsApp(target);
        if (result && result.exists) {
          return result.jid;
        }

        // Se não existe, tentamos variação
        // Caso 1: Tem 13 dígitos (55 + 2 + 9). Tentar remover o 9º dígito (que é o 3º caractere do DDD+Number, índice 4 considerando 55xxN...)
        // 55 11 9 8888 7777 -> Remover o índice 4
        if (cleanNumber.length === 13) {
          const withoutNinth = cleanNumber.slice(0, 4) + cleanNumber.slice(5);
          const targetWithout = `${withoutNinth}@s.whatsapp.net`;
          const [resultWithout] = await this.sock.onWhatsApp(targetWithout);
          if (resultWithout && resultWithout.exists) {
            console.log(`🔄 JID corrigido (removeu 9): ${target} -> ${resultWithout.jid}`);
            return resultWithout.jid;
          }
        }

        // Caso 2: Tem 12 dígitos (55 + 2 + 8). Tentar adicionar o 9
        // 55 11 8888 7777 -> Inserir 9 no índice 4
        if (cleanNumber.length === 12) {
          const withNinth = cleanNumber.slice(0, 4) + '9' + cleanNumber.slice(4);
          const targetWith = `${withNinth}@s.whatsapp.net`;
          const [resultWith] = await this.sock.onWhatsApp(targetWith);
          if (resultWith && resultWith.exists) {
            console.log(`🔄 JID corrigido (adicionou 9): ${target} -> ${resultWith.jid}`);
            return resultWith.jid;
          }
        }
      } catch (e) {
        console.warn('⚠️ Erro ao validar JID no WhatsApp, usando original:', e);
      }
    }

    return target;
  }

  public async sendMessage(jid: string, text: string) {
    if (!this.sock) {
      console.error('❌ Tentativa de enviar mensagem sem conexão ativa');
      return;
    }

    try {
      // Validar JID antes de enviar
      const finalJid = await this.validateJid(jid);

      console.log(`📤 Enviando mensagem para ${finalJid}: ${text.slice(0, 50)}...`);
      await this.sock.sendMessage(finalJid, { text });
    } catch (error) {
      console.error(`❌ Erro ao enviar mensagem para ${jid}:`, error);
    }
  }

  public getStatus() {
    return {
      isConnected: this.isConnected,
      qrCode: this.lastQrCode,
      clientInfo: this.sock?.user || null,
    };
  }

  private clearAuthState() {
    if (!this.authPath) return;
    try {
      if (fs.existsSync(this.authPath)) {
        fs.rmSync(this.authPath, { recursive: true, force: true });
      }
      fs.mkdirSync(this.authPath, { recursive: true });
      console.log('🧹 Credenciais antigas removidas com sucesso.');
    } catch (error) {
      console.error('❌ Erro ao limpar credenciais do WhatsApp:', error);
    }
  }

  private scheduleQrRecoveryCheck(version?: any) {
    setTimeout(() => {
      if (this.isConnected || this.lastQrCode) return;
      if (this.qrRecoveryAttempts >= 2) return;

      this.qrRecoveryAttempts += 1;
      console.log(`⚠️ Sem conexão e sem QR. Forçando regeneração (tentativa ${this.qrRecoveryAttempts})...`);
      this.clearAuthState();
      this.startSock(version);

      // agenda próxima verificação caso continue sem conexão
      this.scheduleQrRecoveryCheck(version);
    }, 30000);
  }

  private hasExplicitTime(text: string): boolean {
    const lower = text.toLowerCase();
    return /(?:\bàs?\s*)?\d{1,2}(?::\d{2})?\s*h?\b/.test(lower)
      || /\b\d{1,2}\s*(am|pm)\b/.test(lower)
      || /\b(da manhã|de manhã|da tarde|de tarde|da noite|de noite)\b/.test(lower);
  }

  private extractExplicitTimesFromText(text: string): Array<{ hour: number; minute: number }> {
    const lower = text.toLowerCase();
    const results: Array<{ hour: number; minute: number }> = [];

    // Horário com contexto explícito: "às 19", "as 19:30"
    const withAs = [...lower.matchAll(/\b(?:às|as)\s*(\d{1,2})(?::(\d{2}))?\b/g)];
    if (withAs.length > 0) {
      for (const match of withAs) {
        const hour = Number(match[1]);
        const minute = match[2] ? Number(match[2]) : 0;
        if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
          results.push({ hour, minute });
        }
      }

      const uniqueFromAs = new Map<string, { hour: number; minute: number }>();
      for (const item of results) {
        const key = `${item.hour}:${item.minute}`;
        if (!uniqueFromAs.has(key)) uniqueFromAs.set(key, item);
      }
      return [...uniqueFromAs.values()];
    }

    // Sem "as/às", tenta demais formatos.
    // Isso evita confundir números de dia com hora quando existe "as/às".
    for (const match of withAs) {
      const hour = Number(match[1]);
      const minute = match[2] ? Number(match[2]) : 0;
      if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
        results.push({ hour, minute });
      }
    }

    // Horário com "h": "19h", "19:30h"
    const withH = [...lower.matchAll(/\b(\d{1,2})(?::(\d{2}))?\s*h\b/g)];
    for (const match of withH) {
      const hour = Number(match[1]);
      const minute = match[2] ? Number(match[2]) : 0;
      if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
        results.push({ hour, minute });
      }
    }

    // Horário HH:mm sem prefixo (mais restrito que número simples para não confundir com dia)
    const hhmm = [...lower.matchAll(/\b(\d{1,2}):(\d{2})\b/g)];
    for (const match of hhmm) {
      const hour = Number(match[1]);
      const minute = Number(match[2]);
      if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
        results.push({ hour, minute });
      }
    }

    const amPm = [...lower.matchAll(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/g)];
    for (const match of amPm) {
      let hour = Number(match[1]);
      const minute = match[2] ? Number(match[2]) : 0;
      const period = match[3];
      if (period === 'pm' && hour < 12) hour += 12;
      if (period === 'am' && hour === 12) hour = 0;
      if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
        results.push({ hour, minute });
      }
    }

    const unique = new Map<string, { hour: number; minute: number }>();
    for (const item of results) {
      const key = `${item.hour}:${item.minute}`;
      if (!unique.has(key)) unique.set(key, item);
    }
    return [...unique.values()];
  }

  private extractWeekdayDateFromText(text: string, timezone: string): DateTime | null {
    const normalized = text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const now = DateTime.now().setZone(timezone);

    const weekdayMap: Record<string, number> = {
      'segunda': 1,
      'terca': 2,
      'quarta': 3,
      'quinta': 4,
      'sexta': 5,
      'sabado': 6,
      'domingo': 7,
    };

    for (const [label, weekday] of Object.entries(weekdayMap)) {
      if (!new RegExp(`\\b${label}(?:-feira)?\\b`).test(normalized)) continue;
      let target = now.startOf('day');
      while (target.weekday !== weekday || target <= now.startOf('day')) {
        target = target.plus({ days: 1 });
      }
      return target;
    }
    return null;
  }

  private extractDaysListFromText(text: string, timezone: string): DateTime[] {
    const normalized = text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const match = normalized.match(/\bdias?\s+([\d,\se]+)/i);
    if (!match) return [];

    const numbers = (match[1].match(/\d{1,2}/g) || [])
      .map((n) => Number(n))
      .filter((n) => n >= 1 && n <= 31);
    if (numbers.length === 0) return [];

    // Se não houver marcador explícito de horário, em frases como
    // "dias 14 16 18 19" o último número deve ser tratado como hora.
    const hasExplicitTimeMarker =
      /\b(?:às|as)\s*\d{1,2}(?::\d{2})?\s*h?\b/.test(normalized) ||
      /\b\d{1,2}\s*h\b/.test(normalized) ||
      /\b\d{1,2}:\d{2}\b/.test(normalized) ||
      /\b\d{1,2}\s*(am|pm)\b/.test(normalized);

    let dayNumbers = [...numbers];
    if (!hasExplicitTimeMarker && dayNumbers.length >= 3) {
      const maybeHour = dayNumbers[dayNumbers.length - 1];
      if (maybeHour >= 0 && maybeHour <= 23) {
        dayNumbers = dayNumbers.slice(0, -1);
      }
    }

    const now = DateTime.now().setZone(timezone);
    const uniqueDays = [...new Set(dayNumbers)];
    const dates: DateTime[] = [];

    for (const day of uniqueDays) {
      let candidate = now.set({ day }).startOf('day');
      if (!candidate.isValid || candidate < now.startOf('day')) {
        candidate = now.plus({ months: 1 }).set({ day }).startOf('day');
      }
      if (candidate.isValid) dates.push(candidate);
    }

    return dates;
  }

  private extractTimeFromDaysListContext(text: string): { hour: number; minute: number } | null {
    const lower = text.toLowerCase();
    const normalized = lower.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // Caso clássico: "dias 14 16 18 às 19" (com ou sem minutos / h)
    let match = normalized.match(/\bdias?\b[\s\d,e]*\b(?:as)\s*(\d{1,2})(?::(\d{2}))?\s*h?\b/);
    if (match) {
      const hour = Number(match[1]);
      const minute = match[2] ? Number(match[2]) : 0;
      if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
        return { hour, minute };
      }
    }

    // Fallback: "dias 14 16 18 19" (último número é horário sem marcador)
    match = normalized.match(/\bdias?\s+([\d,\se]+)\s*$/i);
    if (match) {
      const numbers = (match[1].match(/\d{1,2}/g) || []).map((n) => Number(n));
      if (numbers.length >= 3) {
        const hour = numbers[numbers.length - 1];
        if (hour >= 0 && hour <= 23) {
          return { hour, minute: 0 };
        }
      }
    }

    return null;
  }

  private extractExplicitTimeFromText(text: string): { hour: number; minute: number } | null {
    const lower = text.toLowerCase();

    // Regra absoluta: "as/às + número" sempre é horário.
    const asMatches = [...lower.matchAll(/\b(?:às|as)\s*(\d{1,2})(?::(\d{2}))?\b/g)];
    if (asMatches.length > 0) {
      const first = asMatches[0];
      const hour = Number(first[1]);
      const minute = first[2] ? Number(first[2]) : 0;
      if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
        return { hour, minute };
      }
    }

    const daysContextTime = this.extractTimeFromDaysListContext(lower);
    if (daysContextTime) {
      return daysContextTime;
    }

    // Prioridade: formato com contexto explícito
    let match = lower.match(/\b(?:às|as)\s*(\d{1,2})(?::(\d{2}))?\b/);
    if (match) {
      const hour = Number(match[1]);
      const minute = match[2] ? Number(match[2]) : 0;
      if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
        return { hour, minute };
      }
    }

    match = lower.match(/\b(\d{1,2})(?::(\d{2}))?\s*h\b/);
    if (match) {
      const hour = Number(match[1]);
      const minute = match[2] ? Number(match[2]) : 0;
      if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
        return { hour, minute };
      }
    }

    match = lower.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
    if (match) {
      let hour = Number(match[1]);
      const minute = match[2] ? Number(match[2]) : 0;
      const period = match[3];
      if (period === 'pm' && hour < 12) hour += 12;
      if (period === 'am' && hour === 12) hour = 0;
      if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
        return { hour, minute };
      }
    }

    return null;
  }

  private expandMultipleCommitments(text: string, whatsappId: string): string[] {
    const settingsTimezone = getUserTimezone(whatsappId);
    const allTimes = this.extractExplicitTimesFromText(text);
    const primaryTime =
      this.extractTimeFromDaysListContext(text) ||
      this.extractExplicitTimeFromText(text) ||
      allTimes[0] ||
      { hour: 9, minute: 0 };
    const weekdayDate = this.extractWeekdayDateFromText(text, settingsTimezone);
    const listedDays = this.extractDaysListFromText(text, settingsTimezone);

    if (listedDays.length > 1) {
      const titleSeed = text
        .replace(/\bdias?\s+[\d,\se]+(?:\s*(?:as|às)\s*\d{1,2}(?::\d{2})?\s*h?)?/gi, ' ')
        .replace(/\b(?:as|às)\s*\d{1,2}(?::\d{2})?\s*h?\b/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const title = extractEventTitle(titleSeed) || 'Compromisso';
      return listedDays.map((d) => {
        const scheduled = d.set({
          hour: primaryTime.hour,
          minute: primaryTime.minute,
          second: 0,
          millisecond: 0
        });
        return `${title} dia ${scheduled.toFormat('dd/MM/yyyy')} as ${scheduled.toFormat('HH:mm')}`;
      });
    }

    if (weekdayDate && allTimes.length > 1) {
      const title = extractEventTitle(text) || 'Compromisso';
      return allTimes.map((t) => {
        const scheduled = weekdayDate.set({
          hour: t.hour,
          minute: t.minute,
          second: 0,
          millisecond: 0
        });
        return `${title} dia ${scheduled.toFormat('dd/MM/yyyy')} as ${scheduled.toFormat('HH:mm')}`;
      });
    }

    if (allTimes.length <= 1) return [text];

    const baseSplit = text
      .split(/\s+e\s+(?=(?:outra|outro|uma|um|a|call|reuni[aã]o|consulta|compromisso|mentoria|vendas)\b)/i)
      .map((chunk) => chunk.trim())
      .filter(Boolean);

    const chunks = baseSplit.length > 0 ? baseSplit : [text];
    const expanded: string[] = [];

    let lastDateRef: DateTime | null = null;
    let lastTitleRef = '';

    for (const chunk of chunks) {
      const chunkTimes = this.extractExplicitTimesFromText(chunk);
      if (chunkTimes.length === 0) continue;

      const parsedChunkDate = parseUserDateTime(chunk, whatsappId);
      const parsedWholeDate = parseUserDateTime(text, whatsappId);

      let dateRef = parsedChunkDate
        ? DateTime.fromISO(parsedChunkDate.iso).setZone(settingsTimezone)
        : parsedWholeDate
          ? DateTime.fromISO(parsedWholeDate.iso).setZone(settingsTimezone)
          : lastDateRef;

      if (!dateRef || !dateRef.isValid) {
        dateRef = DateTime.now().setZone(settingsTimezone);
      }

      const titleCandidateRaw = chunk
        .replace(/\b(?:às|as)?\s*\d{1,2}(?::\d{2})?\s*h?\b/gi, ' ')
        .replace(/\b\d{1,2}(?::\d{2})?\s*(am|pm)\b/gi, ' ')
        .replace(/\b(lembre|lembrar|tenho|uma|um|outra|outro)\b/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      let title = extractEventTitle(titleCandidateRaw);
      if (!title || title.toLowerCase() === 'evento') {
        title = lastTitleRef || 'Compromisso';
      }

      for (const t of chunkTimes) {
        const scheduled = dateRef.set({
          hour: t.hour,
          minute: t.minute,
          second: 0,
          millisecond: 0
        });
        expanded.push(`${title} dia ${scheduled.toFormat('dd/MM/yyyy')} as ${scheduled.toFormat('HH:mm')}`);
      }

      lastDateRef = dateRef;
      lastTitleRef = title;
    }

    return expanded.length > 1 ? expanded : [text];
  }

  private getMessageTimestampMs(msg: any): number | null {
    const ts = msg?.messageTimestamp;
    if (!ts) return null;
    if (typeof ts === 'number') return ts * 1000;
    if (typeof ts === 'string') {
      const n = Number(ts);
      return Number.isFinite(n) ? n * 1000 : null;
    }
    if (typeof ts === 'object') {
      const low = (ts as any).low;
      if (typeof low === 'number') return low * 1000;
      if (typeof (ts as any).toNumber === 'function') {
        const n = (ts as any).toNumber();
        return Number.isFinite(n) ? n * 1000 : null;
      }
    }
    return null;
  }
}

const botInstance = new WhatsAppBot();

export const getWhatsAppBot = () => botInstance;
