import type { Event } from "@shared/schema";
import { storage } from "../storage";
import { displayNameFromGuestContact, getLessonDebtUnitCents } from "./pluggy/lessonUnitPrice";
import { spendableDbBalanceCents } from "./guestLessonPaymentPool";

export type ReconcileGuestLessonsResult = {
  markedCount: number;
  balanceConsumedCents: number;
  totalPoolCents: number;
};

/**
 * Marca aulas pendentes como pagas enquanto `lesson_balance_cents` ≥ preço da aula.
 * Não re-soma ledger Pluggy (evita pagar aula em dobro).
 */
export async function reconcileGuestContactLessonPayments(
  userId: number,
  contactId: number,
  _opts?: { paymentSource?: "pluggy" | "balance" },
): Promise<ReconcileGuestLessonsResult> {
  void _opts;

  const contact = await storage.getGuestContactByIdForUser(userId, contactId);
  if (!contact) {
    return { markedCount: 0, balanceConsumedCents: 0, totalPoolCents: 0 };
  }

  const settings = await storage.getUserSettings(userId);
  const def = settings?.defaultLessonPriceCents ?? null;
  const chain = await storage.listBillableLessonEventsForContactOrdered(userId, contactId);

  let poolLeft = spendableDbBalanceCents(contact);
  const totalPoolCents = poolLeft;

  const pendingCount = chain.filter((e) => e.lessonPaymentStatus === "pendente").length;
  console.log("[reconcile] Início", {
    contactId,
    poolCents: poolLeft,
    dbBalance: contact.lessonBalanceCents ?? 0,
    pendingLessons: pendingCount,
  });

  const eventsToMark: Event[] = [];

  for (const ev of chain) {
    if (ev.lessonPaymentStatus !== "pendente") continue;

    const unitEv = getLessonDebtUnitCents(ev, contact, def);
    if (!unitEv || unitEv <= 0) {
      console.warn("[reconcile] Aula sem preço unitário", { eventId: ev.id, contactId });
      continue;
    }

    if (poolLeft >= unitEv) {
      eventsToMark.push(ev);
      poolLeft -= unitEv;
      continue;
    }
    break;
  }

  if (eventsToMark.length === 0) {
    console.log("[reconcile] Nenhuma aula marcada paga", {
      contactId,
      totalPoolCents,
      pendingLessons: pendingCount,
      dbBalance: contact.lessonBalanceCents ?? 0,
    });
    return { markedCount: 0, balanceConsumedCents: 0, totalPoolCents };
  }

  const balanceConsumedCents = totalPoolCents - poolLeft;
  const { markLessonPaidAndSyncCalendar } = await import("./pluggy/pluggyPaymentProcessor");
  const displayName = displayNameFromGuestContact(contact);

  for (const ev of eventsToMark) {
    const freshEv = (await storage.getEvent(ev.id)) ?? ev;
    await markLessonPaidAndSyncCalendar(userId, freshEv, displayName, "balance");
  }

  if (balanceConsumedCents > 0) {
    await storage.adjustGuestLessonBalanceCents(userId, contactId, -balanceConsumedCents);
  }

  const { syncPaidLessonCalendarTitlesForContact } = await import("./lessonGoogleCalendarSync");
  const calendarFixed = await syncPaidLessonCalendarTitlesForContact(userId, contactId);

  console.log("[reconcile] Aulas pagas / agenda", {
    contactId,
    markedCount: eventsToMark.length,
    balanceConsumedCents,
    totalPoolCents,
    poolRemaining: poolLeft,
    calendarFixed,
  });

  return {
    markedCount: eventsToMark.length,
    balanceConsumedCents,
    totalPoolCents,
  };
}
