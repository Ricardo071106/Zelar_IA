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

function exactLessonPaymentMatch(
  amountCents: number,
  pending: Event[],
  contact: UserGuestContactRow,
  defaultLessonPriceCents: number | null | undefined,
): boolean {
  if (pending.length === 0) return false;
  const unit = resolveLessonUnitCentsForAllocation(
    pending[0]!,
    contact,
    defaultLessonPriceCents ?? null,
  );
  if (!unit || unit <= 0) return false;
  const k = Math.floor(amountCents / unit);
  return k >= 1 && k <= pending.length && amountCents === k * unit;
}

/**
 * CPF sozinho não basta: evita PIX entre contas próprias (mesmo CPF) virarem saldo do aluno.
 * Com pendências: valor deve fechar N×aula. Sem pendências: valor ≤ poucas aulas e múltiplo exato.
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
    return exactLessonPaymentMatch(amountCents, pending, contact, def);
  }

  const unit = resolveLessonUnitCents(contact, def);
  if (!unit || unit <= 0) return false;

  const k = Math.floor(amountCents / unit);
  if (k < 1 || k > MAX_RETAINED_WHEN_OWING_LESSONS) return false;
  return amountCents === k * unit;
}
