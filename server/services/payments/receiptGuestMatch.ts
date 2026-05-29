import { storage, type UserGuestContactRow } from "../../storage";
import { normalizeAliasKey } from "../../utils/normalizeGuestAlias";
import { contactMatchesOwnerKeys } from "./guestOwnerMatch";

/**
 * Procura no OCR nomes de alunos cadastrados, ignorando titular/recebedor.
 * Ex.: comprovante com "Sandra" no corpo e "Ricardo" como recebedor → Sandra.
 */
export async function findGuestContactInReceiptText(
  userId: number,
  rawText: string,
  ownerKeys: string[],
): Promise<UserGuestContactRow | null> {
  const blob = normalizeAliasKey(rawText);
  if (blob.length < 4) return null;

  const sigTokens = (s: string) => s.split(/\s+/).filter((t) => t.length >= 3);
  const contacts = await storage.listUserGuestContacts(userId);
  let best: { row: UserGuestContactRow; score: number } | null = null;

  for (const row of contacts) {
    if (contactMatchesOwnerKeys(row, ownerKeys)) continue;

    for (const alias of row.aliasNames ?? []) {
      const ak = normalizeAliasKey(alias);
      if (!ak || ak.length < 3) continue;

      let score = 0;
      if (blob.includes(ak) && ak.length >= 5) {
        score = 95_000 + ak.length;
      } else {
        const tok = sigTokens(ak);
        if (tok.length >= 2 && tok.every((t) => blob.includes(t))) {
          score = 90_000 + tok.length * 400;
        } else if (tok.length === 1 && tok[0]!.length >= 5 && blob.includes(tok[0]!)) {
          score = 75_000 + tok[0]!.length;
        }
      }
      if (score <= 0) continue;
      if (!best || score > best.score) best = { row, score };
    }
  }

  if (best) {
    console.log("[comprovante] Match OCR → aluno", best.row.id, { score: best.score });
  }
  return best?.row ?? null;
}
