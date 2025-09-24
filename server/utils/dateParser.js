import { DateTime } from 'luxon';

function getNextWeekday(baseDate, targetWeekday, isNext = false) {
  const currentWeekday = baseDate.weekday;
  let daysToAdd = targetWeekday - currentWeekday;

  if (isNext || daysToAdd <= 0) {
    daysToAdd += 7;
  }

  return baseDate.plus({ days: daysToAdd });
}

const MONTH_MAP = {
  'janeiro': 0,
  'fevereiro': 1,
  'março': 2,
  'marco': 2,
  'abril': 3,
  'maio': 4,
  'junho': 5,
  'julho': 6,
  'agosto': 7,
  'setembro': 8,
  'outubro': 9,
  'novembro': 10,
  'dezembro': 11
};

function extractDateInfo(input) {
  if (/\b(hoje)\b/.test(input)) {
    return { type: 'relative', daysOffset: 0 };
  }
  if (/\b(amanhã|amanha)\b/.test(input)) {
    return { type: 'relative', daysOffset: 1 };
  }

  const weekdays = {
    'segunda': 1, 'segunda-feira': 1,
    'terça': 2, 'terca': 2, 'terça-feira': 2, 'terca-feira': 2,
    'quarta': 3, 'quarta-feira': 3,
    'quinta': 4, 'quinta-feira': 4,
    'sexta': 5, 'sexta-feira': 5,
    'sábado': 6, 'sabado': 6,
    'domingo': 7
  };

  for (const [day, weekday] of Object.entries(weekdays)) {
    if (new RegExp(`\\b${day}\\b`).test(input)) {
      const isNext = /\b(próxima|proxima|que vem)\b/.test(input);
      return { type: 'weekday', weekday, isNext };
    }
  }

  const dayOfMonthMatch =
    input.match(/dia\s*(\d{1,2})(?:\s+de\s+([a-zçã]+))?(?:\s+de\s*(\d{4}))?/i) ||
    input.match(/\b(\d{1,2})\s+de\s+([a-zçã]+)(?:\s+de\s*(\d{4}))?/i);
  if (dayOfMonthMatch) {
    const day = parseInt(dayOfMonthMatch[1], 10);
    const monthName = dayOfMonthMatch[2] ? dayOfMonthMatch[2].toLowerCase() : null;
    const year = dayOfMonthMatch[3] ? parseInt(dayOfMonthMatch[3], 10) : null;

    return { type: 'dayMonth', day, monthName, year };
  }

  const numericDateMatch = input.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (numericDateMatch) {
    const day = parseInt(numericDateMatch[1], 10);
    const month = parseInt(numericDateMatch[2], 10) - 1;
    const year = numericDateMatch[3] ? parseInt(numericDateMatch[3], 10) : null;

    return { type: 'numeric', day, month, year };
  }

  return null;
}

