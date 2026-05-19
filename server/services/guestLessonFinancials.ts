import type { Event } from "@shared/schema";
import { storage } from "../storage";
import type { UserGuestContactRow } from "../storage";
import { ledgerSinceForPendingLessons } from "./pluggy/pluggyLessonDateRules";
import { getLessonDebtUnitCents, getLessonUnitCentsFromEventSnapshot } from "./pluggy/lessonUnitPrice";

export type GuestLessonFinancials = {
  pendingDebtCents: number;
  lessonBalanceCents: number;
  /** Créditos Pluggy no ledger ainda não “usados” por aulas já marcadas pago. */
  pluggyLedgerUnappliedCents: number;
  lessonNetBalanceCents: number;
};

function lessonWasPaidByPluggy(ev: Event): boolean {
  const raw = ev.rawData as Record<string, unknown> | null;
  const z = raw?.zelarLesson as Record<string, unknown> | undefined;
  return z?.paymentSource === "pluggy";
}

/** Data mínima para somar créditos Pluggy — nunca epoch 0 quando há aulas no histórico. */
export function resolveLedgerSinceForContact(
  pending: Event[],
  billableChain: Event[],
  timeZone?: string | null,
): Date {
  if (pending.length > 0) return ledgerSinceForPendingLessons(pending, timeZone);
  if (billableChain.length > 0) return ledgerSinceForPendingLessons(billableChain, timeZone);
  return new Date(0);
}

export async function computeGuestLessonFinancials(
  userId: number,
  contact: UserGuestContactRow,
  defaultLessonPriceCents: number | null,
): Promise<GuestLessonFinancials> {
  const settings = await storage.getUserSettings(userId);
  const tz = settings?.timeZone ?? "America/Sao_Paulo";
  const def = defaultLessonPriceCents;

  const pending = await storage.listPendingLessonEventsForContact(userId, contact.id);
  const chain = await storage.listBillableLessonEventsForContactOrdered(userId, contact.id);

  let pendingDebtCents = 0;
  for (const ev of pending) {
    const u = getLessonDebtUnitCents(ev, contact, def);
    if (u && u > 0) pendingDebtCents += u;
  }

  const ledgerSince = resolveLedgerSinceForContact(pending, chain, tz);
  const rawLedgerSum = await storage.sumPluggyContactCreditsSince(userId, contact.id, ledgerSince);

  let existingPluggyPaidCents = 0;
  for (const ev of chain) {
    if (ev.lessonPaymentStatus !== "pago" || !lessonWasPaidByPluggy(ev)) continue;
    const u = getLessonUnitCentsFromEventSnapshot(ev, contact, def);
    if (u && u > 0) existingPluggyPaidCents += u;
  }

  const pluggyLedgerUnappliedCents = Math.max(0, rawLedgerSum - existingPluggyPaidCents);
  const lessonBalanceCents = contact.lessonBalanceCents ?? 0;
  const lessonNetBalanceCents = lessonBalanceCents + pluggyLedgerUnappliedCents - pendingDebtCents;

  return {
    pendingDebtCents,
    lessonBalanceCents,
    pluggyLedgerUnappliedCents,
    lessonNetBalanceCents,
  };
}
