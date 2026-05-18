import type { Event, UserSettings } from "@shared/schema";
import { storage } from "../../storage";
import type { UserGuestContactRow } from "../../storage";
import { pluggyFetchJson } from "./pluggyApi";
import { buildLessonCalendarTitle } from "./lessonTitle";
import { extractPayerNameFromPluggyTransaction } from "./pluggyPayerExtract";
import { patchGoogleCalendarEventSummary, setTokens } from "../../telegram/googleCalendarIntegration";
import { patchMicrosoftCalendarEventSubject } from "../../telegram/microsoftCalendarIntegration";

export type PluggyTx = {
  id?: string;
  type?: string;
  status?: string;
  amount?: number;
  description?: string | null;
  descriptionRaw?: string | null;
  date?: string;
  valueDate?: string;
  operationDate?: string;
  createdAt?: string;
  paymentData?: {
    payer?: { name?: string };
    receiver?: { name?: string };
    paymentMethod?: string;
    referenceNumber?: string;
    reason?: string;
  };
};

const DEBUG_PLUGGY = process.env.DEBUG_PLUGGY === "true";

/** Se true/1/yes, webhooks `transactions/*` conciliam sozinhos. Sem variável (padrão): só `/buscar` no WhatsApp. */
export function pluggyWebhookAutoProcessesTransactions(): boolean {
  const v = process.env.PLUGGY_AUTO_WEBHOOK_SYNC?.trim().toLowerCase();
  if (!v) return false;
  return v === "true" || v === "1" || v === "yes";
}

/** Créditos genéricos de cartão/corretora/fatura — sem nome de pagador PIX; não tentamos casar com aluno. */
function memoLooksLikeInstitutionalNoise(tx: PluggyTx): boolean {
  const directPayer = tx.paymentData?.payer?.name?.trim();
  if (directPayer) return false;
  const blob = [tx.descriptionRaw, tx.description]
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .join(" ")
    .toUpperCase();
  if (!blob.trim()) return false;
  const keys = [
    "FATURA",
    "BOLETO",
    "CICLO CORRENTE",
    "CORRETORA",
    "TITULOS E VALORES",
    "TÍTULOS E VALORES",
    "CARTAO",
    "CARTÃO",
    "ANUIDADE",
    "IOF",
    "TARIFA",
    "TAXA DE",
    "SAQUE",
    "CONFIDENCE",
    "C6 CORRETORA",
    "PAGAMENTO FATURA",
    "INCLUSAO",
    "INCLUSÃO",
    "INVESTIMENTO",
    "RENDIMENTO",
    "RESGATE",
    "TRANSF ENVIADA",
    "PIX ENVIADO",
    "DEBITO",
    "DÉBITO",
  ];
  if (keys.some((k) => blob.includes(k))) return true;
  if (/\bLTDA\.?\b|\bS\/?A\b|\bS\.A\./i.test(blob)) return true;
  return false;
}

