
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  BaileysEventMap,
  jidNormalizedUser,
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
  parseUserDateTime,
  hasExplicitCalendarDateInText,
} from '../services/dateService';
import { storage } from '../storage';
import {
  addEventToGoogleCalendar,
  cancelGoogleCalendarEvent,
  listUpcomingEvents as listGoogleUpcomingEvents,
  listGooglePrimaryFutureEventsPaginated,
  listGoogleEventsInTimeRange,
  setTokens
} from '../telegram/googleCalendarIntegration';
import {
  addEventToMicrosoftCalendar,
  cancelMicrosoftCalendarEvent,
  listUpcomingMicrosoftEvents,
  listMicrosoftCalendarViewInRange,
} from '../telegram/microsoftCalendarIntegration';
import { reminderService } from '../services/reminderService';
import { emailService } from '../services/emailService';
import { db } from '../db';
import { parseDeleteCommandWithOpenRouter } from '../utils/openRouterCommandParser';
import { detectMessageType } from '../utils/detectMessageType';
import { extractPlainTextFromWhatsAppMessage } from '../utils/whatsappPlainText';
import type { UserGuestContactRow } from '../storage';
import { extractEmails, filterPlausibleGuestEmails } from '../utils/attendeeExtractor';
import { extractPhonesFromWrittenAndSpoken, isPlaceholderOrFakePhoneDigits } from '../utils/phoneExtraction';
import { resolveGuestEmailsFromAliases, resolveGuestPhonesFromAliases } from '../services/guestContactAliasService';
import { resolveGuestEmailsAndPhonesFromGroups } from '../services/guestContactGroupService';
import { signPanelToken } from '../utils/panelToken';
import { applyCanonicalAndFuzzyGuestEmails } from '../services/guestSavedEmailService';
import { normalizeTranscriptionForCalendarText } from '../utils/transcriptionNormalize';
import { randomUUID } from 'crypto';
import type { UserSettings, Event } from '@shared/schema';
import { buildLessonCalendarTitle } from '../services/pluggy/lessonTitle';
import { resolveLessonUnitCents, resolveLessonUnitCentsForAllocation } from '../services/pluggy/lessonUnitPrice';
import { tryParseBulkLessonSchedule } from './bulkLessonSchedule';
import { extractComGuestNameFromText } from './extractComGuestName';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function disconnectReasonLabel(code: number | undefined): string {
  if (code === undefined) return 'indefinido';
  const known: Record<number, string> = {
    [DisconnectReason.badSession]: 'badSession',
    [DisconnectReason.connectionClosed]: 'connectionClosed',
    [DisconnectReason.connectionLost]: 'connectionLost',
    [DisconnectReason.connectionReplaced]: 'connectionReplaced',
    [DisconnectReason.loggedOut]: 'loggedOut',
    [DisconnectReason.restartRequired]: 'restartRequired',
    [DisconnectReason.multideviceMismatch]: 'multideviceMismatch',
    [DisconnectReason.forbidden]: 'forbidden',
    [DisconnectReason.unavailableService]: 'unavailableService',
  };
  return known[code] ?? `codigo_${code}`;
}

