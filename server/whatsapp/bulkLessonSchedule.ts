import { DateTime } from 'luxon';
import { extractComGuestNameFromText } from './extractComGuestName';

export type BulkLessonParse =
  | { ok: true; syntheticLines: string[]; summaryLines: string[] }
  | { ok: false };

const DAY_PATTERNS: Array<{ re: RegExp; luxonWeekday: number }> = [
  { re: /\bsegundas?(?:-feira)?\b/i, luxonWeekday: 1 },
  { re: /\bter[cç]as?(?:-feira)?\b/i, luxonWeekday: 2 },
  { re: /\bquartas?(?:-feira)?\b/i, luxonWeekday: 3 },
  { re: /\bquintas?(?:-feira)?\b/i, luxonWeekday: 4 },
  { re: /\bsextas?(?:-feira)?\b/i, luxonWeekday: 5 },
  { re: /\bs[aá]bados?\b/i, luxonWeekday: 6 },
  { re: /\bdomingos?\b/i, luxonWeekday: 7 },
];

const PT_COUNT_WORDS: Record<string, number> = {
  uma: 1,
  um: 1,
  duas: 2,
  dois: 2,
  tres: 3,
  três: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  onze: 11,
  doze: 12,
  treze: 13,
  quatorze: 14,
  catorze: 14,
  quinze: 15,
  dezesseis: 16,
  dezessete: 17,
  dezoito: 18,
  dezenove: 19,
  vinte: 20,
};

const TODAS_AS_DAY: Array<{ re: RegExp; luxonWeekday: number }> = [
  { re: /\btodas\s+as\s+segundas?(?:-feira)?\b/i, luxonWeekday: 1 },
  { re: /\btodas\s+as\s+ter[cç]as?(?:-feira)?\b/i, luxonWeekday: 2 },
  { re: /\btodas\s+as\s+quartas?(?:-feira)?\b/i, luxonWeekday: 3 },
  { re: /\btodas\s+as\s+quintas?(?:-feira)?\b/i, luxonWeekday: 4 },
  { re: /\btodas\s+as\s+sextas?(?:-feira)?\b/i, luxonWeekday: 5 },
  { re: /\btodas\s+as\s+s[aá]bados?\b/i, luxonWeekday: 6 },
  { re: /\btodas\s+as\s+domingos?\b/i, luxonWeekday: 7 },
];

function parseLessonCountToken(raw: string | undefined): number | null {
  if (!raw) return null;
  const t = raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const n = parseInt(t, 10);
  if (!Number.isNaN(n) && n > 0) return Math.min(52, n);
  const w = PT_COUNT_WORDS[t];
  if (typeof w === "number" && w > 0) return Math.min(52, w);
  return null;
}

/**
 * "marque 10 aulas com X todas as quartas as 18" → N linhas sintéticas na mesma weekday.
 */
function tryParseCountedRecurringLessons(rawText: string, timeZone: string): BulkLessonParse {
  const text = rawText.trim();
  const lower = text.toLowerCase();
  if (!/(?:^|\b)(?:marque|marcar|agende|crie|criar|cria)\b/i.test(lower)) return { ok: false };
  if (/\bpacote\s+[a-z0-9_-]+\s+de\s+aulas\b/i.test(lower) || /\bpacote\s+de\s+aulas\s+[a-z0-9_-]+\b/i.test(lower)) {
    return { ok: false };
  }

  const countMatch = lower.match(
    /\b(dez|vinte|onze|doze|treze|catorze|quinze|um|uma|dois|duas|tres|três|\d{1,2})\s+aulas?\b/i,
  );
  const nLessons = parseLessonCountToken(countMatch?.[1]);
  if (!nLessons || nLessons < 2) return { ok: false };

  let lastTimeMatch: RegExpExecArray | null = null;
  const timeRe = /\b(?:às|as|@)\s*(\d{1,2})(?:[:h.](\d{2}))?/gi;
  let tm: RegExpExecArray | null;
  while ((tm = timeRe.exec(text)) !== null) {
    lastTimeMatch = tm;
  }
  if (!lastTimeMatch) return { ok: false };
  const hour = Math.min(23, Math.max(0, parseInt(lastTimeMatch[1], 10)));
  const minute = lastTimeMatch[2] ? Math.min(59, Math.max(0, parseInt(lastTimeMatch[2], 10))) : 0;

  let weekday: number | null = null;
  for (const { re, luxonWeekday } of TODAS_AS_DAY) {
    if (re.test(lower)) {
      weekday = luxonWeekday;
      break;
    }
  }
  if (weekday == null) {
    const found = new Set<number>();
    for (const { re, luxonWeekday } of DAY_PATTERNS) {
      if (re.test(lower)) found.add(luxonWeekday);
    }
    if (found.size !== 1) return { ok: false };
    weekday = [...found][0]!;
  }

  const guestName = extractComGuestNameFromText(text);
  const guestPhrase = guestName ? `com ${guestName} ` : "";

  const now = DateTime.now().setZone(timeZone);
  const first = nextWeekdayOccurrence(now, weekday, hour, minute);
  const syntheticLines: string[] = [];
  const summaryLines: string[] = [];
  for (let i = 0; i < nLessons; i++) {
    const dt = first.plus({ weeks: i });
    const dayStr = dt.toFormat("dd/MM/yyyy");
    const hh = String(hour).padStart(2, "0");
    const mm = String(minute).padStart(2, "0");
    syntheticLines.push(`Aula ${guestPhrase}dia ${dayStr} às ${hh}:${mm}`.replace(/\s+/g, " ").trim());
    summaryLines.push(dt.setLocale("pt-BR").toFormat("EEEE dd/MM/yyyy 'às' HH:mm"));
  }

  return { ok: true, syntheticLines, summaryLines };
}

