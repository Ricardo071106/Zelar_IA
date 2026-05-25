import type { UserGuestContactRow } from "../../storage";
import { storage } from "../../storage";
import { syncGuestFinancialState } from "../guestLessonFinancials";
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
import { resolveLessonUnitCentsForAllocation } from "../pluggy/lessonUnitPrice";

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
    return { duplicate: true, applied: false, markedLessons: 0, ledgerTxKey: key, reason: "ja_registrado" };
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
    await syncGuestFinancialState(userId, contact.id);
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

  const r = await reconcileGuestContactLessonPayments(userId, contact.id, { paymentSource });
  await syncGuestFinancialState(userId, contact.id, { applyLedgerTopUp: true });

  return {
    duplicate: false,
    applied: true,
    markedLessons: r.markedCount,
    ledgerTxKey: key,
  };
}
