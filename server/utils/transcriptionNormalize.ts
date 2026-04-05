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

  // "à tarde / da tarde" → STT: "acelco da tarde", "a celco da tarde", "ancelo da tarde"
  s = s.replace(/\b(?:a\s*)?acelc[oa]\s+da\s+tarde\b/gi, 'da tarde');
  s = s.replace(/\bancelo\s+da\s+tarde\b/gi, 'da tarde');
  s = s.replace(/\bace[lt]o\s+da\s+tarde\b/gi, 'da tarde');

  // "@luno." em instituição LSB → quase sempre "aluno." (STT corta o "a")
  s = s.replace(/@luno\.(lsb\.com\.br)\b/gi, 'aluno.$1');

  // "mande para" → "manda para" comum em áudio
  s = s.replace(/\bmande(\s+para\b)/gi, 'manda$1');

  // STT: "agenda" → "ajenda"
  s = s.replace(/\bajenda\b/gi, 'agenda');

  // Reunião sem acento
  s = s.replace(/\breuniao\b/gi, 'reunião');

  // Depois de amanhã
  s = s.replace(/\bdepois\s+d(?:a|o)\s+amanh[ãa]\b/gi, 'depois de amanhã');
  s = s.replace(/\bdepois\s+de\s+manha\b/gi, 'depois de amanhã');

  // Mês "dezembro" ouvido errado
  s = s.replace(/\bdesembro\b/gi, 'dezembro');

  // Horário falado: meio-dia / meia-noite
  s = s.replace(/\bmeio[\s-]?dia\b/gi, '12h');
  s = s.replace(/\bmeia[\s-]?noite\b/gi, '0h');

  // "3 e meia" / "às 15 e meia" → :30 (não mexe em "meia hora" sozinha)
  s = s.replace(/\b(\d{1,2})\s+e\s+meia\b/gi, '$1:30');
  s = s.replace(/\b(?:às|as)\s+(\d{1,2})\s+e\s+meia\b/gi, 'às $1:30');

  // "pra 14h" / "pra as 14" → às
  s = s.replace(/\bpra\s+(?:às|as)\s+/gi, 'às ');
  s = s.replace(/\bpra\s+(\d{1,2})\s*h\b/gi, 'às $1h');

  // Sexta-feira: "sexta feira" com espaço duplo
  s = s.replace(/\bsexta\s+feira\b/gi, 'sexta-feira');
  s = s.replace(/\bsegunda\s+feira\b/gi, 'segunda-feira');
  s = s.replace(/\bter[cç]a\s+feira\b/gi, 'terça-feira');
  s = s.replace(/\bquarta\s+feira\b/gi, 'quarta-feira');
  s = s.replace(/\bquinta\s+feira\b/gi, 'quinta-feira');

  // "daqui a X horas" STT: "da qui a"
  s = s.replace(/\bda\s+qui\s+a\s+/gi, 'daqui a ');

  return s;
}
