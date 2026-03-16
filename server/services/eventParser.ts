import { DateTime } from 'luxon';
import { parseUserDateTime } from './dateService';
import { extractEmails, stripEmails } from '../utils/attendeeExtractor';
import { parseEventWithClaude, ClaudeEventResponse } from '../utils/claudeParser';

// =================== SISTEMA DE APRENDIZADO SIMPLES ===================
export interface LearnedPattern {
  originalText: string;
  title: string;
  hour: number;
  minute: number;
  date: string;
  confidence: number;
  usageCount: number;
}

// Cache em memória para padrões aprendidos
const learnedPatterns: LearnedPattern[] = [];

/**
 * Salva um padrão bem-sucedido do Claude para uso futuro
 */
export function savePatternForLearning(originalText: string, title: string, hour: number, minute: number, date: string): void {
  const existing = learnedPatterns.find(p => p.originalText === originalText);

  if (existing) {
    existing.usageCount++;
    existing.confidence = Math.min(existing.confidence + 0.1, 1.0);
  } else {
    learnedPatterns.push({
      originalText,
      title,
      hour,
      minute,
      date,
      confidence: 0.8,
      usageCount: 1
    });
  }

  console.log(`📚 Padrão aprendido: "${originalText}" → ${title} às ${hour}:${minute.toString().padStart(2, '0')}`);
}

/**
 * Calcula similaridade simples entre dois textos
 */
function calculateSimpleSimilarity(text1: string, text2: string): number {
  const words1 = text1.split(' ').filter(w => w.length > 2);
  const words2 = text2.split(' ').filter(w => w.length > 2);

  let matches = 0;
  for (const word1 of words1) {
    if (words2.some(word2 => word1.includes(word2) || word2.includes(word1))) {
      matches++;
    }
  }

  return matches / Math.max(words1.length, words2.length);
}

export interface Event {
  title: string;
  startDate: string; // ISO string 
  description: string;
  displayDate: string; // Formatted date for display
  attendees?: string[];
  targetPhones?: string[];
}

function normalizeBrazilianPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;

  let normalized = digits;
  if (normalized.startsWith('0')) {
    normalized = normalized.replace(/^0+/, '');
  }

  // DDD + 9 dígitos (11): adiciona DDI 55
  if (normalized.length === 11 && /^[1-9]{2}9\d{8}$/.test(normalized)) {
    return `55${normalized}`;
  }

  // DDI 55 + DDD + 9 dígitos (13): já está no padrão
  if (normalized.length === 13 && /^55[1-9]{2}9\d{8}$/.test(normalized)) {
    return normalized;
  }

  // DDD + 8 dígitos (10): formato antigo, adiciona 9
  if (normalized.length === 10 && /^[1-9]{2}\d{8}$/.test(normalized)) {
    return `55${normalized.slice(0, 2)}9${normalized.slice(2)}`;
  }

  // DDI 55 + DDD + 8 dígitos (12): formato antigo, adiciona 9
  if (normalized.length === 12 && /^55[1-9]{2}\d{8}$/.test(normalized)) {
    return `${normalized.slice(0, 4)}9${normalized.slice(4)}`;
  }

  return null;
}

