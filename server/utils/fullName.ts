/**
 * Nome completo: ≥2 palavras, cada palavra com ≥2 caracteres (após trim).
 */
export function isFullName(raw: string | null | undefined): boolean {
  const t = (raw ?? "").trim();
  if (!t) return false;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length < 2) return false;
  return words.every((w) => w.length >= 2);
}

export function fullNameValidationMessage(): string {
  return "Nome completo obrigatório: use nome e sobrenome (mínimo duas palavras, cada uma com pelo menos 2 letras).";
}