/** Data do crédito no banco (só entra no somatório se >= primeira aula criada). */
export function extractTxPostedAtFromPluggyTx(tx: PluggyTx): Date {
  const r = tx as Record<string, unknown>;
  const keys = ["date", "valueDate", "operationDate", "createdAt", "paymentDate"];
  for (const k of keys) {
    const v = r[k];
    if (v == null || v === "") continue;
    const d = new Date(typeof v === "string" || typeof v === "number" ? v : String(v));
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

function amountToCents(amount: number): number {
  const n = Number(amount);
  if (!Number.isFinite(n)) return 0;
  return Math.round(Math.abs(n) * 100);
}

function resolveLessonUnitCents(
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
function resolveLessonUnitCentsForAllocation(
  firstPendingEvent: Event,
  contact: UserGuestContactRow,
  defaultLessonPriceCents: number | null | undefined,
): number | null {
  const raw = firstPendingEvent.rawData as Record<string, unknown> | null;
  const z = raw?.zelarLesson as Record<string, unknown> | undefined;
  const packUnit = z?.packUnitPriceCents;
  if (typeof packUnit === "number" && Number.isFinite(packUnit) && packUnit > 0) {
    return Math.round(packUnit);
  }
  return resolveLessonUnitCents(contact, defaultLessonPriceCents);
}

function parseTransactionsPayload(data: unknown): PluggyTx[] {
  if (!data || typeof data !== "object") return [];
  const obj = data as Record<string, unknown>;
  if (Array.isArray(obj.results)) {
    return obj.results as PluggyTx[];
  }
  if (Array.isArray(obj.items)) {
    return obj.items as PluggyTx[];
  }
  return [];
}

async function fetchTransactionsByIds(ids: string[]): Promise<PluggyTx[]> {
  if (!ids.length) return [];
  const qs = ids.map((id) => `ids=${encodeURIComponent(id)}`).join("&");
  const data = await pluggyFetchJson(`/transactions?${qs}`);
  return parseTransactionsPayload(data);
}

/**
 * Quando só há um aluno com aulas pendentes e o valor cobre pelo menos 1 aula pelo preço calculado,
 * associa o pagamento a esse aluno (útil quando o banco não envia paymentData.payer).
 */
async function tryResolveContactByAmountOnly(
  userId: number,
  amountCents: number,
  settings: UserSettings | undefined,
): Promise<UserGuestContactRow | null> {
  const contacts = await storage.listUserGuestContacts(userId);
  const candidates: UserGuestContactRow[] = [];

  for (const c of contacts) {
    const pending = await storage.listPendingLessonEventsForContact(userId, c.id);
    if (pending.length === 0) continue;

    const unit = resolveLessonUnitCentsForAllocation(
      pending[0],
      c,
      settings?.defaultLessonPriceCents ?? null,
    );
    if (!unit || unit <= 0) continue;

    const maxLessons = Math.floor(amountCents / unit);
    if (maxLessons < 1) continue;

    candidates.push(c);
  }

  if (candidates.length === 1) {
    return candidates[0] ?? null;
  }
  return null;
}

export async function processPluggyTransactionsPayload(itemId: string | undefined, payload: unknown): Promise<void> {
  const txs = parseTransactionsPayload(payload);
  for (const tx of txs) {
    await processSinglePluggyTransaction(itemId, tx);
  }
}

export async function processSinglePluggyTransaction(itemId: string | undefined, tx: PluggyTx): Promise<void> {
  const txId = typeof tx.id === "string" ? tx.id : null;

  if (tx.type !== "CREDIT" || (tx.status && tx.status !== "POSTED")) {
    return;
  }

  const amountCents = amountToCents(Number(tx.amount));
  if (amountCents <= 0) return;

  let userId: number | null = itemId ? await storage.findUserIdByPluggyItemId(itemId) : null;
  if (userId == null && itemId) {
    console.warn("[Pluggy] Item sem usuário vinculado:", itemId);
    return;
  }
  if (userId == null) return;

  const txPostedAt = extractTxPostedAtFromPluggyTx(tx);

  const globalFirstLessonAt = await storage.getEarliestLessonCreatedAtForUser(userId);
  if (globalFirstLessonAt && txPostedAt.getTime() < globalFirstLessonAt.getTime()) {
    return;
  }

  if (memoLooksLikeInstitutionalNoise(tx)) {
    return;
  }

  const settings = await storage.getUserSettings(userId);

  const payerHint = extractPayerNameFromPluggyTransaction(tx);

  let contact: UserGuestContactRow | null = null;
  if (payerHint) {
    contact = await storage.findGuestContactByLooseName(userId, payerHint);
    if (!contact && DEBUG_PLUGGY) {
      console.log("[Pluggy] Nome extraído mas sem match no cadastro:", payerHint.slice(0, 80));
    }
  }

  if (!contact) {
    contact = await tryResolveContactByAmountOnly(userId, amountCents, settings);
    if (contact) {
      console.log("[Pluggy] Match por valor + único aluno pendente → contato", contact.id);
    }
  }

  if (!contact) {
    return;
  }

  const firstLessonAt = await storage.getFirstLessonCreatedAtForContact(userId, contact.id);

  if (!firstLessonAt) {
    if (txId) await storage.tryRecordPluggyTransactionOnce(userId, txId);
    console.log(
      "[Pluggy] Nenhuma aula ainda vinculada ao contato",
      contact.id,
      "— crédito ignorado para rateio (crie a primeira aula no WhatsApp).",
    );
    return;
  }

  if (txPostedAt.getTime() < firstLessonAt.getTime()) {
    if (txId) await storage.tryRecordPluggyTransactionOnce(userId, txId);
    console.log(
      "[Pluggy] Transação com data anterior à primeira aula criada; não entra na soma.",
      txId,
      firstLessonAt.toISOString(),
    );
    return;
  }

  const pending = await storage.listPendingLessonEventsForContact(userId, contact.id);
  if (!pending.length) {
    if (txId) await storage.tryRecordPluggyTransactionOnce(userId, txId);
    return;
  }

  const unit = resolveLessonUnitCentsForAllocation(
    pending[0],
    contact,
    settings?.defaultLessonPriceCents ?? null,
  );
  if (!unit || unit <= 0) {
    console.warn("[Pluggy] Sem preço por aula configurável para aluno", contact.id);
    return;
  }

  if (txId) {
    const inserted = await storage.tryRecordPluggyTransactionOnce(userId, txId);
    if (!inserted) {
      return;
    }
  }

  const ledgerTxKey = (txId?.trim() || `noid_${userId}_${contact.id}_${txPostedAt.getTime()}_${amountCents}`).slice(
    0,
    128,
  );
  await storage.insertPluggyContactCredit(userId, contact.id, ledgerTxKey, amountCents, txPostedAt);

  const totalPaidCents = await storage.sumPluggyContactCreditsSince(userId, contact.id, firstLessonAt);
  const earnedLessonSlots = Math.floor(totalPaidCents / unit);
  const alreadyPaidCount = await storage.countPaidLessonEventsForContact(userId, contact.id);
  const needToMark = Math.min(Math.max(0, earnedLessonSlots - alreadyPaidCount), pending.length);

  if (needToMark <= 0) {
    return;
  }

  const displayName =
    (contact.aliasNames ?? []).filter(Boolean)[0]?.trim() ||
    contact.canonicalEmail?.split("@")[0] ||
    "Aluno";

  const eventsToMark = pending.slice(0, needToMark);
  for (const ev of eventsToMark) {
    await markLessonPaidAndSyncCalendar(userId, ev, displayName);
  }

  await notifyGuestPaymentDigest(contact, eventsToMark.length, amountCents);

  console.log(
    `[Pluggy] Rateio cumulativo aluno ${contact.id}: total R$ ${(totalPaidCents / 100).toFixed(2)} desde primeira aula → ${earnedLessonSlots} aula(s) “de direito”; já pagas ${alreadyPaidCount}; marcadas agora ${eventsToMark.length}.`,
  );
}

async function markLessonPaidAndSyncCalendar(userId: number, ev: Event, studentLabel: string): Promise<void> {
  const raw = (ev.rawData as Record<string, unknown> | null) || {};
  const zelar = (raw.zelarLesson as Record<string, unknown> | undefined) || {};
  const baseTitle =
    typeof zelar.baseTitle === "string" && zelar.baseTitle.trim()
      ? zelar.baseTitle.trim()
      : String(ev.title || "Aula")
          .split(" · ")[0]
          ?.trim() || "Aula";

  const lessonIndex =
    typeof ev.lessonIndexInPack === "number" && ev.lessonIndexInPack > 0 ? ev.lessonIndexInPack : null;
  const lessonTotal =
    typeof ev.lessonTotalInPack === "number" && ev.lessonTotalInPack > 0 ? ev.lessonTotalInPack : null;

  const newTitle = buildLessonCalendarTitle({
    baseTitle,
    studentLabel,
    lessonIndex,
    lessonTotal,
    paymentStatus: "pago",
  });

  const nextRaw = {
    ...raw,
    zelarLesson: {
      ...zelar,
      baseTitle,
      paymentStatus: "pago",
    },
  };

  await storage.updateEvent(ev.id, {
    title: newTitle,
    lessonPaymentStatus: "pago",
    rawData: nextRaw as Event["rawData"],
  });

  const settings = await storage.getUserSettings(userId);
  const calendarId = ev.calendarId;
  if (!calendarId) return;
  if (!settings) return;

  const provider = settings.calendarProvider;
  if (provider === "google" && settings.googleTokens) {
    try {
      setTokens(userId, JSON.parse(settings.googleTokens));
      await patchGoogleCalendarEventSummary(calendarId, userId, newTitle);
    } catch (e) {
      console.warn("[Pluggy] Falha ao atualizar Google Calendar:", e);
    }
  } else if (provider === "microsoft" && settings.microsoftTokens) {
    try {
      await patchMicrosoftCalendarEventSubject(calendarId, userId, newTitle);
    } catch (e) {
      console.warn("[Pluggy] Falha ao atualizar Microsoft Calendar:", e);
    }
  }
}

async function notifyGuestPaymentDigest(
  contact: UserGuestContactRow,
  lessonsMarked: number,
  amountCents: number,
): Promise<void> {
  const phone = contact.guestPhoneE164?.replace(/\D/g, "");
  if (!phone || phone.length < 10) return;

  const jid = `${phone}@s.whatsapp.net`;
  const brl = (amountCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const msg =
    `💳 Pagamento identificado (${brl}). ` +
    `Marcamos *${lessonsMarked}* aula(s) como *pago* na sua agenda compartilhada. ` +
    `Qualquer dúvida, fale com seu professor.`;

  try {
    const { getWhatsAppBot } = await import("../../whatsapp/whatsappBot");
    await getWhatsAppBot().sendMessage(jid, msg);
  } catch (e) {
    console.warn("[Pluggy] Falha ao avisar aluno no WhatsApp:", e);
  }
}

export async function handlePluggyTransactionsCreatedWebhook(body: Record<string, unknown>): Promise<void> {
  if (!pluggyWebhookAutoProcessesTransactions()) return;
  const link = typeof body.createdTransactionsLink === "string" ? body.createdTransactionsLink : null;
  const itemId = typeof body.itemId === "string" ? body.itemId : undefined;
  if (!link) return;
  const data = await pluggyFetchJson(link);
  await processPluggyTransactionsPayload(itemId, data);
}

export async function handlePluggyTransactionsUpdatedWebhook(body: Record<string, unknown>): Promise<void> {
  if (!pluggyWebhookAutoProcessesTransactions()) return;
  const ids = Array.isArray(body.transactionIds)
    ? (body.transactionIds as unknown[]).filter((x): x is string => typeof x === "string")
    : [];
  const itemId = typeof body.itemId === "string" ? body.itemId : undefined;
  if (!ids.length) return;
  const txs = await fetchTransactionsByIds(ids);
  for (const tx of txs) {
    await processSinglePluggyTransaction(itemId, tx);
  }
}

export async function handlePluggyItemLinkedFromWebhook(
  eventName: string | undefined,
  clientUserId: string | undefined,
  itemId: string | undefined,
): Promise<void> {
  if (eventName !== "item/created") return;
  if (!clientUserId || !itemId) return;
  const m = /^zelar-user-(\d+)$/.exec(clientUserId.trim());
  if (!m) return;
  const userId = Number(m[1]);
  if (!Number.isFinite(userId)) return;
  await storage.updateUserSettings(userId, { pluggyItemId: itemId });
  console.log("[Pluggy] Item associado ao usuário", userId);
}
