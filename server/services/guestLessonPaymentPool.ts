import type { Event } from "@shared/schema";
import { storage } from "../storage";
import type { UserGuestContactRow } from "../storage";
import { getLessonUnitCentsFromEventSnapshot } from "./pluggy/lessonUnitPrice";
import { maxPrepaymentCentsWithoutLessons } from "./pluggy/pluggyCreditAttribution";

function lessonWasPaidByPluggy(ev: Event): boolean {
  const raw = ev.rawData as Record<string, unknown> | null;
  const z = raw?.zelarLesson as Record<string, unknown> | undefined;
  return z?.paymentSource === "pluggy";
}

/**
 * Créditos Pluggy ainda não consumidos (ledger total − aulas já pagas).
 * Usado só no /buscar para incorporar PIX ao saldo retido.
 */
export async function computeFullLedgerCreditsRemaining(
  userId: number,
  contactId: number,
  contact: UserGuestContactRow,
  defaultLessonPriceCents: number | null,
): Promise<number> {
  const fullSum = await storage.sumPluggyContactCreditsSince(userId, contactId, new Date(0));
  const chain = await storage.listBillableLessonEventsForContactOrdered(userId, contactId);
  let pluggyPaidCents = 0;
  let balancePaidCents = 0;
  for (const ev of chain) {
    if (ev.lessonPaymentStatus !== "pago") continue;
    const u = getLessonUnitCentsFromEventSnapshot(ev, contact, defaultLessonPriceCents);
    if (!u || u <= 0) continue;
    if (lessonWasPaidByPluggy(ev)) pluggyPaidCents += u;
    else balancePaidCents += u;
  }
  let remaining = Math.max(0, fullSum - pluggyPaidCents - balancePaidCents);
  if (chain.length === 0) {
    const settings = await storage.getUserSettings(userId);
    const maxPrepay = maxPrepaymentCentsWithoutLessons(contact, settings ?? undefined);
    if (maxPrepay != null) remaining = Math.min(remaining, maxPrepay);
  }
  return remaining;
}

/** Saldo retido disponível para pagar aulas = só o que está em `lesson_balance_cents`. */
export function spendableDbBalanceCents(contact: UserGuestContactRow): number {
  return Math.max(0, contact.lessonBalanceCents ?? 0);
}

/**
 * Incorpora ledger → banco (comprovante, Pluggy /buscar, applyLedgerTopUp).
 */
export async function mergeLedgerIntoDbBalance(
  userId: number,
  contactId: number,
): Promise<number> {
  const contact = await storage.getGuestContactByIdForUser(userId, contactId);
  if (!contact) return 0;
  const settings = await storage.getUserSettings(userId);
  const def = settings?.defaultLessonPriceCents ?? null;
  const dbCents = Math.max(0, contact.lessonBalanceCents ?? 0);
  const ledgerRemaining = await computeFullLedgerCreditsRemaining(userId, contactId, contact, def);
  const merged = Math.max(dbCents, ledgerRemaining);
  if (merged !== dbCents) {
    await storage.setGuestLessonBalanceCents(userId, contactId, merged);
    console.log("[saldo] /buscar: ledger → saldo retido", { contactId, cents: merged });
  }
  return merged;
}
