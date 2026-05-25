import { DateTime } from "luxon";
import { storage } from "../../storage";
import {
  pluggyCredentialsConfigured,
  pluggyFetchJson,
  triggerPluggyItemSync,
  waitForPluggyItemSynced,
} from "./pluggyApi";
import {
  extractTxPostedAtFromPluggyTx,
  pluggyTxIsIncomingCredit,
  processSinglePluggyTransaction,
  type PluggyTx,
} from "./pluggyPaymentProcessor";
import { reconcileGuestContactLessonPayments } from "../reconcileGuestLessonPayments";
import { pluggyTransactionAmountToCents } from "./pluggyAmountToCents";

/** Cada `/buscar` ou `/buscar N` cobre esta quantidade de dias (calendário no fuso do usuário). */
export const BUSCAR_WINDOW_DAYS = 14;
const MAX_BUSCAR_WINDOW_INDEX = 52;

function parseAccountsPayload(data: unknown): { id: string }[] {
  if (!data || typeof data !== "object") return [];
  const r = (data as { results?: unknown }).results;
  if (!Array.isArray(r)) return [];
  return r
    .map((row) =>
      row && typeof row === "object" && typeof (row as { id?: unknown }).id === "string"
        ? { id: (row as { id: string }).id }
        : null,
    )
    .filter((x): x is { id: string } => x != null);
}

function parseTransactionsPage(data: unknown): { results: PluggyTx[]; totalPages: number } {
  if (!data || typeof data !== "object") {
    return { results: [], totalPages: 1 };
  }
  const o = data as Record<string, unknown>;
  const results = Array.isArray(o.results) ? (o.results as PluggyTx[]) : [];
  const tp =
    typeof o.totalPages === "number" && Number.isFinite(o.totalPages) ? Math.max(1, Math.floor(o.totalPages)) : 1;
  return { results, totalPages: Math.min(tp, 200) };
}

export type BuscarPluggyResult =
  | {
      ok: true;
      txSeen: number;
      payableCreditTxSeen: number;
      fromDay: string;
      toDay: string;
      windowIndex: number;
      lessonsMarked: number;
      itemSyncTriggered: boolean;
    }
  | { ok: false; message: string };

function pluggyTxStatus(tx: PluggyTx): string {
  return String(tx.status || "").trim().toUpperCase();
}

function pluggyTxType(tx: PluggyTx): string {
  return String(tx.type || "").trim().toUpperCase();
}

function pluggyTxCreditCountsAsPayment(tx: PluggyTx): boolean {
  const status = pluggyTxStatus(tx);
  return pluggyTxIsIncomingCredit(tx) && (!status || status === "POSTED" || status === "PENDING");
}

/**
 * Janela de N×14 dias para trás: `/buscar` = índice 0 (últimas 2 semanas), `/buscar 1` = bloco anterior, etc.
 * `to` na API Pluggy costuma ser exclusivo — enviamos o dia seguinte ao fim da janela.
 */
export function computePluggyBuscarDateWindow(
  timeZone: string,
  windowIndex: number,
): { fromDay: string; toExclusiveDay: string; toDayInclusive: string; windowIndex: number } {
  const idx = Math.min(MAX_BUSCAR_WINDOW_INDEX, Math.max(0, Math.floor(windowIndex)));
  const tz = timeZone?.trim() || "America/Sao_Paulo";
  const today = DateTime.now().setZone(tz).startOf("day");
  const windowEnd = today.minus({ days: idx * BUSCAR_WINDOW_DAYS });
  const windowStart = windowEnd.minus({ days: BUSCAR_WINDOW_DAYS - 1 });
  const fromDay = windowStart.toFormat("yyyy-MM-dd");
  const toDayInclusive = windowEnd.toFormat("yyyy-MM-dd");
  // +2 dias no `to` da API: alguns bancos demoram a publicar PIX do dia no Open Finance.
  const toExclusiveDay = windowEnd.plus({ days: 2 }).toFormat("yyyy-MM-dd");
  return { fromDay, toExclusiveDay, toDayInclusive, windowIndex: idx };
}

/** Últimas movimentações (sem filtro de data) — complementa PIX que ainda não entrou na janela por data. */
async function fetchRecentAccountTransactions(accountId: string, pageSize = 50): Promise<PluggyTx[]> {
  try {
    const pageData = await pluggyFetchJson(
      `/transactions?accountId=${encodeURIComponent(accountId)}&page=1&pageSize=${pageSize}`,
    );
    return parseTransactionsPage(pageData).results;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[Pluggy/buscar] Falha ao listar transações recentes (sem data)", {
      accountId,
      message: msg.slice(0, 160),
    });
    return [];
  }
}

