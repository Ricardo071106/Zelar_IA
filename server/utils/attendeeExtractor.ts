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

/**
 * Rejeita endereços que passam no regex mas são lixo de STT/IA (ex.: o@dominio.com).
 */
export function isPlausibleGuestEmail(email: string): boolean {
  const t = email.trim();
  const at = t.lastIndexOf('@');
  if (at < 1) return false;
  const local = t.slice(0, at).trim();
  const domain = t.slice(at + 1).trim().toLowerCase();
  if (local.length < 2) return false;
  const labels = domain.split('.').filter(Boolean);
  if (labels.length < 2) return false;
  const tld = labels[labels.length - 1];
  if (tld.length < 2) return false;
  if (!/^[\w.+-]+$/i.test(local)) return false;
  if (!/^[\w.-]+$/i.test(domain)) return false;
  return true;
}

export function filterPlausibleGuestEmails(emails: string[] | undefined | null): string[] {
  if (!emails?.length) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const e of emails) {
    if (!isPlausibleGuestEmail(e)) continue;
    const k = e.trim().toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(e.trim());
  }
  return out;
}

export function stripEmails(text: string | undefined | null): string {
  if (!text) return '';
  return text.replace(EMAIL_REGEX, ' ').replace(/\s{2,}/g, ' ').trim();
}

export default extractEmails;