function nextWeekdayOccurrence(
  now: DateTime,
  weekday: number,
  hour: number,
  minute: number,
): DateTime {
  for (let add = 0; add < 21; add++) {
    const candidate = now.plus({ days: add }).set({ hour, minute, second: 0, millisecond: 0 });
    if (candidate.weekday === weekday && candidate > now) {
      return candidate;
    }
  }
  return now.plus({ days: 7 }).set({ hour, minute, second: 0, millisecond: 0 });
}

/**
 * Detects phrases like "marque aulas segunda terça e quarta às 18" and builds one synthetic
 * calendar line per next occurrence (same flow as a normal "Aula dia …" message).
 */
export function tryParseBulkLessonSchedule(rawText: string, timeZone: string): BulkLessonParse {
  const text = rawText.trim();
  const counted = tryParseCountedRecurringLessons(text, timeZone);
  if (counted.ok) return counted;

  const lower = text.toLowerCase();
  if (!/(?:^|\b)(?:marque|marcar|agende|crie|criar|cria)\b[\s\S]{0,200}?\baulas?\b/i.test(lower)) {
    return { ok: false };
  }

  // Deixa "pacote X de aulas …" para expandLessonPackFromText / expandMultipleCommitments (N aulas + dias).
  if (/\bpacote\s+[a-z0-9_-]+\s+de\s+aulas\b/i.test(lower) || /\bpacote\s+de\s+aulas\s+[a-z0-9_-]+\b/i.test(lower)) {
    return { ok: false };
  }

  let lastTimeMatch: RegExpExecArray | null = null;
  const timeRe = /\b(?:às|as|@)\s*(\d{1,2})(?:[:h.](\d{2}))?/gi;
  let tm: RegExpExecArray | null;
  while ((tm = timeRe.exec(text)) !== null) {
    lastTimeMatch = tm;
  }
  if (!lastTimeMatch) {
    return { ok: false };
  }

  const hour = Math.min(23, Math.max(0, parseInt(lastTimeMatch[1], 10)));
  const minute = lastTimeMatch[2] ? Math.min(59, Math.max(0, parseInt(lastTimeMatch[2], 10))) : 0;

  const idxAulas = lower.search(/\baulas?\b/);
  const idxTime = lastTimeMatch.index;
  if (idxAulas < 0 || idxTime < 0 || idxTime <= idxAulas) {
    return { ok: false };
  }

  const middle = text.slice(idxAulas, idxTime);
  const found = new Set<number>();
  for (const { re, luxonWeekday } of DAY_PATTERNS) {
    if (re.test(middle)) {
      found.add(luxonWeekday);
    }
  }
  if (found.size === 0) {
    return { ok: false };
  }

  const guestName = extractComGuestNameFromText(text);
  const guestPhrase = guestName ? `com ${guestName} ` : '';

  const now = DateTime.now().setZone(timeZone);
  const dates: DateTime[] = [];
  for (const wd of found) {
    dates.push(nextWeekdayOccurrence(now, wd, hour, minute));
  }
  dates.sort((a, b) => a.toMillis() - b.toMillis());

  const syntheticLines = dates.map((dt) => {
    const dayStr = dt.toFormat('dd/MM/yyyy');
    const hh = String(hour).padStart(2, '0');
    const mm = String(minute).padStart(2, '0');
    return `Aula ${guestPhrase}dia ${dayStr} às ${hh}:${mm}`.replace(/\s+/g, ' ').trim();
  });

  const summaryLines = dates.map((dt) =>
    dt.setLocale('pt-BR').toFormat("EEEE dd/MM/yyyy 'às' HH:mm"),
  );

  return { ok: true, syntheticLines, summaryLines };
}
