import { pgTable, text, serial, integer, boolean, timestamp, primaryKey, foreignKey, json, varchar } from "drizzle-orm/pg-core";
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const userRelations = relations(users, ({ many }) => ({
  events: many(events),
  settings: many(userSettings),
}));

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
  calendarProvider: varchar("calendar_provider", { length: 20 }), // google, apple
  googleTokens: text("google_tokens"), // Tokens do Google Calendar em formato JSON
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
  rawData: true,
});



export const insertUserSettingsSchema = createInsertSchema(userSettings).pick({
  userId: true,
  notificationsEnabled: true,
  reminderTimes: true,
  calendarProvider: true,
  googleTokens: true,
  appleTokens: true,
  language: true,
  timeZone: true,
});



// Types para exportação
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof events.$inferSelect;



export type InsertUserSettings = z.infer<typeof insertUserSettingsSchema>;
export type UserSettings = typeof userSettings.$inferSelect;
