import type { Event } from "@shared/schema";
import { storage } from "../storage";
import type { UserGuestContactRow } from "../storage";
import {
  displayNameFromGuestContact,
  resolveLessonUnitCentsForAllocation,
} from "./pluggy/lessonUnitPrice";
import { markLessonPaidAndSyncCalendar } from "./pluggy/pluggyPaymentProcessor";

/**
 * Antes de marcar aula como cancelada no banco: crédito retido (saldo) quando faz sentido.
 * - Aula pendente cancelada → não gera crédito; ela só deixa de contar como dívida.
 * - Aula paga cancelada → +1 preço no saldo, para virar crédito do aluno.
 */
export async function applyLessonBalanceCreditBeforeSoftCancel(userId: number, event: Event): Promise<void> {
  const cid = event.studentContactId;
  if (!cid) return;

  const contact = await storage.getGuestContactByIdForUser(userId, cid);
  if (!contact) return;

  const settings = await storage.getUserSettings(userId);
  const unit = resolveLessonUnitCentsForAllocation(event, contact, settings?.defaultLessonPriceCents ?? null);
  if (!unit || unit <= 0) return;

  if (event.lessonPaymentStatus === "pendente") return;

  if (event.lessonPaymentStatus === "pago") {
    await storage.adjustGuestLessonBalanceCents(userId, cid, unit);
  }
}

/** Após criar aula pendente sincronizada: consome saldo retido e marca como pago se couber. */
export async function tryConsumeLessonBalanceAfterEventCreated(
  userId: number,
  eventId: number,
  contact: UserGuestContactRow,
): Promise<void> {
  const ev = await storage.getEvent(eventId);
  if (!ev || ev.lessonPaymentStatus !== "pendente" || ev.cancelledAt) return;

  const settings = await storage.getUserSettings(userId);
  const unit = resolveLessonUnitCentsForAllocation(ev, contact, settings?.defaultLessonPriceCents ?? null);
  if (!unit || unit <= 0) return;

  const fresh = await storage.getGuestContactByIdForUser(userId, contact.id);
  const balance = fresh?.lessonBalanceCents ?? 0;
  if (balance < unit) return;

  await storage.adjustGuestLessonBalanceCents(userId, contact.id, -unit);
  const displayName = displayNameFromGuestContact(contact);
  const again = await storage.getEvent(eventId);
  if (!again) return;

  await markLessonPaidAndSyncCalendar(userId, again, displayName, "balance");
  if (!again.calendarId?.trim()) {
    console.warn(
      "[saldo] Aula marcada paga no Zelar; Google sem calendarId — título (pago) só na agenda após sync.",
      { userId, eventId, contactId: contact.id },
    );
  }
}
