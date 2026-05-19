import type { Event } from "@shared/schema";
import { storage } from "../storage";
import type { UserGuestContactRow } from "../storage";
import { capFairRetainedCents } from "./pluggy/pluggyCreditAttribution";
import { ledgerSinceForPendingLessons } from "./pluggy/pluggyLessonDateRules";
import { getLessonDebtUnitCents, getLessonUnitCentsFromEventSnapshot } from "./pluggy/lessonUnitPrice";

export type GuestLessonFinancials = {
  pendingDebtCents: number;
  /** Crédito retido exibido no painel (única fonte após sync). */
  lessonBalanceCents: number;
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

async function computeRawFinancials(
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

/** Lê saldo/dívida sem gravar (painel rápido). */
export async function computeGuestLessonFinancials(
  userId: number,
  contact: UserGuestContactRow,
  defaultLessonPriceCents: number | null,
): Promise<GuestLessonFinancials> {
  const raw = await computeRawFinancials(userId, contact, defaultLessonPriceCents);
  const consolidated = capFairRetainedCents(
    Math.max(0, raw.dbBalanceCents) + raw.rawLedgerUnappliedCents,
    raw.pendingDebtCents,
    defaultLessonPriceCents,
    raw.hasBillableLessons,
  );
  return {
    pendingDebtCents: raw.pendingDebtCents,
    lessonBalanceCents: consolidated,
    lessonNetBalanceCents: consolidated - raw.pendingDebtCents,
  };
}

/**
 * Normaliza `lesson_balance_cents` no banco (corrige PIX de teste / ledger inflado).
 * Chamar após /buscar, reconcile ou ao listar alunos no painel.
 */
export async function syncGuestFinancialState(
  userId: number,
  contactId: number,
): Promise<GuestLessonFinancials> {
  const contact = await storage.getGuestContactByIdForUser(userId, contactId);
  if (!contact) {
    return { pendingDebtCents: 0, lessonBalanceCents: 0, lessonNetBalanceCents: 0 };
  }
  const settings = await storage.getUserSettings(userId);
  const def = settings?.defaultLessonPriceCents ?? null;
  const raw = await computeRawFinancials(userId, contact, def);
  const fairRetido = capFairRetainedCents(
    Math.max(0, raw.dbBalanceCents) + raw.rawLedgerUnappliedCents,
    raw.pendingDebtCents,
    def,
    raw.hasBillableLessons,
  );

  if ((contact.lessonBalanceCents ?? 0) !== fairRetido) {
    await storage.setGuestLessonBalanceCents(userId, contactId, fairRetido);
  }

  const stillPending = await storage.listPendingLessonEventsForContact(userId, contactId);
  if (stillPending.length === 0 && raw.pendingDebtCents === 0) {
    await storage.updateGuestContactFields(userId, contactId, { financialStatus: "pago" });
  } else if (raw.pendingDebtCents > 0) {
    await storage.updateGuestContactFields(userId, contactId, { financialStatus: "pendente" });
  }

  return {
    pendingDebtCents: raw.pendingDebtCents,
    lessonBalanceCents: fairRetido,
    lessonNetBalanceCents: fairRetido - raw.pendingDebtCents,
  };
}
