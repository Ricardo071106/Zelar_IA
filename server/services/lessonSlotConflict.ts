import { storage } from "../storage";
import { applyLessonBalanceCreditBeforeSoftCancel } from "./lessonCancellationCredit";

const DEFAULT_SLOT_WINDOW_MS = 90_000;

/**
 * Ao recriar aula no mesmo horário: cancela eventos ativos do aluno nesse slot
 * (evita linha antiga “paga” coexistir com aula nova).
 */
export async function softCancelOverlappingLessonsAtSlot(
  userId: number,
  studentContactId: number,
  startDate: Date,
  windowMs = DEFAULT_SLOT_WINDOW_MS,
): Promise<number> {
  const chain = await storage.listBillableLessonEventsForContactOrdered(userId, studentContactId);
  const targetMs = startDate.getTime();
  if (Number.isNaN(targetMs)) return 0;

  let cancelled = 0;
  for (const ev of chain) {
    if (ev.cancelledAt) continue;
    const st = new Date(ev.startDate).getTime();
    if (Number.isNaN(st) || Math.abs(st - targetMs) > windowMs) continue;
    await applyLessonBalanceCreditBeforeSoftCancel(userId, ev);
    await storage.softCancelEvent(ev.id);
    cancelled += 1;
  }
  if (cancelled > 0) {
    console.log("[aula] Horário reutilizado: cancelou evento(s) anterior(es) no mesmo slot", {
      userId,
      studentContactId,
      startDate: startDate.toISOString(),
      cancelled,
    });
  }
  return cancelled;
}
