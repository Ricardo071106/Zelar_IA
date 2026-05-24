import { DateTime } from 'luxon';
import { parseUserDateTime } from './dateService';
import { extractEmails, stripEmails, filterPlausibleGuestEmails } from '../utils/attendeeExtractor';
import {
  extractPhonesFromWrittenAndSpoken,
  isPlaceholderOrFakePhoneDigits,
} from '../utils/phoneExtraction';
import { resolveGuestEmailsFromAliases, resolveGuestPhonesFromAliases } from './guestContactAliasService';
import { resolveGuestEmailsAndPhonesFromGroups } from './guestContactGroupService';
import {
  recordTypedGuestEmailsFromText,
  applyCanonicalAndFuzzyGuestEmails,
} from './guestSavedEmailService';
import { normalizeTranscriptionForCalendarText } from '../utils/transcriptionNormalize';
import {
  parseScheduleWithOllama,
  type LessonPackageHint,
} from '../utils/ollamaIntentParser';

export interface Event {
  title: string;
  startDate: string;
  description: string;
  displayDate: string;
  attendees?: string[];
  targetPhones?: string[];
  /** Nome do aluno/convidado extraído pela IA (opcional). */
  studentName?: string | null;
  /** id/slug do pacote nomeado (opcional). */
  packageSlug?: string | null;
}

export type ParseEventOptions = {
  lessonPackages?: LessonPackageHint[];
  guestNames?: string[];
  defaultLessonPriceCents?: number | null;
};

/**
 * Extrai título inteligente do evento focando na ação principal
 */
