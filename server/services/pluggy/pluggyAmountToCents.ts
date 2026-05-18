/**
 * Converte o campo `amount` do Pluggy para centavos BRL.
 *
 * Em muitos conectores Open Finance o `amount` vem em **centavos** (inteiro, ex.: 1400 = R$ 14,00).
 * Em outros vem em **reais** (ex.: 14 ou 14.5). Antes multiplicávamos sempre por 100 (reais),
 * o que inflava 100× quando o banco já mandava centavos — saldo retido enorme e rateio de aulas errado.
 *
 * Ordem:
 * 1) `PLUGGY_AMOUNT_IN_CENTS=true` → usa round(|amount|) como centavos.
 * 2) `PLUGGY_AMOUNT_IN_REAIS=true` → usa round(|amount| * 100).
 * 3) Se o texto do extrato tiver valor explícito tipo `R$ 14,00` / `Valor: 14,00`, escolhe entre
 *    interpretação “reais×100” vs “já centavos” pela que mais se aproxima do valor do texto
 *    (entre vários `R$` no memo, usa o mais coerente com o número `amount`).
 * 4) Caso contrário → reais × 100 (comportamento legado).
 */

export type PluggyAmountSource = {
  amount?: number | string | null;
  /** Alguns itens trazem o valor já na moeda da conta. */
  amountInAccountCurrency?: number | string | null;
  currencyCode?: string | null;
  description?: string | null;
  descriptionRaw?: string | null;
  paymentData?: { reason?: string };
};

function envTrue(v: string | undefined): boolean {
  const s = v?.trim().toLowerCase();
  return s === "true" || s === "1" || s === "yes";
}

/**
 * Pluggy normalmente manda `amount` como number; em alguns payloads vem string ("14,50", "1.400,00").
 * `Number("14,50")` → NaN → o fluxo de conciliação zerava e nada entrava no painel.
 */
export function coercePluggyAmountToNumber(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw === "bigint") {
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof raw === "string") {
    let s = raw.trim().replace(/\s/g, "").replace(/^R\$\s*/i, "");
    if (!s) return null;
    const neg = s.startsWith("-");
    const u = neg ? s.slice(1) : s;
    if (!u) return null;
    if (/^\d+$/.test(u)) {
      const v = parseInt(u, 10);
      return Number.isFinite(v) ? (neg ? -v : v) : null;
    }
    if (/,/.test(u)) {
      const lastComma = u.lastIndexOf(",");
      const intPart = u.slice(0, lastComma).replace(/\./g, "") || "0";
      const fracRaw = u.slice(lastComma + 1).replace(/\D/g, "");
      if (!/^\d+$/.test(intPart)) return null;
      if (fracRaw.length === 0) {
        const v = parseInt(intPart, 10);
        return Number.isFinite(v) ? (neg ? -v : v) : null;
      }
      const frac =
        fracRaw.length === 1 ? `${fracRaw}0` : fracRaw.length === 2 ? fracRaw : fracRaw.slice(0, 2);
      const v = parseFloat(`${intPart}.${frac}`);
      return Number.isFinite(v) ? (neg ? -v : v) : null;
    }
    const v = parseFloat(u.replace(/,/g, ""));
    return Number.isFinite(v) ? (neg ? -v : v) : null;
  }
  return null;
}

/** Aceita "1.400,00", "14,00", "0,50", "14,5" → centavos. */
export function parseBrazilianMoneyTokenToCents(token: string): number | null {
  const s = token.trim().replace(/\s/g, "");
  if (!/^\d/.test(s)) return null;
  const lastComma = s.lastIndexOf(",");
  if (lastComma < 0) return null;
  const fracRaw = s.slice(lastComma + 1).replace(/\D/g, "");
  if (fracRaw.length < 1 || fracRaw.length > 2) return null;
  const intRaw = s.slice(0, lastComma).replace(/\./g, "");
  if (!/^\d+$/.test(intRaw)) return null;
  const whole = parseInt(intRaw, 10);
  if (!Number.isFinite(whole)) return null;
  const fracNum =
    fracRaw.length === 1 ? parseInt(fracRaw, 10) * 10 : parseInt(fracRaw.slice(0, 2), 10);
  if (!Number.isFinite(fracNum)) return null;
  return whole * 100 + fracNum;
}

function extractReferenceBrlCentsCandidates(blob: string): number[] {
  if (!blob.trim()) return [];
  const t = blob.replace(/\s+/g, " ");
  const found: number[] = [];
  const patterns: RegExp[] = [
    /valor\s*:?\s*R\$\s*([\d]{1,3}(?:\.[\d]{3})*,\d{1,2}|\d+,\d{1,2})/gi,
    /R\$\s*([\d]{1,3}(?:\.[\d]{3})*,\d{1,2}|\d+,\d{1,2})/gi,
  ];
  for (const re of patterns) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(t)) !== null) {
      const c = parseBrazilianMoneyTokenToCents(m[1] || "");
      if (c != null && c > 0) found.push(c);
    }
  }
  return found;
}

function pickBestReferenceCents(found: number[], asMajorCents: number, asMinorCents: number): number | null {
  if (found.length === 0) return null;
  const uniq = [...new Set(found)];
  let best: number | null = null;
  let bestScore = Infinity;
  for (const c of uniq) {
    const s = Math.min(Math.abs(c - asMajorCents), Math.abs(c - asMinorCents));
    if (s < bestScore) {
      bestScore = s;
      best = c;
    }
  }
  return best;
}

function buildAmountHintBlob(tx: PluggyAmountSource): string {
  const reason =
    typeof tx.paymentData?.reason === "string" && tx.paymentData.reason.trim().length > 0
      ? tx.paymentData.reason.trim()
      : "";
  return [tx.descriptionRaw, tx.description, reason]
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .join("\n");
}

function resolveNumericAmount(tx: PluggyAmountSource): number | null {
  const primary = coercePluggyAmountToNumber(tx.amount);
  if (primary != null && Number.isFinite(primary)) return primary;
  return coercePluggyAmountToNumber(tx.amountInAccountCurrency);
}

export function pluggyTransactionAmountToCents(tx: PluggyAmountSource): number {
  const n = resolveNumericAmount(tx);
  if (n == null || !Number.isFinite(n)) return 0;
  const abs = Math.abs(n);
  if (abs <= 0) return 0;

  const cur = (tx.currencyCode || "BRL").toUpperCase();
  const forceMinor = envTrue(process.env.PLUGGY_AMOUNT_IN_CENTS);
  const forceMajor = envTrue(process.env.PLUGGY_AMOUNT_IN_REAIS);

  if (forceMinor && !forceMajor) return Math.round(abs);
  if (forceMajor && !forceMinor) return Math.round(abs * 100);

  const asMajorCents = Math.round(abs * 100);
  const asMinorCents = Math.round(abs);

  if (cur !== "BRL") return asMajorCents;

  const candidates = extractReferenceBrlCentsCandidates(buildAmountHintBlob(tx));
  const ref = pickBestReferenceCents(candidates, asMajorCents, asMinorCents);
  if (ref != null && ref > 0) {
    const tol = Math.max(50, Math.round(ref * 0.02));
    const dMajor = Math.abs(asMajorCents - ref);
    const dMinor = Math.abs(asMinorCents - ref);
    if (dMinor < dMajor && dMinor <= tol) return asMinorCents;
    if (dMajor < dMinor && dMajor <= tol) return asMajorCents;
    if (dMinor <= tol && dMajor > tol) return asMinorCents;
    if (dMajor <= tol && dMinor > tol) return asMajorCents;
  }

  return asMajorCents;
}
