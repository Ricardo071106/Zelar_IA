import type { Event } from "@shared/schema";
import { DateTime } from "luxon";

export function earliestPendingLessonCreatedAt(events: Event[]): Date | null {
  if (!events.length) return null;
  let min = events[0]!.createdAt;
  for (const e of events) {
    if (e.createdAt < min) min = e.createdAt;
  }
  return min;
}

/**
 * PIX/crédito no extrato só pode quitar aulas pendentes se o lançamento for no mesmo dia
 * ou depois da criação da aula mais antiga ainda pendente (evita pagamento antigo na janela /buscar).
 */
export function pluggyCreditEligibleForPendingLessons(
  txPostedAt: Date,
  pending: Event[],
  timeZone?: string | null,
): boolean {
  if (!pending.length) return true;
  const earliest = earliestPendingLessonCreatedAt(pending);
  if (!earliest) return true;
  const zone = timeZone?.trim() || "America/Sao_Paulo";
  const txDay = DateTime.fromJSDate(txPostedAt).setZone(zone).startOf("day");
  const lessonDay = DateTime.fromJSDate(earliest).setZone(zone).startOf("day");
  return txDay >= lessonDay;
}

/** Início do dia da aula pendente mais antiga — alinhado a `pluggyCreditEligibleForPendingLessons`. */
export function ledgerSinceForPendingLessons(pending: Event[], timeZone?: string | null): Date {
  if (!pending.length) return new Date(0);
  const earliest = earliestPendingLessonCreatedAt(pending);
  if (!earliest) return new Date(0);
  const zone = timeZone?.trim() || "America/Sao_Paulo";
  return DateTime.fromJSDate(earliest).setZone(zone).startOf("day").toJSDate();
}
