import { createHmac } from "crypto";

export function normalizeBrazilianTaxId(raw: unknown): string | null {
  if (raw == null) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length !== 11 && digits.length !== 14) return null;
  return digits;
}

export function maskBrazilianTaxIdLast4(last4: string | null | undefined): string {
  const clean = String(last4 ?? "").replace(/\D/g, "").slice(-4);
  return clean ? `***${clean}` : "";
}

export function hashBrazilianTaxId(raw: unknown): { hash: string; last4: string } | null {
  const digits = normalizeBrazilianTaxId(raw);
  if (!digits) return null;

  const secret =
    process.env.CPF_HASH_SECRET?.trim() ||
    process.env.PANEL_TOKEN_SECRET?.trim() ||
    (process.env.NODE_ENV === "production" ? "" : "dev-tax-id-secret");
  if (!secret) {
    throw new Error("CPF_HASH_SECRET ou PANEL_TOKEN_SECRET deve estar configurado para salvar CPF/CNPJ.");
  }

  const hash = createHmac("sha256", secret).update(digits).digest("hex");
  return { hash, last4: digits.slice(-4) };
}