function baileysLogger() {
  const level =
    process.env.WHATSAPP_BAILEYS_LOG_LEVEL ||
    (process.env.WHATSAPP_DEBUG_LOGS === 'true' ? 'info' : 'warn');
  return pino({ level }) as any;
}

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
  private pendingDeleteAllConfirmations = new Map<string, { userId: number; targetTitle: string; createdAtMs: number }>();
  private pendingPixConfirmations = new Map<
    string,
    { userId: number; contactId: number; payerLabel: string; amountCents: number; createdAtMs: number }
  >();
  private activeRunByJid = new Map<string, number>();
  private lastReconnectScheduledAt = 0;

  /** Contexto compartilhado ao expandir um pacote de aulas em várias mensagens sequenciais */
  private pendingPackBatchContext: {
    packGroupId: string;
    studentContactId: number | null;
    studentDisplayName: string;
    baseTitle: string;
    packUnitPriceCents: number | null;
    packId: string | null;
  } | null = null;

  private closePreviousSocket(reason: string): void {
    const s = this.sock;
    if (!s) return;
    console.log(`[WhatsApp] Encerrando socket anterior (${reason})`);
    try {
      s.end(undefined);
    } catch (e) {
      console.warn('[WhatsApp] Falha ao encerrar socket (ignorado):', e);
    }
    this.sock = null;
  }

  private parseStrictYesNo(text: string): 'yes' | 'no' | 'unknown' {
    const normalized = text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (['s', 'sim', 'yes', 'y'].includes(normalized)) return 'yes';
    if (['n', 'nao', 'no'].includes(normalized)) return 'no';
    return 'unknown';
  }

  private hasExplicitDeleteVerb(text: string): boolean {
    const normalized = text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    return /\b(cancele|cancelar|apague|apagar|deletar|delete|remova|remover|exclua|excluir)\b/.test(normalized);
  }

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
    this.closePreviousSocket('reinício de sessão Baileys');

    this.socketStartedAtMs = Date.now();
    this.sock = makeWASocket({
      version: version,
      printQRInTerminal: false,
      auth: this.authState,
      logger: baileysLogger(),
      browser: ['Zelar IA', 'Chrome', '1.0.0'],
    });

    this.sock.ev.on('creds.update', this.saveCreds);

    this.sock.ev.on('connection.update', (update: any) => {
      const { connection, lastDisconnect, qr } = update;
      const boom = lastDisconnect?.error as Boom | undefined;
      const statusCode = boom?.output?.statusCode;

      if (process.env.WHATSAPP_VERBOSE_CONNECTION === 'true') {
        console.log('[WhatsApp] connection.update', {
          connection,
          statusCode,
          reason: statusCode !== undefined ? disconnectReasonLabel(statusCode) : undefined,
          boomMessage: boom?.message,
          hasQr: Boolean(qr),
          at: new Date().toISOString(),
        });
      }

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
        const isLoggedOut = statusCode === DisconnectReason.loggedOut;
        const reasonLabel = disconnectReasonLabel(statusCode);
        console.log(
          `[WhatsApp] Conexão fechada | ${new Date().toISOString()} | motivo=${reasonLabel} (${statusCode}) | boom=${boom?.message || 'n/a'}`,
        );
        if (boom?.stack) {
          console.log('[WhatsApp] stack:', boom.stack);
        }

        if (isLoggedOut) {
          console.log('🔓 Sessão WhatsApp encerrada (loggedOut). Limpando credenciais e gerando novo QR...');
          this.clearAuthState();
          setTimeout(() => this.initialize(), 1000);
          return;
        }

        const delay = Math.max(
          1000,
          Number.parseInt(process.env.WHATSAPP_RECONNECT_DELAY_MS || '4000', 10) || 4000,
        );
        const now = Date.now();
        if (now - this.lastReconnectScheduledAt < 1500) {
          console.warn('[WhatsApp] Reconexão ignorada (debounce) — já há uma agendada.');
          return;
        }
        this.lastReconnectScheduledAt = now;
        console.log(`[WhatsApp] Reagendando reconexão em ${delay}ms...`);
        setTimeout(() => {
          this.startSock(version);
        }, delay);
      } else if (connection === 'open') {
        this.isConnected = true;
        this.lastQrCode = null;
        this.qrRecoveryAttempts = 0;
        console.log(`✅ Conexão WhatsApp aberta | ${new Date().toISOString()}`);
      } else if (connection === 'connecting') {
        console.log(`[WhatsApp] Conectando... | ${new Date().toISOString()}`);
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
          const incomingType = detectMessageType(msg);
          if (incomingType !== 'text') {
            await this.sendMessage(
              msg.key.remoteJid,
              '📝 *Somente texto*\n\n' +
                'Neste modo o Zelar aceita *apenas mensagens digitadas*. Não processamos áudio, imagem, vídeo, documento, figurinha, contato ou localização. Envie o pedido em texto.',
            );
            continue;
          }

          const text = extractPlainTextFromWhatsAppMessage(msg)?.trim() || null;
          if (!text) {
            continue;
          }

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

  private async getOrCreateUser(whatsappId: string, name?: string): Promise<{ user: any; created: boolean }> {
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
      return { user, created: true };
    }
    return { user, created: false };
  }

  private normalizeForComparison(value: string): string {
    let v = value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    v = v.replace(/\bauals\b/g, 'aula');
    v = v.replace(/\baulas\b/g, 'aula');
    v = v.replace(/\s*·\s*aluno\s*\([^)]*\)\s*$/i, '');
    v = v.replace(/\s*aluno\s*\([^)]*\)\s*$/i, '');
    return v;
  }

  /** Links do painel: entrar (e-mail+senha) e criar senha com token (identifica o WhatsApp sem pedir número na tela). */
  private panelLinkInMessage(user: { id: number; username: string }): string {
    const base = (process.env.BASE_URL || 'http://localhost:8080').replace(/\/+$/, '');
    const entrar = `${base}/painel/entrar`;
    try {
      const tok = signPanelToken(user.id, user.username);
      const criarSenha = `${base}/painel/registro?t=${encodeURIComponent(tok)}`;
      return (
        `🔐 *Entrar:* ${entrar}\n` +
        `📝 *Criar senha e salvar e-mail (link seguro da sua conta):*\n${criarSenha}`
      );
    } catch {
      return (
        `🔐 *Entrar:* ${entrar}\n` +
        `⚠️ Link de criar senha indisponível — configure *PANEL_TOKEN_SECRET* no servidor.`
      );
    }
  }

  private calculateTitleSimilarity(left: string, right: string): number {
    const l = this.normalizeForComparison(left);
    const r = this.normalizeForComparison(right);
    if (!l || !r) return 0;
    if (l === r) return 1;
    if (l.includes(r) || r.includes(l)) return 0.92;

    const leftTokens = new Set(l.split(' ').filter((token) => token.length > 2));
    const rightTokens = new Set(r.split(' ').filter((token) => token.length > 2));
    if (leftTokens.size === 0 || rightTokens.size === 0) return 0;

    let intersections = 0;
    for (const token of leftTokens) {
      if (rightTokens.has(token)) intersections += 1;
    }
    return intersections / Math.max(leftTokens.size, rightTokens.size);
  }

  private findEventsByTitle(events: any[], targetTitle: string, targetDateISO?: string | null): any[] {
    const targetDateMs = targetDateISO ? DateTime.fromISO(targetDateISO).toMillis() : null;

    return events
      .map((event) => ({
        event,
        score: this.calculateTitleSimilarity(event.title || '', targetTitle),
      }))
      .filter((item) => item.score >= 0.45)
      .sort((a, b) => {
        if (targetDateMs) {
          const aDistance = Math.abs(new Date(a.event.startDate).getTime() - targetDateMs);
          const bDistance = Math.abs(new Date(b.event.startDate).getTime() - targetDateMs);
          if (aDistance !== bDistance) return aDistance - bDistance;
        }

        const scoreDelta = b.score - a.score;
        if (Math.abs(scoreDelta) > 0.001) return scoreDelta;
        return new Date(a.event.startDate).getTime() - new Date(b.event.startDate).getTime();
      })
      .map((item) => item.event);
  }

  private getDeletionSourcePriority(source: 'both' | 'calendar_only' | 'db_local'): number {
    if (source === 'both') return 3;
    if (source === 'calendar_only') return 2;
    return 1;
  }

  /** Carrega tokens OAuth da linha system_calendar_integrations e aplica no cache google (oauthUserId). */
  private async applyZelarIntegrationGoogleTokens(
    integrationKey: string,
    oauthUserId: number,
  ): Promise<boolean> {
    if (!db) return false;
    try {
      const integrationResult = await db.execute(sql`
        SELECT tokens, active
        FROM public.system_calendar_integrations
        WHERE integration_key = ${integrationKey}
          AND provider = 'google'
        LIMIT 1
      `);
      const row = (integrationResult as { rows?: { tokens: unknown; active: boolean }[] })?.rows?.[0];
      if (!row || !row.active) return false;
      const raw = row.tokens;
      const tokens = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!tokens || (!tokens.access_token && !tokens.refresh_token)) return false;
      setTokens(oauthUserId, tokens);
      return true;
    } catch (e) {
      console.error('applyZelarIntegrationGoogleTokens:', e);
      return false;
    }
  }

  /**
   * Eventos na agenda Google da conta de serviço (Zelar) em que o e-mail do usuário aparece como participante.
   * Permite apagar convites enviados pela conta zelar.ia.messages mesmo sem Google conectado no painel.
   */
  private async listZelarOrganizerEventsWhereUserIsAttendee(userEmail: string): Promise<
    Array<{
      provider: 'google';
      calendarId: string;
      title: string;
      startDate: Date;
      googleCancelOAuthUserId: number;
      serviceGoogleIntegrationKey: string;
    }>
  > {
    const norm = userEmail.trim().toLowerCase();
    if (!norm || !db) return [];

    const zelarKey = process.env.ZELAR_CALENDAR_INTEGRATION_KEY?.trim() || 'zelar_google_invites';
    const zelarOAuthId = Number(process.env.ZELAR_CALENDAR_OAUTH_USER_ID || '999001');
    const attempts: { key: string; oauthId: number }[] = [{ key: zelarKey, oauthId: zelarOAuthId }];

    const defaultOrganizerId = Number(process.env.DEFAULT_ORGANIZER_USER_ID || '');
    const defaultOrganizerIntegrationKey =
      process.env.DEFAULT_ORGANIZER_INTEGRATION_KEY || 'default_google_organizer';
    if (Number.isInteger(defaultOrganizerId) && defaultOrganizerId > 0) {
      if (defaultOrganizerIntegrationKey !== zelarKey || defaultOrganizerId !== zelarOAuthId) {
        attempts.push({ key: defaultOrganizerIntegrationKey, oauthId: defaultOrganizerId });
      }
    }

    const seen = new Set<string>();
    const out: Array<{
      provider: 'google';
      calendarId: string;
      title: string;
      startDate: Date;
      googleCancelOAuthUserId: number;
      serviceGoogleIntegrationKey: string;
    }> = [];

    for (const { key, oauthId } of attempts) {
      if (!(await this.applyZelarIntegrationGoogleTokens(key, oauthId))) continue;
      const response = await listGooglePrimaryFutureEventsPaginated(oauthId, 2500);
      if (!response.success || !response.events) continue;
      for (const ev of response.events) {
        const id = ev?.id as string | undefined;
        if (!id || seen.has(id)) continue;
        const attendees = ev?.attendees as { email?: string }[] | undefined;
        const isAttendee = attendees?.some((a) => (a?.email || '').toLowerCase().trim() === norm);
        if (!isAttendee) continue;
        seen.add(id);
        const startRaw = ev?.start?.dateTime || ev?.start?.date;
        const startDate = startRaw ? new Date(startRaw as string) : null;
        if (!startDate || Number.isNaN(startDate.getTime())) continue;
        out.push({
          provider: 'google',
          calendarId: String(id),
          title: String(ev.summary || 'Evento'),
          startDate,
          googleCancelOAuthUserId: oauthId,
          serviceGoogleIntegrationKey: key,
        });
      }
    }
    return out;
  }

  private buildDeletionCandidates(
    dbEvents: any[],
    calendarEvents: Array<{
      provider: 'google' | 'microsoft';
      calendarId: string;
      title: string;
      startDate: Date;
      googleCancelOAuthUserId?: number;
      serviceGoogleIntegrationKey?: string;
    }>,
    /** Provedor conectado no painel; usado ao cruzar DB+Google quando o evento não veio na listagem. */
    userCalendarProvider: 'google' | 'microsoft' | null,
  ): {
    candidates: Array<{
      source: 'both' | 'calendar_only' | 'db_local';
      provider: 'google' | 'microsoft' | null;
      calendarId?: string;
      title: string;
      startDate: Date;
      dbEvent?: any;
      googleCancelOAuthUserId?: number;
      serviceGoogleIntegrationKey?: string;
    }>;
    bothCount: number;
    calendarOnlyCount: number;
    dbLocalCount: number;
    dbStaleCount: number;
  } {
    const calendarById = new Map<
      string,
      {
        provider: 'google' | 'microsoft';
        calendarId: string;
        title: string;
        startDate: Date;
        googleCancelOAuthUserId?: number;
        serviceGoogleIntegrationKey?: string;
      }
    >();
    for (const item of calendarEvents) {
      if (item.calendarId) {
        calendarById.set(item.calendarId, item);
      }
    }

    const matchedCalendarIds = new Set<string>();
    const candidates: Array<{
      source: 'both' | 'calendar_only' | 'db_local';
      provider: 'google' | 'microsoft' | null;
      calendarId?: string;
      title: string;
      startDate: Date;
      dbEvent?: any;
      googleCancelOAuthUserId?: number;
      serviceGoogleIntegrationKey?: string;
    }> = [];

    let bothCount = 0;
    let dbLocalCount = 0;
    let dbStaleCount = 0;

    for (const dbEvent of dbEvents) {
      if (dbEvent.calendarId) {
        const calendarMatch = calendarById.get(dbEvent.calendarId);
        if (calendarMatch) {
          bothCount += 1;
          matchedCalendarIds.add(dbEvent.calendarId);
          candidates.push({
            source: 'both',
            provider: calendarMatch.provider,
            calendarId: calendarMatch.calendarId,
            title: dbEvent.title || calendarMatch.title,
            startDate: new Date(dbEvent.startDate || calendarMatch.startDate),
            dbEvent,
            googleCancelOAuthUserId: calendarMatch.googleCancelOAuthUserId,
            serviceGoogleIntegrationKey: calendarMatch.serviceGoogleIntegrationKey,
          });
        } else {
          // Existe no banco com calendarId, mas não entrou na lista (limite da API / timing).
          // Ainda assim tentamos cancelar no Google/Microsoft pelo ID salvo + soft-cancel no DB.
          dbStaleCount += 1;
          if (dbEvent.calendarId) {
            const provider: 'google' | 'microsoft' =
              userCalendarProvider === 'microsoft' ? 'microsoft' : 'google';
            candidates.push({
              source: 'both',
              provider,
              calendarId: String(dbEvent.calendarId),
              title: dbEvent.title || 'Evento',
              startDate: new Date(dbEvent.startDate),
              dbEvent,
            });
          }
        }
      } else {
        // Evento local sem calendarId (não sincronizado com Google/Microsoft).
        dbLocalCount += 1;
        candidates.push({
          source: 'db_local',
          provider: null,
          title: dbEvent.title,
          startDate: new Date(dbEvent.startDate),
          dbEvent,
        });
      }
    }

    let calendarOnlyCount = 0;
    for (const item of calendarEvents) {
      if (!item.calendarId || matchedCalendarIds.has(item.calendarId)) continue;
      calendarOnlyCount += 1;
      candidates.push({
        source: 'calendar_only',
        provider: item.provider,
        calendarId: item.calendarId,
        title: item.title,
        startDate: new Date(item.startDate),
        googleCancelOAuthUserId: item.googleCancelOAuthUserId,
        serviceGoogleIntegrationKey: item.serviceGoogleIntegrationKey,
      });
    }

    return {
      candidates,
      bothCount,
      calendarOnlyCount,
      dbLocalCount,
      dbStaleCount,
    };
  }

  private async getCalendarEventsForDeletion(
    user: any,
    cachedSettings?: Awaited<ReturnType<typeof storage.getUserSettings>>,
  ): Promise<
    Array<{
      provider: 'google' | 'microsoft';
      calendarId: string;
      title: string;
      startDate: Date;
      googleCancelOAuthUserId?: number;
      serviceGoogleIntegrationKey?: string;
    }>
  > {
    type Row = {
      provider: 'google' | 'microsoft';
      calendarId: string;
      title: string;
      startDate: Date;
      googleCancelOAuthUserId?: number;
      serviceGoogleIntegrationKey?: string;
    };

    const merged: Row[] = [];
    const pushDedupe = (row: Row) => {
      if (!row.calendarId) return;
      if (!merged.some((r) => r.calendarId === row.calendarId)) merged.push(row);
    };

    const settings = cachedSettings ?? (await storage.getUserSettings(user.id));

    if (settings?.calendarProvider === 'google' && settings.googleTokens) {
      try {
        setTokens(user.id, JSON.parse(settings.googleTokens));
        const response = await listGooglePrimaryFutureEventsPaginated(user.id, 3500);
        if (response.success && response.events) {
          for (const event of response.events) {
            const startRaw = event?.start?.dateTime || event?.start?.date;
            const startDate = startRaw ? new Date(startRaw) : null;
            if (!event?.id || !startDate || Number.isNaN(startDate.getTime())) continue;
            pushDedupe({
              provider: 'google',
              calendarId: String(event.id),
              title: String(event.summary || 'Evento'),
              startDate,
            });
          }
        }
      } catch (error) {
        console.error('Erro ao listar eventos Google para cruzamento:', error);
      }
    }

    if (settings?.calendarProvider === 'microsoft' && settings.microsoftTokens) {
      try {
        const response = await listUpcomingMicrosoftEvents(user.id, 999);
        if (response.success && response.events) {
          for (const event of response.events) {
            const startRaw = event?.start?.dateTime;
            const startDate = startRaw ? new Date(startRaw) : null;
            if (!event?.id || !startDate || Number.isNaN(startDate.getTime())) continue;
            pushDedupe({
              provider: 'microsoft',
              calendarId: String(event.id),
              title: String(event.subject || 'Evento'),
              startDate,
            });
          }
        }
      } catch (error) {
        console.error('Erro ao listar eventos Microsoft para cruzamento:', error);
      }
    }

    const email = typeof user?.email === 'string' ? user.email.trim() : '';
    if (email) {
      const zelarRows = await this.listZelarOrganizerEventsWhereUserIsAttendee(email);
      for (const r of zelarRows) {
        pushDedupe(r);
      }
    }

    return merged;
  }

  private async getDeletionCandidates(user: any): Promise<{
    candidates: Array<{
      source: 'both' | 'calendar_only' | 'db_local';
      provider: 'google' | 'microsoft' | null;
      calendarId?: string;
      title: string;
      startDate: Date;
      dbEvent?: any;
      googleCancelOAuthUserId?: number;
      serviceGoogleIntegrationKey?: string;
    }>;
    bothCount: number;
    calendarOnlyCount: number;
    dbLocalCount: number;
    dbStaleCount: number;
  }> {
    const settings = await storage.getUserSettings(user.id);
    const userCalendarProvider =
      settings?.calendarProvider === 'microsoft'
        ? 'microsoft'
        : settings?.calendarProvider === 'google'
          ? 'google'
          : null;

    const [dbEvents, calendarEvents] = await Promise.all([
      storage.getActiveEventsForDeletionWindow(user.id, 2500),
      this.getCalendarEventsForDeletion(user, settings ?? undefined),
    ]);

    return this.buildDeletionCandidates(dbEvents, calendarEvents, userCalendarProvider);
  }

  private async deleteCandidate(
    user: any,
    candidate: {
      source: 'both' | 'calendar_only' | 'db_local';
      provider: 'google' | 'microsoft' | null;
      calendarId?: string;
      title: string;
      startDate: Date;
      dbEvent?: any;
      googleCancelOAuthUserId?: number;
      serviceGoogleIntegrationKey?: string;
    },
  ): Promise<void> {
    if ((candidate.source === 'both' || candidate.source === 'calendar_only') && candidate.calendarId) {
      if (candidate.provider === 'google') {
        const oauthUid = candidate.googleCancelOAuthUserId ?? user.id;
        if (
          candidate.googleCancelOAuthUserId != null &&
          candidate.serviceGoogleIntegrationKey
        ) {
          await this.applyZelarIntegrationGoogleTokens(
            candidate.serviceGoogleIntegrationKey,
            oauthUid,
          );
        } else {
          const settings = await storage.getUserSettings(user.id);
          if (settings?.googleTokens) {
            setTokens(user.id, JSON.parse(settings.googleTokens));
          }
        }
        await cancelGoogleCalendarEvent(candidate.calendarId, oauthUid);
      } else if (candidate.provider === 'microsoft') {
        await cancelMicrosoftCalendarEvent(candidate.calendarId, user.id);
      }
    }

    if ((candidate.source === 'both' || candidate.source === 'db_local') && candidate.dbEvent?.id) {
      const ev = await storage.getEvent(candidate.dbEvent.id);
      if (ev && !ev.cancelledAt) {
        const { applyLessonBalanceCreditBeforeSoftCancel } = await import('../services/lessonCancellationCredit');
        await applyLessonBalanceCreditBeforeSoftCancel(user.id, ev);
      }
      await reminderService.deleteEventReminders(candidate.dbEvent.id);
      await storage.softCancelEvent(candidate.dbEvent.id);
    }
  }

  private async deleteEventFromIntegrationsAndDb(user: any, event: any): Promise<void> {
    if (event.calendarId) {
      const settings = await storage.getUserSettings(user.id);
      let removedGoogle = false;

      if (settings?.calendarProvider === 'google' && settings.googleTokens) {
        setTokens(user.id, JSON.parse(settings.googleTokens));
        const r = await cancelGoogleCalendarEvent(event.calendarId, user.id);
        removedGoogle = r.success;
      } else if (settings?.calendarProvider === 'microsoft' && settings.microsoftTokens) {
        await cancelMicrosoftCalendarEvent(event.calendarId, user.id);
      }

      if (!removedGoogle && typeof user?.email === 'string' && user.email.trim()) {
        const zelarKey = process.env.ZELAR_CALENDAR_INTEGRATION_KEY?.trim() || 'zelar_google_invites';
        const zelarOAuthId = Number(process.env.ZELAR_CALENDAR_OAUTH_USER_ID || '999001');
        const attempts: { key: string; oauthId: number }[] = [{ key: zelarKey, oauthId: zelarOAuthId }];
        const defaultOrganizerId = Number(process.env.DEFAULT_ORGANIZER_USER_ID || '');
        const defaultOrganizerIntegrationKey =
          process.env.DEFAULT_ORGANIZER_INTEGRATION_KEY || 'default_google_organizer';
        if (Number.isInteger(defaultOrganizerId) && defaultOrganizerId > 0) {
          if (defaultOrganizerIntegrationKey !== zelarKey || defaultOrganizerId !== zelarOAuthId) {
            attempts.push({ key: defaultOrganizerIntegrationKey, oauthId: defaultOrganizerId });
          }
        }
        for (const { key, oauthId } of attempts) {
          if (await this.applyZelarIntegrationGoogleTokens(key, oauthId)) {
            const r = await cancelGoogleCalendarEvent(event.calendarId, oauthId);
            if (r.success) break;
          }
        }
      }
    }

    await reminderService.deleteEventReminders(event.id);
    const full = await storage.getEvent(event.id);
    if (full && !full.cancelledAt) {
      const { applyLessonBalanceCreditBeforeSoftCancel } = await import('../services/lessonCancellationCredit');
      await applyLessonBalanceCreditBeforeSoftCancel(user.id, full);
    }
    await storage.softCancelEvent(event.id);
  }

  private async handleMessage(
    remoteJid: string,
    whatsappId: string,
    text: string,
    msg: any,
    fromBatch = false,
    runId?: number,
    batchLessonIndex?: number,
    batchLessonTotal?: number,
    suppressSuccessReply = false,
  ) {
    if (!fromBatch) {
      const nextRunId = (this.activeRunByJid.get(remoteJid) || 0) + 1;
      this.activeRunByJid.set(remoteJid, nextRunId);
      runId = nextRunId;
    }

    const currentRunId = runId ?? this.activeRunByJid.get(remoteJid) ?? 0;
    const isRunStillActive = () => this.activeRunByJid.get(remoteJid) === currentRunId;

    const { user, created } = await this.getOrCreateUser(whatsappId, msg.pushName);
    const command = text.split(' ')[0].toLowerCase();
    const args = text.substring(command.length).trim();

    // =========================================================================
    // 1. VERIFICAÇÃO ESTRITA DE ASSINATURA (PREMIUM CHECK)
    // =========================================================================
    if (user.subscriptionStatus !== 'active') {
      console.log(`🚫 Usuário ${user.username} sem assinatura ativa. Enviando painel + pagamento.`);

      await this.sendMessage(remoteJid,
        '⚠️ *Assinatura necessária*\n\n' +
        '🎛️ Abra seu *painel Zelar* para assinar e configurar e-mail, calendário e convidados — *sem usar comandos com barra* (/):\n' +
        `${this.panelLinkInMessage(user)}\n\n` +
        'No painel use o botão para pagar com Stripe. Depois do pagamento seu acesso libera automaticamente.',
      );
      return; // Bloqueia qualquer outra interação
    }

    if (created) {
      await this.sendMessage(
        remoteJid,
        '👋 *Conta criada!*\n\n' +
          '🎛️ Guarde o link do seu painel — por lá você ajusta e-mail, fuso, Google/Microsoft e convidados sem precisar de comandos / no WhatsApp:\n' +
          this.panelLinkInMessage(user),
      );
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
      '/aula',
      '/aulas',
      '/buscar',
    ]);

    if (!user.email && !allowedWithoutEmail.has(command)) {
      await this.sendMessage(
        remoteJid,
        '📧 *E-mail obrigatório*\n\n' +
          'Cadastre no seu painel (sem comandos /):\n' +
          this.panelLinkInMessage(user),
      );
      return;
    }

    const userSettings = await storage.getUserSettings(user.id);
    const userTimezone = userSettings?.timeZone || getUserTimezone(whatsappId);

    // =========================================================================
    // 1.45. CONFIRMAÇÃO PIX (MVP FINANÇAS)
    // =========================================================================
    const pixPending = this.pendingPixConfirmations.get(remoteJid);
    if (pixPending) {
      const pixTtlMs = 15 * 60 * 1000;
      if (Date.now() - pixPending.createdAtMs > pixTtlMs) {
        this.pendingPixConfirmations.delete(remoteJid);
      } else if (text.startsWith('/')) {
        this.pendingPixConfirmations.delete(remoteJid);
      } else {
        const yn = this.parseStrictYesNo(text);
        if (yn === 'yes') {
          await storage.updateGuestContactFields(user.id, pixPending.contactId, { financialStatus: 'pago' });
          this.pendingPixConfirmations.delete(remoteJid);
          await this.sendMessage(remoteJid, '✅ Marquei como *pago* no painel. Obrigado pela confirmação.');
          return;
        }
        if (yn === 'no') {
          this.pendingPixConfirmations.delete(remoteJid);
          await this.sendMessage(remoteJid, 'Ok, não alterei o status financeiro.');
          return;
        }
        await this.sendMessage(remoteJid, 'Responda *sim* ou *não* para confirmar o PIX.');
        return;
      }
    }

    // =========================================================================
    // 1.5. PROCESSAMENTO DE ESTADOS (CONFIRMAÇÕES)
    // =========================================================================
    const pendingDeleteAll = this.pendingDeleteAllConfirmations.get(remoteJid);
    if (pendingDeleteAll) {
      // Expira confirmações antigas para evitar ações tardias inesperadas.
      if ((Date.now() - pendingDeleteAll.createdAtMs) > 5 * 60 * 1000) {
        this.pendingDeleteAllConfirmations.delete(remoteJid);
      } else
      if (text.startsWith('/')) {
        this.pendingDeleteAllConfirmations.delete(remoteJid);
      } else {
        // Segurança: confirmação de exclusão em lote só aceita respostas curtas e explícitas.
        // Qualquer frase longa deve ser tratada como nova solicitação do usuário.
        const strictAnswer = this.parseStrictYesNo(text);
        if (strictAnswer === 'unknown') {
          const looksLikeNewRequest = text.trim().split(/\s+/).length > 2;
          if (looksLikeNewRequest) {
            this.pendingDeleteAllConfirmations.delete(remoteJid);
          } else {
            await this.sendMessage(
              remoteJid,
              'Responda com *sim*/*s* ou *não*/*n* para confirmar exclusão em lote.',
            );
            return;
          }
        }
        const answer = strictAnswer;
        if (answer === 'yes') {
          const deletionScope = await this.getDeletionCandidates(user);
          const matches = this.findEventsByTitle(deletionScope.candidates, pendingDeleteAll.targetTitle)
            .sort((a: any, b: any) => this.getDeletionSourcePriority(b.source) - this.getDeletionSourcePriority(a.source));

          if (matches.length === 0) {
            await this.sendMessage(
              remoteJid,
              '✅ Não encontrei outros eventos com esse nome para apagar.',
            );
            this.pendingDeleteAllConfirmations.delete(remoteJid);
            return;
          }

          let deletedCount = 0;
          for (const event of matches) {
            try {
              await this.deleteCandidate(user, event);
              deletedCount += 1;
            } catch (error) {
              console.error(`Erro ao apagar evento em lote (${event?.calendarId || event?.dbEvent?.id || 'unknown'}):`, error);
            }
          }

          this.pendingDeleteAllConfirmations.delete(remoteJid);
          await this.sendMessage(
            remoteJid,
            `🗑️ Pronto! Apaguei *${deletedCount}* evento(s) com o nome parecido com "*${pendingDeleteAll.targetTitle}*".`,
          );
          return;
        }

        if (answer === 'no') {
          this.pendingDeleteAllConfirmations.delete(remoteJid);
          await this.sendMessage(remoteJid, '✅ Perfeito, mantive os outros eventos.');
          return;
        }

        await this.sendMessage(
          remoteJid,
          'Responda com *sim*/*s* ou *não*/*n* para eu confirmar se apago todos com esse nome.',
        );
        return;
      }
    }

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
      const panelFirst = new Set([
        '/email',
        '/conectar',
        '/connect',
        '/conectar_microsoft',
        '/connect_microsoft',
        '/desconectar',
        '/disconnect',
        '/fuso',
        '/convidado',
        '/contato_convidado',
        '/convidados',
        '/apagar',
        '/convidado_remover',
        '/cancelar',
        '/ajuda',
        '/help',
        '/start',
        '/iniciar',
      ]);
      if (panelFirst.has(command)) {
        await this.sendMessage(
          remoteJid,
          '🎛️ *Painel Zelar*\n\n' +
            'E-mail, calendário (Google/Microsoft), fuso, *alunos/clientes* e assinatura ficam no painel — sem barra (/):\n' +
            this.panelLinkInMessage(user) +
            '\n\n' +
            'No WhatsApp (modo texto) você pode consultar *pendências financeiras*, *aulas de hoje* e *quantas aulas* restam — sempre digitando em texto, sem áudio ou imagem.',
        );
        return;
      }
      await this.handleCommand(remoteJid, user, command, args);
      return;
    }

    if (await this.tryAnswerMvpOperationalQuery(remoteJid, user, text.trim(), userTimezone)) {
      return;
    }

    if (!fromBatch) {
      const bulk = tryParseBulkLessonSchedule(text.trim(), userTimezone);
      if (bulk.ok && bulk.syntheticLines.length > 0) {
        await this.sendMessage(
          remoteJid,
          `📅 *Agendando ${bulk.syntheticLines.length} aula(s):*\n${bulk.summaryLines.map((l) => `• ${l}`).join('\n')}`,
        );
        for (const line of bulk.syntheticLines) {
          if (!isRunStillActive()) break;
          await this.handleMessage(
            remoteJid,
            whatsappId,
            line,
            msg,
            true,
            currentRunId,
            undefined,
            undefined,
            true,
          );
        }
        return;
      }
    }

    // Áudio/STT: mesmas correções do parser de data (segunda vs segundo, tarde, meses, etc.)
    const calendarText = normalizeTranscriptionForCalendarText(text).replace(/\bauals\b/gi, 'aulas');

    // Segurança extra: só entra no fluxo de apagar se o texto contiver verbo explícito de exclusão.
    const hasDeleteVerb = this.hasExplicitDeleteVerb(calendarText);
    const deleteIntent = hasDeleteVerb
      ? await parseDeleteCommandWithOpenRouter(calendarText, userTimezone)
      : { isDeleteIntent: false, targetTitle: '', targetDateISO: null };
    if (deleteIntent.isDeleteIntent) {
      const targetTitle = (deleteIntent.targetTitle || '').trim();
      if (targetTitle.length < 2) {
        await this.sendMessage(
          remoteJid,
          'Entendi que você quer cancelar um evento, mas preciso do nome. Exemplo: *"cancele a aula com Ricardo amanhã"*.',
        );
        return;
      }

      const deletionScope = await this.getDeletionCandidates(user);
      const matches = this.findEventsByTitle(deletionScope.candidates, targetTitle, deleteIntent.targetDateISO)
        .sort((a: any, b: any) => this.getDeletionSourcePriority(b.source) - this.getDeletionSourcePriority(a.source));

      if (matches.length === 0) {
        const staleHint = deletionScope.dbStaleCount > 0
          ? `\n\nℹ️ Detectei *${deletionScope.dbStaleCount}* evento(s) no banco que já não existem na agenda e ignorei eles para evitar confusão.`
          : '';
        await this.sendMessage(
          remoteJid,
          `❌ Não encontrei evento próximo com o nome "*${targetTitle}*".\nUse \`/eventos\` para listar os IDs.${staleHint}`,
        );
        return;
      }

      const eventToDelete = matches[0];
      try {
        await this.deleteCandidate(user, eventToDelete);
        const eventDate = DateTime
          .fromJSDate(new Date(eventToDelete.startDate))
          .setZone(userTimezone)
          .toFormat('dd/MM/yyyy HH:mm');
        const sourceLabel = eventToDelete.source === 'both'
          ? 'agenda + banco'
          : eventToDelete.source === 'calendar_only'
            ? 'agenda (convite/externo)'
            : 'banco local';

        await this.sendMessage(
          remoteJid,
          `🗑️ Evento apagado com sucesso:\n*${eventToDelete.title}*\n📅 ${eventDate}\n📌 Origem: *${sourceLabel}*\n\n🔎 Cruzamento atual: *${deletionScope.bothCount}* em ambos, *${deletionScope.calendarOnlyCount}* só na agenda, *${deletionScope.dbLocalCount}* só no banco local.\n\nDeseja apagar *todos* os eventos com esse nome?\nResponda com *sim/s* ou *não/n*.`,
        );

        this.pendingDeleteAllConfirmations.set(remoteJid, {
          userId: user.id,
          targetTitle,
          createdAtMs: Date.now(),
        });
      } catch (error) {
        console.error('Erro ao apagar evento por linguagem natural:', error);
        await this.sendMessage(remoteJid, '❌ Não consegui apagar esse evento agora. Tente novamente.');
      }
      return;
    }

    // Suporte a múltiplos compromissos em uma única mensagem.
    // Exemplo: "reunião sábado às 13, às 14 e às 15".
    if (!fromBatch) {
      const expandedMessages = await this.expandMultipleCommitments(calendarText, whatsappId, userSettings);
      if (expandedMessages.length > 1) {
        const batchCtx = await this.buildPackBatchContext(
          calendarText,
          expandedMessages,
          user.id,
          whatsappId,
          userSettings,
        );
        this.pendingPackBatchContext = batchCtx;
        try {
          console.log(`🧩 Mensagem expandida em ${expandedMessages.length} compromissos.`);
          for (let i = 0; i < expandedMessages.length; i++) {
            const singleMessage = expandedMessages[i];
            if (!isRunStillActive()) {
              console.log(`⏹️ Lote interrompido para ${remoteJid}: nova mensagem recebida.`);
              break;
            }
            await this.handleMessage(
              remoteJid,
              whatsappId,
              singleMessage,
              msg,
              true,
              currentRunId,
              i + 1,
              expandedMessages.length,
            );
          }
        } finally {
          this.pendingPackBatchContext = null;
        }
        return;
      }
    }

    // =========================================================================
    // 3. PROCESSAMENTO DE EVENTOS (INTEGRAÇÃO COM CLAUDE)
    // =========================================================================
    const processingNoticeTimer = suppressSuccessReply
      ? null
      : setTimeout(() => {
          void this.sendMessage(remoteJid, "⏳ Processando sua solicitação, já te respondo.");
        }, 5000);

    try {
      if (!isRunStillActive()) {
        return;
      }

      console.log(`🧠 Processando mensagem como evento para ${user.username}...`);
      let event = await parseEvent(calendarText, whatsappId, userTimezone, undefined, user.id, user.email);
      const localParsedDate = parseUserDateTime(calendarText, whatsappId);

      if (!event) {
        // Fallback local para evitar falhas por interpretação da IA
        const fallbackDate = parseUserDateTime(calendarText, whatsappId);
        if (!fallbackDate) {
          console.log(`⚠️ Mensagem não interpretada como evento: "${calendarText}"`);
          await this.sendMessage(remoteJid,
            '❓ Não consegui entender a data/hora.\n\n' +
            'Tente assim:\n' +
            '*"Reunião amanhã às 15h"* ou *"Dentista dia 15 às 14h"*.\n\n' +
            'Peça o link do painel ao anfitrião ou suporte para ver exemplos.'
          );
          return;
        }

        const fbEmails = extractEmails(calendarText);
        const fbAliases = await resolveGuestEmailsFromAliases(user.id, calendarText);
        const fbGroups = await resolveGuestEmailsAndPhonesFromGroups(user.id, calendarText);
        const fbAttendees = filterPlausibleGuestEmails(
          [...new Set([...fbEmails, ...fbAliases, ...fbGroups.emails])],
        );
        const fbPhonesText = extractPhonesFromWrittenAndSpoken(calendarText).filter(
          (p) => !isPlaceholderOrFakePhoneDigits(p.replace(/\D/g, '')),
        );
        const fbPhonesAlias = await resolveGuestPhonesFromAliases(user.id, calendarText);
        const fbPhones = [...new Set([...fbPhonesText, ...fbPhonesAlias, ...fbGroups.phones])].filter(
          (p) => !isPlaceholderOrFakePhoneDigits(p.replace(/\D/g, '')),
        );

        event = {
          title: extractEventTitle(calendarText) || 'Evento',
          startDate: fallbackDate.iso,
          description: calendarText,
          displayDate: fallbackDate.readable,
          attendees: fbAttendees,
          targetPhones: fbPhones,
        };
      }

      event.attendees = await applyCanonicalAndFuzzyGuestEmails(user.id, event.attendees ?? []);

      if (!isRunStillActive()) {
        return;
      }

      // =========================================================================
      // 4. CRIAÇÃO DE EVENTO E INTEGRAÇÕES
      // =========================================================================
      // Adiciona o próprio usuário aos telefones alvo (se não estiver lá)
      if (!(event as any).targetPhones) {
        (event as any).targetPhones = [];
      }
      if (!(event as any).targetPhones.includes(whatsappId)) {
        (event as any).targetPhones.push(whatsappId);
      }

      let finalStartDate = new Date(event.startDate);
      if (Number.isNaN(finalStartDate.getTime())) {
        const fallbackDate = parseUserDateTime(calendarText, whatsappId);
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
      const fallbackDate = parseUserDateTime(calendarText, whatsappId);
      const hasExplicitYear = /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|\b20\d{2}\b/.test(calendarText);
      const hasExplicitWeekday = /\b(segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo)(-feira)?\b/i.test(calendarText);
      if (fallbackDate) {
        const fallbackStart = new Date(fallbackDate.iso);
        const now = new Date();
        const aiInPast = finalStartDate.getTime() < (now.getTime() - 6 * 60 * 60 * 1000);
        const fallbackInFuture = fallbackStart.getTime() > now.getTime();
        const yearMismatch = finalStartDate.getFullYear() !== fallbackStart.getFullYear();
        const weekdayMismatch = finalStartDate.getDay() !== fallbackStart.getDay();

        // Se o usuário informou dia da semana explicitamente, prioriza parser local
        // quando IA divergir no dia da semana (ex.: "segunda" e IA retornar terça).
        // Não aplicar se já houver data de calendário explícita (ex.: "14 de dezembro" + "domingo" no flyer).
        if (hasExplicitWeekday && weekdayMismatch && !hasExplicitCalendarDateInText(calendarText)) {
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
      const explicitTime = this.extractExplicitTimeFromText(calendarText);
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
      const batchCtx = this.pendingPackBatchContext;

      let zelarBase =
        batchCtx?.baseTitle?.trim() ||
        String(event.title || 'Evento')
          .split(' · ')[0]
          ?.trim() ||
        'Aula';

      let studentContactId: number | null = batchCtx?.studentContactId ?? null;
      let studentDisplayName = batchCtx?.studentDisplayName?.trim() || '';

      if (!studentContactId) {
        const tnorm = this.normalizeForComparison(calendarText);
        let c = await this.findGuestMentionedInText(user.id, tnorm);
        if (!c) {
          const guessed = extractComGuestNameFromText(calendarText);
          if (guessed) {
            c = await storage.findGuestContactByLooseName(user.id, guessed);
          }
        }
        if (c) {
          studentContactId = c.id;
          studentDisplayName = this.displayGuestNameFromRow(c);
        }
      }

      let guestRow: UserGuestContactRow | null = null;
      if (studentContactId) {
        const allGuests = await storage.listUserGuestContacts(user.id);
        guestRow = allGuests.find((r) => r.id === studentContactId) ?? null;
      }

      const lessonIdx =
        typeof batchLessonIndex === 'number' && batchLessonIndex > 0 ? batchLessonIndex : null;
      const lessonTot =
        typeof batchLessonTotal === 'number' && batchLessonTotal > 0 ? batchLessonTotal : null;

      const calTitle = buildLessonCalendarTitle({
        baseTitle: zelarBase,
        studentLabel: studentDisplayName || 'Aluno',
        lessonIndex: lessonIdx,
        lessonTotal: lessonTot,
        paymentStatus: 'pendente',
      });

      const pkgInline = this.findConfiguredLessonPackage(calendarText, userSettings?.lessonPackagesJson ?? null);
      let packUnitPriceCents = batchCtx?.packUnitPriceCents ?? null;
      let packId = batchCtx?.packId ?? null;
      if (
        (packUnitPriceCents == null || packUnitPriceCents <= 0) &&
        pkgInline &&
        pkgInline.lessons > 0 &&
        pkgInline.priceCents > 0
      ) {
        packUnitPriceCents = Math.round(pkgInline.priceCents / pkgInline.lessons);
        packId = pkgInline.id;
      }

      const rawPayload = JSON.parse(JSON.stringify(event)) as Record<string, unknown>;
      rawPayload.zelarLesson = {
        baseTitle: zelarBase,
        studentContactId,
        packGroupId: batchCtx?.packGroupId ?? null,
        lessonIndex: lessonIdx,
        lessonTotal: lessonTot,
        paymentStatus: 'pendente',
        packUnitPriceCents,
        packId,
      };

      const fakeEv = {
        rawData: rawPayload,
        lessonPaymentStatus: 'pendente',
      } as Event;
      const unitSnapshot = guestRow
        ? resolveLessonUnitCentsForAllocation(fakeEv, guestRow, userSettings?.defaultLessonPriceCents ?? null)
        : resolveLessonUnitCents(null, userSettings?.defaultLessonPriceCents ?? null);
      if (unitSnapshot != null && unitSnapshot > 0) {
        (rawPayload.zelarLesson as Record<string, unknown>).lessonUnitPriceCentsSnapshot = unitSnapshot;
      }

      const packGroupId =
        lessonTot != null && lessonTot > 1 && batchCtx?.packGroupId ? batchCtx.packGroupId : null;

      const emailsFromRawText = filterPlausibleGuestEmails(extractEmails(calendarText));
      const emailSeed = [
        ...new Set(
          [
            ...(event.attendees || []),
            ...emailsFromRawText,
            ...(guestRow?.canonicalEmail ? [guestRow.canonicalEmail.trim()] : []),
          ].filter(Boolean),
        ),
      ] as string[];
      const emailsMerged = await applyCanonicalAndFuzzyGuestEmails(user.id, emailSeed);

      const phonesMerged: string[] = [...(((event as any).targetPhones) || [])];
      if (guestRow?.guestPhoneE164) {
        const gd = String(guestRow.guestPhoneE164).replace(/\D/g, '');
        if (gd && !isPlaceholderOrFakePhoneDigits(gd)) {
          const dup = phonesMerged.some((p) => String(p).replace(/\D/g, '') === gd);
          if (!dup) phonesMerged.push(gd);
        }
      }

      const newEvent = await storage.createEvent({
        userId: user.id,
        title: calTitle,
        description: event.description || '',
        startDate: finalStartDate,
        attendeePhones: phonesMerged,
        attendeeEmails: emailsMerged,
        rawData: rawPayload,
        packGroupId,
        lessonIndexInPack: lessonIdx,
        lessonTotalInPack: lessonTot,
        lessonPaymentStatus: 'pendente',
        studentContactId,
      });

      if (!isRunStillActive()) {
        return;
      }

      const phones = phonesMerged;

      // (Bloco de responseText original removido - será construído mais abaixo)

      // 4.2. Integração com calendário conectado (Google ou Microsoft)
      let syncedCalendarProvider: 'google' | 'microsoft' | null = null;
      let calendarSyncErrorMessage = '';
      let usedServiceGoogleCalendar = false;
      const defaultOrganizerId = Number(process.env.DEFAULT_ORGANIZER_USER_ID || '');
      const defaultOrganizerIntegrationKey = process.env.DEFAULT_ORGANIZER_INTEGRATION_KEY || 'default_google_organizer';
      const zelarCalendarKey = process.env.ZELAR_CALENDAR_INTEGRATION_KEY?.trim() || 'zelar_google_invites';
      const zelarCalendarOAuthUserId = Number(process.env.ZELAR_CALENDAR_OAUTH_USER_ID || '999001');
      let fallbackEmailSentTo: string[] = [];
      let fallbackEmailFailedTo: string[] = [];

      if (userSettings?.calendarProvider === 'google' && userSettings.googleTokens) {
        try {
          setTokens(user.id, JSON.parse(userSettings.googleTokens));
          const googleResult = await addEventToGoogleCalendar({
            ...newEvent,
            startDate: new Date(event.startDate),
            endDate: null,
            attendeePhones: phones,
            attendeeEmails: emailsMerged,
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
            calendarSyncErrorMessage = googleResult.message;
          }
        } catch (error) {
          console.error('Erro Google Calendar:', error);
          calendarSyncErrorMessage = 'Falha ao sincronizar com Google Calendar.';
        }
      } else if (userSettings?.calendarProvider === 'microsoft' && userSettings.microsoftTokens) {
        try {
          const microsoftResult = await addEventToMicrosoftCalendar({
            ...newEvent,
            startDate: new Date(event.startDate),
            endDate: null,
            attendeePhones: phones,
            attendeeEmails: emailsMerged,
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
            calendarSyncErrorMessage = microsoftResult.message;
          }
        } catch (error) {
          console.error('Erro Microsoft Calendar:', error);
          calendarSyncErrorMessage = 'Falha ao sincronizar com Microsoft Calendar.';
        }
      }

      // Conta Google no banco (tokens OAuth): organizador numérico OU conta Zelar (zelar_google_invites).
      const tryServiceGoogleCalendar = async (
        integrationKey: string,
        oauthUserId: number,
      ): Promise<boolean> => {
        if (!db) {
          calendarSyncErrorMessage = 'Banco indisponível para integração Google.';
          return false;
        }
        let integrationResult: unknown = null;
        try {
          integrationResult = await db.execute(sql`
            SELECT account_email, tokens, active
            FROM public.system_calendar_integrations
            WHERE integration_key = ${integrationKey}
              AND provider = 'google'
            LIMIT 1
          `);
        } catch (e: unknown) {
          const code = (e as { code?: string })?.code;
          if (code === '42P01') {
            console.warn('⚠️ Tabela public.system_calendar_integrations não existe; rode a migration 0009.');
            return false;
          }
          throw e;
        }

        const integrationRow = (integrationResult as any)?.rows?.[0];
        const rawTokens = integrationRow?.tokens;
        const organizerTokens = typeof rawTokens === 'string' ? JSON.parse(rawTokens) : rawTokens;

        if (
          !integrationRow ||
          !integrationRow.active ||
          !organizerTokens ||
          (!organizerTokens.access_token && !organizerTokens.refresh_token)
        ) {
          return false;
        }

        setTokens(oauthUserId, organizerTokens);

        const hostEmail = user.email?.trim();
        const serviceAttendeeEmails = [
          ...new Set(
            [...(emailsMerged || []), ...(hostEmail ? [hostEmail] : [])].filter(Boolean),
          ),
        ] as string[];

        const organizerEvent = {
          ...newEvent,
          startDate: new Date(event.startDate),
          endDate: null,
          attendeePhones: phones,
          attendeeEmails: serviceAttendeeEmails,
        };

        const googleResult = await addEventToGoogleCalendar(organizerEvent as any, oauthUserId);
        if (googleResult.success) {
          syncedCalendarProvider = 'google';
          usedServiceGoogleCalendar = true;
          calendarSyncErrorMessage = '';
          if (googleResult.conferenceLink) {
            await storage.updateEvent(newEvent.id, { conferenceLink: googleResult.conferenceLink });
          }
          if (googleResult.calendarEventId) {
            await storage.updateEvent(newEvent.id, { calendarId: googleResult.calendarEventId });
          }
          return true;
        }
        calendarSyncErrorMessage = googleResult.message;
        return false;
      };

      if (!syncedCalendarProvider) {
        try {
          if (Number.isInteger(defaultOrganizerId) && defaultOrganizerId > 0) {
            await tryServiceGoogleCalendar(defaultOrganizerIntegrationKey, defaultOrganizerId);
          }
          if (!syncedCalendarProvider) {
            const okZelar = await tryServiceGoogleCalendar(zelarCalendarKey, zelarCalendarOAuthUserId);
            if (!okZelar && !calendarSyncErrorMessage) {
              calendarSyncErrorMessage =
                'Sem Google/Microsoft no painel e sem tokens válidos em system_calendar_integrations (conta Zelar).';
            }
          }
        } catch (error) {
          console.error('Erro ao sincronizar via Google de serviço (banco):', error);
          calendarSyncErrorMessage = 'Falha ao sincronizar via Google de serviço.';
        }
      }

      if (studentContactId && guestRow) {
        const { tryConsumeLessonBalanceAfterEventCreated } = await import('../services/lessonCancellationCredit');
        const refreshed = (await storage.listUserGuestContacts(user.id)).find((r) => r.id === studentContactId);
        if (refreshed) {
          await tryConsumeLessonBalanceAfterEventCreated(user.id, newEvent.id, refreshed);
        }
      }

      const eventForUserMessage = (await storage.getEvent(newEvent.id)) ?? newEvent;

      // =================== 4.3. NOTIFICAÇÕES (GUESTS vs CREATOR) ===================

      // A) NOTIFICAR CONVIDADOS (Guests)
      const creatorPhone = whatsappId.replace(/\D/g, '');
      const normalizedOtherGuestPhones = (phones || []).filter((p: string) => p.replace(/\D/g, '') !== creatorPhone);
      const hasGuestPhones = normalizedOtherGuestPhones.length > 0;

      // B) NOTIFICAR CRIADOR (Creator)
      let responseText = `✅ *Evento agendado com sucesso!*\n\n` +
        `📝 *${eventForUserMessage.title}*\n` +
        `📅 ${event.displayDate}\n` +
        `🆔 ID: ${newEvent.id}`;

      if (emailsMerged.length > 0) {
        responseText += '\n📧 *E-mails de convidados:*\n' + emailsMerged.map((e) => `• ${e}`).join('\n');
        if (syncedCalendarProvider === 'google' && usedServiceGoogleCalendar) {
          responseText += '\n_Convites enviados pelo Google Calendar (conta de serviço / Zelar no banco)._';
        } else if (syncedCalendarProvider === 'google') {
          responseText += '\n_Convites enviados pelo Google Calendar conectado no painel._';
        } else if (syncedCalendarProvider === 'microsoft') {
          responseText += '\n_Convites enviados pelo Microsoft Calendar._';
        }
      }

      if (hasGuestPhones) {
        responseText += '\n📱 *Convidados Notificados:*\n' + normalizedOtherGuestPhones.map((p: string) => `• ${p}`).join('\n');
        responseText += '\n🔔 *Lembretes para convidados:* 3h, 1h e 15min antes.';
      }

      // Lógica diferenciada para criador: Synced ou Link Manual
      if (syncedCalendarProvider === 'google') {
        responseText += usedServiceGoogleCalendar
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
        // ICS por e-mail: só endereços explícitos como convidados; se não houver, envia cópia ao organizador.
        const fallbackRecipients =
          emailsMerged.length > 0
            ? ([...new Set(emailsMerged)] as string[])
            : user.email
              ? [user.email]
              : [];
        const fallbackIcsLink = generateLinks(event).ics;
        for (const recipient of fallbackRecipients) {
          const sent = await emailService.sendInvitation(
            recipient,
            newEvent,
            user.name || user.username || 'Zelar IA',
            fallbackIcsLink
          );
          if (sent) {
            fallbackEmailSentTo.push(recipient);
          } else {
            fallbackEmailFailedTo.push(recipient);
          }
        }
        if (fallbackEmailFailedTo.length > 0) {
          console.warn('⚠️ Falha no envio de fallback por email para:', fallbackEmailFailedTo.join(', '));
        }
        if (calendarSyncErrorMessage) {
          console.warn('⚠️ Calendar não sincronizou (fallback email aplicado):', calendarSyncErrorMessage);
        }
        responseText += `\n\n✅ *Evento criado*`;
      }

      if (!suppressSuccessReply) {
        await this.sendMessage(remoteJid, responseText);
      }

      // Envio para convidados em background para evitar atrasar resposta ao anfitrião.
      if (hasGuestPhones) {
        void (async () => {
          for (const phone of normalizedOtherGuestPhones) {
            const guestJid = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;
            console.log(`📤 Enviando convite para convidado: ${guestJid}`);
            await this.sendMessage(guestJid,
              `📅 *Você foi convidado para um evento!*\n\n` +
              `📝 *${newEvent.title}*\n` +
              `🗓️ ${event.displayDate}\n\n` +
              `🔔 *Lembretes automáticos:* 3h, 1h e 15min antes.\n\n` +
              `📨 O convite também será enviado por e-mail, se o anfitrião tiver e-mails cadastrados.\n\n` +
              `_Enviado via Zelar IA pelo anfitrião_`
            );
          }

          try {
            await reminderService.createWhatsAppGuestReminders(newEvent as any, normalizedOtherGuestPhones, [180, 60, 15]);
          } catch (guestReminderError) {
            console.error('⚠️ Erro ao criar lembretes para convidados via WhatsApp:', guestReminderError);
          }
        })();
      }

    } catch (err) {
      console.error('Erro fatal ao criar evento:', err);
      await this.sendMessage(remoteJid, '❌ Ocorreu um erro interno ao criar seu evento. Tente novamente.');
    } finally {
      if (processingNoticeTimer) clearTimeout(processingNoticeTimer);
    }
  }

  private async sendWelcomeMessage(remoteJid: string, user: any) {
    await this.sendMessage(remoteJid,
      `👋 *Olá${user.name ? `, ${user.name}` : ''}!* Bem-vindo ao Zelar IA.\n\n` +
      'Estou aqui para organizar sua agenda de forma rápida e inteligente.\n\n' +
      '📌 *O que eu posso fazer?*\n' +
      '• Criar eventos (ex: "Almoço com mãe amanhã 13h")\n' +
      '• Entender áudios/voz e transformar em agendamento\n' +
      '• Enviar lembretes para você e convidados\n' +
      '• Sincronizar com Google ou Microsoft Calendar\n\n' +
      '🎛️ *Configurações (e-mail, calendário, convidados):*\n' +
      `Abra seu painel — sem comandos com barra (/):\n${this.panelLinkInMessage(user)}\n\n` +
      '💡 *Dica:* Por aqui você só manda o compromisso em texto ou áudio; o resto é no painel.',
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
            '• `/aula` — Aulas e eventos *de hoje* (no seu fuso)\n' +
            '• `/buscar` — Concilia *PIX/recebimentos* do Pluggy (só após este comando; desde a 1ª aula no calendário)\n' +
            '• `/email` - Cadastra/atualiza seu email\n' +
            '• `/convidado Nome email@...` - Salva na planilha (áudio reconhece o nome)\n' +
            '• `/convidados` - Lista planilha (/convidado + e-mails do convite escrito)\n' +
            '• `/apagar convidado Nome ou email@...` - Remove da planilha\n' +
            '• `/conectar` - Conecta Google ou Microsoft Calendar\n' +
            '• `/conectar_microsoft` - Conecta ao Microsoft Calendar\n' +
            '• `/desconectar` - Desconecta calendário integrado\n' +
            '• `/lembretes` - Vê lembretes pendentes\n' +
            '• `/cancelar` - Cancela sua assinatura\n' +
            '• `/fuso` - Configura seu fuso horário\n\n' +
            '🎛️ *Painel web (alunos, calendário, financeiro):*\n' +
            `${this.panelLinkInMessage(user)}\n` +
            '(Use *Entrar* com seu e-mail e senha. Na primeira vez use o link *Criar senha* acima — ele identifica seu WhatsApp e grava o e-mail no painel.)\n\n' +
            '💡 *Dica:* Você pode escrever ou mandar áudio (voz) com o evento, como "Reunião de equipe terça 14h", e eu cuido do resto!\n\n' +
            '📌 *Várias aulas de uma vez:* escreva por exemplo *"marque aulas segunda, terça e quinta às 18"* ou *"marque aulas com João Silva segunda e quarta às 19"*.'
          );
          break;

        case '/buscar': {
          await this.sendMessage(
            remoteJid,
            '⏳ Buscando no Pluggy (extrato desde a *primeira aula* no calendário)… pode levar até um minuto.',
          );
          const { runPluggyBuscarReconciliation } = await import('../services/pluggy/pluggyBuscarReconciliation');
          const out = await runPluggyBuscarReconciliation(user.id);
          if (!out.ok) {
            await this.sendMessage(remoteJid, `ℹ️ ${out.message}`);
          } else {
            await this.sendMessage(
              remoteJid,
              `✅ *Busca concluída*\n\n` +
                `Analisei *${out.txSeen}* lançamento(ns) de crédito a partir de *${out.since}*.\n` +
                'Aulas só viram *pago* quando *nome + valor* baterem com um aluno e o preço da aula; caso contrário continuam *pendente*.\n\n' +
                '_Repita /buscar_ quando novos PIX aparecerem no banco.',
            );
          }
          break;
        }

        case '/aula':
        case '/aulas': {
          const panelSettings = await storage.getUserSettings(user.id);
          const tz = panelSettings?.timeZone || 'America/Sao_Paulo';
          const start = DateTime.now().setZone(tz).startOf('day');
          const { lines, usedCalendar, fallbackNote } = await this.getTodayAgendaLinesForUser(user, tz);
          if (lines.length === 0) {
            const hasCalConnection =
              (panelSettings?.calendarProvider === 'google' && panelSettings?.googleTokens) ||
              (panelSettings?.calendarProvider === 'microsoft' && panelSettings?.microsoftTokens);
            const hint = !hasCalConnection
              ? '\n\n_Conecte o calendário com `/conectar` para ver a mesma agenda do Google ou Microsoft._'
              : '';
            await this.sendMessage(
              remoteJid,
              `📭 Nenhum evento para *hoje* (${start.toFormat('dd/MM/yyyy')}, ${tz}).${hint}`,
            );
          } else {
            let msgOut = `📅 *Sua agenda de hoje* (${start.toFormat('dd/MM/yyyy')}):\n\n`;
            lines.forEach((row) => {
              msgOut += `• *${row.hhmm}* — ${row.title}\n`;
            });
            if (usedCalendar === 'google') {
              msgOut += '\n_Fonte: Google Calendar (dia completo no seu fuso)._';
            } else if (usedCalendar === 'microsoft') {
              msgOut += '\n_Fonte: Microsoft Calendar (dia completo no seu fuso)._';
            }
            if (fallbackNote) {
              msgOut += `\n⚠️ _${fallbackNote}_`;
            }
            await this.sendMessage(remoteJid, msgOut);
          }
          break;
        }

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
          const connectBaseUrl = process.env.BASE_URL || 'http://localhost:8080';
          const googleAuthUrl = `${connectBaseUrl}/api/auth/google/authorize?userId=${user.id}&platform=whatsapp&redirect=1`;
          const microsoftAuthUrl = `${connectBaseUrl}/api/auth/microsoft/authorize?userId=${user.id}&platform=whatsapp&redirect=1`;
          const currentProvider =
            settings?.calendarProvider === 'microsoft' && settings.microsoftTokens
              ? 'Microsoft Calendar'
              : settings?.calendarProvider === 'google' && settings.googleTokens
                ? 'Google Calendar'
                : null;

          await this.sendMessage(remoteJid,
            '🔐 *Conectar Calendário*\n\n' +
            (currentProvider
              ? `✅ Conexão atual: *${currentProvider}*.\nVocê pode trocar usando um dos links abaixo:\n\n`
              : 'Escolha um provedor para sincronizar seus eventos automaticamente:\n\n') +
            `🟢 *Google:*\n${googleAuthUrl}\n\n` +
            `🔵 *Microsoft:*\n${microsoftAuthUrl}\n\n` +
            'Após autorizar, seus eventos serão adicionados automaticamente no calendário escolhido.'
          );
          break;

        case '/conectar_microsoft':
        case '/connect_microsoft':
          const microsoftSettings = await storage.getUserSettings(user.id);
          if (microsoftSettings?.calendarProvider === 'microsoft' && microsoftSettings.microsoftTokens) {
            await this.sendMessage(remoteJid, '✅ Você já está conectado ao Microsoft Calendar.\nUse /desconectar se desejar sair.');
          } else {
            const baseUrl = process.env.BASE_URL || 'http://localhost:8080';
            const authUrl = `${baseUrl}/api/auth/microsoft/authorize?userId=${user.id}&platform=whatsapp&redirect=1`;
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

            await this.deleteEventFromIntegrationsAndDb(user, ev);
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

        case '/convidado':
        case '/contato_convidado': {
          const emailMatch = args.match(/\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/i);
          if (!emailMatch || !args.trim()) {
            await this.sendMessage(
              remoteJid,
              '👤 *Cadastrar convidado (nome → email)*\n\n' +
                'Use assim:\n' +
                '`/convidado Nome Completo email@dominio.com`\n\n' +
                'Exemplo:\n' +
                '`/convidado Carol Silva carol@email.com`\n\n' +
                'Depois, em áudio ou texto, quando você falar o *nome*, eu incluo o email no convite.\n' +
                'Ver lista: `/convidados`',
            );
            break;
          }
          const emailRaw = emailMatch[0].trim();
          const emailLower = emailRaw.toLowerCase();
          const name = args.replace(emailMatch[0], '').trim().replace(/\s+/g, ' ');
          if (!name || name.length < 2) {
            await this.sendMessage(remoteJid, '❌ Informe o *nome* antes do email.\nEx: `/convidado Carol carol@email.com`');
            break;
          }
          if (!this.isValidEmail(emailLower)) {
            await this.sendMessage(remoteJid, '❌ Email inválido.');
            break;
          }
          try {
            await storage.upsertUserGuestContactWithAlias(user.id, name, emailRaw);
            await this.sendMessage(
              remoteJid,
              `✅ Convidado salvo: *${name}* → \`${emailLower}\`\n\nEm mensagens ou áudio, quando você mencionar esse nome, eu adiciono o email ao evento.`,
            );
          } catch (e: any) {
            console.error('upsertUserGuestContactWithAlias', e);
            await this.sendMessage(remoteJid, `❌ Não consegui salvar: ${e?.message || e}`);
          }
          break;
        }

        case '/convidados': {
          const list = await storage.listUserGuestContacts(user.id);
          if (list.length === 0) {
            await this.sendMessage(
              remoteJid,
              '📭 Nenhum convidado na planilha.\nUse `/convidado Nome email@...` ou envie um convite com e-mail no texto.',
            );
            break;
          }
          let msg = '👥 *Sua planilha de convidados:*\n\n';
          for (const row of list) {
            const aliases = (row.aliasNames ?? []).filter(Boolean);
            const emailPart = row.canonicalEmail ? `\`${row.canonicalEmail}\`` : '_sem e-mail_';
            const phonePart = row.guestPhoneE164 ? ` · 📱 ${row.guestPhoneE164}` : '';
            if (aliases.length) {
              msg += `• *${aliases.join(', ')}* → ${emailPart}${phonePart}\n`;
            } else {
              msg += `• ${emailPart}${phonePart} _· planilha / convite_\n`;
            }
          }
          msg += '\nRemover: `/apagar convidado Nome` ou `/apagar convidado email@...`\n(também: `/convidado_remover` com nome ou e-mail)';
          await this.sendMessage(remoteJid, msg);
          break;
        }

        case '/apagar': {
          const a = args.trim();
          if (!/^convidado\b/i.test(a)) {
            await this.sendMessage(
              remoteJid,
              'Para apagar um *convidado* da planilha:\n\n`/apagar convidado Nome`\nou\n`/apagar convidado email@dominio.com`\n\n' +
                '_(Também funciona: `/convidado_remover` com nome ou e-mail.)_',
            );
            break;
          }
          const payload = a.replace(/^convidado\s+/i, '').trim();
          if (!payload) {
            await this.sendMessage(
              remoteJid,
              'Informe o nome ou o e-mail.\nEx: `/apagar convidado Maria` ou `/apagar convidado maria@email.com`',
            );
            break;
          }
          const ok = await storage.deleteUserGuestContactEntry(user.id, payload);
          await this.sendMessage(
            remoteJid,
            ok
              ? `✅ Removido da planilha: *${payload}*`
              : '❌ Não encontrei na planilha. Use `/convidados` para ver nomes e e-mails.',
          );
          break;
        }

        case '/convidado_remover': {
          if (!args.trim()) {
            await this.sendMessage(
              remoteJid,
              'Use:\n`/convidado_remover Nome`\nou\n`/convidado_remover email@dominio.com`\n\nOu: `/apagar convidado …`',
            );
            break;
          }
          const ok = await storage.deleteUserGuestContactEntry(user.id, args);
          await this.sendMessage(
            remoteJid,
            ok
              ? `✅ Removido da planilha: *${args.trim()}*`
              : '❌ Não encontrei na planilha. Use `/convidados` para ver nomes e e-mails.',
          );
          break;
        }

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
      const pick = asMatches[asMatches.length - 1]!;
      const hour = Number(pick[1]);
      const minute = pick[2] ? Number(pick[2]) : 0;
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

  private extractRelativeDayRange(text: string): number | null {
    const normalized = text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    const match = normalized.match(/\bproxim(?:os|as)\s+(\d{1,3})\s+dias?\b/);
    if (!match) return null;
    const totalDays = Number(match[1]);
    if (!Number.isFinite(totalDays) || totalDays <= 0) return null;
    return Math.min(totalDays, 120);
  }

  private buildRelativeRangeDates(
    text: string,
    timezone: string,
    totalDays: number,
  ): DateTime[] {
    const normalized = text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    const onlyEvenDays = /\bpares?\b/.test(normalized);
    const onlyOddDays = /\bimpares?\b/.test(normalized);
    const skipWeekend = /\bsem\s+fins?\s+de\s+semana\b|\bsem\s+fim\s+de\s+semana\b/.test(normalized);

    const now = DateTime.now().setZone(timezone).startOf('day');
    const result: DateTime[] = [];

    for (let i = 1; i <= totalDays; i += 1) {
      const candidate = now.plus({ days: i });
      const isWeekend = candidate.weekday === 6 || candidate.weekday === 7;
      if (skipWeekend && isWeekend) continue;

      if (onlyEvenDays && candidate.day % 2 !== 0) continue;
      if (onlyOddDays && candidate.day % 2 === 0) continue;

      result.push(candidate);
    }

    return result;
  }

  private buildTitleSeedForRelativeRange(text: string): string {
    return text
      .replace(/\bpel[oa]s?\b/gi, ' ')
      .replace(/\bproxim(?:os|as)\s+\d{1,3}\s+dias?\b/gi, ' ')
      .replace(/\bpares?\b/gi, ' ')
      .replace(/\bimpares?\b/gi, ' ')
      .replace(/\bsem\s+fins?\s+de\s+semana\b/gi, ' ')
      .replace(/\bsem\s+fim\s+de\s+semana\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private extractRelativeWeekdayRange(text: string): { occurrences: number; weekday: number } | null {
    const normalized = text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    const weekdayMap: Record<string, number> = {
      segunda: 1,
      segundas: 1,
      terca: 2,
      tercas: 2,
      quarta: 3,
      quartas: 3,
      quinta: 4,
      quintas: 4,
      sexta: 5,
      sextas: 5,
      sabado: 6,
      sabados: 6,
      domingo: 7,
      domingos: 7,
    };

    const matchNumbered = normalized.match(
      /\bproxim(?:os|as)\s+(\d{1,3})\s+(segundas?|tercas?|quartas?|quintas?|sextas?|sabados?|domingos?)(?:\s+feiras?)?\b/,
    );
    if (matchNumbered) {
      const occurrences = Number(matchNumbered[1]);
      if (!Number.isFinite(occurrences) || occurrences <= 0) return null;
      const weekday = weekdayMap[matchNumbered[2]];
      if (!weekday) return null;
      return { occurrences: Math.min(occurrences, 104), weekday };
    }

    // "pelas próximas quartas feiras" / "próximas quartas" (sem quantidade explícita)
    const matchBare = normalized.match(
      /\b(?:pel[oa]s?\s+)?pr[oó]xim(?:a|o|as|os)?\s+(segundas?|tercas?|quartas?|quintas?|sextas?|sabados?|domingos?)(?:\s+feiras?)?\b/,
    );
    if (matchBare) {
      const weekday = weekdayMap[matchBare[1]];
      if (!weekday) return null;
      return { occurrences: 8, weekday };
    }

    return null;
  }

  private buildRelativeWeekdayDates(
    timezone: string,
    weekday: number,
    occurrences: number,
  ): DateTime[] {
    const dates: DateTime[] = [];
    let cursor = DateTime.now().setZone(timezone).startOf('day').plus({ days: 1 });

    while (dates.length < occurrences) {
      if (cursor.weekday === weekday) {
        dates.push(cursor);
      }
      cursor = cursor.plus({ days: 1 });
    }

    return dates;
  }

  private applyFinalTagToLastCommitment(messages: string[]): string[] {
    if (messages.length <= 1) return messages;

    const updated = [...messages];
    const lastIdx = updated.length - 1;
    const last = updated[lastIdx];

    if (/\(final\)\s+dia\s+\d{2}\/\d{2}\/\d{4}\s+as\s+\d{2}:\d{2}$/i.test(last)) {
      return updated;
    }

    updated[lastIdx] = last.replace(/^(.+?)\s+dia\s+(\d{2}\/\d{2}\/\d{4}\s+as\s+\d{2}:\d{2})$/i, '$1 (final) dia $2');
    return updated;
  }

  private async buildPackBatchContext(
    calendarText: string,
    expandedMessages: string[],
    userId: number,
    whatsappId: string,
    userSettings: UserSettings | undefined,
  ): Promise<{
    packGroupId: string;
    studentContactId: number | null;
    studentDisplayName: string;
    baseTitle: string;
    packUnitPriceCents: number | null;
    packId: string | null;
  }> {
    void whatsappId;
    const packGroupId = randomUUID();

    const pkg = this.findConfiguredLessonPackage(calendarText, userSettings?.lessonPackagesJson ?? null);
    let packUnitPriceCents: number | null = null;
    let packId: string | null = null;
    if (pkg && pkg.lessons > 0 && pkg.priceCents > 0) {
      packUnitPriceCents = Math.round(pkg.priceCents / pkg.lessons);
      packId = pkg.id;
    }

    const normalizedMsg = calendarText
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    const rawGuest = extractComGuestNameFromText(calendarText);
    let studentContactId: number | null = null;
    let studentDisplayName = '';
    if (rawGuest) {
      const rawName = rawGuest.trim();
      const contact =
        (await storage.findGuestContactByLooseName(userId, rawName)) ||
        (await this.findGuestMentionedInText(userId, normalizedMsg));
      if (contact) {
        studentContactId = contact.id;
        studentDisplayName = this.displayGuestNameFromRow(contact);
      }
    }
    const first = expandedMessages[0] || '';
    const titleMatch = first.match(/^(.+?)\s+dia\s+\d{2}\/\d{2}\/\d{4}\s+as\s+\d{2}:\d{2}$/i);
    const baseTitle = (titleMatch ? titleMatch[1] : extractEventTitle(calendarText)) || 'Aula';

    return { packGroupId, studentContactId, studentDisplayName, baseTitle, packUnitPriceCents, packId };
  }

  private findConfiguredLessonPackage(
    text: string,
    lessonPackagesJson: unknown,
  ): { id: string; lessons: number; priceCents: number } | null {
    if (!lessonPackagesJson || !Array.isArray(lessonPackagesJson)) return null;
    const normalized = text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    let slug: string | null = null;
    const slugPatterns = [
      /\bpacote\s+([a-z0-9_-]+)\s+de\s+aulas\b/i,
      /\bpacote\s+de\s+aulas\s+([a-z0-9_-]+)\b/i,
      /\baulas?\s+do\s+pacote\s+([a-z0-9_-]+)\b/i,
      /\bpacote\s+([a-z0-9_-]+)\b/i,
    ];
    for (const re of slugPatterns) {
      const m = normalized.match(re);
      if (!m?.[1]) continue;
      const candidate = m[1].toLowerCase();
      if (candidate === 'de' || candidate === 'aulas') continue;
      slug = candidate;
      break;
    }
    if (!slug) return null;
    for (const row of lessonPackagesJson) {
      if (!row || typeof row !== 'object') continue;
      const r = row as Record<string, unknown>;
      const id = String(r.id ?? '')
        .toLowerCase()
        .trim();
      const label = String(r.label ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '_');
      const labelTokens = label.split('_').filter(Boolean);
      const slugMatches =
        slug === id ||
        slug === label ||
        labelTokens.includes(slug) ||
        labelTokens[labelTokens.length - 1] === slug;
      if (slugMatches) {
        const lessons = Number(r.lessons);
        const priceCents = Number(r.priceCents);
        if (!Number.isFinite(lessons) || lessons < 1) continue;
        return {
          id: String(r.id ?? slug),
          lessons,
          priceCents: Number.isFinite(priceCents) ? priceCents : 0,
        };
      }
    }
    return null;
  }

  private extractWeekdayWithinRelativeDaysExpansion(
    text: string,
    timezone: string,
    primaryTime: { hour: number; minute: number },
  ): string[] {
    const normalized = text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const dayMatch = normalized.match(
      /\b(?:toda|todas)\s+(segundas?|tercas?|quartas?|quintas?|sextas?|sabados?|domingos?)(?:\s+feira)?\b/,
    );
    const winMatch = normalized.match(/\bproxim(?:os|as)\s+(\d{1,3})\s+dias?\b/);
    if (!dayMatch || !winMatch) return [];

    const totalDays = Math.min(Number(winMatch[1]), 120);
    if (!Number.isFinite(totalDays) || totalDays <= 1) return [];

    const weekdayMap: Record<string, number> = {
      segunda: 1,
      segundas: 1,
      terca: 2,
      tercas: 2,
      quarta: 3,
      quartas: 3,
      quinta: 4,
      quintas: 4,
      sexta: 5,
      sextas: 5,
      sabado: 6,
      sabados: 6,
      domingo: 7,
      domingos: 7,
    };
    const wd = weekdayMap[dayMatch[1]];
    if (!wd) return [];

    const now = DateTime.now().setZone(timezone).startOf('day');
    const dates: DateTime[] = [];
    for (let i = 1; i <= totalDays && dates.length < 80; i++) {
      const candidate = now.plus({ days: i });
      if (candidate.weekday === wd) dates.push(candidate);
    }
    if (dates.length <= 1) return [];

    const titleSeed = text
      .replace(/\b(?:toda|todas)\s+(segundas?|tercas?|quartas?|quintas?|sextas?|sabados?|domingos?)(?:\s+feira)?\b/gi, ' ')
      .replace(/\bproxim(?:os|as)\s+\d{1,3}\s+dias?\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const title = extractEventTitle(titleSeed || text) || 'Compromisso';

    return dates.map((d) => {
      const scheduled = d.set({
        hour: primaryTime.hour,
        minute: primaryTime.minute,
        second: 0,
        millisecond: 0,
      });
      return `${title} dia ${scheduled.toFormat('dd/MM/yyyy')} as ${scheduled.toFormat('HH:mm')}`;
    });
  }

  private expandLessonPackFromText(text: string, whatsappId: string, lessonPackagesJson: unknown): string[] {
    const pkg = this.findConfiguredLessonPackage(text, lessonPackagesJson);
    const ascii = text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    const packMatch = ascii.match(/\b(\d{1,2})\s+aulas?\b/);
    let total: number | null = null;
    if (pkg != null && pkg.lessons > 0) {
      total = pkg.lessons;
    } else if (packMatch) {
      total = parseInt(packMatch[1], 10);
    }
    if (!total || !Number.isFinite(total) || total < 1 || total > 60) return [];

    const dayDefs: { re: RegExp; w: number }[] = [
      { re: /\bsegundas?(?:-feira)?\b/gi, w: 1 },
      { re: /\btercas?(?:-feira)?\b/gi, w: 2 },
      { re: /\bquartas?(?:-feira)?\b/gi, w: 3 },
      { re: /\bquintas?(?:-feira)?\b/gi, w: 4 },
      { re: /\bsextas?(?:-feira)?\b/gi, w: 5 },
      { re: /\bsabados?\b/gi, w: 6 },
      { re: /\bdomingos?\b/gi, w: 7 },
    ];
    const weekdays = new Set<number>();
    for (const { re, w } of dayDefs) {
      if (re.test(ascii)) weekdays.add(w);
    }
    if (weekdays.size === 0) return [];

    const settingsTimezone = getUserTimezone(whatsappId);
    const primaryTime =
      this.extractTimeFromDaysListContext(text) ||
      this.extractExplicitTimeFromText(text) ||
      { hour: 9, minute: 0 };

    let stripped = ascii;
    stripped = stripped.replace(/\b(\d{1,2})\s+aulas?\b/gi, ' ');
    stripped = stripped.replace(/\bpacote\s+[a-z0-9_-]+\s+de\s+aulas\b/gi, ' ');
    stripped = stripped.replace(/\bpacote\s+de\s+aulas\s+[a-z0-9_-]+\b/gi, ' ');
    stripped = stripped.replace(/\baulas?\s+do\s+pacote\s+[a-z0-9_-]+\b/gi, ' ');
    stripped = stripped.replace(/\bpacote\s+[a-z0-9_-]+\b/gi, ' ');
    stripped = this.stripPortugueseEveryWeekdayFromInstructionText(stripped);
    for (const { re } of dayDefs) {
      stripped = stripped.replace(re, ' ');
    }
    stripped = stripped.replace(/\bpara\b/gi, ' ').replace(/\s+/g, ' ').trim();
    stripped = stripped
      .replace(/\b(?:marque|marcar|agende)\b/gi, ' ')
      .replace(/\bpel[oa]s?\b/gi, ' ')
      .replace(/\bpr[oó]xim\w*\b/gi, ' ')
      .replace(/\b(?:às|as)\s*\d{1,2}(?::\d{2})?\s*(?:h|hrs?)?(?:\s+da\s+(?:manha|manhã|tarde|noite))?\b/gi, ' ')
      .replace(/\b(?:da|de)\s+(?:manha|manhã|tarde|noite)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const title = extractEventTitle(stripped.length ? stripped : text) || 'Aula';

    const out: string[] = [];
    let cursor = DateTime.now().setZone(settingsTimezone).startOf('day');
    let guard = 0;
    while (out.length < total && guard < 800) {
      guard += 1;
      if (weekdays.has(cursor.weekday)) {
        const scheduled = cursor.set({
          hour: primaryTime.hour,
          minute: primaryTime.minute,
          second: 0,
          millisecond: 0,
        });
        out.push(`${title} dia ${scheduled.toFormat('dd/MM/yyyy')} as ${scheduled.toFormat('HH:mm')}`);
      }
      cursor = cursor.plus({ days: 1 });
    }
    return out;
  }

  private displayGuestNameFromRow(r: UserGuestContactRow): string {
    const first = (r.aliasNames ?? [])[0]?.trim();
    if (first) {
      return first
        .split(/\s+/)
        .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ''))
        .join(' ')
        .trim();
    }
    if (r.canonicalEmail) {
      const p = r.canonicalEmail.split('@')[0]?.trim();
      if (p) return p;
    }
    if (r.guestPhoneE164) return `Aluno ${r.guestPhoneE164}`;
    return 'Aluno';
  }

  private async findGuestMentionedInText(userId: number, normalizedAscii: string): Promise<UserGuestContactRow | null> {
    const contacts = await storage.listUserGuestContacts(userId);
    let best: UserGuestContactRow | null = null;
    let bestLen = 0;
    for (const row of contacts) {
      for (const alias of row.aliasNames ?? []) {
        const ak = this.normalizeForComparison(alias);
        if (ak.length < 4) continue;
        if (normalizedAscii.includes(ak) && ak.length > bestLen) {
          best = row;
          bestLen = ak.length;
        }
      }
    }
    return best;
  }

  /** Remove "toda quarta" / "todas as terças" antes de apagar só o nome do dia (evita sobrar "toda" no título do evento). */
  private stripPortugueseEveryWeekdayFromInstructionText(text: string): string {
    return text.replace(
      /\b(?:toda|todas)\s+(?:a\s+)?(?:segundas?|tercas?|quartas?|quintas?|sextas?|sabados?|domingos?)(?:\s+feira)?\b/gi,
      ' ',
    );
  }

  /**
   * Agenda de hoje: com Google/Microsoft conectados, lista ao vivo no intervalo do dia (reflete exclusões no calendário).
   * Sem conexão (ou se a API falhar), usa o banco do Zelar.
   */
  private async getTodayAgendaLinesForUser(
    user: { id: number },
    tz: string,
  ): Promise<{
    lines: Array<{ hhmm: string; title: string }>;
    usedCalendar: 'google' | 'microsoft' | null;
    fallbackNote: string | null;
  }> {
    const settings = await storage.getUserSettings(user.id);
    const dayStart = DateTime.now().setZone(tz).startOf('day');
    const dayEndEx = dayStart.plus({ days: 1 });
    const tMin = dayStart.toUTC().toISO()!;
    const tMax = dayEndEx.toUTC().toISO()!;

    const tryDb = async (): Promise<Array<{ hhmm: string; title: string; ms: number }>> => {
      const dbEvents = await storage.getUserEventsBetween(
        user.id,
        dayStart.toUTC().toJSDate(),
        dayEndEx.toUTC().toJSDate(),
      );
      const out: Array<{ hhmm: string; title: string; ms: number }> = [];
      const seen = new Set<string>();
      for (const e of dbEvents) {
        const st = DateTime.fromJSDate(new Date(e.startDate)).setZone(tz);
        if (st < dayStart || st >= dayEndEx) continue;
        const hhmm = st.toFormat('HH:mm');
        const key = `${hhmm}_${(e.title || '').toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({
          hhmm,
          title: (e.title as string) || 'Evento',
          ms: st.toMillis(),
        });
      }
      out.sort((a, b) => a.ms - b.ms);
      return out;
    };

    const finalizeDb = async (note: string | null) => {
      const dbLines = await tryDb();
      return {
        lines: dbLines.map(({ hhmm, title }) => ({ hhmm, title })),
        usedCalendar: null,
        fallbackNote: note,
      };
    };

    if (settings?.calendarProvider === 'google' && settings.googleTokens) {
      try {
        setTokens(user.id, JSON.parse(settings.googleTokens));
        const res = await listGoogleEventsInTimeRange(user.id, tMin, tMax);
        if (!res.success) {
          return finalizeDb(
            'Não foi possível ler o Google Calendar; mostrei o que está salvo no Zelar.',
          );
        }
        const rows: Array<{ hhmm: string; title: string; ms: number }> = [];
        for (const ev of res.events ?? []) {
          const startRaw = ev?.start?.dateTime || ev?.start?.date;
          if (!startRaw) continue;
          let st: DateTime;
          if (ev.start?.dateTime) {
            st = DateTime.fromISO(ev.start.dateTime, { setZone: true }).setZone(tz);
          } else if (ev.start?.date) {
            st = DateTime.fromISO(String(ev.start.date), { zone: tz }).startOf('day');
          } else {
            continue;
          }
          if (st < dayStart || st >= dayEndEx) continue;
          rows.push({
            hhmm: st.toFormat('HH:mm'),
            title: String(ev.summary || 'Evento'),
            ms: st.toMillis(),
          });
        }
        rows.sort((a, b) => a.ms - b.ms);
        return {
          lines: rows.map(({ hhmm, title }) => ({ hhmm, title })),
          usedCalendar: 'google',
          fallbackNote: null,
        };
      } catch (error) {
        console.error('getTodayAgendaLinesForUser Google:', error);
        return finalizeDb(
          'Não foi possível ler o Google Calendar; mostrei o que está salvo no Zelar.',
        );
      }
    }

    if (settings?.calendarProvider === 'microsoft' && settings.microsoftTokens) {
      try {
        const res = await listMicrosoftCalendarViewInRange(user.id, tMin, tMax);
        if (!res.success) {
          return finalizeDb(
            'Não foi possível ler o Microsoft Calendar; mostrei o que está salvo no Zelar.',
          );
        }
        const rows: Array<{ hhmm: string; title: string; ms: number }> = [];
        for (const ev of res.events ?? []) {
          const startRaw = ev?.start?.dateTime;
          if (!startRaw) continue;
          const st = DateTime.fromISO(String(startRaw), { setZone: true }).setZone(tz);
          if (st < dayStart || st >= dayEndEx) continue;
          rows.push({
            hhmm: st.toFormat('HH:mm'),
            title: String(ev.subject || 'Evento'),
            ms: st.toMillis(),
          });
        }
        rows.sort((a, b) => a.ms - b.ms);
        return {
          lines: rows.map(({ hhmm, title }) => ({ hhmm, title })),
          usedCalendar: 'microsoft',
          fallbackNote: null,
        };
      } catch (error) {
        console.error('getTodayAgendaLinesForUser Microsoft:', error);
        return finalizeDb(
          'Não foi possível ler o Microsoft Calendar; mostrei o que está salvo no Zelar.',
        );
      }
    }

    const dbOnly = await tryDb();
    return {
      lines: dbOnly.map(({ hhmm, title }) => ({ hhmm, title })),
      usedCalendar: null,
      fallbackNote: null,
    };
  }

  private async formatTodayAgendaSummary(user: any, userTimezone: string): Promise<string> {
    const { lines, usedCalendar, fallbackNote } = await this.getTodayAgendaLinesForUser(user, userTimezone);
    if (!lines.length) {
      let msg = '📅 *Hoje* você não tem aulas ou compromissos registrados na agenda.';
      if (fallbackNote) {
        msg += `\n⚠️ _${fallbackNote}_`;
      }
      return msg;
    }
    const body = lines.map((r) => `• *${r.hhmm}* — ${r.title}`).join('\n');
    let footer = '';
    if (usedCalendar === 'google') {
      footer = '\n_Fonte: Google Calendar._';
    } else if (usedCalendar === 'microsoft') {
      footer = '\n_Fonte: Microsoft Calendar._';
    }
    if (fallbackNote) {
      footer += `\n⚠️ _${fallbackNote}_`;
    }
    return `📅 *Agenda de hoje*\n\n${body}${footer}`;
  }

  private parseBrAmountToCents(raw: string): number | null {
    const t = raw.trim();
    if (!t) return null;
    const noThousands = t.replace(/\./g, '').replace(',', '.');
    const n = parseFloat(noThousands);
    if (!Number.isFinite(n) || n < 0) return null;
    return Math.round(n * 100);
  }

  private formatBrlFromCents(cents: number): string {
    return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  private async tryAnswerMvpOperationalQuery(
    remoteJid: string,
    user: any,
    rawText: string,
    userTimezone: string,
  ): Promise<boolean> {
    const emailOk = typeof user?.email === 'string' && user.email.trim().length > 0;
    if (user.subscriptionStatus !== 'active' || !emailOk) {
      return false;
    }

    const t = this.normalizeForComparison(rawText);
    if (!t) return false;

    if (/\b(quem\s+falta\s+pagar|pendencias?\s+financeiras?|contas?\s+pendentes?|inadimplentes?)\b/i.test(t)) {
      const contacts = await storage.listUserGuestContacts(user.id);
      const pending = contacts
        .filter((c) => (c.financialStatus ?? 'pendente') === 'pendente')
        .slice(0, 25);
      if (!pending.length) {
        await this.sendMessage(remoteJid, '✅ Não há pendências financeiras no momento.');
        return true;
      }
      const lines = pending.map((c) => {
        const name = this.displayGuestNameFromRow(c);
        const amt =
          typeof c.monthlyAmountCents === 'number'
            ? ` · ref. ${this.formatBrlFromCents(c.monthlyAmountCents)}`
            : '';
        return `• ${name}${amt}`;
      });
      await this.sendMessage(
        remoteJid,
        `💳 *Pendências financeiras* (${pending.length})\n\n${lines.join('\n')}`,
      );
      return true;
    }

    if (
      /\b(aulas?|compromissos?|agenda)\b.*\bhoje\b/i.test(t) ||
      /\bhoje\b.*\b(tenho\s+)?(aulas?|compromissos?|agenda)\b/i.test(t)
    ) {
      const msg = await this.formatTodayAgendaSummary(user, userTimezone);
      await this.sendMessage(remoteJid, msg);
      return true;
    }

    if (/\bquantas?\s+aulas?\b/i.test(t)) {
      const mentioned = await this.findGuestMentionedInText(user.id, t);
      if (!mentioned) {
        await this.sendMessage(
          remoteJid,
          '👤 *Qual aluno?*\n\nInclua o *nome cadastrado* no painel (ex.: "quantas aulas tem o João da Silva?").',
        );
        return true;
      }
      if (mentioned.remainingLessons == null) {
        await this.sendMessage(
          remoteJid,
          `ℹ️ Ainda não informei aulas restantes para *${this.displayGuestNameFromRow(mentioned)}*. Cadastre no painel (coluna aulas restantes).`,
        );
        return true;
      }
      await this.sendMessage(
        remoteJid,
        `📚 *${this.displayGuestNameFromRow(mentioned)}*: faltam *${mentioned.remainingLessons}* aula(s).`,
      );
      return true;
    }

    const pixRe1 =
      /(?:recebi|recebemos)\s+(?:um\s+)?pix\s+(?:de\s+)?(.+?)\s+(?:no\s+)?valor\s+(?:de\s+)?r?\$?\s*([\d.,]+)/i;
    const pixRe2 = /\bpix\s+(?:de\s+)?(.+?)\s+(?:no\s+)?valor\s+(?:de\s+)?r?\$?\s*([\d.,]+)/i;
    const m = rawText.match(pixRe1) || rawText.match(pixRe2);
    if (m) {
      const namePart = (m[1] || '').replace(/\s+no\s+$/i, '').trim();
      const amountCents = this.parseBrAmountToCents(m[2] || '');
      if (!namePart || amountCents == null) {
        return false;
      }
      const contact =
        (await storage.findGuestContactByLooseName(user.id, namePart)) ||
        (await this.findGuestMentionedInText(user.id, t));
      if (!contact) {
        await this.sendMessage(
          remoteJid,
          'Não encontrei um aluno parecido com esse nome. Confira o cadastro no painel ou mencione o nome completo.',
        );
        return true;
      }
      this.pendingPixConfirmations.set(remoteJid, {
        userId: user.id,
        contactId: contact.id,
        payerLabel: namePart,
        amountCents,
        createdAtMs: Date.now(),
      });
      await this.sendMessage(
        remoteJid,
        `Recebi *PIX* de *${namePart}*, valor *${this.formatBrlFromCents(amountCents)}*.\n\n` +
          `Confirma que foi o aluno *${this.displayGuestNameFromRow(contact)}*? Responda *sim* ou *não* (válido por ~15 min).`,
      );
      return true;
    }

    return false;
  }

  private async expandMultipleCommitments(
    text: string,
    whatsappId: string,
    userSettings: UserSettings | undefined,
  ): Promise<string[]> {
    const pack = this.expandLessonPackFromText(text, whatsappId, userSettings?.lessonPackagesJson ?? null);
    if (pack.length > 1) {
      return this.applyFinalTagToLastCommitment(pack);
    }
    if (pack.length === 1) {
      return pack;
    }

    const settingsTimezone = getUserTimezone(whatsappId);
    const allTimes = this.extractExplicitTimesFromText(text);
    const primaryTime =
      this.extractTimeFromDaysListContext(text) ||
      this.extractExplicitTimeFromText(text) ||
      allTimes[0] ||
      { hour: 9, minute: 0 };

    const weekdayWindow = this.extractWeekdayWithinRelativeDaysExpansion(text, settingsTimezone, primaryTime);
    if (weekdayWindow.length > 1) {
      return this.applyFinalTagToLastCommitment(weekdayWindow);
    }

    const weekdayDate = this.extractWeekdayDateFromText(text, settingsTimezone);
    const listedDays = this.extractDaysListFromText(text, settingsTimezone);
    const relativeRangeDays = this.extractRelativeDayRange(text);
    const relativeWeekdayRange = this.extractRelativeWeekdayRange(text);

    if (relativeWeekdayRange) {
      const relativeWeekdayDates = this.buildRelativeWeekdayDates(
        settingsTimezone,
        relativeWeekdayRange.weekday,
        relativeWeekdayRange.occurrences
      );

      if (relativeWeekdayDates.length > 1) {
        const titleSeed = this.stripPortugueseEveryWeekdayFromInstructionText(
          text
            .replace(/\bpel[oa]s?\b/gi, ' ')
            .replace(/\bproxim(?:os|as)\s+\d{1,3}\s+(segundas?|tercas?|quartas?|quintas?|sextas?|sabados?|domingos?)(?:\s+feiras?)?\b/gi, ' ')
            .replace(/\s+/g, ' ')
            .trim(),
        );
        const title = extractEventTitle(titleSeed || text) || 'Compromisso';

        const messages = relativeWeekdayDates.map((d) => {
          const scheduled = d.set({
            hour: primaryTime.hour,
            minute: primaryTime.minute,
            second: 0,
            millisecond: 0,
          });

          return `${title} dia ${scheduled.toFormat('dd/MM/yyyy')} as ${scheduled.toFormat('HH:mm')}`;
        });

        return this.applyFinalTagToLastCommitment(messages);
      }
    }

    if (relativeRangeDays && relativeRangeDays > 1) {
      const relativeDates = this.buildRelativeRangeDates(text, settingsTimezone, relativeRangeDays);
      if (relativeDates.length > 1) {
        const titleSeed = this.buildTitleSeedForRelativeRange(text);
        const title = extractEventTitle(titleSeed || text) || 'Compromisso';

        const messages = relativeDates.map((d) => {
          const scheduled = d.set({
            hour: primaryTime.hour,
            minute: primaryTime.minute,
            second: 0,
            millisecond: 0,
          });

          return `${title} dia ${scheduled.toFormat('dd/MM/yyyy')} as ${scheduled.toFormat('HH:mm')}`;
        });

        return this.applyFinalTagToLastCommitment(messages);
      }
    }

    if (listedDays.length > 1) {
      const titleSeed = this.stripPortugueseEveryWeekdayFromInstructionText(
        text
          .replace(/\bdias?\s+[\d,\se]+(?:\s*(?:as|às)\s*\d{1,2}(?::\d{2})?\s*h?)?/gi, ' ')
          .replace(/\b(?:as|às)\s*\d{1,2}(?::\d{2})?\s*h?\b/gi, ' ')
          .replace(/\s+/g, ' ')
          .trim(),
      );
      const title = extractEventTitle(titleSeed) || 'Compromisso';
      const messages = listedDays.map((d) => {
        const scheduled = d.set({
          hour: primaryTime.hour,
          minute: primaryTime.minute,
          second: 0,
          millisecond: 0
        });
        return `${title} dia ${scheduled.toFormat('dd/MM/yyyy')} as ${scheduled.toFormat('HH:mm')}`;
      });
      return this.applyFinalTagToLastCommitment(messages);
    }

    if (weekdayDate && allTimes.length > 1) {
      const title = extractEventTitle(text) || 'Compromisso';
      const messages = allTimes.map((t) => {
        const scheduled = weekdayDate.set({
          hour: t.hour,
          minute: t.minute,
          second: 0,
          millisecond: 0
        });
        return `${title} dia ${scheduled.toFormat('dd/MM/yyyy')} as ${scheduled.toFormat('HH:mm')}`;
      });
      return this.applyFinalTagToLastCommitment(messages);
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

    if (expanded.length > 1) {
      return this.applyFinalTagToLastCommitment(expanded);
    }
    return [text];
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
