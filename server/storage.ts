import { db } from "./db";
import { eq, and, desc, gt, lte, sql, asc } from "drizzle-orm";
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
} from "@shared/schema";
import { normalizeAliasKey } from "./utils/normalizeGuestAlias";
import { normalizeBrazilianPhone } from "./utils/phoneExtraction";

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
};

export interface IStorage {
  // Usuários
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByTelegramId(telegramId: string): Promise<User | undefined>;
  getUserByWhatsApp(whatsappId: string): Promise<User | undefined>;
  getUserByStripeId(stripeId: string): Promise<User | undefined>;
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
  upsertGuestFromPanel(
    userId: number,
    data: { id?: number; email?: string; name?: string; phone?: string | null },
  ): Promise<UserGuestContactRow>;
  markGuestIdentityNotified(userId: number, contactId: number): Promise<void>;
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
    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      normalizedEmail: r.normalizedEmail,
      canonicalEmail: r.canonicalEmail,
      aliasNames: r.aliasNames ?? [],
      guestPhoneE164: r.guestPhoneE164 ?? null,
      identityNotifiedAt: r.identityNotifiedAt ?? null,
    }));
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

  async markGuestIdentityNotified(userId: number, contactId: number): Promise<void> {
    if (!db) return;
    await db
      .update(userGuestContacts)
      .set({ identityNotifiedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(userGuestContacts.id, contactId), eq(userGuestContacts.userId, userId)));
  }

  async upsertGuestFromPanel(
    userId: number,
    data: { id?: number; email?: string; name?: string; phone?: string | null },
  ): Promise<UserGuestContactRow> {
    if (!db) throw new Error("Database not connected");

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

    const mapDbRow = (r: typeof userGuestContacts.$inferSelect): UserGuestContactRow => ({
      id: r.id,
      userId: r.userId,
      normalizedEmail: r.normalizedEmail ?? null,
      canonicalEmail: r.canonicalEmail ?? null,
      aliasNames: r.aliasNames ?? [],
      guestPhoneE164: r.guestPhoneE164 ?? null,
      identityNotifiedAt: r.identityNotifiedAt ?? null,
    });

    const aliasesFromName = (name?: string): string[] => {
      const t = name?.trim() ?? "";
      if (t.length < 2) return [];
      const key = normalizeAliasKey(t);
      return key ? [key] : [];
    };

    if (data.id != null) {
      const [row] = await db
        .select()
        .from(userGuestContacts)
        .where(and(eq(userGuestContacts.id, data.id), eq(userGuestContacts.userId, userId)));
      if (!row) {
        throw new Error("contato nao encontrado");
      }

      const emailTrimUpd = (data.email ?? "").trim();
      let nextNe: string | null = null;
      let nextCanon: string | null = null;
      if (emailTrimUpd) {
        const low = emailTrimUpd.toLowerCase();
        if (!isValidEmailFormat(low)) {
          throw new Error("email invalido");
        }
        nextNe = low;
        nextCanon = emailTrimUpd;
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
      };

      const emailChanged = nextNe !== row.normalizedEmail || nextCanon !== row.canonicalEmail;
      const phoneChanged = nextPhone !== (row.guestPhoneE164 ?? null);
      if (emailChanged || phoneChanged) {
        patch.identityNotifiedAt = null;
      }

      if (data.name !== undefined && data.name.trim().length >= 2) {
        const key = normalizeAliasKey(data.name.trim());
        if (!key) {
          throw new Error("nome invalido");
        }
        patch.aliasNames = [...new Set([...(row.aliasNames ?? []), key])];
      }

      const [updated] = await db
        .update(userGuestContacts)
        .set(patch)
        .where(eq(userGuestContacts.id, data.id))
        .returning();
      if (!updated) throw new Error("falha ao atualizar");
      return mapDbRow(updated);
    }

    if (!ne && !phoneNorm) {
      throw new Error("informe email ou telefone");
    }

    if (!ne && phoneNorm) {
      const [existing] = await db
        .select()
        .from(userGuestContacts)
        .where(and(eq(userGuestContacts.userId, userId), eq(userGuestContacts.guestPhoneE164, phoneNorm)));
      const addAliases = aliasesFromName(data.name);
      if (existing) {
        const merged = [...new Set([...(existing.aliasNames ?? []), ...addAliases])];
        const [upd] = await db
          .update(userGuestContacts)
          .set({
            aliasNames: merged,
            updatedAt: new Date(),
            identityNotifiedAt: null,
          })
          .where(eq(userGuestContacts.id, existing.id))
          .returning();
        return mapDbRow(upd);
      }
      const [ins] = await db
        .insert(userGuestContacts)
        .values({
          userId,
          normalizedEmail: null,
          canonicalEmail: null,
          aliasNames: addAliases,
          guestPhoneE164: phoneNorm,
          updatedAt: new Date(),
        })
        .returning();
      return mapDbRow(ins);
    }

    if (ne && canonical) {
      if (data.name != null && data.name.trim().length >= 2) {
        await this.upsertUserGuestContactWithAlias(userId, data.name.trim(), canonical);
      } else {
        await this.upsertUserGuestContactEmailTyped(userId, ne, canonical);
      }

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
      };
      if (phoneNorm !== (inserted.guestPhoneE164 ?? null)) {
        notifyPatch.identityNotifiedAt = null;
      }

      const [finalRow] = await db
        .update(userGuestContacts)
        .set(notifyPatch)
        .where(eq(userGuestContacts.id, inserted.id))
        .returning();

      return mapDbRow(finalRow ?? inserted);
    }

    throw new Error("informe email ou telefone");
  }
}

export const storage = new DatabaseStorage();
