import type { Event } from "@shared/schema";
import { storage } from "../storage";
import type { UserGuestContactRow } from "../storage";
import { displayNameFromGuestContact, getLessonUnitCentsFromEventSnapshot } from "./pluggy/lessonUnitPrice";

const DEBUG_RECONCILE = process.env.DEBUG_PLUGGY === "true";

export type ReconcileGuestLessonsResult = {
  markedCount: number;
  /** Saldo retido (centavos) abatido porque cobriu aulas além do que o ledger Pluggy cobria sozinho. */
  balanceConsumedCents: number;
  /** Ledger Pluggy (desde a 1ª aula) + saldo retido antes do abate. */
  totalPoolCents: number;
};

/**
 * Marca aulas como pagas até esgotar: soma do `pluggy_contact_payment_ledger` (desde a 1ª aula do aluno)
 * + `lesson_balance_cents` do contato. Abate o saldo retido quando a marcação usa mais que o ledger sozinho.
 *
 * Usado após crédito Pluggy e após salvar o aluno no painel (saldo manual), para alinhar agenda e banco.
 */
export async function reconcileGuestContactLessonPayments(
  userId: number,
  contactId: number,
): Promise<ReconcileGuestLessonsResult> {
  const contact = await storage.getGuestContactByIdForUser(userId, contactId);
  if (!contact) {
    return { markedCount: 0, balanceConsumedCents: 0, totalPoolCents: 0 };
  }

  const settings = await storage.getUserSettings(userId);
  const def = settings?.defaultLessonPriceCents ?? null;

  const firstLessonAt = await storage.getFirstLessonCreatedAtForContact(userId, contactId);
  const ledgerSum = firstLessonAt
    ? await storage.sumPluggyContactCreditsSince(userId, contactId, firstLessonAt)
    : 0;
  const balanceBefore = contact.lessonBalanceCents ?? 0;
  const totalPoolCents = ledgerSum + balanceBefore;

  const chain = await storage.listBillableLessonEventsForContactOrdered(userId, contactId);
  let cum = 0;
  const eventsToMark: Event[] = [];

  for (const ev of chain) {
    const unitEv = getLessonUnitCentsFromEventSnapshot(ev, contact, def);
    if (!unitEv || unitEv <= 0) {
      if (DEBUG_RECONCILE) {
        console.log("[reconcile] Parou: aula sem preço unitário na fila", { eventId: ev.id, contactId });
      }
      break;
    }
    if (cum + unitEv > totalPoolCents) break;
    cum += unitEv;
    if (ev.lessonPaymentStatus === "pendente") eventsToMark.push(ev);
  }

  if (eventsToMark.length === 0) {
    if (DEBUG_RECONCILE && totalPoolCents > 0) {
      console.log("[reconcile] Pool > 0 mas nenhuma pendência coberta neste momento", {
        contactId,
        totalPoolCents,
        cum,
      });
    }
    return { markedCount: 0, balanceConsumedCents: 0, totalPoolCents };
  }

  const { markLessonPaidAndSyncCalendar } = await import("./pluggy/pluggyPaymentProcessor");
  const displayName = displayNameFromGuestContact(contact);
  for (const ev of eventsToMark) {
    await markLessonPaidAndSyncCalendar(userId, ev, displayName);
  }

  let markedCostCents = 0;
  for (const ev of eventsToMark) {
    const u = getLessonUnitCentsFromEventSnapshot(ev, contact, def);
    if (u && u > 0) markedCostCents += u;
  }

  const rawFromBalance = Math.max(0, markedCostCents - ledgerSum);
  const fromBalance = Math.min(balanceBefore, rawFromBalance);
  if (fromBalance > 0) {
    await storage.adjustGuestLessonBalanceCents(userId, contactId, -fromBalance);
  }

  const stillPending = await storage.listPendingLessonEventsForContact(userId, contactId);
  if (stillPending.length === 0) {
    await storage.updateGuestContactFields(userId, contactId, { financialStatus: "pago" });
  }

  return {
    markedCount: eventsToMark.length,
    balanceConsumedCents: fromBalance,
    totalPoolCents,
  };
}
