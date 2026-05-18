import type { Event, UserSettings } from "@shared/schema";
import { storage } from "../../storage";
import type { UserGuestContactRow } from "../../storage";
import { pluggyFetchJson } from "./pluggyApi";
import { buildLessonCalendarTitle } from "./lessonTitle";
import { extractPayerNameFromPluggyTransaction, extractReceiverNameFromPluggyTransaction } from "./pluggyPayerExtract";
import { resolveLessonUnitCentsForAllocation } from "./lessonUnitPrice";
import { reconcileGuestContactLessonPayments } from "../reconcileGuestLessonPayments";
import { normalizeAliasKey } from "../../utils/normalizeGuestAlias";
import { patchGoogleCalendarEventSummary } from "../../telegram/googleCalendarIntegration";
import { patchMicrosoftCalendarEventSubject } from "../../telegram/microsoftCalendarIntegration";
import { coercePluggyAmountToNumber, pluggyTransactionAmountToCents } from "./pluggyAmountToCents";

export type PluggyTx = {
  id?: string;
  type?: string;
  status?: string;
  amount?: number | string | null;
  amountInAccountCurrency?: number | string | null;
  currencyCode?: string | null;
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
  merchant?: { name?: string } | null;
  counterparty?: { name?: string } | null;
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
  if (/PIX\s+RECEBIDO|RECEBIDO.{0,32}PIX|TRANSFER[EÊ]NCIA\s+RECEBIDA|TRANSF\s+RECEBIDA|TED\s+RECEBIDA/i.test(blob)) {
    return false;
  }
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

function debitLooksLikePersonPayout(tx: PluggyTx): boolean {
  if (tx.paymentData?.receiver?.name?.trim()) return true;
  const blob = [tx.descriptionRaw, tx.description]
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .join(" ")
    .toUpperCase();
  if (!blob.trim()) return false;
  if (/FATURA|BOLETO|DARF|GPS|FGTS|FOLHA|PAGAMENTO\s+FATURA|ANUIDADE/i.test(blob)) return false;
  return /PIX\s+ENVIADO|T\.?\s*E\.?\s*D\.?\s|DOC\s|TRANSFERENCIA\s+ENVIADA|TRANSF\s+ENVI/i.test(blob);
}

/** Texto normalizado do extrato para buscar nomes da planilha (LGPD: não persistimos o extrato). */
function buildCreditSearchBlob(tx: PluggyTx): string {
  const parts: string[] = [];
  const payer = tx.paymentData?.payer?.name?.trim();
  if (payer) parts.push(payer);
  const extractedPayer = extractPayerNameFromPluggyTransaction(tx);
  if (extractedPayer) parts.push(extractedPayer);
  const merchant = tx.merchant?.name?.trim();
  if (merchant) parts.push(merchant);
  const counterparty = tx.counterparty?.name?.trim();
  if (counterparty) parts.push(counterparty);
  const reason = typeof tx.paymentData?.reason === "string" ? tx.paymentData.reason.trim() : "";
  if (reason) parts.push(reason);
  if (typeof tx.description === "string" && tx.description.trim()) parts.push(tx.description);
  if (typeof tx.descriptionRaw === "string" && tx.descriptionRaw.trim()) parts.push(tx.descriptionRaw);
  return normalizeAliasKey(parts.join(" "));
}

/**
 * Procura cada aluno da planilha: se algum alias aparece no texto do crédito (extrato), devolve o contato.
 * Evita atribuir PIX só por valor quando há vários alunos.
 */
async function findGuestContactByTxMemoAgainstPlanilha(
  userId: number,
  tx: PluggyTx,
): Promise<UserGuestContactRow | null> {
  const blob = buildCreditSearchBlob(tx);
  if (!blob || blob.length < 4) return null;

  const sigTokens = (s: string) => s.split(/\s+/).filter((t) => t.length >= 3);
  const oneStrongToken = (s: string) => {
    const t = s.split(/\s+/).filter(Boolean);
    return t.length === 1 && t[0]!.length >= 5;
  };

  const contacts = await storage.listUserGuestContacts(userId);
  let best: { row: UserGuestContactRow; score: number } | null = null;

  for (const row of contacts) {
    for (const alias of row.aliasNames ?? []) {
      const ak = normalizeAliasKey(alias);
      if (!ak || ak.length < 2) continue;
      let score = 0;
      if (ak === blob) score = 1_000_000 + ak.length;
      else if (blob.includes(ak) && ak.length >= 6) score = 80_000 + ak.length;
      else {
        const tokA = sigTokens(ak);
        if (tokA.length >= 2 && tokA.every((t) => blob.includes(t))) score = 60_000 + tokA.length * 400;
        else if (tokA.length === 1 && oneStrongToken(ak) && blob.includes(tokA[0]!)) score = 45_000 + tokA[0]!.length;
        else if (tokA.length === 0 && ak.length >= 5 && blob.includes(ak)) score = 35_000 + ak.length;
      }
      if (score <= 0) continue;
      if (!best || score > best.score) best = { row, score };
    }
  }
  return best?.row ?? null;
}

/** Cruza o memo do extrato com "Aula com …" das aulas pendentes (sem depender do parser de pagador). */
async function tryResolveContactFromPendingLessonMemo(
  userId: number,
  memoBlob: string,
): Promise<UserGuestContactRow | null> {
  if (!memoBlob || memoBlob.length < 5) return null;
  const contacts = await storage.listUserGuestContacts(userId);
  let best: { row: UserGuestContactRow; score: number } | null = null;

  for (const row of contacts) {
    const pending = await storage.listPendingLessonEventsForContact(userId, row.id);
    for (const ev of pending) {
      const frag = extractLessonGuestNameFromEventTitle(ev.title || "");
      if (!frag) continue;
      const fk = normalizeAliasKey(frag);
      if (fk.length < 3) continue;
      let sc = 0;
      if (memoBlob.includes(fk)) sc = 8000 + fk.length;
      else {
        const tok = fk.split(/\s+/).filter((t) => t.length >= 3);
        if (tok.length >= 2 && tok.every((t) => memoBlob.includes(t))) sc = 7000 + tok.length * 200;
      }
      if (sc <= 0) continue;
      if (!best || sc > best.score) best = { row, score: sc };
    }
  }
  return best?.row ?? null;
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
 * Se vários têm pendências, desambigua quando o valor fecha exatamente N aulas (N ≤ pendências) para um único aluno.
 */
async function tryResolveContactByAmountOnly(
  userId: number,
  amountCents: number,
  settings: UserSettings | undefined,
): Promise<UserGuestContactRow | null> {
  const contacts = await storage.listUserGuestContacts(userId);
  type V = { contact: UserGuestContactRow; pending: Event[]; unit: number; maxLessons: number };
  const viable: V[] = [];

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

    viable.push({ contact: c, pending, unit, maxLessons });
  }

  if (viable.length === 1) {
    return viable[0]!.contact;
  }
  if (viable.length > 1) {
    const exactMultiples = viable.filter((v) => {
      const k = Math.floor(amountCents / v.unit);
      return k >= 1 && k <= v.pending.length && amountCents === k * v.unit;
    });
    if (exactMultiples.length === 1) {
      return exactMultiples[0]!.contact;
    }
  }
  return null;
}

/** Extrai o nome do aluno de títulos como "Aula com pietro gaeta · Aluno (pendente)". */
function extractLessonGuestNameFromEventTitle(title: string): string | null {
  const n = normalizeAliasKey(title);
  if (!n) return null;
  const parts = n.split(/\s+com\s+/);
  if (parts.length < 2) return null;
  const tail = parts.slice(1).join(" com ");
  const stopIdx = tail.search(/\s+aluno\b|·|\s+pendente\b|\s+pago\b/);
  const cleaned = (stopIdx >= 0 ? tail.slice(0, stopIdx) : tail).trim();
  return cleaned.length >= 3 ? cleaned : null;
}

/** Caso o nome do PIX não case com aliasNames, cruza com o texto das aulas pendentes no calendário. */
async function tryResolveContactFromPendingLessonTitles(
  userId: number,
  payerHint: string,
): Promise<UserGuestContactRow | null> {
  const payerKey = normalizeAliasKey(payerHint);
  if (!payerKey || payerKey.length < 3) return null;

  const sig = (s: string) => s.split(/\s+/).filter((t) => t.length >= 3);
  const oneLong = (s: string) => {
    const t = s.split(/\s+/).filter(Boolean);
    return t.length === 1 && t[0]!.length >= 5;
  };

  const overlapScore = (a: string, b: string): number => {
    if (a === b) return 9000;
    if (a.includes(b) || b.includes(a)) return 8000 + Math.min(a.length, b.length);
    const ta = sig(a);
    const tb = sig(b);
    if (ta.length && ta.length < 2 && !oneLong(a)) return 0;
    if (tb.length && tb.length < 2 && !oneLong(b)) return 0;
    if (ta.length && ta.every((t) => b.includes(t))) return 7000 + ta.length * 50;
    if (tb.length && tb.every((t) => a.includes(t))) return 6500 + tb.length * 50;
    return 0;
  };

  const contacts = await storage.listUserGuestContacts(userId);
  let best: { row: UserGuestContactRow; score: number } | null = null;

  for (const row of contacts) {
    const pending = await storage.listPendingLessonEventsForContact(userId, row.id);
    for (const ev of pending) {
      const frag = extractLessonGuestNameFromEventTitle(ev.title || "");
      if (!frag) continue;
      const fk = normalizeAliasKey(frag);
      const sc = overlapScore(fk, payerKey);
      if (sc <= 0) continue;
      if (!best || sc > best.score) best = { row, score: sc };
    }
  }
  return best?.row ?? null;
}

export async function processPluggyTransactionsPayload(itemId: string | undefined, payload: unknown): Promise<void> {
  const txs = parseTransactionsPayload(payload);
  for (const tx of txs) {
    await processSinglePluggyTransaction(itemId, tx);
  }
}

export async function processSinglePluggyTransaction(itemId: string | undefined, tx: PluggyTx): Promise<void> {
  const txId = typeof tx.id === "string" ? tx.id : null;

  let userId: number | null = itemId ? await storage.findUserIdByPluggyItemId(itemId) : null;
  if (userId == null && itemId) {
    console.warn("[Pluggy] Item sem usuário vinculado:", itemId);
    return;
  }
  if (userId == null) return;

  const txPostedAt = extractTxPostedAtFromPluggyTx(tx);
  const txType = String(tx.type || "").trim().toUpperCase();

  if (txType === "DEBIT" && (!tx.status || tx.status === "POSTED")) {
    const amountCents = pluggyTransactionAmountToCents(tx);
    if (amountCents <= 0) return;
    if (!debitLooksLikePersonPayout(tx)) return;
    const globalFirstLessonAt = await storage.getEarliestLessonCreatedAtForUser(userId);
    if (globalFirstLessonAt && txPostedAt.getTime() < globalFirstLessonAt.getTime()) {
      return;
    }
    const receiverHint = extractReceiverNameFromPluggyTransaction(tx);
    if (!receiverHint) return;
    const contact = await storage.findGuestContactByLooseName(userId, receiverHint);
    if (!contact) return;
    const dedupeKey = (
      txId?.trim() ? `debit_bal_${txId.trim()}` : `debit_bal_${userId}_${txPostedAt.getTime()}_${amountCents}`
    ).slice(0, 128);
    const inserted = await storage.tryRecordPluggyTransactionOnce(userId, dedupeKey);
    if (!inserted) return;
    await storage.adjustGuestLessonBalanceCents(userId, contact.id, -amountCents);
    return;
  }

  const creditLike =
    txType === "CREDIT" ||
    txType === "INCOME" ||
    (txType === "" && (coercePluggyAmountToNumber(tx.amount) ?? 0) > 0);
  if (!creditLike || (tx.status && tx.status !== "POSTED")) {
    return;
  }

  const amountCents = pluggyTransactionAmountToCents(tx);
  if (amountCents <= 0) return;

  if (memoLooksLikeInstitutionalNoise(tx)) {
    return;
  }

  const settings = await storage.getUserSettings(userId);

  const memoBlob = buildCreditSearchBlob(tx);

  let contact: UserGuestContactRow | null = await findGuestContactByTxMemoAgainstPlanilha(userId, tx);
  if (contact) {
    console.log("[Pluggy] Match extrato ↔ planilha (nome no texto) → contato", contact.id);
  }

  const payerHint = extractPayerNameFromPluggyTransaction(tx);

  if (!contact && payerHint) {
    contact = await storage.findGuestContactByLooseName(userId, payerHint);
    if (!contact && DEBUG_PLUGGY) {
      console.log("[Pluggy] Nome extraído mas sem match no cadastro:", payerHint.slice(0, 80));
    }
  }

  if (!contact && payerHint) {
    contact = await tryResolveContactFromPendingLessonTitles(userId, payerHint);
    if (contact) {
      console.log("[Pluggy] Match por título de aula pendente → contato", contact.id);
    }
  }

  if (!contact && memoBlob.length >= 5) {
    contact = await tryResolveContactFromPendingLessonMemo(userId, memoBlob);
    if (contact) {
      console.log("[Pluggy] Match memo extrato ↔ título aula pendente → contato", contact.id);
    }
  }

  const allowAmountOnly = process.env.PLUGGY_ALLOW_AMOUNT_ONLY_MATCH?.trim().toLowerCase() === "true";
  if (!contact && allowAmountOnly) {
    contact = await tryResolveContactByAmountOnly(userId, amountCents, settings);
    if (contact) {
      console.log("[Pluggy] Match por valor (PLUGGY_ALLOW_AMOUNT_ONLY_MATCH) → contato", contact.id);
    }
  }

  if (!contact) {
    if (DEBUG_PLUGGY) {
      console.log("[Pluggy] Crédito sem match de nome na planilha/extrato:", memoBlob.slice(0, 160));
    }
    return;
  }

  const firstLessonAt = await storage.getFirstLessonCreatedAtForContact(userId, contact.id);
  const pending = await storage.listPendingLessonEventsForContact(userId, contact.id);

  const canAllocateToLessons =
    firstLessonAt != null &&
    txPostedAt.getTime() >= firstLessonAt.getTime() &&
    pending.length > 0;

  if (!canAllocateToLessons) {
    if (txId) {
      const inserted = await storage.tryRecordPluggyTransactionOnce(userId, txId);
      if (!inserted) return;
    } else {
      const synKey = `pluggy_bal_${userId}_${contact.id}_${amountCents}_${txPostedAt.getTime()}`.slice(0, 128);
      const inserted = await storage.tryRecordPluggyTransactionOnce(userId, synKey);
      if (!inserted) return;
    }
    await storage.adjustGuestLessonBalanceCents(userId, contact.id, amountCents);
    console.log(
      `[Pluggy] Saldo retido +R$ ${(amountCents / 100).toFixed(2)} (contato ${contact.id}) — sem aula pendente para ratear, ou PIX anterior à primeira aula do aluno.`,
    );
    return;
  }

  const unitProbe = resolveLessonUnitCentsForAllocation(
    pending[0],
    contact,
    settings?.defaultLessonPriceCents ?? null,
  );
  if (!unitProbe || unitProbe <= 0) {
    if (txId) {
      const inserted = await storage.tryRecordPluggyTransactionOnce(userId, txId);
      if (!inserted) return;
    } else {
      const synKey = `pluggy_bal_${userId}_${contact.id}_${amountCents}_${txPostedAt.getTime()}`.slice(0, 128);
      const inserted = await storage.tryRecordPluggyTransactionOnce(userId, synKey);
      if (!inserted) return;
    }
    await storage.adjustGuestLessonBalanceCents(userId, contact.id, amountCents);
    console.warn(
      `[Pluggy] Sem preço por aula para ratear (contato ${contact.id}); valor +R$ ${(amountCents / 100).toFixed(2)} creditado como saldo retido.`,
    );
    return;
  }

  const ledgerTxKey = (txId?.trim() || `noid_${userId}_${contact.id}_${txPostedAt.getTime()}_${amountCents}`).slice(
    0,
    128,
  );
  const ledgerInserted = await storage.insertPluggyContactCredit(
    userId,
    contact.id,
    ledgerTxKey,
    amountCents,
    txPostedAt,
  );
  if (!ledgerInserted) {
    const already = await storage.hasPluggyContactCredit(userId, ledgerTxKey);
    if (!already) {
      console.warn(
        "[Pluggy] Ledger não registrou o crédito (tabela ausente ou falha); rateio abortado.",
        { userId, contactId: contact.id, ledgerTxKey },
      );
      return;
    }
  }

  const r = await reconcileGuestContactLessonPayments(userId, contact.id);
  if (r.markedCount === 0) {
    if (DEBUG_PLUGGY || r.totalPoolCents > 0) {
      console.log(
        "[Pluggy] Pool (ledger + saldo retido) atualizado; nenhuma aula pendente coberta neste momento.",
        { contactId: contact.id, totalPoolCents: r.totalPoolCents },
      );
    }
    return;
  }

  if (ledgerInserted) {
    await notifyGuestPaymentDigest(contact, r.markedCount, amountCents);
  }

  console.log(
    `[Pluggy] Rateio cumulativo aluno ${contact.id}: pool R$ ${(r.totalPoolCents / 100).toFixed(2)} (ledger Pluggy + saldo retido) → ${r.markedCount} aula(s) marcada(s); abatido do saldo retido R$ ${(r.balanceConsumedCents / 100).toFixed(2)}.`,
  );
}

export async function markLessonPaidAndSyncCalendar(userId: number, ev: Event, studentLabel: string): Promise<void> {
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

  const up = await storage.getEvent(ev.id);
  if (!up) return;

  const settings = await storage.getUserSettings(userId);
  const calendarId = up.calendarId?.trim();
  if (!calendarId) {
    console.warn(
      "[Pluggy] Aula marcada como paga no banco, mas sem `calendarId` — não foi possível atualizar Google/Microsoft.",
      { eventId: ev.id },
    );
    return;
  }
  if (!settings) return;

  const rawUp = (up.rawData as Record<string, unknown>) || {};
  const zelarUp = (rawUp.zelarLesson as Record<string, unknown>) || {};
  const provider = settings.calendarProvider;
  const intKey =
    typeof zelarUp.googleCalendarIntegrationKey === "string" ? zelarUp.googleCalendarIntegrationKey.trim() : "";
  const oauthForGoogle =
    typeof zelarUp.googleCalendarOAuthUserId === "number" && Number.isFinite(zelarUp.googleCalendarOAuthUserId)
      ? Math.floor(zelarUp.googleCalendarOAuthUserId)
      : userId;

  if (provider === "google") {
    try {
      if (intKey) {
        const { getGoogleIntegrationTokensByKey } = await import("../systemCalendarGoogleTokens");
        const pack = await getGoogleIntegrationTokensByKey(intKey);
        if (pack?.tokens) {
          const r = await patchGoogleCalendarEventSummary(calendarId, userId, newTitle, {
            oauthClientId: oauthForGoogle,
            tokens: pack.tokens,
          });
          if (!r.success) {
            console.warn("[Pluggy] Falha ao atualizar Google Calendar (conta de serviço):", r.message, { eventId: ev.id });
          }
        } else {
          console.warn(
            "[Pluggy] Aula no Google de serviço, mas tokens não encontrados para integration_key=",
            intKey,
            "event",
            ev.id,
          );
        }
      } else if (settings.googleTokens) {
        let r = await patchGoogleCalendarEventSummary(calendarId, userId, newTitle);
        if (!r.success) {
          const fbKey = process.env.ZELAR_CALENDAR_INTEGRATION_KEY?.trim() || "zelar_google_invites";
          const fbOauth = Number(process.env.ZELAR_CALENDAR_OAUTH_USER_ID || "999001");
          if (Number.isFinite(fbOauth)) {
            const { getGoogleIntegrationTokensByKey } = await import("../systemCalendarGoogleTokens");
            const pack = await getGoogleIntegrationTokensByKey(fbKey);
            if (pack?.tokens) {
              r = await patchGoogleCalendarEventSummary(calendarId, userId, newTitle, {
                oauthClientId: Math.floor(fbOauth),
                tokens: pack.tokens,
              });
            }
          }
          if (!r.success) {
            console.warn("[Pluggy] Falha ao atualizar Google Calendar:", r.message, { eventId: ev.id });
          }
        }
      }
    } catch (e) {
      console.warn("[Pluggy] Falha ao atualizar Google Calendar:", e);
    }
  } else if (provider === "microsoft" && settings.microsoftTokens) {
    try {
      const r = await patchMicrosoftCalendarEventSubject(calendarId, userId, newTitle);
      if (!r.success) {
        console.warn("[Pluggy] Falha ao atualizar Microsoft Calendar:", r.message, { eventId: ev.id });
      }
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
