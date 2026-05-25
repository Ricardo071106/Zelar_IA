import { DateTime } from "luxon";
import { normalizeAliasKey } from "../../utils/normalizeGuestAlias";

/** Chave estável (máx. 128 chars) para o ledger — mesma chave = mesmo pagamento (Pluggy ou upload). */
export type PaymentDedupeKey = string;

const E2E_REGEX = /\b(E[A-Z0-9]{31,35})\b/i;
const E2E_LABEL_REGEX =
  /(?:ID\s*(?:DA\s*)?TRANSACAO|IDENTIFICADOR|E2E|END\s*TO\s*END|CODIGO)[:\s]*([E][A-Z0-9]{20,40})/i;

export function extractPixEndToEndId(text: string): string | null {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return null;
  const labeled = t.match(E2E_LABEL_REGEX);
  if (labeled?.[1]) return labeled[1].toUpperCase();
  const m = t.match(E2E_REGEX);
  return m?.[1] ? m[1].toUpperCase() : null;
}

export function normalizeDedupeKeyPart(raw: string, maxLen = 96): string {
  return raw
    .replace(/\s+/g, "")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, maxLen);
}

export type PluggyTxDedupeFields = {
  id?: string;
  description?: string | null;
  descriptionRaw?: string | null;
  providerId?: string | null;
  providerCode?: string | null;
  paymentData?: {
    referenceNumber?: string;
    paymentMethod?: string;
    payer?: { name?: string };
  };
};

export function collectTextForPixIdSearch(tx: PluggyTxDedupeFields): string {
  return [
    tx.paymentData?.referenceNumber,
    tx.providerId,
    tx.providerCode,
    tx.descriptionRaw,
    tx.description,
  ]
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .join("\n");
}

/** Prioridade: E2E → referência do banco → providerId (OF) → id Pluggy legado. */
export function resolvePaymentDedupeKeyFromPluggyTx(tx: PluggyTxDedupeFields): PaymentDedupeKey {
  const blob = collectTextForPixIdSearch(tx);
  const e2e = extractPixEndToEndId(blob);
  if (e2e) return `e2e:${e2e}`.slice(0, 128);

  const ref = tx.paymentData?.referenceNumber?.trim();
  if (ref) {
    const n = normalizeDedupeKeyPart(ref);
    if (n) return `ref:${n}`.slice(0, 128);
  }

  const prov = tx.providerId?.trim();
  if (prov) {
    const n = normalizeDedupeKeyPart(prov);
    if (n) return `of:${n}`.slice(0, 128);
  }

  const pluggyId = typeof tx.id === "string" ? tx.id.trim() : "";
  if (pluggyId) return `pluggy:${pluggyId}`.slice(0, 128);

  return "";
}

export function buildFingerprintDedupeKey(opts: {
  txPostedAt: Date;
  amountCents: number;
  payerName?: string | null;
  timeZone?: string | null;
}): PaymentDedupeKey {
  const zone = opts.timeZone?.trim() || "America/Sao_Paulo";
  const minute = DateTime.fromJSDate(opts.txPostedAt).setZone(zone).toFormat("yyyyMMddHHmm");
  const payer =
    opts.payerName?.trim() ?
      normalizeAliasKey(opts.payerName).replace(/\s/g, "_").slice(0, 40)
    : "unknown";
  return `fp:${minute}_${opts.amountCents}_${payer}`.slice(0, 128);
}

export function resolvePaymentDedupeKeyFromReceiptText(
  text: string,
  opts: {
    txPostedAt: Date;
    amountCents: number;
    payerName?: string | null;
    timeZone?: string | null;
  },
): PaymentDedupeKey {
  const e2e = extractPixEndToEndId(text);
  if (e2e) return `e2e:${e2e}`.slice(0, 128);

  const refMatch = text.match(
    /(?:ID\s*(?:DA\s*)?TRANSACAO|IDENTIFICADOR|AUTENTICACAO|NSU|NUMERO\s*DA\s*TRANSACAO)[:\s#]*([A-Z0-9][A-Z0-9-]{8,50})/i,
  );
  if (refMatch?.[1] && !/^E[A-Z0-9]{31}$/i.test(refMatch[1])) {
    const n = normalizeDedupeKeyPart(refMatch[1]);
    if (n) return `ref:${n}`.slice(0, 128);
  }

  return buildFingerprintDedupeKey(opts);
}

export function resolvePaymentDedupeKeyFromUploadFile(
  fileSha256: string,
  userId: number,
): PaymentDedupeKey {
  const h = normalizeDedupeKeyPart(fileSha256, 64);
  return `upload:${userId}_${h}`.slice(0, 128);
}
