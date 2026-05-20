import type { Event } from "@shared/schema";
import { storage } from "../storage";
import type { UserGuestContactRow } from "../storage";
import { getLessonUnitCentsFromEventSnapshot } from "./pluggy/lessonUnitPrice";

function lessonWasPaidByPluggy(ev: Event): boolean {
  const raw = ev.rawData as Record<string, unknown> | null;
  const z = raw?.zelarLesson as Record<string, unknown> | undefined;
  return z?.paymentSource === "pluggy";
}

/**
 * Créditos Pluggy ainda não consumidos (ledger total − aulas já pagas).
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
  return Math.max(0, fullSum - pluggyPaidCents - balancePaidCents);
}

/**
 * Pool para pagar aulas = saldo retido no banco; se zerado, usa créditos do ledger.
 */
export async function computeLessonPaymentPoolCents(
  userId: number,
  contact: UserGuestContactRow,
  defaultLessonPriceCents: number | null,
): Promise<{ poolCents: number; dbCents: number; ledgerRemainingCents: number }> {
  const dbCents = Math.max(0, contact.lessonBalanceCents ?? 0);
  const ledgerRemainingCents = await computeFullLedgerCreditsRemaining(
    userId,
    contact.id,
    contact,
    defaultLessonPriceCents,
  );

  if (dbCents > 0) {
    return { poolCents: dbCents, dbCents, ledgerRemainingCents };
  }
  return { poolCents: ledgerRemainingCents, dbCents: 0, ledgerRemainingCents };
}

/**
 * Garante `lesson_balance_cents` > 0 quando há PIX no ledger e o banco está zerado.
 */
export async function ensureSpendableBalanceInDb(
  userId: number,
  contactId: number,
): Promise<number> {
  const contact = await storage.getGuestContactByIdForUser(userId, contactId);
  if (!contact) return 0;
  const settings = await storage.getUserSettings(userId);
  const def = settings?.defaultLessonPriceCents ?? null;
  const dbCents = Math.max(0, contact.lessonBalanceCents ?? 0);
  if (dbCents > 0) return dbCents;

  const ledgerRemaining = await computeFullLedgerCreditsRemaining(userId, contactId, contact, def);
  if (ledgerRemaining > 0) {
    await storage.setGuestLessonBalanceCents(userId, contactId, ledgerRemaining);
    console.log("[saldo] Ledger → saldo retido no banco", { contactId, cents: ledgerRemaining });
    return ledgerRemaining;
  }
  return 0;
}
