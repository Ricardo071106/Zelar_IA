import { DateTime } from "luxon";
import { storage } from "../../storage";
import { pluggyCredentialsConfigured, pluggyFetchJson } from "./pluggyApi";
import {
  extractTxPostedAtFromPluggyTx,
  processSinglePluggyTransaction,
  type PluggyTx,
} from "./pluggyPaymentProcessor";
import { reconcileGuestContactLessonPayments } from "../reconcileGuestLessonPayments";
import { coercePluggyAmountToNumber, pluggyTransactionAmountToCents } from "./pluggyAmountToCents";

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
    }
  | { ok: false; message: string };

function pluggyTxStatus(tx: PluggyTx): string {
  return String(tx.status || "").trim().toUpperCase();
}

function pluggyTxType(tx: PluggyTx): string {
  return String(tx.type || "").trim().toUpperCase();
}

function pluggyTxLooksCredit(tx: PluggyTx): boolean {
  const type = pluggyTxType(tx);
  return type === "CREDIT" || type === "INCOME" || (type === "" && (coercePluggyAmountToNumber(tx.amount) ?? 0) > 0);
}

function pluggyTxCreditCountsAsPayment(tx: PluggyTx): boolean {
  const status = pluggyTxStatus(tx);
  return pluggyTxLooksCredit(tx) && (!status || status === "POSTED" || status === "PENDING");
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

  if (windowIndex === 0) {
    const tz = settings?.timeZone || "America/Sao_Paulo";
    const recentCutoff = DateTime.now().setZone(tz).minus({ days: 4 }).startOf("day");
    let addedRecent = 0;
    for (const acc of accounts) {
      const recent = await fetchRecentAccountTransactions(acc.id, 60);
      for (const tx of recent) {
        const id = typeof tx.id === "string" ? tx.id : null;
        if (!id || seenIds.has(id)) continue;
        const posted = extractTxPostedAtFromPluggyTx(tx);
        if (posted < recentCutoff.toJSDate()) continue;
        seenIds.add(id);
        merged.push(tx);
        addedRecent += 1;
      }
    }
    if (addedRecent > 0) {
      console.log("[Pluggy/buscar] Transações recentes adicionais (sem filtro data):", addedRecent);
    }
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
    await processSinglePluggyTransaction(itemId, tx);
  }

  // Retentiva idempotente: se uma busca anterior guardou o pagamento como saldo retido
  // (ex.: transação bancária sem hora, mesmo dia da criação da aula), reaplica o saldo nas pendências.
  const contacts = await storage.listUserGuestContacts(userId);
  for (const c of contacts) {
    await reconcileGuestContactLessonPayments(userId, c.id);
  }

  return { ok: true, txSeen: merged.length, payableCreditTxSeen, fromDay, toDay: toDayInclusive, windowIndex };
}