function extractTimeInfo(input) {
  console.log(`🕰️ Extraindo horário de: "${input}"`);

  const timeMatch1 = input.match(/(?:^|\s)(\d{1,2})[:\.](\d{2})(?:\s|$)/);
  if (timeMatch1) {
    const hour = parseInt(timeMatch1[1], 10);
    const minute = parseInt(timeMatch1[2], 10);
    console.log(`🕰️ Formato HH[:.]MM encontrado: ${hour}:${minute}`);
    return { hour, minute };
  }

  const timeMatch2 = input.match(/(?:^|\s)(\d{1,2})h(\d{2})?(?:\s|$)/);
  if (timeMatch2) {
    const hour = parseInt(timeMatch2[1], 10);
    const minute = timeMatch2[2] ? parseInt(timeMatch2[2], 10) : 0;
    console.log(`🕰️ Formato HHh encontrado: ${hour}:${minute}`);
    return { hour, minute };
  }

  const timeMatch3 = input.match(/(?:^|\s)(?:às|ás|as|a)\s*(\d{1,2})(?:[:\.](\d{2}))?(?:\s|$)/);
  if (timeMatch3) {
    const hour = parseInt(timeMatch3[1], 10);
    const minute = timeMatch3[2] ? parseInt(timeMatch3[2], 10) : 0;
    console.log(`🕰️ Formato "às/as X" encontrado: ${hour}:${minute}`);
    return { hour, minute };
  }

  const timeMatchPeriod = input.match(/(?:^|\s)(\d{1,2})\s*(?:da|de)?\s*(manhã|manha|tarde|noite)(?:\s|$)/);
  if (timeMatchPeriod) {
    let hour = parseInt(timeMatchPeriod[1], 10);
    const period = timeMatchPeriod[2];
    if ((period === 'tarde' || period === 'noite') && hour < 12) {
      hour += 12;
    } else if ((period === 'manhã' || period === 'manha') && hour === 12) {
      hour = 0;
    }
    console.log(`🕰️ Formato "${timeMatchPeriod[0].trim()}" encontrado: ${hour}:00`);
    return { hour, minute: 0 };
  }

  const timeMatch4 = input.match(/(?:^|\s)(\d{1,2})(?:\s|$)/);
  if (timeMatch4) {
    const hour = parseInt(timeMatch4[1], 10);
    console.log(`🕰️ Número isolado encontrado: ${hour}:00`);
    return { hour, minute: 0 };
  }

  const wordNumbers = {
    'uma': 1, 'dois': 2, 'três': 3, 'tres': 3, 'quatro': 4,
    'cinco': 5, 'seis': 6, 'sete': 7, 'oito': 8, 'nove': 9,
    'dez': 10, 'onze': 11, 'doze': 12
  };

  for (const [word, number] of Object.entries(wordNumbers)) {
    if (new RegExp(`\\b${word}\\b`).test(input)) {
      let hour = number;
      if (/\b(da tarde|de tarde|da noite|de noite)\b/.test(input) && hour < 12) {
        hour += 12;
      }
      console.log(`🕰️ Número por extenso encontrado: ${word} → ${hour}:00`);
      return { hour, minute: 0 };
    }
  }

  console.log(`❌ Nenhum horário encontrado em: "${input}"`);
  return null;
}

export function parseBrazilianDateTime(input) {
  try {
    console.log(`🔍 Analisando: "${input}"`);

    const normalizedInput = input.toLowerCase().trim();
    const dateInfo = extractDateInfo(normalizedInput);
    const timeInfo = extractTimeInfo(normalizedInput);

    if (!dateInfo) {
      console.log(`❌ Não foi possível extrair data de: "${input}"`);
      return null;
    }

    let baseDateTime = DateTime.now().setZone('America/Sao_Paulo');

    if (dateInfo.type === 'relative' && dateInfo.daysOffset !== undefined) {
      baseDateTime = baseDateTime.plus({ days: dateInfo.daysOffset });
    } else if (dateInfo.type === 'weekday' && dateInfo.weekday !== undefined) {
      baseDateTime = getNextWeekday(baseDateTime, dateInfo.weekday, dateInfo.isNext);
    } else if (dateInfo.type === 'dayMonth') {
      const current = baseDateTime;
      let month = dateInfo.monthName ? MONTH_MAP[dateInfo.monthName] : current.month - 1;
      if (month === undefined || month === null) {
        month = current.month - 1;
      }
      let targetYear = dateInfo.year || current.year;
      let candidate = DateTime.fromObject({ year: targetYear, month: month + 1, day: dateInfo.day }, { zone: 'America/Sao_Paulo' });
      if (!candidate.isValid || candidate < current.startOf('day')) {
        candidate = candidate.plus({ months: 1 });
      }
      baseDateTime = candidate;
    } else if (dateInfo.type === 'numeric') {
      const targetYear = dateInfo.year ? (dateInfo.year < 100 ? 2000 + dateInfo.year : dateInfo.year) : baseDateTime.year;
      let candidate = DateTime.fromObject({ year: targetYear, month: dateInfo.month + 1, day: dateInfo.day }, { zone: 'America/Sao_Paulo' });
      if (!candidate.isValid || candidate < baseDateTime.startOf('day')) {
        candidate = candidate.plus({ years: 1 });
      }
      baseDateTime = candidate;
    }

    const hour = timeInfo?.hour ?? 9;
    const minute = timeInfo?.minute ?? 0;

    const finalDateTime = baseDateTime.set({ hour, minute, second: 0, millisecond: 0 });

    const iso = finalDateTime.toISO();
    const readable = finalDateTime
      .setLocale('pt-BR')
      .toFormat("cccc, dd 'de' LLLL 'às' HH:mm");

    console.log(`✅ Interpretado "${input}"`);
    console.log(`📅 ISO: ${iso}`);
    console.log(`📋 Legível: ${readable}`);

    return { iso, readable };
  } catch (error) {
    console.error(`❌ Erro ao interpretar "${input}":`, error);
    return null;
  }
}