function extractPhonesFromText(text: string): string[] {
  const phoneCandidates = text.match(/(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?(?:9?\d{4})[-\s]?\d{4}/g) || [];
  const normalized = phoneCandidates
    .map((candidate) => normalizeBrazilianPhone(candidate))
    .filter((phone): phone is string => !!phone);

  return [...new Set(normalized)];
}

/**
 * Verifica se existe um padrão similar aprendido
 */
export function checkLearnedPatterns(userText: string, userTimezone: string = 'America/Sao_Paulo'): Event | null {
  // Desabilitado temporariamente para corrigir bug de data fixa (May 30th)
  // O sistema de aprendizado estava forçando datas antigas/hardcoded
  return null;
}

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
    /\b(depois|antes|agora|já|ainda)\b/gi
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
    .replace(/^./, char => char.toUpperCase());

  if (cleanTitle.length > 2) {
    return capitalizeFirst(cleanTitle);
  }

  const specificPatterns = [
    { regex: /reunião\s+com\s+([^,\s]+(?:\s+[^,\s]+)*)/i, format: (match: string) => `Reunião com ${match}` },
    { regex: /consulta\s+(?:com\s+)?(?:dr\.?\s+|dra\.?\s+)?([^,\s]+(?:\s+[^,\s]+)*)/i, format: (match: string) => `Consulta Dr. ${match}` },
    { regex: /dentista\s+(?:com\s+)?(?:dr\.?\s+|dra\.?\s+)?([^,\s]+(?:\s+[^,\s]+)*)/i, format: (match: string) => `Dentista Dr. ${match}` },
    { regex: /médico\s+(?:com\s+)?(?:dr\.?\s+|dra\.?\s+)?([^,\s]+(?:\s+[^,\s]+)*)/i, format: (match: string) => `Médico Dr. ${match}` },
    { regex: /aniversário\s+(?:do\s+|da\s+)?([^,\s]+(?:\s+[^,\s]+)*)/i, format: (match: string) => `Aniversário ${match}` },
    { regex: /festa\s+(?:do\s+|da\s+|de\s+)?([^,\s]+(?:\s+[^,\s]+)*)/i, format: (match: string) => `Festa ${match}` }
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
    /criar?\s+(?:um\s+|uma\s+)?(.+?)(?:\s+(?:hoje|amanhã|segunda|terça|quarta|quinta|sexta|sábado|domingo|às|na|no)|\s*$)/i
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
    'compromisso', 'consulta', 'exame', 'reunião', 'reuniao', 'compras'
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

/**
 * Processa mensagem usando interpretação avançada de datas com detecção de fuso horário
 */
export async function processMessage(text: string, userId: string, languageCode?: string): Promise<Event | null> {
  console.log(`🔍 Processando com detecção de fuso: "${text}"`);

  const result = parseUserDateTime(text, userId, languageCode);

  if (!result) {
    console.log('❌ Não foi possível interpretar data/hora');
    return null;
  }

  const title = extractEventTitle(stripEmails(text));

  console.log(`📝 Título extraído: "${title}"`);
  console.log(`📅 Data interpretada: ${result.readable}`);

  return {
    title,
    startDate: result.iso,
    description: stripEmails(text),
    displayDate: result.readable,
    attendees: extractEmails(text)
  };
}

/**
 * Processa mensagem completa usando Claude ou fallback
 */
export async function parseEvent(text: string, userId: string, userTimezone: string, languageCode?: string): Promise<Event | null> {
  console.log(`🤖 Usando Claude Haiku para interpretar: "${text}"`);

  let claudeResult: ClaudeEventResponse = {
    title: '',
    isValid: false,
    date: '',
    hour: 0,
    minute: 0,
    target_phones: [],
    attendees: []
  };

  try {
    claudeResult = await parseEventWithClaude(text, userTimezone);
  } catch (error) {
    console.warn('⚠️ Erro ao usar Claude (ignorando e usando fallback):', error);
  }

  let event: Event | null = null;

  if (claudeResult.isValid) {
    const eventDate = DateTime.fromObject({
      year: parseInt(claudeResult.date.split('-')[0]),
      month: parseInt(claudeResult.date.split('-')[1]),
      day: parseInt(claudeResult.date.split('-')[2]),
      hour: claudeResult.hour,
      minute: claudeResult.minute
    }, { zone: userTimezone });

    const phonesFromText = extractPhonesFromText(text);
    const phonesFromClaude = (claudeResult.target_phones || [])
      .map((phone) => normalizeBrazilianPhone(phone))
      .filter((phone): phone is string => !!phone);

    // Proteção contra alucinação de telefone: só aceita telefone que apareceu no texto.
    // Se Claude não retornar telefone, usamos os encontrados via regex local.
    const filteredPhones = phonesFromClaude.length > 0
      ? phonesFromClaude.filter((phone) => phonesFromText.includes(phone))
      : phonesFromText;

    const cleanedClaudeTitle = extractEventTitle(claudeResult.title || text);
    const fallbackTitle = extractEventTitle(text);
    const normalizedTitle =
      (cleanedClaudeTitle && cleanedClaudeTitle.length > 2 ? cleanedClaudeTitle : '') ||
      (fallbackTitle && fallbackTitle.length > 2 ? fallbackTitle : '') ||
      claudeResult.title ||
      'Compromisso';

    event = {
      title: normalizedTitle,
      startDate: eventDate.toISO() || eventDate.toString(),
      description: normalizedTitle,
      displayDate: eventDate.toFormat('EEEE, dd \'de\' MMMM \'às\' HH:mm', { locale: 'pt-BR' }),
      attendees: claudeResult.attendees,
      targetPhones: [...new Set(filteredPhones)],
    };

    console.log(`✅ Claude interpretou: ${normalizedTitle} em ${claudeResult.date} às ${claudeResult.hour}:${claudeResult.minute}`);
  } else {
    // Fallback
    const learnedPattern = checkLearnedPatterns(text, userTimezone);
    if (learnedPattern) {
      event = learnedPattern;
      event.title = extractEventTitle(text);
      event.description = event.title;
    } else {
      event = await processMessage(text, userId, languageCode);
    }
  }

  return event;
}

/**
 * Gera links para calendários usando data ISO com fuso correto
 */
export function generateLinks(event: Event) {
  const eventDateTime = DateTime.fromISO(event.startDate);
  const endDateTime = eventDateTime.plus({ hours: 1 });

  // Para Google Calendar: converter para UTC porque Google espera UTC no formato sem Z
  const startUTC = eventDateTime.toUTC();
  const endUTC = endDateTime.toUTC();

  const startFormatted = startUTC.toFormat('yyyyMMdd\'T\'HHmmss\'Z\'');
  const endFormatted = endUTC.toFormat('yyyyMMdd\'T\'HHmmss\'Z\'');

  // Para Outlook: usar ISO com fuso horário original
  const startISO = eventDateTime.toISO();
  const endISO = endDateTime.toISO();

  console.log(`🔗 Links gerados:`);
  console.log(`📅 Google UTC: ${startFormatted}/${endFormatted}`);
  console.log(`📅 Outlook: ${startISO} → ${endISO}`);

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
