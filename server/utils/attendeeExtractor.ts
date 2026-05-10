const EMAIL_STANDARD = /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/gi;

/** STT: ", @luno.dominio.com" — um @ só; reconstrói local@domínio (não casa @ interno de e-mail válido). */
const EMAIL_STRAY_AT = /(?:^|[\s,;])@([\w][\w.-]{0,64})\.((?:[\w-]+\.)+[a-z]{2,})\b/gi;

function pushEmail(
  seen: Set<string>,
  out: { normalized: string; canonical: string }[],
  canonical: string,
) {
  const normalized = canonical.trim().toLowerCase();
  if (seen.has(normalized)) return;
  seen.add(normalized);
  out.push({ normalized, canonical: canonical.trim() });
}

/** Primeira ocorrência no texto preserva a grafia digitada; `normalized` é chave de busca. */
export function extractEmailsWithCanonical(text: string | undefined | null): { normalized: string; canonical: string }[] {
  if (!text) return [];
  const seen = new Set<string>();
  const out: { normalized: string; canonical: string }[] = [];
  let m: RegExpExecArray | null;
  const re1 = new RegExp(EMAIL_STANDARD.source, 'gi');
  while ((m = re1.exec(text)) !== null) {
    pushEmail(seen, out, m[0]);
  }
  const re2 = new RegExp(EMAIL_STRAY_AT.source, 'gi');
  while ((m = re2.exec(text)) !== null) {
    pushEmail(seen, out, `${m[1]}@${m[2]}`);
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
  return text
    .replace(EMAIL_STANDARD, ' ')
    .replace(EMAIL_STRAY_AT, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export default extractEmails;
