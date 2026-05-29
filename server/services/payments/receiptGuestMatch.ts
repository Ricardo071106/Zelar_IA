import { storage, type UserGuestContactRow } from "../../storage";
import { normalizeAliasKey } from "../../utils/normalizeGuestAlias";
import { contactMatchesOwnerKeys, nameMatchesOwnerKeys } from "./guestOwnerMatch";
import { extractPersonLikeLinesFromReceipt, isGarbagePayerName } from "./receiptPayerExtract";

function sigTokens(s: string): string[] {
  return s.split(/\s+/).filter((t) => t.length >= 3);
}

function scoreAliasAgainstBlob(aliasKey: string, blob: string): number {
  if (!aliasKey || aliasKey.length < 3) return 0;

  if (aliasKey.length >= 10 && blob.includes(aliasKey)) {
    return 98_000 + aliasKey.length;
  }

  const tok = sigTokens(aliasKey);
  if (tok.length === 0) return 0;

  const matched = tok.filter((t) => blob.includes(t));
  if (matched.length === 0) return 0;

  const ratio = matched.length / tok.length;

  if (matched.length >= 3) {
    return 96_000 + matched.length * 800 + Math.round(ratio * 4000);
  }
  if (matched.length >= 2) {
    return 92_000 + matched.length * 600 + Math.round(ratio * 3000);
  }

  const only = matched[0]!;
  if (tok.length >= 3) {
    return 40_000 + only.length;
  }
  if (only.length >= 5) {
    return 72_000 + only.length;
  }
  return 0;
}

function pickBestGuestMatch(
  hits: { row: UserGuestContactRow; score: number; alias: string }[],
): UserGuestContactRow | null {
  if (!hits.length) return null;
  hits.sort((a, b) => b.score - a.score);
  const top = hits[0]!;
  const second = hits[1];

  if (second && top.score - second.score < 3000) {
    console.log("[comprovante] Match OCR ambíguo", {
      a: { id: top.row.id, score: top.score, alias: top.alias },
      b: { id: second.row.id, score: second.score, alias: second.alias },
    });
    return null;
  }

  console.log("[comprovante] Match OCR → aluno", top.row.id, {
    score: top.score,
    alias: top.alias,
  });
  return top.row;
}

/**
 * Procura no OCR nomes de alunos cadastrados, ignorando titular/recebedor.
 */
export async function findGuestContactInReceiptText(
  userId: number,
  rawText: string,
  ownerKeys: string[],
): Promise<UserGuestContactRow | null> {
  const blobs = [
    normalizeAliasKey(rawText),
    ...extractPersonLikeLinesFromReceipt(rawText).map((l) => normalizeAliasKey(l)),
  ].filter((b) => b.length >= 4);

  if (!blobs.length) return null;

  const contacts = await storage.listUserGuestContacts(userId);
  const hits: { row: UserGuestContactRow; score: number; alias: string }[] = [];

  for (const row of contacts) {
    if (contactMatchesOwnerKeys(row, ownerKeys)) continue;

    for (const alias of row.aliasNames ?? []) {
      const ak = normalizeAliasKey(alias);
      if (!ak || ak.length < 3) continue;

      let bestScore = 0;
      for (const blob of blobs) {
        bestScore = Math.max(bestScore, scoreAliasAgainstBlob(ak, blob));
      }
      if (bestScore <= 0) continue;
      hits.push({ row, score: bestScore, alias });
    }
  }

  const picked = pickBestGuestMatch(hits);
  if (picked) return picked;

  for (const personLine of extractPersonLikeLinesFromReceipt(rawText)) {
    if (isGarbagePayerName(personLine)) continue;
    if (nameMatchesOwnerKeys(personLine, ownerKeys)) continue;
    const byName = await storage.findGuestContactByLooseName(userId, personLine);
    if (byName && !contactMatchesOwnerKeys(byName, ownerKeys)) {
      console.log("[comprovante] Match linha OCR → aluno", byName.id, { personLine });
      return byName;
    }
  }

  return null;
}
