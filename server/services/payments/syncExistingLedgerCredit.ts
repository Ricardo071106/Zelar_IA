import { storage } from "../../storage";
import { syncGuestFinancialState } from "../guestLessonFinancials";
import { mergeLedgerIntoDbBalance } from "../guestLessonPaymentPool";

export type SyncExistingLedgerCreditResult = {
  contactId: number | null;
  balanceCents: number;
};

/** Reenvio de comprovante duplicado: incorpora crédito do ledger ao saldo visível no painel. */
export async function syncExistingLedgerCreditToBalance(
  userId: number,
  dedupeKey: string,
  contactId?: number | null,
): Promise<SyncExistingLedgerCreditResult> {
  const cid =
    contactId ?? (await storage.findContactIdByPluggyLedgerKey(userId, dedupeKey));
  if (cid == null) {
    return { contactId: null, balanceCents: 0 };
  }
  const balanceCents = await mergeLedgerIntoDbBalance(userId, cid);
  await syncGuestFinancialState(userId, cid, { applyLedgerTopUp: false });
  return { contactId: cid, balanceCents };
}
