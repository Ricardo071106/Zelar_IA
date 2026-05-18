import type { Event } from "@shared/schema";
import { storage } from "../storage";
import type { UserGuestContactRow } from "../storage";
import { resolveLessonUnitCentsForAllocation, lessonEventNeedsImplicitUnitFreeze } from "./pluggy/lessonUnitPrice";

/** Alias — use `lessonEventNeedsImplicitUnitFreeze` em código novo. */
export { lessonEventNeedsImplicitUnitFreeze as eventNeedsImplicitLessonUnitFreeze };

async function persistSnapshot(_userId: number, ev: Event, snapshotCents: number): Promise<void> {
  const raw = { ...((ev.rawData as Record<string, unknown> | null) || {}) };
  const z = { ...((raw.zelarLesson as Record<string, unknown> | undefined) || {}) };
  z.lessonUnitPriceCentsSnapshot = Math.round(snapshotCents);
  raw.zelarLesson = z;
  await storage.updateEvent(ev.id, { rawData: raw as Event["rawData"] });
}

/**
 * Antes de mudar o preço padrão no painel: grava em cada aula (paga ou pendente) o preço unitário
 * que valia até agora, para pendências e Pluggy não “reembalarem” o passado com o preço novo.
 */
export async function freezeLessonUnitSnapshotsBeforeDefaultPriceChange(
  userId: number,
  oldDefaultLessonPriceCents: number | null | undefined,
): Promise<number> {
  const events = await storage.listLessonEventsMissingUnitSnapshotForUser(userId);
  if (events.length === 0) return 0;
  const contacts = await storage.listUserGuestContacts(userId);
  const byId = new Map(contacts.map((c) => [c.id, c]));
  let n = 0;
  for (const ev of events) {
    const cid = ev.studentContactId;
    if (cid == null) continue;
    const contact = byId.get(cid);
    if (!contact) continue;
    if (!lessonEventNeedsImplicitUnitFreeze(ev)) continue;
    const u = resolveLessonUnitCentsForAllocation(ev, contact, oldDefaultLessonPriceCents);
    if (!u || u <= 0) continue;
    await persistSnapshot(userId, ev, u);
    n++;
  }
  return n;
}

/**
 * Antes de mudar mensalidade/pacote do aluno: congela só aulas *pendentes* desse contato com o perfil antigo.
 */
export async function freezePendingLessonSnapshotsBeforeGuestPricingChange(
  userId: number,
  contactId: number,
  oldContactRow: UserGuestContactRow,
  defaultLessonPriceCents: number | null | undefined,
): Promise<number> {
  const pending = await storage.listPendingLessonEventsForContact(userId, contactId);
  let n = 0;
  for (const ev of pending) {
    if (!lessonEventNeedsImplicitUnitFreeze(ev)) continue;
    const u = resolveLessonUnitCentsForAllocation(ev, oldContactRow, defaultLessonPriceCents);
    if (!u || u <= 0) continue;
    await persistSnapshot(userId, ev, u);
    n++;
  }
  return n;
}