function mergeUniqueTransactions(
  merged: PluggyTx[],
  seenIds: Set<string>,
  incoming: PluggyTx[],
  recentCutoff: Date,
): number {
  let added = 0;
  for (const tx of incoming) {
    const id = typeof tx.id === "string" ? tx.id : null;
    if (!id || seenIds.has(id)) continue;
    const posted = extractTxPostedAtFromPluggyTx(tx);
    if (posted < recentCutoff) continue;
    seenIds.add(id);
    merged.push(tx);
    added += 1;
  }
  return added;
}

/** Rebusca página 1 sem filtro de data (PIX do dia costuma demorar na janela `from`/`to`). */
async function appendRecentTransactionsFromAccounts(
  accounts: { id: string }[],
  merged: PluggyTx[],
  seenIds: Set<string>,
  timeZone: string,
  pageSize: number,
): Promise<number> {
  const recentCutoff = DateTime.now().setZone(timeZone).minus({ days: 14 }).startOf("day");
  let added = 0;
  for (const acc of accounts) {
    const recent = await fetchRecentAccountTransactions(acc.id, pageSize);
    added += mergeUniqueTransactions(merged, seenIds, recent, recentCutoff.toJSDate());
  }
  return added;
}

/**
 * Conciliação sob demanda (WhatsApp `/buscar` e `/buscar N`): lê o extrato Pluggy na janela de datas
 * e aplica regras em pluggyPaymentProcessor (aulas pendentes, saldo retido, etc.).
 */
