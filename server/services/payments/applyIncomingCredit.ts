import type { UserGuestContactRow } from "../../storage";
import { storage } from "../../storage";
import { syncGuestFinancialState } from "../guestLessonFinancials";
import { mergeLedgerIntoDbBalance } from "../guestLessonPaymentPool";
import { reconcileGuestContactLessonPayments } from "../reconcileGuestLessonPayments";
import {
  earliestPendingLessonCreatedAt,
  pluggyCreditEligibleForPendingLessons,
} from "../pluggy/pluggyLessonDateRules";
import {
  maxPrepaymentCentsWithoutLessons,
  pluggyCreditAllowedForContact,
  type PluggyCreditMatchKind,
} from "../pluggy/pluggyCreditAttribution";
import { displayNameFromGuestContact, resolveLessonUnitCentsForAllocation } from "../pluggy/lessonUnitPrice";

/** Marca aulas pendentes em ordem enquanto o valor do PIX/comprovante cobrir o preço unitário. */
async function markPendingLessonsFromCreditAmount(
  userId: number,
  contact: UserGuestContactRow,
  poolCents: number,
  paymentSource: "pluggy" | "upload",
): Promise<number> {
  if (poolCents <= 0) return 0;
  const settings = await storage.getUserSettings(userId);
  const pending = await storage.listPendingLessonEventsForContact(userId, contact.id);
  const { markLessonPaidAndSyncCalendar } = await import("../pluggy/pluggyPaymentProcessor");
  const displayName = displayNameFromGuestContact(contact);

  let pool = poolCents;
  let marked = 0;
  let consumedFromBalance = 0;

  for (const ev of pending) {
    const unit = resolveLessonUnitCentsForAllocation(
      ev,
      contact,
      settings?.defaultLessonPriceCents ?? null,
    );
    if (!unit || unit <= 0 || pool < unit) break;

    const fresh = (await storage.getEvent(ev.id)) ?? ev;
    if (fresh.lessonPaymentStatus !== "pendente" || fresh.cancelledAt) continue;

    await markLessonPaidAndSyncCalendar(userId, fresh, displayName, paymentSource);
    pool -= unit;
    consumedFromBalance += unit;
    marked += 1;
  }

  if (consumedFromBalance > 0) {
    const freshContact = await storage.getGuestContactByIdForUser(userId, contact.id);
    const bal = Math.max(0, freshContact?.lessonBalanceCents ?? 0);
    const deduct = Math.min(consumedFromBalance, bal);
    if (deduct > 0) {
      await storage.adjustGuestLessonBalanceCents(userId, contact.id, -deduct);
    }
  }

  return marked;
}

async function applyCreditToGuestBalance(
  userId: number,
  contactId: number,
  amountCents: number,
): Promise<number> {
  if (amountCents <= 0) return 0;
  const next = await storage.adjustGuestLessonBalanceCents(userId, contactId, amountCents);
  console.log("[saldo] crédito → lesson_balance_cents", { contactId, deltaCents: amountCents, balanceCents: next });
  return next;
}

async function settleCreditAndMarkLessons(
  userId: number,
  contact: UserGuestContactRow,
  amountCents: number,
  paymentSource: "pluggy" | "upload",
): Promise<number> {
  if (amountCents > 0) {
    await applyCreditToGuestBalance(userId, contact.id, amountCents);
  } else {
    await mergeLedgerIntoDbBalance(userId, contact.id);
  }
  const r = await reconcileGuestContactLessonPayments(userId, contact.id, { paymentSource });
  let marked = r.markedCount;
  if (marked === 0 && amountCents > 0) {
    marked = await markPendingLessonsFromCreditAmount(userId, contact, amountCents, paymentSource);
  }
  await syncGuestFinancialState(userId, contact.id, { applyLedgerTopUp: false });

  const { syncPaidLessonCalendarTitlesForContact } = await import("../lessonGoogleCalendarSync");
  const calendarFixed = await syncPaidLessonCalendarTitlesForContact(userId, contact.id);
  if (calendarFixed > 0) {
    console.log("[crédito] Títulos (pago) corrigidos no Google:", { contactId: contact.id, calendarFixed });
  }
  return marked;
}

export type ApplyIncomingCreditResult = {
  duplicate: boolean;
  applied: boolean;
  markedLessons: number;
  ledgerTxKey: string;
  reason?: string;
};

/**
 * Registra crédito no ledger (dedupe por user_id + transaction_id) e rateia aulas pendentes.
 */
