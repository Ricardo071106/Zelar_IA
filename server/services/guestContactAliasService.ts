import { storage } from '../storage';
import { normalizeAliasKey } from '../utils/normalizeGuestAlias';

export { normalizeAliasKey };

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

function fuzzyNameInText(normalizedText: string, key: string): boolean {
  if (key.length < 4) return false;
  const words = normalizedText.split(/\s+/).filter((w) => w.length >= 3);
  const maxDist = key.length <= 6 ? 1 : 2;
  for (const w of words) {
    if (Math.abs(w.length - key.length) > maxDist + 1) continue;
    if (levenshtein(w, key) <= maxDist) return true;
  }
  return false;
}

export async function resolveGuestEmailsFromAliases(ownerUserId: number, text: string): Promise<string[]> {
  const rows = await storage.listUserGuestContacts(ownerUserId);
  if (!rows.length) return [];
  const t = normalizeAliasKey(text);
  const emails: string[] = [];
  for (const row of rows) {
    const em = row.canonicalEmail.toLowerCase();
    for (const alias of row.aliasNames ?? []) {
      const key = normalizeAliasKey(alias);
      if (key.length < 2) continue;
      if (t.includes(key)) {
        emails.push(em);
        break;
      }
      if (fuzzyNameInText(t, key)) {
        emails.push(em);
        break;
      }
    }
  }
  return [...new Set(emails)];
}
