import { storage } from "../../storage";
import { pluggyCredentialsConfigured, pluggyFetchJson } from "./pluggyApi";
import {
  extractTxPostedAtFromPluggyTx,
  processSinglePluggyTransaction,
  type PluggyTx,
} from "./pluggyPaymentProcessor";

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
  | { ok: true; txSeen: number; since: string }
  | { ok: false; message: string };

/**
 * Conciliação sob demanda (WhatsApp `/buscar`): lê o extrato Pluggy desde a primeira aula
 * e aplica a mesma regra de nome + valor; aulas sem match seguem pendentes.
 */
export async function runPluggyBuscarReconciliation(userId: number): Promise<BuscarPluggyResult> {
  if (!pluggyCredentialsConfigured()) {
    return { ok: false, message: "Pluggy não está configurado no servidor." };
  }
  const settings = await storage.getUserSettings(userId);
  const itemId = settings?.pluggyItemId?.trim();
  if (!itemId) {
    return { ok: false, message: "Nenhum banco conectado. Abra o painel e use *Conectar banco (Pluggy)*." };
  }
  const since = await storage.getEarliestLessonCreatedAtForUser(userId);
  if (!since) {
    return {
      ok: false,
      message:
        "Ainda não há *aulas vinculadas a alunos* no calendário. Marque aulas com seus alunos primeiro; depois use /buscar.",
    };
  }
  const fromDay = since.toISOString().slice(0, 10);

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

  const merged: PluggyTx[] = [];
  const seenIds = new Set<string>();

  for (const acc of accounts) {
    let totalPages = 1;
    for (let page = 1; page <= totalPages; page++) {
      const qs =
        `accountId=${encodeURIComponent(acc.id)}` +
        `&from=${encodeURIComponent(fromDay)}` +
        `&page=${page}` +
        `&pageSize=500`;
      let pageData: unknown;
      try {
        pageData = await pluggyFetchJson(`/transactions?${qs}`);
      } catch {
        break;
      }
      const { results, totalPages: tp } = parseTransactionsPage(pageData);
      totalPages = tp;
      for (const tx of results) {
        const id = typeof tx.id === "string" ? tx.id : null;
        if (!id || seenIds.has(id)) continue;
        seenIds.add(id);
        merged.push(tx);
      }
    }
  }

  merged.sort((a, b) => extractTxPostedAtFromPluggyTx(a).getTime() - extractTxPostedAtFromPluggyTx(b).getTime());

  for (const tx of merged) {
    await processSinglePluggyTransaction(itemId, tx);
  }

  return { ok: true, txSeen: merged.length, since: fromDay };
}
