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
  const lower = text.toLowerCase();
  if (!/(?:^|\b)(?:marque|marcar|agende)\b[\s\S]{0,200}?\baulas?\b/i.test(lower)) {
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
