import { db } from "./db";
import { and, eq, lte, lt, gt } from "drizzle-orm";
import { 
  users, type User, type InsertUser, 
  events, type Event, type InsertEvent,
  userSettings, type UserSettings, type InsertUserSettings
} from "@shared/schema";

export interface IStorage {
  // Usuários
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByTelegramId(telegramId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined>;
  
  // Eventos
  getEvent(id: number): Promise<Event | undefined>;
  getEventsByUserId(userId: number): Promise<Event[]>;
  getPastEvents(before: Date): Promise<Event[]>; // Nova função para buscar eventos passados
  getFutureEvents(userId: number): Promise<Event[]>; // Nova função para buscar eventos futuros
  createEvent(event: InsertEvent): Promise<Event>;
  updateEvent(id: number, data: Partial<InsertEvent>): Promise<Event | undefined>;
  deleteEvent(id: number): Promise<boolean>;
  

  
  // Configurações do usuário
  getUserSettings(userId: number): Promise<UserSettings | undefined>;
  createUserSettings(settings: InsertUserSettings): Promise<UserSettings>;
  updateUserSettings(userId: number, data: Partial<InsertUserSettings>): Promise<UserSettings | undefined>;
}

// Importações já feitas acima

export class DatabaseStorage implements IStorage {
  // Usuários
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }
  
  async getUserByTelegramId(telegramId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.telegramId, telegramId));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }
  
  async updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(users)
      .set(data)
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }
  
  // Eventos
  async getEvent(id: number): Promise<Event | undefined> {
    const [event] = await db.select().from(events).where(eq(events.id, id));
    return event;
  }
  
  async getEventsByUserId(userId: number): Promise<Event[]> {
    return await db.select().from(events).where(eq(events.userId, userId));
  }
  
  async getPastEvents(before: Date): Promise<Event[]> {
    return await db.select().from(events).where(lt(events.startDate, before));
  }
  
  async getFutureEvents(userId: number): Promise<Event[]> {
    const now = new Date();
    return await db.select().from(events).where(
      and(
        eq(events.userId, userId),
        gt(events.startDate, now)
      )
    );
  }
  
  async createEvent(event: InsertEvent): Promise<Event> {
    const [newEvent] = await db
      .insert(events)
      .values(event)
      .returning();
    return newEvent;
  }
  
  async updateEvent(id: number, data: Partial<InsertEvent>): Promise<Event | undefined> {
    const [updatedEvent] = await db
      .update(events)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(events.id, id))
      .returning();
    return updatedEvent;
  }
  
  async deleteEvent(id: number): Promise<boolean> {
    const [deletedEvent] = await db
      .delete(events)
      .where(eq(events.id, id))
      .returning();
    
    return !!deletedEvent;
  }
  
  // Configurações do usuário
  async getUserSettings(userId: number): Promise<UserSettings | undefined> {
    const [settings] = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
    return settings;
  }
  
  async createUserSettings(settings: InsertUserSettings): Promise<UserSettings> {
    const [newSettings] = await db
      .insert(userSettings)
      .values(settings)
      .returning();
    return newSettings;
  }
  
  async updateUserSettings(userId: number, data: Partial<InsertUserSettings>): Promise<UserSettings | undefined> {
    const [updatedSettings] = await db
      .update(userSettings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(userSettings.userId, userId))
      .returning();
    return updatedSettings;
  }
}

export const storage = new DatabaseStorage();
