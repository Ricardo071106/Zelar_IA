import { db } from "./db";
import { eq, and, desc, gt, gte, lt, lte, sql, asc, inArray, ne } from "drizzle-orm";
import {
  users,
  type User,
  type InsertUser,
  userSettings,
  type UserSettings,
  type InsertUserSettings,
  events,
  type Event,
  type InsertEvent,
  reminders,
  type Reminder,
  type InsertReminder,
  userGuestContacts,
  userContactGroups,
  userContactGroupMembers,
} from "@shared/schema";
import { normalizeAliasKey } from "./utils/normalizeGuestAlias";
import { normalizeBrazilianPhone } from "./utils/phoneExtraction";
import { isFullName, fullNameValidationMessage } from "./utils/fullName";

function isValidEmailFormat(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

export type UserGuestContactRow = {
  id: number;
  userId: number;
  normalizedEmail: string | null;
  canonicalEmail: string | null;
  aliasNames: string[];
  guestPhoneE164: string | null;
  identityNotifiedAt: Date | null;
  studentType: string | null;
  monthlyAmountCents: number | null;
  packageLessonsTotal: number | null;
  remainingLessons: number | null;
  financialStatus: string;
  notes: string | null;
};

export const FINANCIAL_STATUSES = new Set(["pago", "pendente", "cancelado", "reagendado"]);

export function parseFinancialStatus(raw: string | null | undefined): string {
  const t = (raw ?? "").trim().toLowerCase();
  if (!FINANCIAL_STATUSES.has(t)) {
    throw new Error("status financeiro invalido: use pago, pendente, cancelado ou reagendado");
  }
  return t;
}

export type GuestPanelUpsertData = {
  id?: number;
  email?: string;
  name?: string;
  phone?: string | null;
  studentType?: string | null;
  notes?: string | null;
  financialStatus?: string | null;
  monthlyAmountCents?: number | null;
  packageLessonsTotal?: number | null;
  remainingLessons?: number | null;
};

export function pickGuestMvpPatch(data: GuestPanelUpsertData): Partial<(typeof userGuestContacts.$inferInsert)> {
  const patch: Partial<(typeof userGuestContacts.$inferInsert)> = {};
  if (Object.prototype.hasOwnProperty.call(data, "studentType") && data.studentType !== undefined) {
    const v = data.studentType;
    patch.studentType =
      v == null || String(v).trim() === "" ? null : String(v).trim().slice(0, 64);
  }
  if (Object.prototype.hasOwnProperty.call(data, "monthlyAmountCents") && data.monthlyAmountCents !== undefined) {
    const v = data.monthlyAmountCents;
    if (v == null) patch.monthlyAmountCents = null;
    else if (typeof v === "number" && Number.isFinite(v)) patch.monthlyAmountCents = Math.round(v);
  }
  if (Object.prototype.hasOwnProperty.call(data, "packageLessonsTotal") && data.packageLessonsTotal !== undefined) {
    const v = data.packageLessonsTotal;
    if (v == null) patch.packageLessonsTotal = null;
    else if (typeof v === "number" && Number.isFinite(v)) patch.packageLessonsTotal = Math.round(v);
  }
  if (Object.prototype.hasOwnProperty.call(data, "remainingLessons") && data.remainingLessons !== undefined) {
    const v = data.remainingLessons;
    if (v == null) patch.remainingLessons = null;
    else if (typeof v === "number" && Number.isFinite(v)) patch.remainingLessons = Math.round(v);
  }
  if (Object.prototype.hasOwnProperty.call(data, "financialStatus") && data.financialStatus != null && data.financialStatus !== "") {
    patch.financialStatus = parseFinancialStatus(data.financialStatus);
  }
  if (Object.prototype.hasOwnProperty.call(data, "notes") && data.notes !== undefined) {
    const v = data.notes;
    patch.notes = v == null || String(v).trim() === "" ? null : String(v).trim();
  }
  return patch;
}

export function mapGuestContactRow(r: typeof userGuestContacts.$inferSelect): UserGuestContactRow {
  return {
    id: r.id,
    userId: r.userId,
    normalizedEmail: r.normalizedEmail ?? null,
    canonicalEmail: r.canonicalEmail ?? null,
    aliasNames: r.aliasNames ?? [],
    guestPhoneE164: r.guestPhoneE164 ?? null,
    identityNotifiedAt: r.identityNotifiedAt ?? null,
    studentType: r.studentType ?? null,
    monthlyAmountCents: r.monthlyAmountCents ?? null,
    packageLessonsTotal: r.packageLessonsTotal ?? null,
    remainingLessons: r.remainingLessons ?? null,
    financialStatus: r.financialStatus ?? "pendente",
    notes: r.notes ?? null,
  };
}

export interface IStorage {
  // Usuários
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByTelegramId(telegramId: string): Promise<User | undefined>;
  getUserByWhatsApp(whatsappId: string): Promise<User | undefined>;
  getUserByStripeId(stripeId: string): Promise<User | undefined>;
  /** Login do painel por e-mail (comparação case-insensitive). */
  getUserByNormalizedEmail(normalizedEmail: string): Promise<User | undefined>;
  /** True se outro usuário já usa este e-mail (painel). */
  existsOtherUserWithEmail(excludeUserId: number, normalizedEmail: string): Promise<boolean>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined>;
  updateUserSubscription(id: number, data: { status: string; stripeCustomerId?: string; subscriptionEndsAt?: Date | null }): Promise<User | undefined>;


  // Configurações do usuário
  getUserSettings(userId: number): Promise<UserSettings | undefined>;
  createUserSettings(settings: InsertUserSettings): Promise<UserSettings>;
  updateUserSettings(userId: number, data: Partial<InsertUserSettings>): Promise<UserSettings | undefined>;

  // Eventos
  createEvent(event: InsertEvent): Promise<Event>;
  getEvent(id: number): Promise<Event | undefined>;
  getUserEvents(userId: number): Promise<Event[]>;
  getUpcomingEvents(userId: number, limit?: number): Promise<Event[]>;
  updateEvent(eventId: number, data: Partial<Event>): Promise<Event | undefined>;
  deleteEvent(eventId: number): Promise<boolean>;

  // Lembretes
  createReminder(reminder: InsertReminder): Promise<Reminder>;
  getReminder(id: number): Promise<Reminder | undefined>;
  getEventReminders(eventId: number): Promise<Reminder[]>;
  getPendingRemindersToSend(): Promise<Reminder[]>;
  getUserPendingReminders(userId: number): Promise<Reminder[]>;
  getAllUnsentReminders(): Promise<Reminder[]>;
  updateReminder(reminderId: number, data: Partial<Reminder>): Promise<Reminder | undefined>;
  markReminderSent(reminderId: number): Promise<void>;
  deleteReminder(reminderId: number): Promise<boolean>;
  deleteRemindersByEvent(eventId: number): Promise<void>;

  /** Planilha única: convidados por /convidado + e-mails do convite escrito */
  listUserGuestContacts(userId: number): Promise<UserGuestContactRow[]>;
  upsertUserGuestContactWithAlias(userId: number, displayName: string, emailRaw: string): Promise<void>;
  upsertUserGuestContactEmailTyped(userId: number, normalizedEmail: string, canonicalEmail: string): Promise<void>;
  /** Remove por *nome* (alias) ou por *e-mail* (apaga a linha inteira na planilha). */
  deleteUserGuestContactEntry(userId: number, nameOrEmail: string): Promise<boolean>;
  deleteUserGuestContactById(userId: number, id: number): Promise<boolean>;
  upsertGuestFromPanel(userId: number, data: GuestPanelUpsertData): Promise<UserGuestContactRow>;
  markGuestIdentityNotified(userId: number, contactId: number): Promise<void>;
  getUserEventsBetween(userId: number, startInclusive: Date, endExclusive: Date): Promise<Event[]>;
  updateGuestContactFields(
    userId: number,
    contactId: number,
    patch: { financialStatus?: string; remainingLessons?: number | null; notes?: string | null },
  ): Promise<UserGuestContactRow | undefined>;
  findGuestContactByLooseName(userId: number, nameQuery: string): Promise<UserGuestContactRow | null>;

  listUserContactGroupsWithMembers(
    userId: number,
  ): Promise<{ id: number; name: string; normalizedName: string; contactIds: number[] }[]>;
  createUserContactGroup(userId: number, name: string, contactIds: number[]): Promise<{ id: number }>;
  updateUserContactGroup(
    userId: number,
    groupId: number,
    data: { name?: string; contactIds?: number[] },
  ): Promise<void>;
  deleteUserContactGroup(userId: number, groupId: number): Promise<boolean>;

  findUserIdByPluggyItemId(itemId: string): Promise<number | null>;
  listPendingLessonEventsForContact(userId: number, studentContactId: number): Promise<Event[]>;
  /** Retorna true se inseriu (primeira vez); false se transação já processada. */
  tryRecordPluggyTransactionOnce(userId: number, transactionId: string): Promise<boolean>;
  /** Primeira linha do tempo em que uma aula foi criada para esse aluno (created_at do evento). */
  getFirstLessonCreatedAtForContact(userId: number, studentContactId: number): Promise<Date | null>;
  /** Soma centavos de créditos Pluggy registrados para o aluno com data >= since (inclusive). */
  sumPluggyContactCreditsSince(userId: number, contactId: number, sinceInclusive: Date): Promise<number>;
  /** Quantas aulas já estão marcadas como pagas para esse aluno. */
  countPaidLessonEventsForContact(userId: number, contactId: number): Promise<number>;
  /** Registra um crédito por transação Pluggy (dedupe por user_id + transaction_id). Retorna true se inseriu. */
  insertPluggyContactCredit(
    userId: number,
    contactId: number,
    transactionId: string,
    amountCents: number,
    txPostedAt: Date,
  ): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  // =================== USUÁRIOS ===================

  async getUser(id: number): Promise<User | undefined> {
    if (!db) return undefined;
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    if (!db) return undefined;
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserByTelegramId(telegramId: string): Promise<User | undefined> {
    if (!db) return undefined;
    const [user] = await db.select().from(users).where(eq(users.telegramId, telegramId));
    return user;
  }

  async getUserByWhatsApp(whatsappId: string): Promise<User | undefined> {
    if (!db) return undefined;
    // WhatsApp ID será armazenado no campo username por enquanto
    const [user] = await db.select().from(users).where(eq(users.username, whatsappId));
    return user;
  }

  async getUserByStripeId(stripeId: string): Promise<User | undefined> {
    if (!db) return undefined;
    const [user] = await db.select().from(users).where(eq(users.stripeCustomerId, stripeId));
    return user;
  }

  async getUserByNormalizedEmail(normalizedEmail: string): Promise<User | undefined> {
    if (!db) return undefined;
    const norm = normalizedEmail.trim().toLowerCase();
    if (!norm) return undefined;
    const [user] = await db
      .select()
      .from(users)
      .where(sql`lower(trim(${users.email})) = ${norm}`)
      .limit(1);
    return user;
  }

  async existsOtherUserWithEmail(excludeUserId: number, normalizedEmail: string): Promise<boolean> {
    if (!db) return false;
    const norm = normalizedEmail.trim().toLowerCase();
    if (!norm) return false;
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(and(sql`lower(trim(${users.email})) = ${norm}`, ne(users.id, excludeUserId)))
      .limit(1);
    return rows.length > 0;
  }

  async createUser(user: InsertUser): Promise<User> {
    if (!db) throw new Error("Database not connected");
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  async updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined> {
    if (!db) return undefined;
    const [updatedUser] = await db
      .update(users)
      .set(data)
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }

  async updateUserSubscription(id: number, data: { status: string; stripeCustomerId?: string; subscriptionEndsAt?: Date | null }): Promise<User | undefined> {
    if (!db) return undefined;
    const [updatedUser] = await db
      .update(users)
      .set({
        subscriptionStatus: data.status,
        stripeCustomerId: data.stripeCustomerId,
        subscriptionEndsAt: data.subscriptionEndsAt,
      })
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }

  // =================== CONFIGURAÇÕES DO USUÁRIO ===================

  async getUserSettings(userId: number): Promise<UserSettings | undefined> {
    if (!db) return undefined;
    try {
      const [settings] = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
      return settings;
    } catch (error: any) {
      // Fallback para bancos que ainda não receberam a migration de microsoft_tokens.
      if (error?.code === '42703' && String(error?.message || '').includes('microsoft_tokens')) {
        const legacyResult = await db.execute(sql`
          SELECT
            id,
            user_id,
            notifications_enabled,
            reminder_times,
            calendar_provider,
            google_tokens,
            apple_tokens,
            language,
            time_zone,
            updated_at
          FROM user_settings
          WHERE user_id = ${userId}
          LIMIT 1
        `);

        const row = (legacyResult as any)?.rows?.[0];
        if (!row) return undefined;

        return {
          id: row.id,
          userId: row.user_id,
          notificationsEnabled: row.notifications_enabled,
          reminderTimes: row.reminder_times,
          calendarProvider: row.calendar_provider,
          googleTokens: row.google_tokens,
          microsoftTokens: null,
          appleTokens: row.apple_tokens,
          language: row.language,
          timeZone: row.time_zone,
          updatedAt: row.updated_at,
        } as UserSettings;
      }

      throw error;
    }
  }

  async createUserSettings(settings: InsertUserSettings): Promise<UserSettings> {
    if (!db) throw new Error("Database not connected");
    const [newSettings] = await db
      .insert(userSettings)
      .values(settings)
      .returning();
    return newSettings;
  }

  async updateUserSettings(userId: number, data: Partial<InsertUserSettings>): Promise<UserSettings | undefined> {
    if (!db) return undefined;
    try {
      const [updatedSettings] = await db
        .update(userSettings)
        .set(data)
        .where(eq(userSettings.userId, userId))
        .returning();
      return updatedSettings;
    } catch (error: any) {
      if (
        error?.code === '42703' &&
        String(error?.message || '').includes('microsoft_tokens') &&
        Object.prototype.hasOwnProperty.call(data, 'microsoftTokens')
      ) {
        throw new Error('A coluna user_settings.microsoft_tokens nao existe no banco atual. Execute as migrations no Supabase antes de conectar o Microsoft Calendar.');
      }

      throw error;
    }
  }

  // =================== EVENTOS ===================

  async createEvent(event: InsertEvent): Promise<Event> {
    if (!db) throw new Error("Database not connected");
    const [newEvent] = await db.insert(events).values({
      ...event,
      attendeeEmails: event.attendeeEmails || []
    }).returning();
    return newEvent;
  }

  async getEvent(id: number): Promise<Event | undefined> {
    if (!db) return undefined;
    const [event] = await db.select().from(events).where(eq(events.id, id));
    return event;
  }

  async getUserEvents(userId: number): Promise<Event[]> {
    if (!db) return [];
    const userEvents = await db
      .select()
      .from(events)
      .where(eq(events.userId, userId))
      .orderBy(desc(events.startDate));
    return userEvents;
  }

  async getUpcomingEvents(userId: number, limit: number = 10): Promise<Event[]> {
    if (!db) return [];
    const now = new Date();
    const upcomingEvents = await db
      .select()
      .from(events)
      .where(and(
        eq(events.userId, userId),
        gt(events.startDate, now)
      ))
      .orderBy(events.startDate)
      .limit(limit);
    return upcomingEvents;
  }

  async getUserEventsBetween(userId: number, startInclusive: Date, endExclusive: Date): Promise<Event[]> {
    if (!db) return [];
    return db
      .select()
      .from(events)
      .where(
        and(eq(events.userId, userId), gte(events.startDate, startInclusive), lt(events.startDate, endExclusive)),
      )
      .orderBy(asc(events.startDate));
  }

  async updateEvent(eventId: number, data: Partial<Event>): Promise<Event | undefined> {
    if (!db) return undefined;
    const [updatedEvent] = await db
      .update(events)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(events.id, eventId))
      .returning();
    return updatedEvent;
  }

  async deleteEvent(eventId: number): Promise<boolean> {
    if (!db) return false;
    const result = await db.delete(events).where(eq(events.id, eventId));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // =================== LEMBRETES ===================
  async createReminder(reminder: InsertReminder): Promise<Reminder> {
    if (!db) throw new Error("Database not connected");
    const [newReminder] = await db.insert(reminders).values(reminder).returning();
    return newReminder;
  }

  async getReminder(id: number): Promise<Reminder | undefined> {
    if (!db) return undefined;
    const [reminder] = await db.select().from(reminders).where(eq(reminders.id, id));
    return reminder;
  }

  async getEventReminders(eventId: number): Promise<Reminder[]> {
    if (!db) return [];
    return db.select().from(reminders).where(eq(reminders.eventId, eventId)).orderBy(reminders.sendAt);
  }

  async getPendingRemindersToSend(): Promise<Reminder[]> {
    if (!db) return [];
    const now = new Date();
    return db
      .select()
      .from(reminders)
      .where(and(eq(reminders.sent, false), lte(reminders.sendAt, now)));
  }

  async getUserPendingReminders(userId: number): Promise<Reminder[]> {
    if (!db) return [];
    return db
      .select()
      .from(reminders)
      .where(and(eq(reminders.userId, userId), eq(reminders.sent, false)))
      .orderBy(reminders.sendAt);
  }

  async updateReminder(reminderId: number, data: Partial<Reminder>): Promise<Reminder | undefined> {
    if (!db) return undefined;
    const [updated] = await db
      .update(reminders)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(reminders.id, reminderId))
      .returning();
    return updated;
  }

  async markReminderSent(reminderId: number): Promise<void> {
    if (!db) return;
    await db
      .update(reminders)
      .set({ sent: true, sentAt: new Date(), updatedAt: new Date() })
      .where(eq(reminders.id, reminderId));
  }

  async getAllUnsentReminders(): Promise<Reminder[]> {
    if (!db) return [];
    return db.select().from(reminders).where(eq(reminders.sent, false)).orderBy(reminders.sendAt);
  }

  async deleteReminder(reminderId: number): Promise<boolean> {
    if (!db) return false;
    const result = await db.delete(reminders).where(eq(reminders.id, reminderId));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async deleteRemindersByEvent(eventId: number): Promise<void> {
    if (!db) return;
    await db.delete(reminders).where(eq(reminders.eventId, eventId));
  }

  async listUserGuestContacts(userId: number): Promise<UserGuestContactRow[]> {
    if (!db) return [];
    const rows = await db
      .select()
      .from(userGuestContacts)
      .where(eq(userGuestContacts.userId, userId))
      .orderBy(asc(userGuestContacts.id));
    return rows.map((r) => mapGuestContactRow(r));
  }

  async upsertUserGuestContactWithAlias(userId: number, displayName: string, emailRaw: string): Promise<void> {
    if (!db) throw new Error("Database not connected");
    const key = normalizeAliasKey(displayName);
    const ne = emailRaw.trim().toLowerCase();
    const canonical = emailRaw.trim();
    if (!key || !ne) throw new Error("alias e email obrigatorios");

    const all = await db.select().from(userGuestContacts).where(eq(userGuestContacts.userId, userId));
    for (const row of all) {
      const names = row.aliasNames ?? [];
      const filtered = names.filter((a) => normalizeAliasKey(a) !== key);
      if (filtered.length !== names.length) {
        await db
          .update(userGuestContacts)
          .set({ aliasNames: filtered, updatedAt: new Date() })
          .where(eq(userGuestContacts.id, row.id));
      }
    }

    const [existing] = await db
      .select()
      .from(userGuestContacts)
      .where(and(eq(userGuestContacts.userId, userId), eq(userGuestContacts.normalizedEmail, ne)));

    if (existing) {
      const merged = [...new Set([...(existing.aliasNames ?? []), key])];
      await db
        .update(userGuestContacts)
        .set({
          aliasNames: merged,
          canonicalEmail: canonical,
          updatedAt: new Date(),
        })
        .where(eq(userGuestContacts.id, existing.id));
    } else {
      await db.insert(userGuestContacts).values({
        userId,
        normalizedEmail: ne,
        canonicalEmail: canonical,
        aliasNames: [key],
        updatedAt: new Date(),
      });
    }
  }

  async upsertUserGuestContactEmailTyped(
    userId: number,
    normalizedEmail: string,
    canonicalEmail: string,
  ): Promise<void> {
    if (!db) throw new Error("Database not connected");
    const ne = normalizedEmail.trim().toLowerCase();
    const ce = canonicalEmail.trim();
    if (!ne || !ce) return;

    // Índice único é parcial (WHERE normalized_email IS NOT NULL) — ON CONFLICT não casa com 42P10.
    const [existing] = await db
      .select()
      .from(userGuestContacts)
      .where(and(eq(userGuestContacts.userId, userId), eq(userGuestContacts.normalizedEmail, ne)));

    if (existing) {
      await db
        .update(userGuestContacts)
        .set({ canonicalEmail: ce, updatedAt: new Date() })
        .where(eq(userGuestContacts.id, existing.id));
    } else {
      await db.insert(userGuestContacts).values({
        userId,
        normalizedEmail: ne,
        canonicalEmail: ce,
        aliasNames: [],
        updatedAt: new Date(),
      });
    }
  }

  async deleteUserGuestContactEntry(userId: number, nameOrEmail: string): Promise<boolean> {
    if (!db) return false;
    const raw = nameOrEmail.trim();
    if (!raw) return false;

    const emailMatch = raw.match(/\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/i);
    if (emailMatch) {
      const ne = emailMatch[0].trim().toLowerCase();

      const exact = await db
        .delete(userGuestContacts)
        .where(and(eq(userGuestContacts.userId, userId), eq(userGuestContacts.normalizedEmail, ne)))
        .returning({ id: userGuestContacts.id });
      if (exact.length > 0) return true;

      const candidates = await db
        .select({ id: userGuestContacts.id, normalizedEmail: userGuestContacts.normalizedEmail })
        .from(userGuestContacts)
        .where(eq(userGuestContacts.userId, userId));
      if (!candidates.length) return false;

      const maxDist = Math.min(12, Math.max(4, Math.ceil(ne.length * 0.55)));
      const scored = candidates
        .filter((c) => c.normalizedEmail != null && c.normalizedEmail !== '')
        .map((c) => ({ id: c.id, d: levenshteinDistance(ne, c.normalizedEmail!) }))
        .filter((x) => x.d <= maxDist)
        .sort((a, b) => a.d - b.d);
      if (scored.length === 0) return false;
      if (scored.length > 1 && scored[0].d === scored[1].d) return false;

      const fuzzy = await db
        .delete(userGuestContacts)
        .where(eq(userGuestContacts.id, scored[0].id))
        .returning({ id: userGuestContacts.id });
      return fuzzy.length > 0;
    }

    const key = normalizeAliasKey(raw);
    if (!key) return false;
    const rows = await db.select().from(userGuestContacts).where(eq(userGuestContacts.userId, userId));
    for (const row of rows) {
      const names = row.aliasNames ?? [];
      const filtered = names.filter((a) => normalizeAliasKey(a) !== key);
      if (filtered.length === names.length) continue;
      await db
        .update(userGuestContacts)
        .set({ aliasNames: filtered, updatedAt: new Date() })
        .where(eq(userGuestContacts.id, row.id));
      return true;
    }
    return false;
  }

  async deleteUserGuestContactById(userId: number, id: number): Promise<boolean> {
    if (!db) return false;
    const del = await db
      .delete(userGuestContacts)
      .where(and(eq(userGuestContacts.id, id), eq(userGuestContacts.userId, userId)))
      .returning({ id: userGuestContacts.id });
    return del.length > 0;
  }

  async findGuestContactByLooseName(userId: number, nameQuery: string): Promise<UserGuestContactRow | null> {
    const key = normalizeAliasKey(nameQuery.trim());
    if (!key || key.length < 2) return null;
    const contacts = await this.listUserGuestContacts(userId);
    let best: { row: UserGuestContactRow; score: number } | null = null;
    for (const row of contacts) {
      for (const alias of row.aliasNames ?? []) {
        const ak = normalizeAliasKey(alias);
        if (!ak) continue;
        let score = 0;
        if (ak === key) score = 100000 + ak.length;
        else if (ak.includes(key)) score = 50000 + ak.length;
        else if (key.includes(ak)) score = 10000 + ak.length;
        else continue;
        if (!best || score > best.score) best = { row, score };
      }
    }
    return best?.row ?? null;
  }

  async updateGuestContactFields(
    userId: number,
    contactId: number,
    patch: { financialStatus?: string; remainingLessons?: number | null; notes?: string | null },
  ): Promise<UserGuestContactRow | undefined> {
    if (!db) return undefined;
    const set: Partial<typeof userGuestContacts.$inferInsert> = { updatedAt: new Date() };
    if (patch.financialStatus !== undefined) {
      set.financialStatus = parseFinancialStatus(patch.financialStatus);
    }
    if (patch.remainingLessons !== undefined) {
      set.remainingLessons = patch.remainingLessons;
    }
    if (patch.notes !== undefined) {
      const v = patch.notes;
      set.notes = v == null || String(v).trim() === "" ? null : String(v).trim();
    }
    const [updated] = await db
      .update(userGuestContacts)
      .set(set)
      .where(and(eq(userGuestContacts.id, contactId), eq(userGuestContacts.userId, userId)))
      .returning();
    return updated ? mapGuestContactRow(updated) : undefined;
  }

  async markGuestIdentityNotified(userId: number, contactId: number): Promise<void> {
    if (!db) return;
    await db
      .update(userGuestContacts)
      .set({ identityNotifiedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(userGuestContacts.id, contactId), eq(userGuestContacts.userId, userId)));
  }

  async upsertGuestFromPanel(userId: number, data: GuestPanelUpsertData): Promise<UserGuestContactRow> {
    if (!db) throw new Error("Database not connected");

    const nameTrim = (data.name ?? "").trim();
    const nameExplicit = data.name !== undefined;
    if (data.id == null || nameExplicit) {
      if (!isFullName(nameTrim)) {
        throw new Error(fullNameValidationMessage());
      }
    }

    const mvpPatch = pickGuestMvpPatch(data);

    const emailTrim = (data.email ?? "").trim();
    let ne: string | null = null;
    let canonical: string | null = null;
    if (emailTrim.length > 0) {
      const low = emailTrim.toLowerCase();
      if (!isValidEmailFormat(low)) {
        throw new Error("email invalido");
      }
      ne = low;
      canonical = emailTrim;
    }

    let phoneNorm: string | null = null;
    if (data.phone != null && String(data.phone).trim()) {
      const n = normalizeBrazilianPhone(String(data.phone).trim());
      const digits = n ? n.replace(/\D/g, "") : null;
      if (!digits) {
        throw new Error("telefone invalido");
      }
      phoneNorm = digits;
    }

    const aliasKey = normalizeAliasKey(nameTrim);
    const aliasArr = aliasKey ? [aliasKey] : [];

    if (data.id != null) {
      const [row] = await db
        .select()
        .from(userGuestContacts)
        .where(and(eq(userGuestContacts.id, data.id), eq(userGuestContacts.userId, userId)));
      if (!row) {
        throw new Error("contato nao encontrado");
      }

      const emailTrimUpd = (data.email ?? "").trim();
      let nextNe: string | null = row.normalizedEmail;
      let nextCanon: string | null = row.canonicalEmail;
      if (data.email !== undefined) {
        if (emailTrimUpd) {
          const low = emailTrimUpd.toLowerCase();
          if (!isValidEmailFormat(low)) {
            throw new Error("email invalido");
          }
          nextNe = low;
          nextCanon = emailTrimUpd;
        } else {
          nextNe = null;
          nextCanon = null;
        }
      }

      let nextPhone: string | null = row.guestPhoneE164 ?? null;
      if (data.phone !== undefined) {
        if (!data.phone || !String(data.phone).trim()) {
          nextPhone = null;
        } else {
          const n = normalizeBrazilianPhone(String(data.phone).trim());
          const digits = n ? n.replace(/\D/g, "") : null;
          if (!digits) {
            throw new Error("telefone invalido");
          }
          nextPhone = digits;
        }
      }

      if (!nextNe && !nextPhone) {
        throw new Error("informe email ou telefone");
      }

      const patch: Partial<typeof userGuestContacts.$inferInsert> = {
        normalizedEmail: nextNe,
        canonicalEmail: nextCanon,
        guestPhoneE164: nextPhone,
        updatedAt: new Date(),
        ...mvpPatch,
      };

      const emailChanged = nextNe !== row.normalizedEmail || nextCanon !== row.canonicalEmail;
      const phoneChanged = nextPhone !== (row.guestPhoneE164 ?? null);
      if (emailChanged || phoneChanged) {
        patch.identityNotifiedAt = null;
      }

      if (nameExplicit && aliasArr.length) {
        patch.aliasNames = aliasArr;
      }

      const [updated] = await db
        .update(userGuestContacts)
        .set(patch)
        .where(eq(userGuestContacts.id, data.id))
        .returning();
      if (!updated) throw new Error("falha ao atualizar");
      return mapGuestContactRow(updated);
    }

    if (!ne && !phoneNorm) {
      throw new Error("informe email ou telefone");
    }

    if (!ne && phoneNorm) {
      const [existing] = await db
        .select()
        .from(userGuestContacts)
        .where(and(eq(userGuestContacts.userId, userId), eq(userGuestContacts.guestPhoneE164, phoneNorm)));
      if (existing) {
        const [upd] = await db
          .update(userGuestContacts)
          .set({
            aliasNames: aliasArr.length ? aliasArr : existing.aliasNames ?? [],
            guestPhoneE164: phoneNorm,
            updatedAt: new Date(),
            identityNotifiedAt: null,
            ...mvpPatch,
          })
          .where(eq(userGuestContacts.id, existing.id))
          .returning();
        return mapGuestContactRow(upd);
      }
      const [ins] = await db
        .insert(userGuestContacts)
        .values({
          userId,
          normalizedEmail: null,
          canonicalEmail: null,
          aliasNames: aliasArr,
          guestPhoneE164: phoneNorm,
          updatedAt: new Date(),
          financialStatus: mvpPatch.financialStatus ?? "pendente",
          ...mvpPatch,
        })
        .returning();
      return mapGuestContactRow(ins);
    }

    if (ne && canonical) {
      await this.upsertUserGuestContactWithAlias(userId, nameTrim, canonical);

      const [inserted] = await db
        .select()
        .from(userGuestContacts)
        .where(and(eq(userGuestContacts.userId, userId), eq(userGuestContacts.normalizedEmail, ne)));

      if (!inserted) {
        throw new Error("falha ao salvar contato");
      }

      const notifyPatch: Partial<typeof userGuestContacts.$inferInsert> = {
        guestPhoneE164: phoneNorm,
        updatedAt: new Date(),
        ...mvpPatch,
      };
      if (phoneNorm !== (inserted.guestPhoneE164 ?? null)) {
        notifyPatch.identityNotifiedAt = null;
      }

      const [finalRow] = await db
        .update(userGuestContacts)
        .set(notifyPatch)
        .where(eq(userGuestContacts.id, inserted.id))
        .returning();

      return mapGuestContactRow(finalRow ?? inserted);
    }

    throw new Error("informe email ou telefone");
  }

  async listUserContactGroupsWithMembers(
    userId: number,
  ): Promise<{ id: number; name: string; normalizedName: string; contactIds: number[] }[]> {
    if (!db) return [];
    const groups = await db
      .select()
      .from(userContactGroups)
      .where(eq(userContactGroups.userId, userId))
      .orderBy(asc(userContactGroups.name));
    if (!groups.length) return [];
    const ids = groups.map((g: (typeof userContactGroups.$inferSelect)) => g.id);
    const allMembers = await db
      .select()
      .from(userContactGroupMembers)
      .where(inArray(userContactGroupMembers.groupId, ids));
    const byGroup = new Map<number, number[]>();
    for (const m of allMembers) {
      const list = byGroup.get(m.groupId) ?? [];
      list.push(m.contactId);
      byGroup.set(m.groupId, list);
    }
    return groups.map((g: typeof userContactGroups.$inferSelect) => ({
      id: g.id,
      name: g.name,
      normalizedName: g.normalizedName,
      contactIds: byGroup.get(g.id) ?? [],
    }));
  }

  async createUserContactGroup(
    userId: number,
    name: string,
    contactIds: number[],
  ): Promise<{ id: number }> {
    if (!db) throw new Error("Database not connected");
    const raw = name?.trim() ?? "";
    if (raw.length < 2) {
      throw new Error("nome do grupo invalido");
    }
    const normalizedName = normalizeAliasKey(raw);
    if (normalizedName.length < 2) {
      throw new Error("nome do grupo invalido");
    }
    const uniqueIds = Array.from(new Set(contactIds)).filter((n) => n > 0);
    if (uniqueIds.length) {
      const rows = await db
        .select({ id: userGuestContacts.id })
        .from(userGuestContacts)
        .where(and(eq(userGuestContacts.userId, userId), inArray(userGuestContacts.id, uniqueIds)));
      if (rows.length !== uniqueIds.length) {
        throw new Error("um ou mais contatos invalidos");
      }
    }
    return await db.transaction(async (tx: any) => {
      const [g] = await tx
        .insert(userContactGroups)
        .values({
          userId,
          name: raw,
          normalizedName,
          updatedAt: new Date(),
        })
        .returning({ id: userContactGroups.id });
      if (!g) throw new Error("falha ao criar grupo");
      if (uniqueIds.length) {
        await tx.insert(userContactGroupMembers).values(
          uniqueIds.map((contactId) => ({ groupId: g.id, contactId })),
        );
      }
      return { id: g.id };
    });
  }

  async updateUserContactGroup(
    userId: number,
    groupId: number,
    data: { name?: string; contactIds?: number[] },
  ): Promise<void> {
    if (!db) throw new Error("Database not connected");
    const [existing] = await db
      .select()
      .from(userContactGroups)
      .where(and(eq(userContactGroups.id, groupId), eq(userContactGroups.userId, userId)));
    if (!existing) {
      throw new Error("grupo nao encontrado");
    }
    if (data.name != null) {
      const raw = data.name.trim();
      if (raw.length < 2) throw new Error("nome do grupo invalido");
      const normalizedName = normalizeAliasKey(raw);
      if (normalizedName.length < 2) throw new Error("nome do grupo invalido");
      await db
        .update(userContactGroups)
        .set({ name: raw, normalizedName, updatedAt: new Date() })
        .where(eq(userContactGroups.id, groupId));
    }
    if (data.contactIds != null) {
      const uniqueIds = Array.from(new Set(data.contactIds)).filter((n) => n > 0);
      if (uniqueIds.length) {
        const rows = await db
          .select({ id: userGuestContacts.id })
          .from(userGuestContacts)
          .where(and(eq(userGuestContacts.userId, userId), inArray(userGuestContacts.id, uniqueIds)));
        if (rows.length !== uniqueIds.length) {
          throw new Error("um ou mais contatos invalidos");
        }
      }
      await db
        .delete(userContactGroupMembers)
        .where(eq(userContactGroupMembers.groupId, groupId));
      if (uniqueIds.length) {
        await db
          .insert(userContactGroupMembers)
          .values(uniqueIds.map((contactId) => ({ groupId, contactId })));
      }
    }
  }

  async deleteUserContactGroup(userId: number, groupId: number): Promise<boolean> {
    if (!db) return false;
    const deleted = await db
      .delete(userContactGroups)
      .where(and(eq(userContactGroups.id, groupId), eq(userContactGroups.userId, userId)))
      .returning({ id: userContactGroups.id });
    return deleted.length > 0;
  }

  async findUserIdByPluggyItemId(itemId: string): Promise<number | null> {
    if (!db) return null;
    const [row] = await db
      .select({ userId: userSettings.userId })
      .from(userSettings)
      .where(eq(userSettings.pluggyItemId, itemId))
      .limit(1);
    return row?.userId ?? null;
  }

  async listPendingLessonEventsForContact(userId: number, studentContactId: number): Promise<Event[]> {
    if (!db) return [];
    return db
      .select()
      .from(events)
      .where(
        and(
          eq(events.userId, userId),
          eq(events.studentContactId, studentContactId),
          eq(events.lessonPaymentStatus, "pendente"),
        ),
      )
      .orderBy(asc(events.startDate));
  }

  async tryRecordPluggyTransactionOnce(userId: number, transactionId: string): Promise<boolean> {
    if (!db) return false;
    const tid = transactionId.trim().slice(0, 128);
    if (!tid) return false;
    try {
      const ins = await db.execute(sql`
        INSERT INTO pluggy_processed_transactions (user_id, transaction_id)
        VALUES (${userId}, ${tid})
        ON CONFLICT (user_id, transaction_id) DO NOTHING
        RETURNING id
      `);
      const rows = (ins as { rows?: { id: number }[] }).rows;
      return (rows?.length ?? 0) > 0;
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code;
      if (code === "42P01") {
        console.warn(
          "[storage] Tabela pluggy_processed_transactions ausente; execute migration 0013. Dedupe desativado.",
        );
        return true;
      }
      throw e;
    }
  }

  async getFirstLessonCreatedAtForContact(userId: number, studentContactId: number): Promise<Date | null> {
    if (!db) return null;
    try {
      const res = await db.execute(sql`
        SELECT min(created_at) AS m
        FROM events
        WHERE user_id = ${userId}
          AND student_contact_id = ${studentContactId}
      `);
      const row = (res as { rows?: { m: Date | string | null }[] }).rows?.[0];
      const m = row?.m;
      if (m == null) return null;
      const d = m instanceof Date ? m : new Date(String(m));
      return Number.isNaN(d.getTime()) ? null : d;
    } catch (e: unknown) {
      console.warn("[storage] getFirstLessonCreatedAtForContact:", e);
      return null;
    }
  }

  async sumPluggyContactCreditsSince(userId: number, contactId: number, sinceInclusive: Date): Promise<number> {
    if (!db) return 0;
    try {
      const res = await db.execute(sql`
        SELECT COALESCE(SUM(amount_cents), 0)::bigint AS s
        FROM pluggy_contact_payment_ledger
        WHERE user_id = ${userId}
          AND contact_id = ${contactId}
          AND tx_posted_at >= ${sinceInclusive}
      `);
      const row = (res as { rows?: { s: string | bigint | number }[] }).rows?.[0];
      const n = row?.s != null ? Number(row.s) : 0;
      return Number.isFinite(n) ? n : 0;
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code;
      if (code === "42P01") {
        console.warn("[storage] pluggy_contact_payment_ledger ausente; soma = 0. Rode migration 0015.");
        return 0;
      }
      throw e;
    }
  }

  async countPaidLessonEventsForContact(userId: number, contactId: number): Promise<number> {
    if (!db) return 0;
    const [row] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(events)
      .where(
        and(
          eq(events.userId, userId),
          eq(events.studentContactId, contactId),
          eq(events.lessonPaymentStatus, "pago"),
        ),
      );
    const n = Number(row?.c ?? 0);
    return Number.isFinite(n) ? n : 0;
  }

  async insertPluggyContactCredit(
    userId: number,
    contactId: number,
    transactionId: string,
    amountCents: number,
    txPostedAt: Date,
  ): Promise<boolean> {
    if (!db) return false;
    const tid = (transactionId.trim() || `synthetic_${Date.now()}`).slice(0, 128);
    try {
      const ins = await db.execute(sql`
        INSERT INTO pluggy_contact_payment_ledger (user_id, contact_id, transaction_id, amount_cents, tx_posted_at)
        VALUES (${userId}, ${contactId}, ${tid}, ${Math.round(amountCents)}, ${txPostedAt})
        ON CONFLICT (user_id, transaction_id) DO NOTHING
        RETURNING id
      `);
      const rows = (ins as { rows?: { id: number }[] }).rows;
      return (rows?.length ?? 0) > 0;
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code;
      if (code === "42P01") {
        console.warn("[storage] pluggy_contact_payment_ledger ausente; rode migration 0015.");
        return false;
      }
      throw e;
    }
  }
}

export const storage = new DatabaseStorage();
