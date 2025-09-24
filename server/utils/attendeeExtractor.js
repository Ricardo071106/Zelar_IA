const EMAIL_REGEX = /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/gi;

export function extractEmails(text) {
  if (!text) return [];
  const matches = text.match(EMAIL_REGEX);
  if (!matches) return [];
  const normalized = matches.map((email) => email.toLowerCase());
  return Array.from(new Set(normalized));
}

export function stripEmails(text) {
  if (!text) return text;
  return text.replace(EMAIL_REGEX, ' ').replace(/\s{2,}/g, ' ').trim();
}

export default extractEmails;