export function extractEventTitle(text: string): string {
  const textLower = text.toLowerCase();
  let cleanTitle = text;

  const limparTitulo = (texto: string) =>
    texto
      .replace(/\b(marque|agende|coloque|anote|lembre|crie|faça|criar|fazer)\b/gi, '')
      .replace(/\b(me\s+lembre\s+de|lembre\s+me\s+de|me\s+lembrar\s+de)\b/gi, '')
      .replace(/\b(às|as)\s+\d{1,2}(:\d{2})?\s?(h|horas?|pm|am)?\b/gi, '')
      .replace(/\b(amanhã|amanha|hoje|ontem|segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo)(-feira)?\b/gi, '')
      .replace(/\b(da\s+manhã|da\s+tarde|da\s+noite|de\s+manhã|de\s+tarde|de\s+noite)\b/gi, '')
      .replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

  cleanTitle = limparTitulo(cleanTitle);

  const temporalPatterns = [
    /\b(próxima|proxima|que\s+vem)\b/gi,
    /\b(depois|antes|agora|já|ainda)\b/gi,
  ];

  for (const pattern of temporalPatterns) {
    cleanTitle = cleanTitle.replace(pattern, ' ');
  }

  cleanTitle = cleanTitle
    .replace(/\s+/g, ' ')
    .replace(/^\s*(o|a|os|as|um|uma|no|na|em|de|da|do|às|as|para|pra)\s+/i, '')
    .replace(/\s+(no|na|em|de|da|do|às|as|para|pra)\s*$/i, '')
    .replace(/^\s*(e|com|sem|por)\s+/i, '')
    .trim()
    .replace(/^./, (char) => char.toUpperCase());

  if (cleanTitle.length > 2) {
    return capitalizeFirst(cleanTitle);
  }

  const specificPatterns = [
    { regex: /reunião\s+com\s+([^,\s]+(?:\s+[^,\s]+)*)/i, format: (match: string) => `Reunião com ${match}` },
    { regex: /consulta\s+(?:com\s+)?(?:dr\.?\s+|dra\.?\s+)?([^,\s]+(?:\s+[^,\s]+)*)/i, format: (match: string) => `Consulta Dr. ${match}` },
    { regex: /dentista\s+(?:com\s+)?(?:dr\.?\s+|dra\.?\s+)?([^,\s]+(?:\s+[^,\s]+)*)/i, format: (match: string) => `Dentista Dr. ${match}` },
    { regex: /médico\s+(?:com\s+)?(?:dr\.?\s+|dra\.?\s+)?([^,\s]+(?:\s+[^,\s]+)*)/i, format: (match: string) => `Médico Dr. ${match}` },
    { regex: /aniversário\s+(?:do\s+|da\s+)?([^,\s]+(?:\s+[^,\s]+)*)/i, format: (match: string) => `Aniversário ${match}` },
    { regex: /festa\s+(?:do\s+|da\s+|de\s+)?([^,\s]+(?:\s+[^,\s]+)*)/i, format: (match: string) => `Festa ${match}` },
  ];

  for (const pattern of specificPatterns) {
    const match = textLower.match(pattern.regex);
    if (match && match[1]) {
      return capitalizeFirst(pattern.format(match[1].trim()));
    }
  }

  const actionVerbs = [
    /(?:me\s+)?lembre?\s+de\s+(.+?)(?:\s+(?:hoje|amanhã|segunda|terça|quarta|quinta|sexta|sábado|domingo|às|na|no)|\s*$)/i,
    /(?:vou\s+|ir\s+)?fazer\s+(.+?)(?:\s+(?:hoje|amanhã|segunda|terça|quarta|quinta|sexta|sábado|domingo|às|na|no)|\s*$)/i,
    /agende?\s+(.+?)(?:\s+(?:hoje|amanhã|segunda|terça|quarta|quinta|sexta|sábado|domingo|às|na|no)|\s*$)/i,
    /marque?\s+(.+?)(?:\s+(?:hoje|amanhã|segunda|terça|quarta|quinta|sexta|sábado|domingo|às|na|no)|\s*$)/i,
    /criar?\s+(?:um\s+|uma\s+)?(.+?)(?:\s+(?:hoje|amanhã|segunda|terça|quarta|quinta|sexta|sábado|domingo|às|na|no)|\s*$)/i,
  ];

  for (const verb of actionVerbs) {
    const match = text.match(verb);
    if (match && match[1]) {
      let extracted = match[1].trim();
      extracted = extracted.replace(/^(um|uma|o|a|os|as)\s+/i, '');
      return capitalizeFirst(extracted);
    }
  }

  const directKeywords = [
    'jantar', 'almoço', 'almoco', 'academia', 'trabalho', 'escola', 'aula',
    'compromisso', 'consulta', 'exame', 'reunião', 'reuniao', 'compras',
  ];

  for (const keyword of directKeywords) {
    if (textLower.includes(keyword)) {
      return capitalizeFirst(keyword);
    }
  }

  let cleaned = text
    .replace(/^(me\s+lembre\s+de\s+|agende\s+|marque\s+|criar?\s+|vou\s+|ir\s+)/i, '')
    .replace(/^(um|uma|o|a|os|as)\s+/i, '')
    .replace(/\b(amanhã|amanha|hoje|ontem)\b/gi, '')
    .replace(/\b(segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo)(-feira)?\b/gi, '')
    .replace(/\b(próxima|proxima|que vem|na|no)\b/gi, '')
    .replace(/\bàs?\s+\d{1,2}(:\d{2})?h?\b/gi, '')
    .replace(/\b\d{1,2}(am|pm)\b/gi, '')
    .replace(/\b(da manhã|da manha|da tarde|da noite)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  return capitalizeFirst(cleaned) || 'Evento';
}

function capitalizeFirst(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/** Remove o email da conta do anfitrião dos convidados, salvo se o endereço aparecer explicitamente no texto. */
function stripOwnerEmailUnlessInText(
  attendees: string[] | undefined,
  ownerAccountEmail: string | null | undefined,
  text: string,
): string[] {
  if (!attendees?.length) return [];
  const owner = ownerAccountEmail?.trim().toLowerCase();
  if (!owner) return attendees;
  const literal = new Set(filterPlausibleGuestEmails(extractEmails(text)).map((e) => e.toLowerCase()));
  return attendees.filter((e) => {
    if (e.trim().toLowerCase() !== owner) return true;
    return literal.has(owner);
  });
}

/**
 * Processa mensagem usando interpretação local de datas (regex/chrono).
 * LLM local (Ollama) será plugado aqui depois.
 */
export async function processMessage(
  text: string,
  userId: string,
  languageCode?: string,
  ownerDbUserId?: number,
): Promise<Event | null> {
  console.log(`🔍 Processando com detecção de fuso: "${text}"`);

  const result = parseUserDateTime(text, userId, languageCode);

  if (!result) {
    console.log('❌ Não foi possível interpretar data/hora');
    return null;
  }

  const title = extractEventTitle(stripEmails(text));

  console.log(`📝 Título extraído: "${title}"`);
  console.log(`📅 Data interpretada: ${result.readable}`);

  const emailsFromText = extractEmails(text);
  const fromAliases =
    ownerDbUserId != null ? await resolveGuestEmailsFromAliases(ownerDbUserId, text) : [];
  const fromGroups =
    ownerDbUserId != null ? await resolveGuestEmailsAndPhonesFromGroups(ownerDbUserId, text) : { emails: [], phones: [] };
  const attendees = filterPlausibleGuestEmails(
    [...new Set([...emailsFromText, ...fromAliases, ...fromGroups.emails])],
  );
  const phonesFromText = extractPhonesFromWrittenAndSpoken(text).filter(
    (p) => !isPlaceholderOrFakePhoneDigits(p.replace(/\D/g, '')),
  );
  const fromAliasPhones =
    ownerDbUserId != null ? await resolveGuestPhonesFromAliases(ownerDbUserId, text) : [];
  const targetPhones = [...new Set([...phonesFromText, ...fromAliasPhones, ...fromGroups.phones])].filter(
    (p) => !isPlaceholderOrFakePhoneDigits(p.replace(/\D/g, '')),
  );

  return {
    title,
    startDate: result.iso,
    description: stripEmails(text),
    displayDate: result.readable,
    attendees,
    targetPhones,
  };
}

/**
 * Processa mensagem: Ollama (texto) quando configurado, senão parser local regex.
 */
export async function parseEvent(
  text: string,
  userId: string,
  userTimezone: string,
  languageCode?: string,
  ownerDbUserId?: number,
  ownerAccountEmail?: string | null,
  options?: ParseEventOptions,
): Promise<Event | null> {
  const textNorm = normalizeTranscriptionForCalendarText(text);
  await recordTypedGuestEmailsFromText(ownerDbUserId, textNorm);

  let event: Event | null = null;

  const llmIntent = await parseScheduleWithOllama(textNorm, {
    userTimezone,
    lessonPackages: options?.lessonPackages,
    guestNames: options?.guestNames,
    defaultLessonPriceCents: options?.defaultLessonPriceCents,
  });

  if (llmIntent) {
    const eventDate = DateTime.fromObject(
      {
        year: parseInt(llmIntent.date.split('-')[0], 10),
        month: parseInt(llmIntent.date.split('-')[1], 10),
        day: parseInt(llmIntent.date.split('-')[2], 10),
        hour: llmIntent.hour,
        minute: llmIntent.minute,
      },
      { zone: userTimezone },
    );

    if (eventDate.isValid) {
      const emailsInText = filterPlausibleGuestEmails(extractEmails(textNorm));
      const fromAliases =
        ownerDbUserId != null ? await resolveGuestEmailsFromAliases(ownerDbUserId, textNorm) : [];
      const fromGroups =
        ownerDbUserId != null
          ? await resolveGuestEmailsAndPhonesFromGroups(ownerDbUserId, textNorm)
          : { emails: [], phones: [] };
      const phonesFromText = extractPhonesFromWrittenAndSpoken(textNorm).filter(
        (p) => !isPlaceholderOrFakePhoneDigits(p.replace(/\D/g, '')),
      );
      const fromAliasPhones =
        ownerDbUserId != null ? await resolveGuestPhonesFromAliases(ownerDbUserId, textNorm) : [];
      const targetPhones = [
        ...new Set([...phonesFromText, ...fromAliasPhones, ...fromGroups.phones]),
      ].filter((p) => !isPlaceholderOrFakePhoneDigits(p.replace(/\D/g, '')));

      const cleanedTitle = extractEventTitle(llmIntent.title || textNorm);
      const fallbackTitle = extractEventTitle(textNorm);
      const normalizedTitle =
        (cleanedTitle && cleanedTitle.length > 2 ? cleanedTitle : '') ||
        (fallbackTitle && fallbackTitle.length > 2 ? fallbackTitle : '') ||
        llmIntent.title ||
        'Compromisso';

      event = {
        title: normalizedTitle,
        startDate: eventDate.toISO() || eventDate.toString(),
        description: normalizedTitle,
        displayDate: eventDate.toFormat("EEEE, dd 'de' MMMM 'às' HH:mm", { locale: 'pt-BR' }),
        attendees: filterPlausibleGuestEmails(
          [...new Set([...emailsInText, ...fromAliases, ...fromGroups.emails])],
        ),
        targetPhones,
        studentName: llmIntent.studentName?.trim() || null,
        packageSlug: llmIntent.packageSlug?.trim().toLowerCase() || null,
      };

      console.log(
        `✅ Ollama interpretou: ${normalizedTitle} em ${llmIntent.date} às ${llmIntent.hour}:${llmIntent.minute}` +
          (event.packageSlug ? ` [pacote=${event.packageSlug}]` : '') +
          (event.studentName ? ` [aluno=${event.studentName}]` : ''),
      );
    }
  }

  if (!event) {
    console.log(`📋 Interpretando evento (parser local): "${textNorm}"`);
    event = await processMessage(textNorm, userId, languageCode, ownerDbUserId);
  }

  if (event && ownerDbUserId != null) {
    event.attendees = await applyCanonicalAndFuzzyGuestEmails(ownerDbUserId, event.attendees ?? []);
  }

  if (event) {
    event.attendees = stripOwnerEmailUnlessInText(event.attendees, ownerAccountEmail, textNorm);
  }

  return event;
}

/**
 * Gera links para calendários usando data ISO com fuso correto
 */
export function generateLinks(event: Event) {
  const eventDateTime = DateTime.fromISO(event.startDate);
  const endDateTime = eventDateTime.plus({ hours: 1 });

  const startUTC = eventDateTime.toUTC();
  const endUTC = endDateTime.toUTC();

  const startFormatted = startUTC.toFormat("yyyyMMdd'T'HHmmss'Z'");
  const endFormatted = endUTC.toFormat("yyyyMMdd'T'HHmmss'Z'");

  const startISO = eventDateTime.toISO();
  const endISO = endDateTime.toISO();

  const google = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${startFormatted}/${endFormatted}${serializeGoogleAttendees(event.attendees)}`;
  const outlook = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(event.title)}&startdt=${startISO}&enddt=${endISO}${serializeOutlookAttendees(event.attendees)}`;
  const ics = generateIcsDataUrl(eventDateTime, endDateTime, event);

  return { google, outlook, ics };
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function generateIcsDataUrl(start: DateTime, end: DateTime, event: Event): string {
  const uid = `${Date.now()}@zelar.ia`;
  const dtStamp = DateTime.utc().toFormat("yyyyMMdd'T'HHmmss'Z'");
  const dtStart = start.toUTC().toFormat("yyyyMMdd'T'HHmmss'Z'");
  const dtEnd = end.toUTC().toFormat("yyyyMMdd'T'HHmmss'Z'");

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Zelar IA//Agenda//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeIcsText(event.title || 'Evento')}`,
    `DESCRIPTION:${escapeIcsText(event.description || event.title || '')}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return `data:text/calendar;charset=utf-8,${encodeURIComponent(lines.join('\r\n'))}`;
}

function serializeGoogleAttendees(attendees?: string[]): string {
  if (!attendees?.length) return '';
  return attendees.map((email) => `&add=${encodeURIComponent(email)}`).join('');
}

function serializeOutlookAttendees(attendees?: string[]): string {
  if (!attendees?.length) return '';
  return attendees.map((email) => `&to=${encodeURIComponent(email)}`).join('');
}
