import type { Event } from "@shared/schema";
import { storage } from "../storage";
import type { UserGuestContactRow } from "../storage";
import { capFairRetainedCents } from "./pluggy/pluggyCreditAttribution";
import { ledgerSinceForPendingLessons } from "./pluggy/pluggyLessonDateRules";
import { getLessonDebtUnitCents, getLessonUnitCentsFromEventSnapshot } from "./pluggy/lessonUnitPrice";
import { computeFullLedgerCreditsRemaining } from "./guestLessonPaymentPool";

export type GuestLessonFinancials = {
  pendingDebtCents: number;
  /** Crédito retido disponível para quitar aulas (centavos). */
  lessonBalanceCents: number;
  /** Saldo líquido = retido − dívidas pendentes (pode ser negativo). */
  lessonNetBalanceCents: number;
};

function lessonWasPaidByPluggy(ev: Event): boolean {
  const raw = ev.rawData as Record<string, unknown> | null;
  const z = raw?.zelarLesson as Record<string, unknown> | undefined;
  return z?.paymentSource === "pluggy";
}

export function resolveLedgerSinceForContact(
  pending: Event[],
  billableChain: Event[],
  timeZone?: string | null,
): Date {
  if (pending.length > 0) return ledgerSinceForPendingLessons(pending, timeZone);
  if (billableChain.length > 0) return ledgerSinceForPendingLessons(billableChain, timeZone);
  return new Date(0);
}

export async function computeRawFinancials(
  userId: number,
  contact: UserGuestContactRow,
  defaultLessonPriceCents: number | null,
): Promise<{
  pendingDebtCents: number;
  dbBalanceCents: number;
  rawLedgerUnappliedCents: number;
  hasBillableLessons: boolean;
}> {
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

  let pluggyPaidCents = 0;
  for (const ev of chain) {
    if (ev.lessonPaymentStatus !== "pago" || !lessonWasPaidByPluggy(ev)) continue;
    const u = getLessonUnitCentsFromEventSnapshot(ev, contact, def);
    if (u && u > 0) pluggyPaidCents += u;
  }

  const rawLedgerUnappliedCents = Math.max(0, rawLedgerSum - pluggyPaidCents);
  const dbBalanceCents = contact.lessonBalanceCents ?? 0;

  return {
    pendingDebtCents,
    dbBalanceCents,
    rawLedgerUnappliedCents,
    hasBillableLessons: chain.length > 0,
  };
}

function buildFinancialsFromParts(
  pendingDebtCents: number,
  availableCents: number,
): GuestLessonFinancials {
  const retido = capFairRetainedCents(availableCents, pendingDebtCents, null, true);
  return {
    pendingDebtCents,
    lessonBalanceCents: retido,
    lessonNetBalanceCents: availableCents - pendingDebtCents,
  };
}

/**
 * Somente leitura para o painel — saldo retido = `lesson_balance_cents` no banco.
 */
export async function computeGuestLessonFinancials(
  userId: number,
  contact: UserGuestContactRow,
  defaultLessonPriceCents: number | null,
): Promise<GuestLessonFinancials> {
  const raw = await computeRawFinancials(userId, contact, defaultLessonPriceCents);
  const retido = Math.max(0, raw.dbBalanceCents);
  return buildFinancialsFromParts(raw.pendingDebtCents, retido);
}

export type SyncGuestFinancialOpts = {
  /** true após /buscar Pluggy: incorpora créditos do ledger no saldo retido. */
  applyLedgerTopUp?: boolean;
};

/**
 * Grava saldo retido normalizado no banco. Use com applyLedgerTopUp após conciliação Pluggy;
 * no painel prefira computeGuestLessonFinancials (sem escrita).
 */
export async function syncGuestFinancialState(
  userId: number,
  contactId: number,
  opts?: SyncGuestFinancialOpts,
): Promise<GuestLessonFinancials> {
  const contact = await storage.getGuestContactByIdForUser(userId, contactId);
  if (!contact) {
    return buildFinancialsFromParts(0, 0);
  }
  const settings = await storage.getUserSettings(userId);
  const def = settings?.defaultLessonPriceCents ?? null;
  const raw = await computeRawFinancials(userId, contact, def);
  const ledgerRemaining = await computeFullLedgerCreditsRemaining(userId, contactId, contact, def);
  const db = contact.lessonBalanceCents ?? 0;

  const chain = await storage.listBillableLessonEventsForContactOrdered(userId, contactId);
  let targetBalance = db;
  if (opts?.applyLedgerTopUp) {
    // Sem aulas no sistema: saldo = ledger capado (corrige PIX de teste acumulados).
    if (chain.length === 0 && raw.pendingDebtCents <= 0) {
      targetBalance = ledgerRemaining;
    } else {
      targetBalance = Math.max(db, ledgerRemaining);
    }
  } else if (raw.pendingDebtCents <= 0) {
    targetBalance = Math.max(0, db);
  }

  if ((contact.lessonBalanceCents ?? 0) !== targetBalance) {
    await storage.setGuestLessonBalanceCents(userId, contactId, targetBalance);
  }

  const stillPending = await storage.listPendingLessonEventsForContact(userId, contactId);
  if (stillPending.length === 0 && raw.pendingDebtCents === 0) {
    await storage.updateGuestContactFields(userId, contactId, { financialStatus: "pago" });
  } else if (stillPending.length > 0 || raw.pendingDebtCents > 0) {
    await storage.updateGuestContactFields(userId, contactId, { financialStatus: "pendente" });
  }

  const fresh = await storage.getGuestContactByIdForUser(userId, contactId);
  const retidoAfter = Math.max(0, fresh?.lessonBalanceCents ?? targetBalance);
  return buildFinancialsFromParts(raw.pendingDebtCents, retidoAfter);
}
