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

/** Teto de retido no painel quando há dívidas pendentes (evita confusão retido vs débito). */
const MAX_RETAINED_WHEN_OWING_LESSONS = 2;

/**
 * Normaliza crédito retido exibido/gravado. Nunca infla acima do valor real (`rawRetainedCents`).
 * Sem dívidas pendentes: mostra o crédito integral (ex. R$ 12 após 3× PIX de R$ 4 no /buscar).
 * Com dívidas: limita exibição a ~2 aulas para não mascarar o saldo líquido negativo.
 */
export function capFairRetainedCents(
  rawRetainedCents: number,
  pendingDebtCents: number,
  defaultUnitCents: number | null,
  hasBillableLessons: boolean,
): number {
  void hasBillableLessons;
  if (rawRetainedCents <= 0) return 0;
  if (pendingDebtCents <= 0) return rawRetainedCents;
  const unit =
    typeof defaultUnitCents === "number" && defaultUnitCents > 0
      ? Math.round(defaultUnitCents)
      : 200;
  return Math.min(rawRetainedCents, unit * MAX_RETAINED_WHEN_OWING_LESSONS);
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
