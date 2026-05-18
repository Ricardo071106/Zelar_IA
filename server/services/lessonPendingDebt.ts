import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "../db";
import { events, type Event } from "@shared/schema";
import { storage } from "../storage";
import { getLessonUnitCentsFromEventSnapshot } from "./pluggy/lessonUnitPrice";

/**
 * Soma (centavos BRL) do valor das aulas *pendentes* por aluno, usando o preço
 * congelado em cada evento (`lessonUnitPriceCentsSnapshot`) quando existir.
 */
export async function computePendingLessonDebtCentsByContact(userId: number): Promise<Map<number, number>> {
  if (!db) return new Map();
  const rows = await db
    .select()
    .from(events)
    .where(
      and(
        eq(events.userId, userId),
        eq(events.lessonPaymentStatus, "pendente"),
        isNull(events.cancelledAt),
        isNotNull(events.studentContactId),
      ),
    );

  const contacts = await storage.listUserGuestContacts(userId);
  const byId = new Map(contacts.map((c) => [c.id, c]));
  const settings = await storage.getUserSettings(userId);
  const def = settings?.defaultLessonPriceCents ?? null;

  const out = new Map<number, number>();
  for (const ev of rows as Event[]) {
    const cid = ev.studentContactId!;
    const c = byId.get(cid);
    if (!c) continue;
    const unit = getLessonUnitCentsFromEventSnapshot(ev, c, def);
    if (!unit || unit <= 0) continue;
    out.set(cid, (out.get(cid) ?? 0) + unit);
  }
  return out;
}
