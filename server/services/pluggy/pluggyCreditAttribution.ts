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

/** Máximo de crédito retido exibido (≈2 aulas) — evita PIX de teste inflar saldo no painel. */
const MAX_IDLE_RETAINED_LESSONS = 2;

/**
 * Limita crédito retido exibido/gravado. Nunca infla acima do valor real (`rawRetainedCents`).
 * `pendingDebtCents` entra só no saldo líquido (retido − dívida), não no teto do retido.
 */
export function capFairRetainedCents(
  rawRetainedCents: number,
  pendingDebtCents: number,
  defaultUnitCents: number | null,
  hasBillableLessons: boolean,
): number {
  void pendingDebtCents;
  if (rawRetainedCents <= 0) return 0;
  const unit =
    typeof defaultUnitCents === "number" && defaultUnitCents > 0
      ? Math.round(defaultUnitCents)
      : 200;
  if (!hasBillableLessons) return 0;
  return Math.min(rawRetainedCents, unit * MAX_IDLE_RETAINED_LESSONS);
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
  if (k < 1 || k > MAX_IDLE_RETAINED_LESSONS) return false;
  return amountCents === k * unit;
}
