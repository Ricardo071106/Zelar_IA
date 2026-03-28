/**
 * Corrige erros comuns de STT em PT-BR antes de interpretar data/hora e enviar à IA.
 * Não altera trechos que parecem e-mail (evita mexer após @).
 */
export function normalizeTranscriptionForCalendarText(input: string): string {
  if (!input) return input;
  let s = input;

  // "segunda às 14" muito ouvido como "segundo as 14" (ordinal vs dia da semana)
  s = s.replace(/\bsegundo(\s+(?:às|as)\s*\d)/gi, 'segunda$1');
  s = s.replace(/\bsegundo(\s*,\s*(?:às|as)\s*\d)/gi, 'segunda$1');

  // "terça às …" como "terceiro as …"
  s = s.replace(/\bterceiro(\s+(?:às|as)\s*\d)/gi, 'terça$1');

  // "envie para" → STT: "envi para"
  s = s.replace(/\benvi(\s+para\b)/gi, 'envie$1');

  return s;
}
