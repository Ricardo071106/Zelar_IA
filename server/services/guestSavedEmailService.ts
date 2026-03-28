import { storage } from '../storage';
import { extractEmailsWithCanonical } from '../utils/attendeeExtractor';

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

function maxFuzzyDist(len: number): number {
  if (len <= 10) return 2;
  if (len <= 20) return 3;
  return 4;
}

export type SavedGuestEmailRow = { normalizedEmail: string; canonicalEmail: string };

/**
 * Resolve um e-mail (ex.: vindo de STT/Claude) para a grafia salva quando há match exato ou fuzzy único.
 */
export function resolveGuestEmailFromRows(rows: SavedGuestEmailRow[], rawEmail: string): string | null {
  if (!rows.length) return null;
  const low = rawEmail.trim().toLowerCase();
  if (!low) return null;
  const byNorm = new Map(rows.map((r) => [r.normalizedEmail, r.canonicalEmail]));
  const exact = byNorm.get(low);
  if (exact) return exact;

  const normalizedList = rows.map((r) => r.normalizedEmail);
  const maxD = maxFuzzyDist(low.length);
  const candidates: { saved: string; d: number }[] = [];
  for (const saved of normalizedList) {
    const d = levenshtein(low, saved);
    if (d <= maxD) candidates.push({ saved, d });
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.d - b.d);
  if (candidates.length === 1 || candidates[0].d < candidates[1].d) {
    return byNorm.get(candidates[0].saved) ?? null;
  }
  return null;
}

export async function listSavedGuestEmailRows(ownerUserId: number | undefined): Promise<SavedGuestEmailRow[]> {
  if (ownerUserId == null) return [];
  return storage.listUserSavedGuestEmails(ownerUserId);
}

/** Persiste e-mails claramente digitados (regex) com a grafia da primeira ocorrência no texto. */
export async function recordTypedGuestEmailsFromText(ownerUserId: number | undefined, text: string): Promise<void> {
  if (ownerUserId == null || !text?.trim()) return;
  for (const { normalized, canonical } of extractEmailsWithCanonical(text)) {
    await storage.upsertUserSavedGuestEmail(ownerUserId, normalized, canonical);
  }
}

/** Substitui cada endereço pela versão canônica do banco (exato ou fuzzy único). */
export async function applyCanonicalAndFuzzyGuestEmails(
  ownerUserId: number | undefined,
  emails: string[],
): Promise<string[]> {
  if (ownerUserId == null || !emails.length) return emails;
  const rows = await storage.listUserSavedGuestEmails(ownerUserId);
  if (!rows.length) return emails;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of emails) {
    const resolved = resolveGuestEmailFromRows(rows, e) ?? e;
    const key = resolved.trim().toLowerCase();
    if (!key) continue;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(resolved);
    }
  }
  return out;
}
