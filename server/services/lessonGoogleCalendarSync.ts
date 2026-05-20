import type { Event, UserSettings } from "@shared/schema";
import { storage } from "../storage";
import type { UserGuestContactRow } from "../storage";
import { buildLessonCalendarTitle } from "./pluggy/lessonTitle";
import { displayNameFromGuestContact } from "./pluggy/lessonUnitPrice";
import { patchGoogleCalendarEventSummary } from "../telegram/googleCalendarIntegration";

export type GoogleCalendarAuthPack = { oauthClientId: number; tokens: unknown };

/** Tokens OAuth da mesma conta que criou o evento no Google Calendar. */
/** Ordem: conta que criou o evento → painel do professor → conta Zelar. */
export async function resolveGoogleCalendarAuthAttempts(
  userId: number,
  zelarUp: Record<string, unknown>,
  settings: UserSettings | null | undefined,
): Promise<GoogleCalendarAuthPack[]> {
  const attempts: GoogleCalendarAuthPack[] = [];
  const seen = new Set<string>();
  const push = (p: GoogleCalendarAuthPack | null) => {
    if (!p) return;
    const k = `${p.oauthClientId}`;
    if (seen.has(k)) return;
    seen.add(k);
    attempts.push(p);
  };

  const primary = await resolveGoogleCalendarAuthForLesson(userId, zelarUp, settings);
  push(primary);

  const intKey =
    typeof zelarUp.googleCalendarIntegrationKey === "string"
      ? zelarUp.googleCalendarIntegrationKey.trim()
      : "";
  if (intKey && settings?.googleTokens) {
    try {
      push({ oauthClientId: userId, tokens: JSON.parse(settings.googleTokens) });
    } catch {
      /* ignore */
    }
  }

  const zelarKey = process.env.ZELAR_CALENDAR_INTEGRATION_KEY?.trim() || "zelar_google_invites";
  const zelarOauth = Number(process.env.ZELAR_CALENDAR_OAUTH_USER_ID || "999001");
  if (Number.isFinite(zelarOauth)) {
    const { getGoogleIntegrationTokensByKey } = await import("./systemCalendarGoogleTokens");
    const pack = await getGoogleIntegrationTokensByKey(zelarKey);
    if (pack?.tokens) push({ oauthClientId: Math.floor(zelarOauth), tokens: pack.tokens });
  }

  return attempts;
}

export async function resolveGoogleCalendarAuthForLesson(
  userId: number,
  zelarUp: Record<string, unknown>,
  settings: UserSettings | null | undefined,
): Promise<GoogleCalendarAuthPack | null> {
  const intKey =
    typeof zelarUp.googleCalendarIntegrationKey === "string"
      ? zelarUp.googleCalendarIntegrationKey.trim()
      : "";
  const oauthUid =
    typeof zelarUp.googleCalendarOAuthUserId === "number" &&
    Number.isFinite(zelarUp.googleCalendarOAuthUserId)
      ? Math.floor(zelarUp.googleCalendarOAuthUserId)
      : userId;

  const zelarKey = process.env.ZELAR_CALENDAR_INTEGRATION_KEY?.trim() || "zelar_google_invites";
  const zelarOauth = Number(process.env.ZELAR_CALENDAR_OAUTH_USER_ID || "999001");

  if (intKey) {
    const { getGoogleIntegrationTokensByKey } = await import("./systemCalendarGoogleTokens");
    const pack = await getGoogleIntegrationTokensByKey(intKey);
    if (pack?.tokens) {
      return { oauthClientId: oauthUid, tokens: pack.tokens };
    }
    console.warn("[aula] Google: integration_key sem tokens no banco", { intKey, oauthUid, eventOAuth: oauthUid });
    return null;
  }

  if (settings?.googleTokens && oauthUid === userId) {
    try {
      return { oauthClientId: userId, tokens: JSON.parse(settings.googleTokens) };
    } catch {
      console.warn("[aula] Google: tokens do painel inválidos", { userId });
    }
  }

  if (Number.isFinite(zelarOauth) && (oauthUid === Math.floor(zelarOauth) || !settings?.googleTokens)) {
    const { getGoogleIntegrationTokensByKey } = await import("./systemCalendarGoogleTokens");
    const pack = await getGoogleIntegrationTokensByKey(zelarKey);
    if (pack?.tokens) {
      return { oauthClientId: Math.floor(zelarOauth), tokens: pack.tokens };
    }
  }

  if (settings?.googleTokens) {
    try {
      return { oauthClientId: userId, tokens: JSON.parse(settings.googleTokens) };
    } catch {
      return null;
    }
  }

  return null;
}

