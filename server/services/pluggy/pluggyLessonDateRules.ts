import type { Event } from "@shared/schema";

export function earliestPendingLessonCreatedAt(events: Event[]): Date | null {
  if (!events.length) return null;
  let min = events[0]!.createdAt;
  for (const e of events) {
    if (e.createdAt < min) min = e.createdAt;
  }
  return min;
}

/**
 * PIX/crédito no extrato só quita aulas pendentes se o lançamento for **após**
 * o instante exato (data/hora/segundo) em que a aula mais antiga ainda pendente foi criada.
 */
export function pluggyCreditEligibleForPendingLessons(
  txPostedAt: Date,
  pending: Event[],
  _timeZone?: string | null,
): boolean {
  void _timeZone;
  if (!pending.length) return true;
  const earliest = earliestPendingLessonCreatedAt(pending);
  if (!earliest) return true;
  return txPostedAt.getTime() >= earliest.getTime();
}

/** Timestamp da aula pendente mais antiga — alinhado a `pluggyCreditEligibleForPendingLessons`. */
export function ledgerSinceForPendingLessons(pending: Event[], _timeZone?: string | null): Date {
  void _timeZone;
  if (!pending.length) return new Date(0);
  const earliest = earliestPendingLessonCreatedAt(pending);
  return earliest ?? new Date(0);
}
