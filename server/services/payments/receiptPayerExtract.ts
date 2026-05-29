import { extractPayerNameFromPluggyTransaction } from "../pluggy/pluggyPayerExtract";
import { normalizeAliasKey } from "../../utils/normalizeGuestAlias";
import { nameMatchesOwnerKeys } from "./guestOwnerMatch";

const RECEIVER_LINE =
  /^(?:para|recebedor|destinat[aá]rio|favorecido|benefici[aá]rio|nome\s+do\s+recebedor)\s*[:\-]/i;

const PAYER_LINE =
  /^(?:nome\s+do\s+pagador|pagador|de|origem|quem\s+enviou|remetente|nome\s+do\s+remetente)\s*[:\-]\s*(.+)$/i;

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
    if (m?.[1] && m[1].length >= 3 && m[1].length <= 120) {
      return m[1].replace(/\s+/g, " ").trim();
    }
  }

  const inline = text.match(
    /(?:nome\s+do\s+pagador|pagador|de|origem|remetente)\s*[:\-]\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s.'-]{2,80})/i,
  );
  if (inline?.[1] && !RECEIVER_LINE.test(inline[0])) {
    return inline[1].replace(/\s+/g, " ").trim();
  }
  return null;
}

/** Nome de quem enviou o PIX (pagador), não o recebedor/professor. */
export function parseReceiptPayerName(text: string, ownerKeys: string[] = []): string | null {
  const receiver = parseReceiptReceiverName(text);
  const keys = [...ownerKeys];
  if (receiver) keys.push(normalizeAliasKey(receiver));

  const fromLines = parsePayerFromLines(text);
  if (fromLines && !nameMatchesOwnerKeys(fromLines, keys)) {
    return fromLines;
  }

  let scrubbed = scrubOwnerNamesFromText(text, keys);
  if (receiver) {
    scrubbed = scrubOwnerNamesFromText(scrubbed, [normalizeAliasKey(receiver)]);
  }

  const fromScrubbedLines = parsePayerFromLines(scrubbed);
  if (fromScrubbedLines && !nameMatchesOwnerKeys(fromScrubbedLines, keys)) {
    return fromScrubbedLines;
  }

  const fallback = extractPayerNameFromPluggyTransaction({
    descriptionRaw: scrubbed.slice(0, 800),
    description: scrubbed.slice(0, 400),
    paymentData: {},
  });
  if (fallback && !nameMatchesOwnerKeys(fallback, keys)) {
    return fallback;
  }

  return fromLines && !nameMatchesOwnerKeys(fromLines, keys) ? fromLines : null;
}

/** Nome do recebedor (professor) — usado para não confundir com pagador. */
export function parseReceiptReceiverName(text: string): string | null {
  const patterns = [
    /(?:nome\s+do\s+recebedor|recebedor|destinat[aá]rio|favorecido|benefici[aá]rio|para)\s*[:\-]\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s.'-]{2,80})/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) return m[1].replace(/\s+/g, " ").trim();
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
  if (payerName?.trim() && !nameMatchesOwnerKeys(payerName, ownerKeys)) {
    parts.push(payerName.trim());
  }
  for (const line of rawText.split(/\r?\n/)) {
    if (RECEIVER_LINE.test(line.trim())) continue;
    if (/pagador|remetente|origem|quem\s+enviou/i.test(line)) parts.push(line);
  }
  return normalizeAliasKey(parts.join(" "));
}
