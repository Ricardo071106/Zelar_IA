import { DateTime } from 'luxon';

function getNextWeekday(baseDate, targetWeekday, isNext = false) {
  const currentWeekday = baseDate.weekday;
  let daysToAdd = targetWeekday - currentWeekday;

  if (isNext || daysToAdd <= 0) {
    daysToAdd += 7;
  }

  return baseDate.plus({ days: daysToAdd });
}

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

  return null;
}

function extractTimeInfo(input) {
  console.log(`🕰️ Extraindo horário de: "${input}"`);

  const timeMatch1 = input.match(/\b(\d{1,2}):(\d{2})\b/);
  if (timeMatch1) {
    const hour = parseInt(timeMatch1[1]);
    const minute = parseInt(timeMatch1[2]);
    console.log(`🕰️ Formato HH:MM encontrado: ${hour}:${minute}`);
    return { hour, minute };
  }

  const timeMatch2 = input.match(/\b(\d{1,2})h(\d{2})?\b/);
  if (timeMatch2) {
    const hour = parseInt(timeMatch2[1]);
    const minute = parseInt(timeMatch2[2] || '0');
    console.log(`🕰️ Formato HHh encontrado: ${hour}:${minute}`);
    return { hour, minute };
  }

  const timeMatch3 = input.match(/\bàs?\s+(\d{1,2})\b/);
  if (timeMatch3) {
    const hour = parseInt(timeMatch3[1]);
    console.log(`🕰️ Formato "às X" encontrado: ${hour}:00`);
    return { hour, minute: 0 };
  }

  const timeMatch4 = input.match(/\b(\d{1,2})\s*$/);
  if (timeMatch4) {
    const hour = parseInt(timeMatch4[1]);
    console.log(`🕰️ Número no final encontrado: ${hour}:00`);
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

export function parseBrazilianDateTimeISO(input) {
  const result = parseBrazilianDateTime(input);
  return result ? result.iso : null;
}

export function formatBrazilianDateTime(isoString) {
  try {
    const dt = DateTime.fromISO(isoString);
    return dt.setLocale('pt-BR').toFormat("cccc, dd 'de' LLLL 'às' HH:mm");
  } catch (error) {
    return isoString;
  }
}

