import type { Event } from "@shared/schema";
import { storage } from "../storage";
import { displayNameFromGuestContact, getLessonDebtUnitCents } from "./pluggy/lessonUnitPrice";
import { computeRawFinancials, poolCentsForRetainedDisplay, syncGuestFinancialState } from "./guestLessonFinancials";

const DEBUG_RECONCILE = process.env.DEBUG_PLUGGY === "true";

export type ReconcileGuestLessonsResult = {
  markedCount: number;
  balanceConsumedCents: number;
  totalPoolCents: number;
};

/**
 * Marca aulas pendentes como pagas enquanto houver pool (saldo retido + créditos Pluggy no ledger).
 * Só abate `lesson_balance_cents` do aluno quando a fonte é saldo manual/retido; Pluggy consome o ledger.
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
  const freshContact = await storage.getGuestContactByIdForUser(userId, contactId);
  if (!freshContact) {
    return { markedCount: 0, balanceConsumedCents: 0, totalPoolCents: 0 };
  }
  const raw = await computeRawFinancials(userId, freshContact, def);

  const poolCents = poolCentsForRetainedDisplay({
    dbBalanceCents: freshContact.lessonBalanceCents ?? 0,
    rawLedgerUnappliedCents: raw.rawLedgerUnappliedCents,
  });
  void paySource;
  const totalPoolCents = poolCents;

  const chain = await storage.listBillableLessonEventsForContactOrdered(userId, contactId);
  const eventsToMark: { event: Event; source: "pluggy" | "balance" }[] = [];
  let balanceConsumedCents = 0;

  for (const ev of chain) {
    if (ev.lessonPaymentStatus !== "pendente") continue;

    const unitEv = getLessonDebtUnitCents(ev, freshContact, def);
    if (!unitEv || unitEv <= 0) {
      if (DEBUG_RECONCILE) {
        console.log("[reconcile] Ignorou aula sem preço unitário", { eventId: ev.id, contactId });
      }
      continue;
    }

    if (poolCents >= unitEv) {
      const dbLeft = Math.max(0, freshContact.lessonBalanceCents ?? 0) - balanceConsumedCents;
      const source: "pluggy" | "balance" = dbLeft >= unitEv ? "balance" : "pluggy";
      eventsToMark.push({ event: ev, source });
      poolCents -= unitEv;
      if (source === "balance") {
        balanceConsumedCents += unitEv;
      }
      continue;
    }
    break;
  }

  if (eventsToMark.length === 0) {
    if (DEBUG_RECONCILE && totalPoolCents > 0) {
      console.log("[reconcile] Pool > 0 mas nenhuma pendência coberta", {
        contactId,
        totalPoolCents,
        ledgerUnapplied: raw.rawLedgerUnappliedCents,
        dbBalance: freshContact.lessonBalanceCents,
      });
    }
    return { markedCount: 0, balanceConsumedCents: 0, totalPoolCents };
  }

  const { markLessonPaidAndSyncCalendar } = await import("./pluggy/pluggyPaymentProcessor");
  const displayName = displayNameFromGuestContact(freshContact);
  for (const item of eventsToMark) {
    const freshEv = (await storage.getEvent(item.event.id)) ?? item.event;
    await markLessonPaidAndSyncCalendar(userId, freshEv, displayName, item.source);
  }

  if (balanceConsumedCents > 0) {
    await storage.adjustGuestLessonBalanceCents(userId, contactId, -balanceConsumedCents);
  }

  await syncGuestFinancialState(userId, contactId, { applyLedgerTopUp: false });

  const { syncPaidLessonCalendarTitlesForContact } = await import("./lessonGoogleCalendarSync");
  const calendarFixed = await syncPaidLessonCalendarTitlesForContact(userId, contactId);

  if (eventsToMark.length > 0 || calendarFixed > 0) {
    console.log("[reconcile] Aulas pagas / agenda", {
      contactId,
      markedCount: eventsToMark.length,
      balanceConsumedCents,
      totalPoolCents,
      calendarFixed,
    });
  }

  return {
    markedCount: eventsToMark.length,
    balanceConsumedCents,
    totalPoolCents,
  };
}
