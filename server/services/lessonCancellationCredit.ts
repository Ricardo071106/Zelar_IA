import type { Event } from "@shared/schema";
import { storage } from "../../storage";
import type { UserGuestContactRow } from "../../storage";
import {
  displayNameFromGuestContact,
  resolveLessonUnitCentsForAllocation,
} from "./pluggy/lessonUnitPrice";
import { markLessonPaidAndSyncCalendar } from "./pluggy/pluggyPaymentProcessor";

/**
 * Antes de marcar aula como cancelada no banco: crédito retido (saldo) quando faz sentido.
 * - Aula pendente cancelada → +1 preço de aula no saldo.
 * - Aula paga cancelada e não há outras pendentes → +1 preço no saldo (senão o /buscar re-rateia PIX nas pendentes).
 */
export async function applyLessonBalanceCreditBeforeSoftCancel(userId: number, event: Event): Promise<void> {
  const cid = event.studentContactId;
  if (!cid) return;

  const contact = await storage.getGuestContactByIdForUser(userId, cid);
  if (!contact) return;

  const settings = await storage.getUserSettings(userId);
  const unit = resolveLessonUnitCentsForAllocation(event, contact, settings?.defaultLessonPriceCents ?? null);
  if (!unit || unit <= 0) return;

  if (event.lessonPaymentStatus === "pendente") {
    await storage.adjustGuestLessonBalanceCents(userId, cid, unit);
    return;
  }

  if (event.lessonPaymentStatus === "pago") {
    const pending = await storage.listPendingLessonEventsForContact(userId, cid);
    if (pending.length === 0) {
      await storage.adjustGuestLessonBalanceCents(userId, cid, unit);
    }
  }
}

/** Após criar aula pendente: consome saldo retido e marca como pago se couber. */
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
  if (again) await markLessonPaidAndSyncCalendar(userId, again, displayName);
}
