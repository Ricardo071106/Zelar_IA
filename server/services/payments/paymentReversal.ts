import type { PluggyTx } from "../pluggy/pluggyPaymentProcessor";
import { storage } from "../../storage";
import type { UserGuestContactRow } from "../../storage";
import {
  displayNameFromGuestContact,
  resolveLessonUnitCentsForAllocation,
} from "../pluggy/lessonUnitPrice";
import { syncGuestFinancialState } from "../guestLessonFinancials";

export function pluggyTxDescriptionUpper(tx: PluggyTx): string {
  return [tx.descriptionRaw, tx.description, tx.paymentData?.reason]
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .join(" ")
    .toUpperCase();
}

/** Crédito no extrato que na prática desfaz um PIX recebido (estorno/devolução). */
export function memoLooksLikeInboundRefundCredit(tx: PluggyTx): boolean {
  const blob = pluggyTxDescriptionUpper(tx);
  if (!blob.trim()) return false;
  if (/PIX\s+ENVIADO|TRANSF\s+ENVIADA|TRANSFERENCIA\s+ENVIADA/i.test(blob)) return false;
  return (
    /DEVOL\s+RECEBIDA|DEVOLU[CÇ][AÃ]O\s+RECEBIDA|ESTORNO|REEMBOLSO|DEVOL\s+PIX|DEVOLU[CÇ][AÃ]O\s+PIX/i.test(
      blob,
    ) || /PIX\s+DEVOLVIDO|PIX\s+ESTORNADO/i.test(blob)
  );
}

export type PaymentReversalResult = {
  applied: boolean;
  lessonsReopened: number;
  ledgerReversalCents: number;
  balanceAdjustedCents: number;
};

/**
 * Estorno: PIX enviado ao aluno ou devolução no extrato.
 * Registra ajuste negativo no ledger, reabre aulas pagas (LIFO) e reduz saldo retido.
 */
export async function applyOutgoingPaymentReversal(opts: {
  userId: number;
  contact: UserGuestContactRow;
  amountCents: number;
  txPostedAt: Date;
  dedupeKey: string;
  reason: "debit" | "refund_credit";
}): Promise<PaymentReversalResult> {
  const { userId, contact, amountCents, txPostedAt, dedupeKey, reason } = opts;
  const cents = Math.round(amountCents);
  if (cents <= 0) {
    return { applied: false, lessonsReopened: 0, ledgerReversalCents: 0, balanceAdjustedCents: 0 };
  }

  const key = dedupeKey.trim().slice(0, 128);
  if (!key) {
    return { applied: false, lessonsReopened: 0, ledgerReversalCents: 0, balanceAdjustedCents: 0 };
  }

  const inserted = await storage.tryRecordPluggyTransactionOnce(userId, key);
  if (!inserted) {
    return { applied: false, lessonsReopened: 0, ledgerReversalCents: 0, balanceAdjustedCents: 0 };
  }

  const ledgerKey = (`reversal_${key}`).slice(0, 128);
  const ledgerInserted = await storage.insertPluggyContactCredit(
    userId,
    contact.id,
    ledgerKey,
    -cents,
    txPostedAt,
  );

  const settings = await storage.getUserSettings(userId);
  const displayName = displayNameFromGuestContact(contact);
  const chain = await storage.listBillableLessonEventsForContactOrdered(userId, contact.id);
  const paidNewestFirst = chain.filter((ev) => ev.lessonPaymentStatus === "pago").reverse();

  const { unmarkLessonPaidAndSyncCalendar } = await import("../pluggy/pluggyPaymentProcessor");

  let remaining = cents;
  let lessonsReopened = 0;

  for (const ev of paidNewestFirst) {
    if (remaining <= 0) break;
    const unit = resolveLessonUnitCentsForAllocation(
      ev,
      contact,
      settings?.defaultLessonPriceCents ?? null,
    );
    if (!unit || unit <= 0 || remaining < unit) continue;

    const fresh = (await storage.getEvent(ev.id)) ?? ev;
    if (fresh.lessonPaymentStatus !== "pago" || fresh.cancelledAt) continue;

    await unmarkLessonPaidAndSyncCalendar(userId, fresh, displayName);
    remaining -= unit;
    lessonsReopened += 1;
  }

  const freshContact = await storage.getGuestContactByIdForUser(userId, contact.id);
  const balanceBefore = Math.max(0, freshContact?.lessonBalanceCents ?? 0);
  const balanceCut = Math.min(balanceBefore, cents);
  if (balanceCut > 0) {
    await storage.adjustGuestLessonBalanceCents(userId, contact.id, -balanceCut);
  }

  await syncGuestFinancialState(userId, contact.id, { applyLedgerTopUp: false });

  console.log("[estorno] Pagamento revertido para aluno", {
    userId,
    contactId: contact.id,
    reason,
    amountCents: cents,
    lessonsReopened,
    ledgerInserted,
    balanceAdjustedCents: balanceCut,
  });

  return {
    applied: true,
    lessonsReopened,
    ledgerReversalCents: ledgerInserted ? cents : 0,
    balanceAdjustedCents: balanceCut,
  };
}
