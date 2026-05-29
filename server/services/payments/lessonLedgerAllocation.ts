import type { Event } from "@shared/schema";

/** Aula quitada com PIX/comprovante (ledger), não com saldo retido manual. */
export function lessonPaidFromLedgerCredits(ev: Event): boolean {
  const raw = ev.rawData as Record<string, unknown> | null;
  const z = raw?.zelarLesson as Record<string, unknown> | undefined;
  const src = z?.paymentSource;
  return src === "pluggy" || src === "upload";
}
