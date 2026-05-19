import type { Event } from "@shared/schema";
import type { UserGuestContactRow } from "../../storage";

export function resolveLessonUnitCents(
  contact: UserGuestContactRow | null,
  defaultLessonPriceCents: number | null | undefined,
): number | null {
  if (
    contact?.monthlyAmountCents != null &&
    contact.monthlyAmountCents > 0 &&
    contact.packageLessonsTotal != null &&
    contact.packageLessonsTotal > 0
  ) {
    return Math.round(contact.monthlyAmountCents / contact.packageLessonsTotal);
  }
  if (typeof defaultLessonPriceCents === "number" && defaultLessonPriceCents > 0) {
    return defaultLessonPriceCents;
  }
  if (contact?.monthlyAmountCents != null && contact.monthlyAmountCents > 0) {
    return contact.monthlyAmountCents;
  }
  return null;
}

/** Prioriza preço implícito do pacote salvo no evento (painel + WhatsApp), senão regra do aluno/padrão. */
export function resolveLessonUnitCentsForAllocation(
  firstPendingEvent: Event,
  contact: UserGuestContactRow,
  defaultLessonPriceCents: number | null | undefined,
): number | null {
  const raw = firstPendingEvent.rawData as Record<string, unknown> | null;
  const z = raw?.zelarLesson as Record<string, unknown> | undefined;
  /** Congelado no momento do agendamento — mudança de preço no painel não altera aulas antigas pendentes. */
  const snap = z?.lessonUnitPriceCentsSnapshot;
  if (typeof snap === "number" && Number.isFinite(snap) && snap > 0) {
    return Math.round(snap);
  }
  const packUnit = z?.packUnitPriceCents;
  if (typeof packUnit === "number" && Number.isFinite(packUnit) && packUnit > 0) {
    return Math.round(packUnit);
  }
  return resolveLessonUnitCents(contact, defaultLessonPriceCents);
}

/** Já tem preço congelado no evento (snapshot) ou preço unitário do pacote no agendamento. */
export function lessonEventUsesFrozenOrPackUnitPrice(ev: Event): boolean {
  const raw = ev.rawData as Record<string, unknown> | null;
  const z = raw?.zelarLesson as Record<string, unknown> | undefined;
  if (typeof z?.lessonUnitPriceCentsSnapshot === "number" && Number.isFinite(z.lessonUnitPriceCentsSnapshot) && z.lessonUnitPriceCentsSnapshot > 0) {
    return true;
  }
  if (typeof z?.packUnitPriceCents === "number" && Number.isFinite(z.packUnitPriceCents) && z.packUnitPriceCents > 0) {
    return true;
  }
  return false;
}

/** Ainda depende do preço vigente no painel (aluno/padrão) — deve ser congelado antes de mudar tabela de preços. */
export function lessonEventNeedsImplicitUnitFreeze(ev: Event): boolean {
  return !lessonEventUsesFrozenOrPackUnitPrice(ev);
}

/** Mesma regra que o rateio Pluggy: snapshot → pacote no evento → tabela do aluno / preço padrão. */
export function getLessonUnitCentsFromEventSnapshot(
  ev: Event,
  contact: UserGuestContactRow,
  defaultLessonPriceCents: number | null | undefined,
): number | null {
  return resolveLessonUnitCentsForAllocation(ev, contact, defaultLessonPriceCents);
}

/**
 * Valor unitário (centavos) para **dívida** de aulas pendentes e saldo líquido no painel.
 * Usa snapshot/pacote/aluno como o rateio; se ainda não der valor, aplica o preço padrão do usuário
 * para que pendências com aluno vinculado contem no saldo líquido.
 */
export function getLessonDebtUnitCents(
  ev: Event,
  contact: UserGuestContactRow,
  defaultLessonPriceCents: number | null | undefined,
): number | null {
  const u = getLessonUnitCentsFromEventSnapshot(ev, contact, defaultLessonPriceCents);
  if (u != null && u > 0) return u;
  if (typeof defaultLessonPriceCents === "number" && defaultLessonPriceCents > 0) {
    return Math.round(defaultLessonPriceCents);
  }
  return null;
}

export function displayNameFromGuestContact(contact: UserGuestContactRow): string {
  return (
    (contact.aliasNames ?? []).filter(Boolean)[0]?.trim() ||
    contact.canonicalEmail?.split("@")[0] ||
    "Aluno"
  );
}
