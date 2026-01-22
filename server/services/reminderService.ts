import schedule from "node-schedule";
import { DateTime } from "luxon";
import { Event, Reminder } from "@shared/schema";
import { storage } from "../storage";
import { sendTelegramNotification } from "../telegram/direct_bot";
import { getWhatsAppBot } from "../whatsapp/whatsappBot";
import { emailService } from "./emailService";

type ReminderChannel = Reminder["channel"];

class ReminderService {
  private jobs = new Map<number, schedule.Job>();

  async start(): Promise<void> {
    await this.rescheduleAll();
    // Verificador de segurança para lembretes atrasados
    setInterval(() => {
      this.runDueReminders().catch((err) => console.error("Erro ao processar lembretes pendentes:", err));
    }, 30_000);
  }

  async rescheduleAll(): Promise<void> {
    const reminders = await storage.getAllUnsentReminders();
    for (const reminder of reminders) {
      const event = await storage.getEvent(reminder.eventId);
      if (event) {
        this.scheduleReminder(reminder, event);
      }
    }
  }

  private cancelJob(reminderId: number): void {
    const existing = this.jobs.get(reminderId);
    if (existing) {
      existing.cancel();
      this.jobs.delete(reminderId);
    }
  }

  private scheduleReminder(reminder: Reminder, event?: Event): void {
    this.cancelJob(reminder.id);
    if (reminder.sent) return;

    const sendDate = reminder.sendAt instanceof Date ? reminder.sendAt : new Date(reminder.sendAt);
    if (Number.isNaN(sendDate.getTime())) return;

    const now = new Date();
    if (sendDate <= now) {
      void this.sendReminder(reminder, event);
      return;
    }

    const job = schedule.scheduleJob(sendDate, () => {
      void this.sendReminder(reminder, event);
    });
    if (job) {
      this.jobs.set(reminder.id, job);
    }
  }

  private buildReminderMessage(reminder: { message?: string | null }, event: Event, timezone?: string): string {
    const eventDate = DateTime.fromJSDate(event.startDate).setZone(timezone || "America/Sao_Paulo");
    const defaultMessage = [
      "⏰ Lembrete de evento",
      `📌 ${event.title}`,
      `📅 ${eventDate.toFormat("dd/MM/yyyy HH:mm")}`,
    ].join("\n");
    return reminder.message ?? defaultMessage;
  }

  private async sendReminder(reminder: Reminder, cachedEvent?: Event): Promise<void> {
    const event = cachedEvent ?? (await storage.getEvent(reminder.eventId));
    if (!event) {
      await storage.markReminderSent(reminder.id);
      return;
    }

    const user = await storage.getUser(event.userId);
    if (!user) {
      await storage.markReminderSent(reminder.id);
      return;
    }

    const settings = await storage.getUserSettings(event.userId);
    const message = this.buildReminderMessage(reminder, event, settings?.timeZone || undefined);

    try {
      if (reminder.channel === "telegram" && user.telegramId) {
        await sendTelegramNotification(Number(user.telegramId), message);
      } else if (reminder.channel === "whatsapp") {
        const bot = getWhatsAppBot();

        // Prioritize targetPhones
        if (reminder.targetPhones && reminder.targetPhones.length > 0) {
          for (const phone of reminder.targetPhones) {
            // Ensure phone has country code or strict format if needed. 
            // Assuming stored format is compatible (e.g. 5511...)
            console.log(`📤 Sending reminder to target: ${phone}`);
            await bot.sendMessage(phone, message);
          }
        } else if (user.username) {
          // Fallback to owner
          // Verify if username looks like a phone number (digits only)
          if (/^\d+$/.test(user.username)) {
            await bot.sendMessage(user.username, message);
          } else {
            console.log(`⚠️ Username '${user.username}' is not a phone number. Skipping WhatsApp reminder fallback.`);
          }
        }
      } else if (reminder.channel === "email") {
        if (reminder.targetEmails && reminder.targetEmails.length > 0) {
          for (const email of reminder.targetEmails) {
            console.log(`📤 Sending email reminder to: ${email}`);
            await emailService.sendReminder(email, event);
          }
        }
      }
    } finally {
      await storage.markReminderSent(reminder.id);
      this.cancelJob(reminder.id);
    }
  }

