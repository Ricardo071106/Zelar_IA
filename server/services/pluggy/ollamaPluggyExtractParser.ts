import { z } from 'zod';
import { chatJsonCompletion, isLlmConfigured } from '../../utils/llmClient';
import { normalizeBrazilianTaxId } from '../../utils/taxIdHash';

export type PluggyTxForLlm = {
  id?: string;
  type?: string;
  status?: string;
  amount?: number | string | null;
  amountInAccountCurrency?: number | string | null;
  currencyCode?: string | null;
  date?: string;
  description?: string | null;
  descriptionRaw?: string | null;
  paymentData?: {
    payer?: { name?: string };
    receiver?: { name?: string };
    paymentMethod?: string;
    reason?: string;
  };
  merchant?: { name?: string } | null;
  counterparty?: { name?: string } | null;
};

export type PluggyExtractHints = {
  payerName: string | null;
  receiverName: string | null;
  cpf: string | null;
  cnpj: string | null;
  amountCents: number | null;
  confidence: number;
};

export type PluggyExtractContext = {
  guestNames: string[];
  knownAmountCents?: number;
  direction: 'credit' | 'debit';
};

const PluggyExtractSchema = z.object({
  payerName: z.string().nullable().optional(),
  receiverName: z.string().nullable().optional(),
  cpf: z.string().nullable().optional(),
  cnpj: z.string().nullable().optional(),
  amountCents: z.number().int().nullable().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export function pluggyLlmExtractEnabled(): boolean {
  if (process.env.PLUGGY_LLM_EXTRACT === 'false') return false;
  return isLlmConfigured();
}

/** Padrão: em todo lançamento. Use PLUGGY_LLM_EXTRACT=fallback para só quando regex falhar. */
export function pluggyLlmExtractOnEveryTransaction(): boolean {
  const mode = process.env.PLUGGY_LLM_EXTRACT?.trim().toLowerCase();
  if (!mode || mode === 'always' || mode === 'true' || mode === '1' || mode === 'yes') return true;
  if (mode === 'fallback') return false;
  return true;
}

/** Texto mínimo do lançamento para a IA (sem persistir extrato completo). */
export function buildPluggyTxTextForLlm(tx: PluggyTxForLlm): string {
  const lines: string[] = [];
  if (tx.type) lines.push(`tipo: ${tx.type}`);
  if (tx.status) lines.push(`status: ${tx.status}`);
  if (tx.amount != null) lines.push(`valor_api: ${tx.amount}`);
  if (tx.amountInAccountCurrency != null) lines.push(`valor_conta: ${tx.amountInAccountCurrency}`);
  if (tx.currencyCode) lines.push(`moeda: ${tx.currencyCode}`);
  if (tx.date) lines.push(`data: ${tx.date}`);
  if (tx.paymentData?.paymentMethod) lines.push(`meio: ${tx.paymentData.paymentMethod}`);
  if (tx.paymentData?.payer?.name) lines.push(`pagador_api: ${tx.paymentData.payer.name}`);
  if (tx.paymentData?.receiver?.name) lines.push(`favorecido_api: ${tx.paymentData.receiver.name}`);
  if (tx.paymentData?.reason) lines.push(`motivo: ${tx.paymentData.reason}`);
  if (tx.counterparty?.name) lines.push(`contra_parte: ${tx.counterparty.name}`);
  if (tx.merchant?.name) lines.push(`estabelecimento: ${tx.merchant.name}`);
  if (tx.descriptionRaw) lines.push(`descricao_raw: ${tx.descriptionRaw}`);
  if (tx.description) lines.push(`descricao: ${tx.description}`);
  return lines.join('\n');
}

function sanitizePersonName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  let s = raw
    .replace(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g, ' ')
    .replace(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g, ' ')
    .replace(/\*{3,}\d+/g, ' ')
    .replace(/\b(?:PIX|RECEBIDO|RECEBIDA|TRANSFER[EÊ]NCIA|TED|DOC|PAGADOR|FAVORECIDO|DESTINAT[AÁ]RIO)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (s.length < 2 || s.length > 120) return null;
  return s;
}

function parseAmountCents(raw: unknown, knownAmountCents?: number): number | null {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) return null;
  const asInt = Math.round(raw);
  if (knownAmountCents != null && knownAmountCents > 0) {
    if (asInt === knownAmountCents) return asInt;
    if (Math.round(asInt * 100) === knownAmountCents) return knownAmountCents;
    if (Math.round(asInt / 100) === knownAmountCents) return knownAmountCents;
  }
  if (asInt >= 100 && asInt <= 500_000_000) return asInt;
  if (asInt > 0 && asInt < 100_000) return Math.round(asInt * 100);
  return null;
}

function buildSystemPrompt(ctx: PluggyExtractContext): string {
  const knownBrl =
    typeof ctx.knownAmountCents === 'number' && ctx.knownAmountCents > 0
      ? (ctx.knownAmountCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      : 'desconhecido';

  return `Você extrai dados de lançamentos bancários brasileiros (PIX, TED, transferência) para conciliar pagamentos de aulas.

Direção do lançamento: ${ctx.direction === 'credit' ? 'CRÉDITO recebido (PIX recebido)' : 'DÉBITO enviado (PIX/TED para alguém)'}.
Valor já conhecido da API (referência): ${knownBrl}.

Alunos cadastrados (priorize estes nomes se aparecerem no texto):
${ctx.guestNames.slice(0, 80).join(', ') || '(lista vazia)'}

Regras:
1) Retorne JSON apenas.
2) payerName: nome de quem enviou/pagou em crédito PIX/TED. Null se não houver ou se for instituição (banco, corretora, fatura).
3) receiverName: nome do favorecido em débito enviado. Null se não aplicável.
4) cpf: somente 11 dígitos (sem pontuação) se identificar CPF de pessoa física pagadora/favorecida. Null se não houver.
5) cnpj: somente 14 dígitos se identificar CNPJ. Null se não houver.
6) amountCents: valor em centavos (ex.: R$ 14,50 → 1450). Prefira o valor explícito no texto; se incerto, use null.
7) confidence: 0.0 a 1.0 — quão certo você está dos campos preenchidos.
8) Ignore faturas de cartão, boletos, corretoras, tarifas, rendimentos, estornos genéricos.
9) Nomes em MAIÚSCULAS no extrato são comuns — normalize para Title Case quando fizer sentido.`;
}

/**
 * Usa Ollama para extrair pagador, CPF/CNPJ e valor de um lançamento Pluggy.
 * Não persiste o extrato; só devolve campos estruturados para casar com alunos.
 */
export async function parsePluggyTransactionWithOllama(
  tx: PluggyTxForLlm,
  ctx: PluggyExtractContext,
): Promise<PluggyExtractHints | null> {
  if (!pluggyLlmExtractEnabled()) return null;

  const blob = buildPluggyTxTextForLlm(tx);
  if (!blob.trim() || blob.trim().length < 8) return null;

  const raw = await chatJsonCompletion<Record<string, unknown>>(buildSystemPrompt(ctx), blob);
  if (!raw) return null;

  const parsed = PluggyExtractSchema.safeParse(raw);
  if (!parsed.success) {
    console.warn('[Pluggy/LLM] JSON inválido ao interpretar extrato:', parsed.error.message);
    return null;
  }

  const data = parsed.data;
  const cpf = normalizeBrazilianTaxId(data.cpf);
  const cnpjRaw = normalizeBrazilianTaxId(data.cnpj);
  const cnpj = cnpjRaw && cnpjRaw.length === 14 ? cnpjRaw : null;
  const cpfOnly = cpf && cpf.length === 11 ? cpf : null;

  const hints: PluggyExtractHints = {
    payerName: sanitizePersonName(data.payerName),
    receiverName: sanitizePersonName(data.receiverName),
    cpf: cpfOnly,
    cnpj,
    amountCents: parseAmountCents(data.amountCents, ctx.knownAmountCents),
    confidence: typeof data.confidence === 'number' ? data.confidence : 0.5,
  };

  const hasSignal =
    hints.payerName ||
    hints.receiverName ||
    hints.cpf ||
    hints.cnpj ||
    hints.amountCents != null;

  if (!hasSignal) return null;

  console.log('[Pluggy/LLM] Extrato interpretado', {
    txId: tx.id ?? null,
    payerName: hints.payerName,
    receiverName: hints.receiverName,
    cpfLast4: hints.cpf?.slice(-4) ?? null,
    amountCents: hints.amountCents,
    confidence: hints.confidence,
  });

  return hints;
}
