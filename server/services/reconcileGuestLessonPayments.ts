import type { Event } from "@shared/schema";
import { DateTime } from "luxon";
import { storage } from "../storage";
import { displayNameFromGuestContact, getLessonUnitCentsFromEventSnapshot } from "./pluggy/lessonUnitPrice";

const DEBUG_RECONCILE = process.env.DEBUG_PLUGGY === "true";

function startOfLocalDay(d: Date, timeZone: string | null | undefined): Date {
  const zone = timeZone?.trim() || "America/Sao_Paulo";
  return DateTime.fromJSDate(d).setZone(zone).startOf("day").toJSDate();
}

function lessonWasPaidByPluggy(ev: Event): boolean {
  const raw = ev.rawData as Record<string, unknown> | null;
  const z = raw?.zelarLesson as Record<string, unknown> | undefined;
  return z?.paymentSource === "pluggy";
}

export type ReconcileGuestLessonsResult = {
  markedCount: number;
  /** Saldo retido (centavos) abatido porque cobriu aulas além do que o ledger Pluggy cobria sozinho. */
  balanceConsumedCents: number;
  /** Ledger Pluggy (desde a 1ª aula) + saldo retido antes do abate. */
  totalPoolCents: number;
};

/**
 * Marca aulas pendentes como pagas até esgotar o crédito disponível.
 *
 * O ledger Pluggy cobre o prefixo cronológico de aulas (pagas + pendentes). O saldo retido/manual cobre
 * somente aulas ainda pendentes, para não ser consumido por aulas antigas que já estavam pagas por outro caminho.
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
  const ledgerSince = firstLessonAt ? startOfLocalDay(firstLessonAt, settings?.timeZone) : new Date(0);
  const ledgerSum = await storage.sumPluggyContactCreditsSince(userId, contactId, ledgerSince);
  const balanceBefore = contact.lessonBalanceCents ?? 0;
  const positiveBalanceCents = Math.max(0, balanceBefore);
  const totalPoolCents = ledgerSum + positiveBalanceCents;

  const chain = await storage.listBillableLessonEventsForContactOrdered(userId, contactId);
  let pluggyConsumedCents = 0;
  let balanceRemainingCents = positiveBalanceCents;
  let balanceConsumedCents = 0;
  const eventsToMark: { event: Event; source: "pluggy" | "balance" }[] = [];

  for (const ev of chain) {
    const unitEv = getLessonUnitCentsFromEventSnapshot(ev, contact, def);
    if (!unitEv || unitEv <= 0) {
      if (DEBUG_RECONCILE) {
        console.log("[reconcile] Parou: aula sem preço unitário na fila", { eventId: ev.id, contactId });
      }
      break;
    }

    if (ev.lessonPaymentStatus === "pago") {
      if (lessonWasPaidByPluggy(ev)) {
        pluggyConsumedCents += unitEv;
      }
      continue;
    }

    if (ev.lessonPaymentStatus !== "pendente") {
      continue;
    }

    if (pluggyConsumedCents + unitEv <= ledgerSum) {
      eventsToMark.push({ event: ev, source: "pluggy" });
      pluggyConsumedCents += unitEv;
      continue;
    }

    if (balanceRemainingCents >= unitEv) {
      eventsToMark.push({ event: ev, source: "balance" });
      balanceRemainingCents -= unitEv;
      balanceConsumedCents += unitEv;
      continue;
    }

    break;
  }

  if (eventsToMark.length === 0) {
    if (DEBUG_RECONCILE && totalPoolCents > 0) {
      console.log("[reconcile] Pool > 0 mas nenhuma pendência coberta neste momento", {
        contactId,
        totalPoolCents,
        ledgerSum,
        balanceBefore,
      });
    }
    return { markedCount: 0, balanceConsumedCents: 0, totalPoolCents };
  }

  const { markLessonPaidAndSyncCalendar } = await import("./pluggy/pluggyPaymentProcessor");
  const displayName = displayNameFromGuestContact(contact);
  for (const item of eventsToMark) {
    await markLessonPaidAndSyncCalendar(userId, item.event, displayName, item.source);
  }

  if (balanceConsumedCents > 0) {
    await storage.adjustGuestLessonBalanceCents(userId, contactId, -balanceConsumedCents);
  }

  const stillPending = await storage.listPendingLessonEventsForContact(userId, contactId);
  if (stillPending.length === 0) {
    await storage.updateGuestContactFields(userId, contactId, { financialStatus: "pago" });
  }

  return {
    markedCount: eventsToMark.length,
    balanceConsumedCents,
    totalPoolCents,
  };
}
