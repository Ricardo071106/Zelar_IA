import { extractPayerNameFromPluggyTransaction } from "../pluggy/pluggyPayerExtract";
import { normalizeAliasKey } from "../../utils/normalizeGuestAlias";
import { nameMatchesOwnerKeys } from "./guestOwnerMatch";

const RECEIVER_LINE =
  /^(?:para|recebedor|destinat[aá]rio|favorecido|benefici[aá]rio|nome\s+do\s+recebedor)\s*[:\-]/i;

/** Sem "de" isolado — evita casar "De: Chave Pix". */
const PAYER_LINE =
  /^(?:nome\s+do\s+pagador|nome\s+pagador|pagador|quem\s+enviou|remetente|nome\s+do\s+remetente|origem)\s*[:\-]\s*(.+)$/i;

const GARBAGE_PAYER_KEYS = new Set([
  "chave",
  "pix",
  "valor",
  "data",
  "hora",
  "cpf",
  "cnpj",
  "agencia",
  "conta",
  "banco",
  "documento",
  "transferencia",
  "comprovante",
  "pagamento",
  "recebido",
  "enviado",
  "tipo",
  "descricao",
  "autenticacao",
  "instituicao",
  "identificador",
  "e2e",
  "endtoend",
  "nsu",
  "codigo",
  "tarifa",
  "id",
  "bradesco",
  "itau",
  "nubank",
  "inter",
  "santander",
  "caixa",
  "bb",
]);

export function isGarbagePayerName(name: string | null | undefined): boolean {
  if (!name?.trim()) return true;
  const raw = name.trim();
  const k = normalizeAliasKey(raw);
  if (!k || k.length < 3) return true;
  if (GARBAGE_PAYER_KEYS.has(k)) return true;
  if (GARBAGE_PAYER_KEYS.has(k.split(/\s+/)[0] ?? "")) return true;
  if (/^\d+$/.test(k.replace(/\s/g, ""))) return true;
  if (/@/.test(raw) || /\.(com|br|net)\b/i.test(raw)) return true;
  if (/^[a-f0-9-]{16,}$/i.test(k.replace(/\s/g, ""))) return true;
  if (/^\*+\d/.test(raw)) return true;
  if (/^[+\d\s()-]{10,}$/.test(raw)) return true;
  return false;
}

function scrubOwnerNamesFromText(text: string, ownerKeys: string[]): string {
  let out = text;
  for (const ok of ownerKeys) {
    for (const part of ok.split(/\s+/).filter((t) => t.length >= 4)) {
      const esc = part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      out = out.replace(new RegExp(esc, "gi"), " ");
    }
  }
  return out;
}

function parsePayerFromLines(text: string): string | null {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    if (RECEIVER_LINE.test(line)) continue;
    const m = line.match(PAYER_LINE);
    if (m?.[1]) {
      const v = m[1].replace(/\s+/g, " ").trim();
      if (!isGarbagePayerName(v)) return v;
    }
  }

  const inline = text.match(
    /(?:nome\s+do\s+pagador|nome\s+pagador|pagador|origem|remetente)\s*[:\-]\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s.'-]{2,80})/i,
  );
  if (inline?.[1] && !RECEIVER_LINE.test(inline[0])) {
    const v = inline[1].replace(/\s+/g, " ").trim();
    if (!isGarbagePayerName(v)) return v;
  }
  return null;
}

/** Linhas do OCR que parecem nome de pessoa (2–6 palavras, não rótulo de campo). */
export function extractPersonLikeLinesFromReceipt(text: string): string[] {
  const skipStart =
    /^(chave|pix|valor|data|hora|cpf|cnpj|banco|comprovante|transferencia|tipo|id|nsu|cod|autenticacao|instituicao|e2e|endtoend|nome\s+do\s+recebedor|recebedor|destinat)/i;
  const out: string[] = [];

  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (t.length < 5 || t.length > 100) continue;
    if (skipStart.test(t)) continue;
    if (/R\$\s*[\d.,]+/.test(t)) continue;
    if (/^\d{2}\/\d{2}/.test(t)) continue;
    if (!/[A-Za-zÀ-ÿ]{3,}/.test(t)) continue;

    const words = t.split(/\s+/).filter(Boolean);
    if (words.length < 2 || words.length > 6) continue;

    const alphaWords = words.filter((w) => /^[A-Za-zÀ-ÿ'.-]+$/.test(w) && w.length >= 2);
    if (alphaWords.length < 2) continue;
    if (alphaWords.every((w) => w.length <= 3)) continue;

    const candidate = alphaWords.join(" ");
    if (!isGarbagePayerName(candidate)) out.push(candidate);
  }
  return [...new Set(out)];
}

/** Nome de quem enviou o PIX (pagador), não o recebedor/professor. */
export function parseReceiptPayerName(text: string, ownerKeys: string[] = []): string | null {
  const receiver = parseReceiptReceiverName(text);
  const keys = [...ownerKeys];
  if (receiver) keys.push(normalizeAliasKey(receiver));

  const fromLines = parsePayerFromLines(text);
  if (fromLines && !isGarbagePayerName(fromLines) && !nameMatchesOwnerKeys(fromLines, keys)) {
    return fromLines;
  }

  let scrubbed = scrubOwnerNamesFromText(text, keys);
  if (receiver) {
    scrubbed = scrubOwnerNamesFromText(scrubbed, [normalizeAliasKey(receiver)]);
  }

  const fromScrubbedLines = parsePayerFromLines(scrubbed);
  if (fromScrubbedLines && !isGarbagePayerName(fromScrubbedLines) && !nameMatchesOwnerKeys(fromScrubbedLines, keys)) {
    return fromScrubbedLines;
  }

  for (const personLine of extractPersonLikeLinesFromReceipt(scrubbed)) {
    if (!nameMatchesOwnerKeys(personLine, keys)) return personLine;
  }

  const fallback = extractPayerNameFromPluggyTransaction({
    descriptionRaw: scrubbed.slice(0, 800),
    description: scrubbed.slice(0, 400),
    paymentData: {},
  });
  if (fallback && !isGarbagePayerName(fallback) && !nameMatchesOwnerKeys(fallback, keys)) {
    return fallback;
  }

  return null;
}

/** Nome do recebedor (professor) — usado para não confundir com pagador. */
export function parseReceiptReceiverName(text: string): string | null {
  const patterns = [
    /(?:nome\s+do\s+recebedor|recebedor|destinat[aá]rio|favorecido|benefici[aá]rio|para)\s*[:\-]\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s.'-]{2,80})/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) {
      const v = m[1].replace(/\s+/g, " ").trim();
      if (!isGarbagePayerName(v)) return v;
    }
  }
  return null;
}

/** Texto enxuto para casar com cadastro de alunos (só pagador, sem OCR completo). */
export function buildReceiptPayerMemoBlob(
  rawText: string,
  payerName: string | null,
  ownerKeys: string[] = [],
): string {
  const parts: string[] = [];
  if (payerName?.trim() && !isGarbagePayerName(payerName) && !nameMatchesOwnerKeys(payerName, ownerKeys)) {
    parts.push(payerName.trim());
  }
  for (const line of extractPersonLikeLinesFromReceipt(rawText)) {
    if (!nameMatchesOwnerKeys(line, ownerKeys)) parts.push(line);
  }
  for (const line of rawText.split(/\r?\n/)) {
    if (RECEIVER_LINE.test(line.trim())) continue;
    if (/pagador|remetente|origem|quem\s+enviou/i.test(line)) parts.push(line);
  }
  return normalizeAliasKey(parts.join(" "));
}
