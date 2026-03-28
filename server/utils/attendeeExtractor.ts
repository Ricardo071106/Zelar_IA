const EMAIL_REGEX = /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/gi;

/** Primeira ocorrência no texto preserva a grafia digitada; `normalized` é chave de busca. */
export function extractEmailsWithCanonical(text: string | undefined | null): { normalized: string; canonical: string }[] {
  if (!text) return [];
  const seen = new Set<string>();
  const out: { normalized: string; canonical: string }[] = [];
  const re = new RegExp(EMAIL_REGEX.source, 'gi');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const canonical = m[0].trim();
    const normalized = canonical.toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push({ normalized, canonical });
  }
  return out;
}

export function extractEmails(text: string | undefined | null): string[] {
  return extractEmailsWithCanonical(text).map((p) => p.normalized);
}

export function stripEmails(text: string | undefined | null): string {
  if (!text) return '';
  return text.replace(EMAIL_REGEX, ' ').replace(/\s{2,}/g, ' ').trim();
}

export default extractEmails;
