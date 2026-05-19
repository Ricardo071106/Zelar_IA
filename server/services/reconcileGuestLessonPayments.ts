import type { Event } from "@shared/schema";
import { storage } from "../storage";
import { displayNameFromGuestContact, getLessonUnitCentsFromEventSnapshot } from "./pluggy/lessonUnitPrice";
import { syncGuestFinancialState } from "./guestLessonFinancials";

const DEBUG_RECONCILE = process.env.DEBUG_PLUGGY === "true";

export type ReconcileGuestLessonsResult = {
  markedCount: number;
  balanceConsumedCents: number;
  totalPoolCents: number;
};

/**
 * Marca aulas pendentes como pagas usando saldo retido normalizado (após sync).
 * Créditos Pluggy entram no ledger e o saldo exibido é recalculado em syncGuestFinancialState.
 */
export async function reconcileGuestContactLessonPayments(
  userId: number,
  contactId: number,
  opts?: { paymentSource?: "pluggy" | "balance" },
): Promise<ReconcileGuestLessonsResult> {
  const paySource = opts?.paymentSource ?? "balance";
  const contact = await storage.getGuestContactByIdForUser(userId, contactId);
  if (!contact) {
    return { markedCount: 0, balanceConsumedCents: 0, totalPoolCents: 0 };
  }

  const settings = await storage.getUserSettings(userId);
  const def = settings?.defaultLessonPriceCents ?? null;

  await syncGuestFinancialState(userId, contactId);
  const fresh = await storage.getGuestContactByIdForUser(userId, contactId);
  if (!fresh) {
    return { markedCount: 0, balanceConsumedCents: 0, totalPoolCents: 0 };
  }

  let poolCents = Math.max(0, fresh.lessonBalanceCents ?? 0);
  const totalPoolCents = poolCents;

  const chain = await storage.listBillableLessonEventsForContactOrdered(userId, contactId);
  const eventsToMark: { event: Event; source: "pluggy" | "balance" }[] = [];
  let balanceConsumedCents = 0;

  for (const ev of chain) {
    if (ev.lessonPaymentStatus !== "pendente") continue;

    const unitEv = getLessonUnitCentsFromEventSnapshot(ev, fresh, def);
    if (!unitEv || unitEv <= 0) {
      if (DEBUG_RECONCILE) {
        console.log("[reconcile] Parou: aula sem preço unitário", { eventId: ev.id, contactId });
      }
      break;
    }

    if (poolCents >= unitEv) {
      eventsToMark.push({ event: ev, source: paySource });
      poolCents -= unitEv;
      balanceConsumedCents += unitEv;
      continue;
    }
    break;
  }

  if (eventsToMark.length === 0) {
    return { markedCount: 0, balanceConsumedCents: 0, totalPoolCents };
  }

  const { markLessonPaidAndSyncCalendar } = await import("./pluggy/pluggyPaymentProcessor");
  const displayName = displayNameFromGuestContact(fresh);
  for (const item of eventsToMark) {
    await markLessonPaidAndSyncCalendar(userId, item.event, displayName, item.source);
  }

  if (balanceConsumedCents > 0) {
    await storage.adjustGuestLessonBalanceCents(userId, contactId, -balanceConsumedCents);
  }

  await syncGuestFinancialState(userId, contactId);

  return {
    markedCount: eventsToMark.length,
    balanceConsumedCents,
    totalPoolCents,
  };
}
