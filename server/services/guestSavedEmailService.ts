import { storage } from '../storage';
import { extractEmailsWithCanonical, isPlausibleGuestEmail } from '../utils/attendeeExtractor';

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

function splitEmailParts(email: string): { local: string; domain: string } | null {
  const i = email.lastIndexOf('@');
  if (i <= 0 || i >= email.length - 1) return null;
  const local = email.slice(0, i).trim().toLowerCase();
  const domain = email.slice(i + 1).trim().toLowerCase();
  if (!local || !domain) return null;
  return { local, domain };
}

/** Quantos rótulos do domínio batem da direita (ex.: aluno.lsb.com.br vs x.lsb.com.br → 3). */
function sharedDomainSuffixLen(d1: string, d2: string): number {
  const a = d1.split('.').filter(Boolean);
  const b = d2.split('.').filter(Boolean);
  const L = Math.min(a.length, b.length);
  let n = 0;
  for (let k = 1; k <= L; k++) {
    if (a.slice(-k).join('.') === b.slice(-k).join('.')) n = k;
    else break;
  }
  return n;
}

export type SavedGuestEmailRow = { normalizedEmail: string; canonicalEmail: string };

/**
 * Resolve e-mail (STT/Claude) para grafia salva: exato, fuzzy curto no endereço inteiro,
 * ou fuzzy em local+domínio quando o sufixo do domínio coincide (mesma instituição).
 */
export function resolveGuestEmailFromRows(rows: SavedGuestEmailRow[], rawEmail: string): string | null {
  if (!rows.length) return null;
  const trimmed = rawEmail.trim();
  if (!trimmed) return null;

  const guess = splitEmailParts(trimmed);
  const byNorm = new Map(rows.map((r) => [r.normalizedEmail, r.canonicalEmail]));

  if (guess) {
    const low = `${guess.local}@${guess.domain}`;
    const exact = byNorm.get(low);
    if (exact) return exact;
  }

  const lowFull = trimmed.toLowerCase();
  const normalizedList = rows.map((r) => r.normalizedEmail);
  const maxD = maxFuzzyDist(lowFull.length);
  const candidates: { saved: string; d: number }[] = [];
  for (const saved of normalizedList) {
    const d = levenshtein(lowFull, saved);
    if (d <= maxD) candidates.push({ saved, d });
  }
  if (candidates.length > 0) {
    candidates.sort((a, b) => a.d - b.d);
    if (candidates.length === 1 || candidates[0].d < candidates[1].d) {
      return byNorm.get(candidates[0].saved) ?? null;
    }
  }

  if (!guess) return null;

  const MIN_SUFFIX = 2;
  type Scored = { canonical: string; dist: number; suffixLen: number };
  const scored: Scored[] = [];
  for (const row of rows) {
    const saved = splitEmailParts(row.normalizedEmail);
    if (!saved) continue;
    const suffixLen = sharedDomainSuffixLen(guess.domain, saved.domain);
    if (suffixLen < MIN_SUFFIX) continue;
    const locDist = levenshtein(guess.local, saved.local);
    const locMax = Math.max(guess.local.length, saved.local.length, 1);
    const ratio = locDist / locMax;
    if (locDist > 14 || ratio > 0.52) continue;
    scored.push({ canonical: row.canonicalEmail, dist: locDist, suffixLen });
  }
  if (scored.length === 0) return null;
  scored.sort((a, b) => a.dist - b.dist || b.suffixLen - a.suffixLen);
  if (scored.length === 1 || scored[0].dist < scored[1].dist) {
    return scored[0].canonical;
  }
  return null;
}

export async function listSavedGuestEmailRows(ownerUserId: number | undefined): Promise<SavedGuestEmailRow[]> {
  if (ownerUserId == null) return [];
  const rows = await storage.listUserGuestContacts(ownerUserId);
  return rows.map((r) => ({ normalizedEmail: r.normalizedEmail, canonicalEmail: r.canonicalEmail }));
}

/** Persiste e-mails claramente digitados (regex) com a grafia da primeira ocorrência no texto. */
export async function recordTypedGuestEmailsFromText(ownerUserId: number | undefined, text: string): Promise<void> {
  if (ownerUserId == null || !text?.trim()) return;
  for (const { normalized, canonical } of extractEmailsWithCanonical(text)) {
    if (!isPlausibleGuestEmail(canonical)) continue;
    await storage.upsertUserGuestContactEmailTyped(ownerUserId, normalized, canonical);
  }
}

/** Substitui cada endereço pela versão canônica do banco (exato ou fuzzy único). */
export async function applyCanonicalAndFuzzyGuestEmails(
  ownerUserId: number | undefined,
  emails: string[],
): Promise<string[]> {
  if (ownerUserId == null || !emails.length) return emails;
  const rows = await listSavedGuestEmailRows(ownerUserId);
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