  private calculateSendAt(startDate: Date, hoursBefore: number): Date {
    const eventDate = DateTime.fromJSDate(startDate);
    const target = eventDate.minus({ hours: hoursBefore });
    const now = DateTime.now();
    return target < now ? now.plus({ minutes: 1 }).toJSDate() : target.toJSDate();
  }

  async ensureDefaultReminder(event: Event, channel: ReminderChannel): Promise<Reminder | undefined> {
    const hoursBefore = 12;
    const sendAt = this.calculateSendAt(event.startDate, hoursBefore);
    const message = this.buildReminderMessage({ message: undefined }, event, undefined);

    // Determine target phones
    let targetPhones: string[] = [];
    if (event.attendeePhones && event.attendeePhones.length > 0) {
      targetPhones = event.attendeePhones;
    } else {
      // Fallback to user's phone if available (need to fetch user? Or assume event.userId maps to a user with phone?)
      // We can fetch user here or let the sendReminder handle the fallback if targetPhones is empty.
      // Let's populate it here if possible.
      const user = await storage.getUser(event.userId);
      if (user && user.username) { // username is the phone number in this bot
        targetPhones = [user.username];
      }
    }

    const reminders = await storage.getEventReminders(event.id);

    // Determine target emails (include creator if valid)
    // Note: We might have fetched user above, but scope is limited. Safest to ensure we have the user.
    let targetEmails: string[] = [...(event.attendeeEmails || [])];
    const ownerUser = await storage.getUser(event.userId);
    if (ownerUser && ownerUser.email && !ownerUser.email.endsWith('@whatsapp.user') && !targetEmails.includes(ownerUser.email)) {
      targetEmails.push(ownerUser.email);
    }
    const existing = reminders.find((item) => item.isDefault && item.channel === channel);

    if (existing) {
      const updated = await storage.updateReminder(existing.id, {
        sendAt,
        sent: false,
        message,
        reminderTime: hoursBefore,
        targetPhones: targetPhones,
        targetEmails: targetEmails
      });
      if (updated) {
        this.scheduleReminder(updated, event);
      }
      return updated;
    }

    const reminder = await storage.createReminder({
      eventId: event.id,
      userId: event.userId,
      channel,
      message,
      sendAt,
      sent: false,
      isDefault: true,
      reminderTime: hoursBefore,
      targetPhones: targetPhones,
      targetEmails: targetEmails
    });
    this.scheduleReminder(reminder, event);
    return reminder;
  }

  async createReminderWithOffset(
    event: Event,
    channel: ReminderChannel,
    hoursBefore: number,
    message?: string
  ): Promise<Reminder> {
    const sendAt = this.calculateSendAt(event.startDate, hoursBefore);
    const reminder = await storage.createReminder({
      eventId: event.id,
      userId: event.userId,
      channel,
      message: message || undefined,
      sendAt,
      sent: false,
      isDefault: false,
      reminderTime: hoursBefore,
    });
    this.scheduleReminder(reminder, event);
    return reminder;
  }

  async updateReminderWithOffset(
    reminderId: number,
    event: Event,
    hoursBefore: number,
    message?: string
  ): Promise<Reminder | undefined> {
    const sendAt = this.calculateSendAt(event.startDate, hoursBefore);
    const updated = await storage.updateReminder(reminderId, {
      sendAt,
      sent: false,
      message: message || undefined,
      reminderTime: hoursBefore,
    });
    if (updated) {
      this.scheduleReminder(updated, event);
    }
    return updated;
  }

  async deleteReminder(reminderId: number): Promise<boolean> {
    this.cancelJob(reminderId);
    return storage.deleteReminder(reminderId);
  }

  async deleteEventReminders(eventId: number): Promise<void> {
    const eventReminders = await storage.getEventReminders(eventId);
    for (const reminder of eventReminders) {
      this.cancelJob(reminder.id);
    }
    await storage.deleteRemindersByEvent(eventId);
  }

  async runDueReminders(): Promise<void> {
    const dueReminders = await storage.getPendingRemindersToSend();
    for (const reminder of dueReminders) {
      await this.sendReminder(reminder);
    }
  }
}

export const reminderService = new ReminderService();
