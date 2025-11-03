import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";
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
} from "@shared/schema";

export interface IStorage {
  // Usuários
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByTelegramId(telegramId: string): Promise<User | undefined>;
  getUserByWhatsApp(whatsappId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined>;

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

  // =================== CONFIGURAÇÕES DO USUÁRIO ===================
  
  async getUserSettings(userId: number): Promise<UserSettings | undefined> {
    if (!db) return undefined;
    const [settings] = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
    return settings;
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
    const [updatedSettings] = await db
      .update(userSettings)
      .set(data)
      .where(eq(userSettings.userId, userId))
      .returning();
    return updatedSettings;
  }

  // =================== EVENTOS ===================
  
  async createEvent(event: InsertEvent): Promise<Event> {
    if (!db) throw new Error("Database not connected");
    const [newEvent] = await db.insert(events).values(event).returning();
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
        // Eventos que ainda não aconteceram
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
}

export const storage = new DatabaseStorage();