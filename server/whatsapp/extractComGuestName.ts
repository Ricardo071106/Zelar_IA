/**
 * Extrai nome após "com " para agendamentos, parando em palavras de contexto (dias, pelas próximas, etc.).
 * Evita capturar "caroline benhuk pelas proxima quartas feiras" inteiro como nome.
 */
const SCHEDULING_STOP = new Set(
  [
    'pelas',
    'pela',
    'pelo',
    'proxima',
    'proximas',
    'proximo',
    'proximos',
    'toda',
    'todas',
    'cada',
    'dia',
    'dias',
    'nos',
    'no',
    'na',
    'em',
    'por',
    'ate',
    'até',
    'entre',
    'marque',
    'marcar',
    'agende',
    'pacote',
    'aulas',
    'aula',
    'segunda',
    'segundas',
    'terca',
    'tercas',
    'terça',
    'terças',
    'quarta',
    'quartas',
    'quinta',
    'quintas',
    'sexta',
    'sextas',
    'sabado',
    'sabados',
    'sábado',
    'domingo',
    'domingos',
    'manha',
    'manhã',
    'tarde',
    'noite',
    'as',
    'às',
    'aos',
    'a',
    'o',
    'e',
    'da',
    'de',
    'do',
    'das',
    'dos',
  ].map((w) =>
    w
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase(),
  ),
);

function normToken(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function extractComGuestNameFromText(raw: string): string | null {
  const m = raw.match(/\bcom\s+/i);
  if (!m || m.index === undefined) return null;
  const start = m.index + m[0].length;
  const slice = raw.slice(start);
  const parts: string[] = [];

  for (const token of slice.split(/\s+/)) {
    if (!token) continue;
    const base = token.replace(/[,;:]+$/g, '');
    if (!base) continue;
    const lw = normToken(base);
    if (SCHEDULING_STOP.has(lw)) break;
    if (!/^[A-Za-zÀ-ÿ]+$/.test(base)) break;
    parts.push(base);
    if (parts.length >= 5) break;
  }

  if (parts.length >= 2) return parts.join(' ');
  if (parts.length === 1 && parts[0]!.length >= 5) return parts[0]!;
  return null;
}
