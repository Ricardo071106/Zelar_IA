import type { Event, UserSettings } from "@shared/schema";
import type { UserGuestContactRow } from "../../storage";
import { resolveLessonUnitCents, resolveLessonUnitCentsForAllocation } from "./lessonUnitPrice";

export type PluggyCreditMatchKind =
  | "amount_exact"
  | "name"
  | "memo"
  | "lesson_title"
  | "cpf_with_amount"
  | "cpf_only";

/** Teto só para PIX solto por CPF sem aulas (evita transferência de teste virar saldo). */
export const MAX_RETAINED_WHEN_OWING_LESSONS = 2;

/** Prepagamento máximo (centavos) quando o aluno ainda não tem aulas no sistema. */
export function maxPrepaymentCentsWithoutLessons(
  contact: UserGuestContactRow,
  settings: UserSettings | undefined,
): number | null {
  const unit = resolveLessonUnitCents(contact, settings?.defaultLessonPriceCents ?? null);
  if (!unit || unit <= 0) return null;
  return MAX_RETAINED_WHEN_OWING_LESSONS * unit;
}

/**
 * Crédito disponível para exibir/gravar. Não reduz artificialmente o retido quando há dívidas
 * (o saldo líquido já desconta as pendências).
 */
export function capFairRetainedCents(
  rawRetainedCents: number,
  pendingDebtCents: number,
  defaultUnitCents: number | null,
  hasBillableLessons: boolean,
): number {
  void pendingDebtCents;
  void defaultUnitCents;
  void hasBillableLessons;
  return Math.max(0, rawRetainedCents);
}

function pendingLessonUnitCents(
  pending: Event[],
  contact: UserGuestContactRow,
  defaultLessonPriceCents: number | null | undefined,
): number | null {
  if (pending.length === 0) return null;
  const unit = resolveLessonUnitCentsForAllocation(
    pending[0]!,
    contact,
    defaultLessonPriceCents ?? null,
  );
  return unit && unit > 0 ? unit : null;
}

/** Valor fecha exatamente N×aula (N ≥ 1), inclusive quando N > pendências (overpayment). */
export function exactLessonPaymentMatch(
  amountCents: number,
  pending: Event[],
  contact: UserGuestContactRow,
  defaultLessonPriceCents: number | null | undefined,
): boolean {
  const unit = pendingLessonUnitCents(pending, contact, defaultLessonPriceCents);
  if (!unit) return false;
  const k = Math.floor(amountCents / unit);
  return k >= 1 && amountCents === k * unit;
}

/**
 * CPF sozinho não basta: evita PIX entre contas próprias (mesmo CPF) virarem saldo do aluno.
 * Com pendências: aceita ≥ 1 aula (excedente vira saldo no rateio). Sem pendências: teto curto e múltiplo exato.
 */
export function pluggyCreditAllowedForContact(
  matchKind: PluggyCreditMatchKind,
  amountCents: number,
  contact: UserGuestContactRow,
  pending: Event[],
  settings: UserSettings | undefined,
): boolean {
  if (matchKind !== "cpf_only") return true;

  const def = settings?.defaultLessonPriceCents ?? null;
  if (pending.length > 0) {
    const unit = pendingLessonUnitCents(pending, contact, def);
    return unit != null && amountCents >= unit;
  }

  const unit = resolveLessonUnitCents(contact, def);
  if (!unit || unit <= 0) return false;

  const k = Math.floor(amountCents / unit);
  if (k < 1 || k > MAX_RETAINED_WHEN_OWING_LESSONS) return false;
  return amountCents === k * unit;
}