export async function applyIncomingCreditToContact(opts: {
  userId: number;
  contact: UserGuestContactRow;
  amountCents: number;
  txPostedAt: Date;
  ledgerTxKey: string;
  matchKind: PluggyCreditMatchKind;
  paymentSource: "pluggy" | "upload";
}): Promise<ApplyIncomingCreditResult> {
  const { userId, contact, amountCents, txPostedAt, ledgerTxKey, matchKind, paymentSource } = opts;
  const key = ledgerTxKey.trim().slice(0, 128);
  if (!key) {
    return { duplicate: false, applied: false, markedLessons: 0, ledgerTxKey: key, reason: "chave_vazia" };
  }

  if (await storage.hasPluggyContactCredit(userId, key)) {
    const pendingDup = await storage.listPendingLessonEventsForContact(userId, contact.id);
    if (pendingDup.length > 0) {
      const marked = await settleCreditAndMarkLessons(userId, contact, 0, paymentSource);
      return {
        duplicate: true,
        applied: true,
        markedLessons: marked,
        ledgerTxKey: key,
        reason: "ja_registrado_reconciliado",
      };
    }
    await mergeLedgerIntoDbBalance(userId, contact.id);
    await syncGuestFinancialState(userId, contact.id, { applyLedgerTopUp: false });
    return {
      duplicate: true,
      applied: true,
      markedLessons: 0,
      ledgerTxKey: key,
      reason: "ja_registrado_saldo_sincronizado",
    };
  }

  const settings = await storage.getUserSettings(userId);
  const pending = await storage.listPendingLessonEventsForContact(userId, contact.id);

  if (!pluggyCreditAllowedForContact(matchKind, amountCents, contact, pending, settings)) {
    return {
      duplicate: false,
      applied: false,
      markedLessons: 0,
      ledgerTxKey: key,
      reason: "nao_e_pagamento_aula",
    };
  }

  if (pending.length > 0 && !pluggyCreditEligibleForPendingLessons(txPostedAt, pending, settings?.timeZone)) {
    return {
      duplicate: false,
      applied: false,
      markedLessons: 0,
      ledgerTxKey: key,
      reason: "data_anterior_aula",
    };
  }

  if (pending.length === 0) {
    const chain = await storage.listBillableLessonEventsForContactOrdered(userId, contact.id);
    if (chain.length === 0) {
      const maxPrepay = maxPrepaymentCentsWithoutLessons(contact, settings ?? undefined);
      if (maxPrepay != null) {
        const ledgerSum = await storage.sumPluggyContactCreditsSince(userId, contact.id, new Date(0));
        if (ledgerSum + amountCents > maxPrepay) {
          return {
            duplicate: false,
            applied: false,
            markedLessons: 0,
            ledgerTxKey: key,
            reason: "teto_prepagamento",
          };
        }
      }
    }
    const ledgerInserted = await storage.insertPluggyContactCredit(
      userId,
      contact.id,
      key,
      amountCents,
      txPostedAt,
    );
    if (!ledgerInserted) {
      return { duplicate: true, applied: false, markedLessons: 0, ledgerTxKey: key, reason: "conflito_insert" };
    }
    await applyCreditToGuestBalance(userId, contact.id, amountCents);
    await syncGuestFinancialState(userId, contact.id, { applyLedgerTopUp: false });
    return { duplicate: false, applied: true, markedLessons: 0, ledgerTxKey: key };
  }

  const unitProbe = resolveLessonUnitCentsForAllocation(
    pending[0],
    contact,
    settings?.defaultLessonPriceCents ?? null,
  );
  if (!unitProbe || unitProbe <= 0) {
    const ledgerInserted = await storage.insertPluggyContactCredit(
      userId,
      contact.id,
      key,
      amountCents,
      txPostedAt,
    );
    if (!ledgerInserted) {
      return { duplicate: true, applied: false, markedLessons: 0, ledgerTxKey: key };
    }
    await applyCreditToGuestBalance(userId, contact.id, amountCents);
    await syncGuestFinancialState(userId, contact.id, { applyLedgerTopUp: false });
    return { duplicate: false, applied: true, markedLessons: 0, ledgerTxKey: key, reason: "sem_preco_aula" };
  }

  const ledgerInserted = await storage.insertPluggyContactCredit(
    userId,
    contact.id,
    key,
    amountCents,
    txPostedAt,
  );
  if (!ledgerInserted) {
    const already = await storage.hasPluggyContactCredit(userId, key);
    if (already) {
      return { duplicate: true, applied: false, markedLessons: 0, ledgerTxKey: key };
    }
    return { duplicate: false, applied: false, markedLessons: 0, ledgerTxKey: key, reason: "ledger_falhou" };
  }

  const markedLessons = await settleCreditAndMarkLessons(userId, contact, amountCents, paymentSource);

  return {
    duplicate: false,
    applied: true,
    markedLessons,
    ledgerTxKey: key,
  };
}
