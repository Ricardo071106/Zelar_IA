import type { Event } from "@shared/schema";
import { storage } from "../storage";

/**
 * Grava no `rawData.zelarLesson` qual conta OAuth Google deve atualizar o título no Calendar
 * (calendário do aluno/professor vs conta de serviço Zelar).
 */
export async function mergeLessonGoogleCalendarPatchMeta(
  eventId: number,
  patch: { googleCalendarOAuthUserId: number; googleCalendarIntegrationKey?: string | null },
): Promise<void> {
  const ev = await storage.getEvent(eventId);
  if (!ev?.rawData || typeof ev.rawData !== "object") return;
  const raw = { ...(ev.rawData as Record<string, unknown>) };
  const z = { ...((raw.zelarLesson as Record<string, unknown>) || {}) };
  z.googleCalendarOAuthUserId = Math.floor(patch.googleCalendarOAuthUserId);
  if (patch.googleCalendarIntegrationKey === null || patch.googleCalendarIntegrationKey === "") {
    delete z.googleCalendarIntegrationKey;
  } else if (typeof patch.googleCalendarIntegrationKey === "string") {
    z.googleCalendarIntegrationKey = patch.googleCalendarIntegrationKey.trim();
  }
  raw.zelarLesson = z;
  await storage.updateEvent(eventId, { rawData: raw as Event["rawData"] });
}