export async function patchLessonTitleOnGoogleCalendar(opts: {
  userId: number;
  eventId: number;
  calendarId: string;
  newTitle: string;
  zelarUp: Record<string, unknown>;
  settings: UserSettings | null | undefined;
}): Promise<boolean> {
  const authAttempts = await resolveGoogleCalendarAuthAttempts(
    opts.userId,
    opts.zelarUp,
    opts.settings,
  );
  if (authAttempts.length === 0) {
    console.warn("[aula] Google Calendar: sem credenciais para atualizar título", {
      eventId: opts.eventId,
      calendarId: opts.calendarId,
      oauthUid: opts.zelarUp.googleCalendarOAuthUserId ?? null,
      integrationKey: opts.zelarUp.googleCalendarIntegrationKey ?? null,
    });
    return false;
  }

  for (const auth of authAttempts) {
    const r = await patchGoogleCalendarEventSummary(opts.calendarId, opts.userId, opts.newTitle, {
      oauthClientId: auth.oauthClientId,
      tokens: auth.tokens,
    });
    if (r.success) {
      console.log("[aula] Google Calendar título atualizado", {
        eventId: opts.eventId,
        calendarId: opts.calendarId,
        oauthClientId: auth.oauthClientId,
        title: opts.newTitle.slice(0, 80),
      });
      return true;
    }
    console.warn("[aula] Google Calendar tentativa falhou", {
      eventId: opts.eventId,
      oauthClientId: auth.oauthClientId,
      message: r.message,
    });
  }

  return false;
}

function lessonPaidTitle(
  ev: Event,
  contact: UserGuestContactRow,
  _settings: UserSettings | null | undefined,
): string {
  const raw = (ev.rawData as Record<string, unknown> | null) || {};
  const z = (raw.zelarLesson as Record<string, unknown> | undefined) || {};
  const baseTitle =
    typeof z.baseTitle === "string" && z.baseTitle.trim()
      ? z.baseTitle.trim()
      : String(ev.title || "Aula")
          .split(" · ")[0]
          ?.trim() || "Aula";
  const lessonIndex =
    typeof ev.lessonIndexInPack === "number" && ev.lessonIndexInPack > 0 ? ev.lessonIndexInPack : null;
  const lessonTotal =
    typeof ev.lessonTotalInPack === "number" && ev.lessonTotalInPack > 0 ? ev.lessonTotalInPack : null;
  return buildLessonCalendarTitle({
    baseTitle,
    studentLabel: displayNameFromGuestContact(contact),
    lessonIndex,
    lessonTotal,
    paymentStatus: "pago",
  });
}

/** Força título (pago) no Google para aulas já pagas no banco (mesmo se o DB já tiver o texto certo). */
export async function syncPaidLessonCalendarTitlesForContact(
  userId: number,
  contactId: number,
): Promise<number> {
  const contact = await storage.getGuestContactByIdForUser(userId, contactId);
  if (!contact) return 0;
  const settings = await storage.getUserSettings(userId);
  const chain = await storage.listBillableLessonEventsForContactOrdered(userId, contactId);
  let fixed = 0;

  for (const ev of chain) {
    if (ev.lessonPaymentStatus !== "pago" || ev.cancelledAt || !ev.calendarId?.trim()) continue;

    const raw = (ev.rawData as Record<string, unknown> | null) || {};
    const zelarUp = (raw.zelarLesson as Record<string, unknown> | undefined) || {};
    const newTitle = lessonPaidTitle(ev, contact, settings);

    const ok = await patchLessonTitleOnGoogleCalendar({
      userId,
      eventId: ev.id,
      calendarId: ev.calendarId.trim(),
      newTitle,
      zelarUp,
      settings,
    });
    if (ok) fixed += 1;
  }

  return fixed;
}