export async function runPluggyBuscarReconciliation(
  userId: number,
  opts?: { windowIndex?: number },
): Promise<BuscarPluggyResult> {
  if (!pluggyCredentialsConfigured()) {
    return { ok: false, message: "Pluggy não está configurado no servidor." };
  }
  const settings = await storage.getUserSettings(userId);
  const itemId = settings?.pluggyItemId?.trim();
  if (!itemId) {
    return { ok: false, message: "Nenhum banco conectado. Abra o painel e use *Conectar banco (Pluggy)*." };
  }

  const { fromDay, toExclusiveDay, toDayInclusive, windowIndex } = computePluggyBuscarDateWindow(
    settings?.timeZone || "America/Sao_Paulo",
    opts?.windowIndex ?? 0,
  );
  console.log("[Pluggy/buscar] Iniciando conciliação", {
    userId,
    itemId,
    fromDay,
    toExclusiveDay,
    windowIndex,
  });

  let itemSyncTriggered = false;
  if (windowIndex === 0) {
    try {
      await triggerPluggyItemSync(itemId);
      itemSyncTriggered = true;
      console.log("[Pluggy/buscar] Sync do item disparado; aguardando banco…");
      await waitForPluggyItemSynced(itemId, 25_000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/409/.test(msg) || /allowed at most every/i.test(msg)) {
        console.log("[Pluggy/buscar] Sync do banco já feito há menos de 1h; usando extrato em cache.");
      } else {
        console.warn("[Pluggy/buscar] Sync do item falhou (seguindo com extrato em cache):", msg.slice(0, 160));
      }
    }
  }

  const contactsBefore = await storage.listUserGuestContacts(userId);
  let pendingBefore = 0;
  for (const c of contactsBefore) {
    pendingBefore += (await storage.listPendingLessonEventsForContact(userId, c.id)).length;
  }

  let accountsData: unknown;
  try {
    accountsData = await pluggyFetchJson(`/accounts?itemId=${encodeURIComponent(itemId)}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: `Falha ao listar contas Pluggy: ${msg.slice(0, 200)}` };
  }
  const accounts = parseAccountsPayload(accountsData);
  if (!accounts.length) {
    return { ok: false, message: "Pluggy não retornou contas para esta conexão. Tente reconectar no painel." };
  }
  console.log("[Pluggy/buscar] Contas retornadas:", accounts.length);

  const merged: PluggyTx[] = [];
  const seenIds = new Set<string>();

  for (const acc of accounts) {
    let totalPages = 1;
    for (let page = 1; page <= totalPages; page++) {
      const qs =
        `accountId=${encodeURIComponent(acc.id)}` +
        `&from=${encodeURIComponent(fromDay)}` +
        `&to=${encodeURIComponent(toExclusiveDay)}` +
        `&page=${page}` +
        `&pageSize=500`;
      let pageData: unknown;
      try {
        pageData = await pluggyFetchJson(`/transactions?${qs}`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn("[Pluggy/buscar] Falha ao listar transações", {
          userId,
          accountId: acc.id,
          page,
          message: msg.slice(0, 200),
        });
        break;
      }
      const { results, totalPages: tp } = parseTransactionsPage(pageData);
      totalPages = tp;
      console.log("[Pluggy/buscar] Página de transações", {
        userId,
        accountId: acc.id,
        page,
        totalPages,
        results: results.length,
      });
      for (const tx of results) {
        const id = typeof tx.id === "string" ? tx.id : null;
        if (!id || seenIds.has(id)) continue;
        seenIds.add(id);
        merged.push(tx);
      }
    }
  }

  const tz = settings?.timeZone || "America/Sao_Paulo";
  if (windowIndex === 0) {
    let addedRecent = await appendRecentTransactionsFromAccounts(accounts, merged, seenIds, tz, 200);
    if (addedRecent > 0) {
      console.log("[Pluggy/buscar] Transações recentes adicionais (sem filtro data):", addedRecent);
    }
    // PIX de hoje às vezes só aparece segundos após o sync — nova leitura antes de conciliar.
    await new Promise((r) => setTimeout(r, 4000));
    const addedRetry = await appendRecentTransactionsFromAccounts(accounts, merged, seenIds, tz, 200);
    if (addedRetry > 0) {
      console.log("[Pluggy/buscar] Transações recentes na 2ª leitura:", addedRetry);
    }
    const todayStart = DateTime.now().setZone(tz).startOf("day");
    const todayCredits = merged.filter((tx) => {
      if (!pluggyTxCreditCountsAsPayment(tx)) return false;
      const posted = extractTxPostedAtFromPluggyTx(tx);
      return posted >= todayStart.toJSDate();
    });
    console.log("[Pluggy/buscar] Créditos com data de hoje no fuso do usuário:", todayCredits.length, {
      tz,
      samples: todayCredits.slice(0, 5).map((tx) => ({
        txId: tx.id ?? null,
        brl: (pluggyTransactionAmountToCents(tx) / 100).toFixed(2),
        postedAtLocal: DateTime.fromJSDate(extractTxPostedAtFromPluggyTx(tx))
          .setZone(tz)
          .toFormat("yyyy-MM-dd HH:mm"),
        desc: String(tx.description || tx.descriptionRaw || "").slice(0, 80),
      })),
    });
  }

  merged.sort((a, b) => extractTxPostedAtFromPluggyTx(a).getTime() - extractTxPostedAtFromPluggyTx(b).getTime());
  console.log("[Pluggy/buscar] Transações únicas na janela:", merged.length);
  const payableCreditTxSeen = merged.filter(pluggyTxCreditCountsAsPayment).length;

  for (const tx of merged) {
    if (pluggyTxCreditCountsAsPayment(tx)) {
      const cents = pluggyTransactionAmountToCents(tx);
      console.log("[Pluggy/buscar] Crédito no lote", {
        txId: tx.id ?? null,
        type: pluggyTxType(tx),
        status: pluggyTxStatus(tx),
        amountRaw: tx.amount ?? tx.amountInAccountCurrency ?? null,
        amountCents: cents,
        brl: (cents / 100).toFixed(2),
        postedAt: extractTxPostedAtFromPluggyTx(tx).toISOString(),
        desc: String(tx.description || tx.descriptionRaw || "").slice(0, 100),
      });
    }
    await processSinglePluggyTransaction(itemId, tx, { skipLlm: true });
  }

  // Retentiva idempotente: se uma busca anterior guardou o pagamento como saldo retido
  // (ex.: transação bancária sem hora, mesmo dia da criação da aula), reaplica o saldo nas pendências.
  const { syncGuestFinancialState } = await import("../guestLessonFinancials");
  const contacts = await storage.listUserGuestContacts(userId);
  const { syncPaidLessonCalendarTitlesForContact } = await import("../lessonGoogleCalendarSync");
  for (const c of contacts) {
    await syncGuestFinancialState(userId, c.id, { applyLedgerTopUp: true });
    await reconcileGuestContactLessonPayments(userId, c.id, { paymentSource: "pluggy" });
    await syncGuestFinancialState(userId, c.id, { applyLedgerTopUp: false });
    const calendarFixed = await syncPaidLessonCalendarTitlesForContact(userId, c.id);
    if (calendarFixed > 0) {
      console.log("[Pluggy/buscar] Títulos Google corrigidos para (pago):", { contactId: c.id, calendarFixed });
    }
  }

  let pendingAfter = 0;
  for (const c of contacts) {
    pendingAfter += (await storage.listPendingLessonEventsForContact(userId, c.id)).length;
  }
  const lessonsMarked = Math.max(0, pendingBefore - pendingAfter);
  if (lessonsMarked > 0) {
    console.log("[Pluggy/buscar] Aulas marcadas como pagas nesta busca:", lessonsMarked);
  }

  return {
    ok: true,
    txSeen: merged.length,
    payableCreditTxSeen,
    fromDay,
    toDay: toDayInclusive,
    windowIndex,
    lessonsMarked,
    itemSyncTriggered,
  };
}
