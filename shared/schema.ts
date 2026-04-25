import { sql } from "drizzle-orm";
import { pgTable, text, serial, integer, boolean, timestamp, primaryKey, foreignKey, json, jsonb, varchar, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Usuários
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  telegramId: text("telegram_id").unique(),
  name: text("name"),
  email: text("email"),
  stripeCustomerId: text("stripe_customer_id"),
  subscriptionStatus: text("subscription_status").default("inactive"), // active, inactive, past_due
  subscriptionEndsAt: timestamp("subscription_ends_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * Planilha de convidados: e-mail e/ou telefone; pelo menos um identificador por linha.
 */
export const userGuestContacts = pgTable(
  "user_guest_contacts",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    normalizedEmail: text("normalized_email"),
    canonicalEmail: text("canonical_email"),
    aliasNames: text("alias_names").array().notNull().default(sql`'{}'::text[]`),
    /** Dígitos E.164 normalizados (ex.: 5511999999999), opcional */
    guestPhoneE164: text("guest_phone_e164"),
    /** Quando já enviamos aviso de cadastro na planilha (painel) */
    identityNotifiedAt: timestamp("identity_notified_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("user_guest_contacts_user_email_partial")
      .on(t.userId, t.normalizedEmail)
      .where(sql`${t.normalizedEmail} is not null`),
    uniqueIndex("user_guest_contacts_user_phone_partial")
      .on(t.userId, t.guestPhoneE164)
      .where(sql`${t.guestPhoneE164} is not null`),
  ],
);

export const userGuestContactsRelations = relations(userGuestContacts, ({ one }) => ({
  user: one(users, {
    fields: [userGuestContacts.userId],
    references: [users.id],
  }),
}));

/**
 * Grupos de contatos: no WhatsApp, mencione o grupo (ex. "adicione o grupo Nome do grupo")
 * para incluir todos os membros como convidados.
 */
export const userContactGroups = pgTable(
  "user_contact_groups",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("user_contact_groups_user_norm_name").on(t.userId, t.normalizedName)],
);

export const userContactGroupMembers = pgTable(
  "user_contact_group_members",
  {
    id: serial("id").primaryKey(),
    groupId: integer("group_id")
      .notNull()
      .references(() => userContactGroups.id, { onDelete: "cascade" }),
    contactId: integer("contact_id")
      .notNull()
      .references(() => userGuestContacts.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("user_contact_group_members_g_c").on(t.groupId, t.contactId)],
);

export const userContactGroupsRelations = relations(userContactGroups, ({ one, many }) => ({
  user: one(users, {
    fields: [userContactGroups.userId],
    references: [users.id],
  }),
  members: many(userContactGroupMembers),
}));

export const userContactGroupMembersRelations = relations(userContactGroupMembers, ({ one }) => ({
  group: one(userContactGroups, {
    fields: [userContactGroupMembers.groupId],
    references: [userContactGroups.id],
  }),
  contact: one(userGuestContacts, {
    fields: [userContactGroupMembers.contactId],
    references: [userGuestContacts.id],
  }),
}));

/** OAuth Google (JSON) para convites quando o usuário não conectou agenda — ex.: zelar.ia.messages@gmail.com */
export const systemCalendarIntegrations = pgTable(
  "system_calendar_integrations",
  {
    id: serial("id").primaryKey(),
    integrationKey: varchar("integration_key", { length: 128 }).notNull(),
    provider: varchar("provider", { length: 32 }).notNull(),
    accountEmail: text("account_email"),
    tokens: jsonb("tokens").notNull().default(sql`'{}'::jsonb`),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("system_calendar_integrations_key_provider").on(t.integrationKey, t.provider),
  ],
);

export const userRelations = relations(users, ({ many }) => ({
  events: many(events),
  settings: many(userSettings),
  payments: many(payments),
  userGuestContacts: many(userGuestContacts),
  userContactGroups: many(userContactGroups),
}));

// Pagamentos
export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  stripeSessionId: text("stripe_session_id").unique(),
  amount: integer("amount").notNull(), // in cents
  currency: text("currency").default("brl"),
  status: text("status").notNull(), // pending, completed, failed
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Eventos
export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  description: text("description"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  location: text("location"),
  isAllDay: boolean("is_all_day").default(false),
  calendarId: text("calendar_id"), // ID do evento no Google/Apple Calendar
  conferenceLink: text("conference_link"),
  attendeePhones: text("attendee_phones").array(), // Lista de telefones dos participantes
  attendeeEmails: text("attendee_emails").array(), // Lista de emails dos participantes
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  rawData: json("raw_data"), // Dados originais processados pela IA
});

export const eventRelations = relations(events, ({ one }) => ({
  user: one(users, {
    fields: [events.userId],
    references: [users.id],
  }),
}));



// Configurações do usuário
export const userSettings = pgTable("user_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  notificationsEnabled: boolean("notifications_enabled").default(true),
  reminderTimes: integer("reminder_times").array(), // Array de horas antes do evento para enviar lembretes
  calendarProvider: varchar("calendar_provider", { length: 20 }), // google, microsoft, apple
  googleTokens: text("google_tokens"), // Tokens do Google Calendar em formato JSON
  microsoftTokens: text("microsoft_tokens"), // Tokens do Microsoft Calendar em formato JSON
  appleTokens: text("apple_tokens"), // Tokens da Apple em formato JSON
  language: varchar("language", { length: 10 }).default("pt-BR"),
  timeZone: varchar("time_zone", { length: 50 }).default("America/Sao_Paulo"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const userSettingsRelations = relations(userSettings, ({ one }) => ({
  user: one(users, {
    fields: [userSettings.userId],
    references: [users.id],
  }),
}));




// Lembretes
export const reminders = pgTable("reminders", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  channel: varchar("channel", { length: 20 }).notNull(), // telegram | whatsapp | email
  targetPhones: text("target_phones").array(), // Array de telefones para enviar o lembrete
  targetEmails: text("target_emails").array(), // Array de emails para enviar o lembrete
  message: text("message"),
  reminderTime: integer("reminder_time").notNull().default(12), // horas antes do evento
  sendAt: timestamp("send_at").notNull(),
  sent: boolean("sent").default(false).notNull(),
  sentAt: timestamp("sent_at"),
  isDefault: boolean("is_default").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const reminderRelations = relations(reminders, ({ one }) => ({
  event: one(events, {
    fields: [reminders.eventId],
    references: [events.id],
  }),
  user: one(users, {
    fields: [reminders.userId],
    references: [users.id],
  }),
}));


// Schemas para inserção
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  telegramId: true,
  name: true,
  email: true,
});

export const insertEventSchema = createInsertSchema(events).pick({
  userId: true,
  title: true,
  description: true,
  startDate: true,
  endDate: true,
  location: true,
  isAllDay: true,
  calendarId: true,
  conferenceLink: true,
  attendeePhones: true,
  attendeeEmails: true,
  rawData: true,
});


export const insertReminderSchema = createInsertSchema(reminders).pick({
  eventId: true,
  userId: true,
  channel: true,
  targetPhones: true,
  targetEmails: true,
  message: true,
  reminderTime: true,
  sendAt: true,
  sent: true,
  isDefault: true,
  createdAt: true,
});


export const insertUserSettingsSchema = createInsertSchema(userSettings).pick({
  userId: true,
  notificationsEnabled: true,
  reminderTimes: true,
  calendarProvider: true,
  googleTokens: true,
  microsoftTokens: true,
  appleTokens: true,
  language: true,
  timeZone: true,
});



// Types para exportação
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof events.$inferSelect;




export type InsertReminder = z.infer<typeof insertReminderSchema>;
export type Reminder = typeof reminders.$inferSelect;

export type InsertUserSettings = z.infer<typeof insertUserSettingsSchema>;
export type UserSettings = typeof userSettings.$inferSelect;
