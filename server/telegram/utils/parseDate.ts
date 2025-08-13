import { DateTime, IANAZone } from 'luxon';
import * as chrono from 'chrono-node';

/**
 * Mapeamento de códigos de idioma para fusos horários prováveis
 */
const TIMEZONE_BY_LANGUAGE: { [key: string]: string } = {
  'pt': 'America/Sao_Paulo',    // Português - Brasil
  'pt-BR': 'America/Sao_Paulo', // Português Brasil
  'en': 'America/New_York',     // Inglês - EUA
  'es': 'Europe/Madrid',        // Espanhol - Espanha
  'es-AR': 'America/Argentina/Buenos_Aires', // Espanhol Argentina
  'es-MX': 'America/Mexico_City', // Espanhol México
  'fr': 'Europe/Paris',         // Francês
  'de': 'Europe/Berlin',        // Alemão
  'it': 'Europe/Rome',          // Italiano
  'ru': 'Europe/Moscow',        // Russo
  'ja': 'Asia/Tokyo',           // Japonês
  'ko': 'Asia/Seoul',           // Coreano
  'zh': 'Asia/Shanghai',        // Chinês
};

/**
 * Armazenamento simples de fusos horários por usuário
 */
const userTimezones = new Map<string, string>();

/**
 * Valida se um fuso horário é válido usando Luxon
 */
function isValidZone(zone: string): boolean {
  try {
    return IANAZone.isValidZone(zone);
  } catch (error) {
    return false;
  }
}

/**
 * Define o fuso horário para um usuário específico com validação robusta
 */
export function setUserTimezone(userId: string, timezone: string): boolean {
  try {
    // =================== CORREÇÃO: VALIDAÇÃO ROBUSTA DE FUSO ===================
    // Primeiro validar com IANAZone
    if (!isValidZone(timezone)) {
      console.error(`❌ Fuso horário inválido (IANA): ${timezone}`);
      return false;
    }
    
    // Segundo testar criação de DateTime
    const testDateTime = DateTime.now().setZone(timezone);
    if (!testDateTime.isValid) {
      console.error(`❌ Fuso horário inválido (DateTime): ${timezone}`);
      return false;
    }
    
    userTimezones.set(userId, timezone);
    console.log(`🌍 Fuso horário validado e definido para usuário ${userId}: ${timezone}`);
    return true;
    // =================== FIM CORREÇÃO ===================
  } catch (error) {
    console.error(`❌ Erro ao definir fuso horário: ${timezone}`, error);
    return false;
  }
}

/**
 * Obtém o fuso horário para um usuário específico
 */
export function getUserTimezone(userId: string, languageCode?: string): string {
  // 1. Verificar se o usuário definiu um fuso específico
  const userTimezone = userTimezones.get(userId);
  if (userTimezone) {
    console.log(`🌍 Usando fuso definido pelo usuário ${userId}: ${userTimezone}`);
    return userTimezone;
  }
  
  // 2. Tentar detectar pelo código de idioma
  if (languageCode) {
    const detectedTimezone = TIMEZONE_BY_LANGUAGE[languageCode] || TIMEZONE_BY_LANGUAGE[languageCode.split('-')[0]];
    if (detectedTimezone) {
      console.log(`🌍 Fuso detectado pelo idioma ${languageCode}: ${detectedTimezone}`);
      return detectedTimezone;
    }
  }
  
  // 3. Padrão: São Paulo (maioria dos usuários são brasileiros)
  console.log(`🌍 Usando fuso padrão: America/Sao_Paulo`);
  return 'America/Sao_Paulo';
}

/**
 * Lista de fusos horários válidos para sugestões
 */
export const COMMON_TIMEZONES = [
  'America/Sao_Paulo',          // Brasil
  'America/Argentina/Buenos_Aires', // Argentina
  'America/New_York',           // EUA Costa Leste
  'America/Los_Angeles',        // EUA Costa Oeste
  'America/Mexico_City',        // México
  'Europe/London',              // Reino Unido
  'Europe/Paris',               // França/Alemanha
  'Europe/Madrid',              // Espanha
  'Asia/Tokyo',                 // Japão
  'Asia/Shanghai',              // China
  'Australia/Sydney',           // Austrália
];

/**
 * Preprocessa texto em português para melhor interpretação do chrono-node
 */
function preprocessPortugueseText(input: string): string {
  let processed = input.toLowerCase().trim();
  
  // Substituições que ajudam o chrono-node português
  const replacements: { [key: string]: string } = {
    'às': 'às',  // manter
    'as': 'às',  // normalizar
    'amanhã': 'amanhã',
    'amanha': 'amanhã',
    'hoje': 'hoje',
    'segunda-feira': 'segunda',
    'terça-feira': 'terça',
    'terca-feira': 'terça',
    'quarta-feira': 'quarta',
    'quinta-feira': 'quinta',
    'sexta-feira': 'sexta',
    'sábado': 'sábado',
    'sabado': 'sábado'
  };
  
  Object.entries(replacements).forEach(([original, replacement]) => {
    const regex = new RegExp(`\\b${original}\\b`, 'gi');
    processed = processed.replace(regex, replacement);
  });
  
  return processed;
}

/**
 * Corrige horário quando há "da noite" e hora < 12
 */
function correctNightTime(originalInput: string, parsedDate: Date): Date {
  const input = originalInput.toLowerCase();
  const hasNightIndicator = /\b(da noite|de noite)\b/.test(input);
  
  if (!hasNightIndicator) {
    return parsedDate;
  }
  
  const hour = parsedDate.getHours();
  
  // Se tem "da noite" e a hora é menor que 12, adicionar 12 horas
  if (hour < 12) {
    console.log(`🌙 Correção noite: ${hour}h → ${hour + 12}h`);
    const correctedDate = new Date(parsedDate);
    correctedDate.setHours(hour + 12);
    return correctedDate;
  }
  
  return parsedDate;
}

/**
 * Função principal para interpretar datas com fuso horário do usuário (híbrida)
 */
export function parseUserDateTime(
  input: string, 
  userId: string, 
  languageCode?: string
): { iso: string; readable: string } | null {
  try {
    console.log(`🔍 Analisando "${input}" para usuário ${userId}`);
    
    // Obter fuso horário do usuário com validação
    let userTimezone = getUserTimezone(userId, languageCode);
    
    // =================== CORREÇÃO: VALIDAR FUSO ANTES DE USAR ===================
    if (!isValidZone(userTimezone)) {
      console.error(`❌ Fuso inválido detectado: ${userTimezone}, usando fallback`);
      userTimezone = 'America/Sao_Paulo'; // Fallback seguro
    }
    
    // =================== CORREÇÃO: PARSING SIMPLIFICADO E ROBUSTO ===================
    // Extrair hora com múltiplas tentativas antes de usar padrão
    let timeResult = extractTimeFromText(input);
    
    // CORREÇÃO: Se não conseguiu extrair, tentar padrões mais simples
    if (!timeResult) {
      // Tentar detectar números isolados após palavras de tempo
      const simpleTimeMatch = input.toLowerCase().match(/\b(?:às|as|ate)\s+(\d{1,2})\b/);
      if (simpleTimeMatch) {
        const hourFound = parseInt(simpleTimeMatch[1]);
        if (hourFound >= 0 && hourFound <= 23) {
          timeResult = { hour: hourFound, minute: 0 };
          console.log(`🕐 CORREÇÃO SIMPLES - Detectado: "${simpleTimeMatch[0]}" → ${hourFound}:00`);
        }
      }
    }
    
    const hour = timeResult?.hour ?? 9;
    const minute = timeResult?.minute ?? 0;
    
    console.log(`🕐 Hora extraída: ${timeResult ? `${hour}:${minute}` : 'padrão 9:00'}`);
    
    // Extrair data passando horário para lógica inteligente de "hoje"
    const dateResult = extractDateFromText(input, userTimezone, hour, minute);
    
    if (!dateResult) {
      console.log(`❌ Não conseguiu extrair data de: "${input}"`);
      return null;
    }
    
    console.log(`📅 Data extraída: ${dateResult.toDateString()}`);
    
    // =================== CORREÇÃO: INTERPRETAR HORÁRIO COMO LOCAL COM VALIDAÇÃO ===================
    // Criar data/hora diretamente no fuso do usuário
    const userDateTime = DateTime.fromJSDate(dateResult, { zone: userTimezone })
      .set({ hour, minute, second: 0, millisecond: 0 });
    
    // Validar se o DateTime criado é válido
    if (!userDateTime.isValid) {
      console.error(`❌ DateTime inválido criado com fuso ${userTimezone}`);
      return null;
    }
    
    console.log(`📅 Data/hora criada no fuso ${userTimezone}: ${userDateTime.toISO()}`);
    // =================== FIM CORREÇÃO ===================
    
    // Gerar os dois formatos com validação
    const iso = userDateTime.toISO();
    if (!iso) {
      console.error(`❌ Não foi possível gerar ISO string`);
      return null;
    }
    
    const readable = userDateTime.setLocale('pt-BR').toFormat('cccc, dd \'de\' LLLL \'às\' HH:mm');
    
    console.log(`✅ Resultado final:`);
    console.log(`📅 ISO (${userTimezone}): ${iso}`);
    console.log(`📋 Legível: ${readable}`);
    
    return { iso, readable };
    
  } catch (error) {
    console.error(`❌ Erro ao interpretar "${input}":`, error);
    return null;
  }
}

/**
 * Encontra a próxima ocorrência de um dia da semana no futuro
 */
function getNextWeekdayDate(weekday: number, hour: number, minute: number, zone: string): DateTime {
  // =================== CORREÇÃO: VALIDAR FUSO ANTES DE USAR ===================
  if (!isValidZone(zone)) {
    console.error(`❌ Fuso inválido em getNextWeekdayDate: ${zone}, usando fallback`);
    zone = 'America/Sao_Paulo'; // Fallback seguro
  }
  
  const now = DateTime.now().setZone(zone);
  if (!now.isValid) {
    console.error(`❌ DateTime inválido com fuso ${zone}`);
    return DateTime.now(); // Fallback
  }
  
  let date = now.startOf('day');
  
  // Se é hoje e o horário ainda não passou, usar hoje
  if (date.weekday === weekday) {
    const todayWithTime = now.set({ hour, minute, second: 0, millisecond: 0 });
    if (todayWithTime.isValid && todayWithTime > now) {
      console.log(`📅 Agendando para hoje mesmo (${date.toFormat('cccc')}) pois horário ainda não passou`);
      return date;
    }
  }
  
  // Procurar próxima ocorrência do dia da semana
  while (date.weekday !== weekday || date <= now.startOf('day')) {
    date = date.plus({ days: 1 });
  }
  
  console.log(`📅 Próxima ${['', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'][weekday]}: ${date.toFormat('cccc, dd/MM')}`);
  return date;
}

/**
 * Extrai data usando Luxon para garantir próxima ocorrência futura
 */
function extractDateFromText(input: string, userTimezone: string = 'America/Sao_Paulo', hour: number = 9, minute: number = 0): Date | null {
  try {
    const text = input.toLowerCase();
    
    // NOVO: Detectar 'daqui X sábados' e somar X semanas ao próximo sábado (PRIORITÁRIO)
    const daquiSabados = text.match(/daqui\s+(a\s+)?(\d+|um|uma|dois|duas|três|tres|quatro|cinco|seis|sete|oito|nove|dez)\s+s[áa]bados?/);
    if (daquiSabados) {
      const extensoParaNumero: { [key: string]: number } = {
        'um': 1, 'uma': 1, 'dois': 2, 'duas': 2, 'três': 3, 'tres': 3, 'quatro': 4, 'cinco': 5, 'seis': 6, 'sete': 7, 'oito': 8, 'nove': 9, 'dez': 10
      };
      let n = daquiSabados[2];
      let semanas = parseInt(n);
      if (isNaN(semanas)) {
        semanas = extensoParaNumero[n] || 1;
      }
      const now = DateTime.now().setZone(userTimezone);
      let date = now;
      let daysToAdd = (6 - now.weekday + 7) % 7;
      if (daysToAdd === 0) daysToAdd = 7;
      date = date.plus({ days: daysToAdd });
      if (semanas > 1) {
        date = date.plus({ weeks: semanas - 1 });
      }
      date = date.set({ hour, minute, second: 0, millisecond: 0 });
      console.log(`[extractDateFromText][DEBUG] 'daqui X sábados': semanas=${semanas}, resultado=${date.toFormat('dd/MM/yyyy HH:mm')}`);
      if (!date.isValid) return null;
      return date.toJSDate();
    }
    
    // =================== CORREÇÃO: LÓGICA DE DIAS DA SEMANA COM LUXON ===================
    // Mapear dias da semana (Luxon: 1=segunda, 7=domingo)
    const weekdays: { [key: string]: number } = {
      'segunda': 1, 'segunda-feira': 1,
      'terça': 2, 'terca': 2, 'terça-feira': 2, 'terca-feira': 2,
      'quarta': 3, 'quarta-feira': 3,
      'quinta': 4, 'quinta-feira': 4,
      'sexta': 5, 'sexta-feira': 5,
      'sábado': 6, 'sabado': 6,
      'domingo': 7
    };
    
    // Verificar se contém dia da semana
    for (const [dayName, weekdayNum] of Object.entries(weekdays)) {
      if (text.includes(dayName)) {
        console.log(`📅 Detectado dia da semana: ${dayName} (${weekdayNum})`);
        const nextDate = getNextWeekdayDate(weekdayNum, hour, minute, userTimezone);
        return nextDate.toJSDate();
      }
    }
    
    // Casos especiais
    if (text.includes('hoje')) {
      console.log(`📅 Detectado: hoje`);
      return DateTime.now().setZone(userTimezone).startOf('day').toJSDate();
    }
    
    if (text.includes('amanhã') || text.includes('amanha')) {
      console.log(`📅 Detectado: amanhã`);
      const now = DateTime.now().setZone(userTimezone);
      const tomorrow = now.plus({ days: 1 });
      console.log(`📅 Hoje: ${now.toFormat('dd/MM/yyyy HH:mm')}, Amanhã: ${tomorrow.toFormat('dd/MM/yyyy HH:mm')}`);
      return tomorrow.toJSDate();
    }
    
    // =================== CORREÇÃO: SUPORTE PARA DATAS BRASILEIRAS DD/MM/AAAA ===================
    
    // 1. PRIMEIRO: Tentar detectar formatos DD/MM ou DD/MM/AAAA
    const brazilianDateRegex = /\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/;
    const dateMatch = text.match(brazilianDateRegex);
    
    if (dateMatch) {
      let [_, dayStr, monthStr, yearStr] = dateMatch;
      const day = parseInt(dayStr);
      const month = parseInt(monthStr) - 1; // JavaScript months are 0-indexed
      const now = DateTime.now().setZone(userTimezone);
      let year = yearStr ? parseInt(yearStr) : now.year;
      
      // Ajustar ano de 2 dígitos (26 → 2026)
      if (yearStr && yearStr.length === 2) {
        const shortYear = parseInt(yearStr);
        year = shortYear < 50 ? 2000 + shortYear : 1900 + shortYear;
      }
      
      // =================== CORREÇÃO: VALIDAÇÃO ROBUSTA DE DATAS ===================
      // Validar intervalos mais precisos para dia e mês
      const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; // considerando ano bissexto
      const maxDayForMonth = daysInMonth[month] || 31;
      
      if (day >= 1 && day <= maxDayForMonth && month >= 0 && month <= 11) {
        try {
          let parsedDate = DateTime.fromObject({ 
            year, 
            month: month + 1, // Luxon usa meses 1-indexed
            day, 
            hour, 
            minute 
          }, { zone: userTimezone });
          
          // Verificar se a data é válida (Luxon detecta datas inválidas como 31/02)
          if (!parsedDate.isValid) {
            console.log(`❌ Data inválida detectada: ${day}/${month + 1}/${year} - ${parsedDate.invalidReason}`);
            return null;
          }
          
          // Se não foi informado ano e a data já passou este ano, usar próximo ano
          if (!yearStr && parsedDate < now) {
            parsedDate = parsedDate.plus({ years: 1 });
            console.log(`📅 Data passou este ano, ajustando para próximo ano`);
          }
          
          console.log(`📅 Data brasileira válida: ${day}/${month + 1}/${year} → ${parsedDate.toFormat('dd/MM/yyyy')}`);
          return parsedDate.toJSDate();
        } catch (error) {
          console.log(`❌ Erro ao criar data ${day}/${month + 1}/${year}: ${error}`);
          return null;
        }
      } else {
        console.log(`❌ Data fora do intervalo válido: dia ${day}, mês ${month + 1}`);
        return null;
      }
    }
    
    // 2. FALLBACK: usar chrono-node para outros casos
    const pt = chrono.pt;
    const processedInput = preprocessPortugueseText(input);
    
    const dateOnlyInput = processedInput
      .replace(/\bàs?\s+\w+/gi, '')
      .replace(/\b\d{1,2}h?\b/gi, '')
      .replace(/\b(da manhã|da tarde|da noite|de manhã|de tarde|de noite)\b/gi, '')
      .trim();
    
    const parseResults = pt.parse(dateOnlyInput, new Date(), { forwardDate: true });
    
    if (parseResults.length > 0) {
      const parsedDate = parseResults[0].start.date();
      console.log(`📅 Chrono-node detectou: ${parsedDate.toDateString()}`);
      
      // Garantir que é futuro
      const now = DateTime.now().setZone(userTimezone);
      const resultDateTime = DateTime.fromJSDate(parsedDate, { zone: userTimezone });
      
      if (resultDateTime < now.startOf('day')) {
        console.log(`📅 Data no passado, ajustando para próxima semana`);
        return resultDateTime.plus({ weeks: 1 }).toJSDate();
      }
      
      return parsedDate;
    }
    
    return null;
  } catch (error) {
    console.error('Erro ao extrair data:', error);
    return null;
  }
}

/**
 * Extrai horário usando parser customizado com suporte robusto para AM/PM
 * CORREÇÃO: Prioriza formatos AM/PM e suporte para minutos (ex: 6:30pm → 18:30)
 */
function extractTimeFromText(input: string): { hour: number, minute: number } | null {
  const text = input.toLowerCase().trim();

  // 1. Padrão completo: "às 20:00", "às 20h", "às 20"
  let match = text.match(/\b(?:às|as)\s*(\d{1,2})(?::(\d{2}))?\s*h?\b/);
  if (match) {
    const hour = parseInt(match[1]);
    const minute = match[2] ? parseInt(match[2]) : 0;
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      console.log(`🕐 PADRÃO EXPLÍCITO: '${match[0]}' → ${hour}:${minute.toString().padStart(2, '0')}`);
      return { hour, minute };
    }
  }

  // 2. Padrão: "20:00", "20h", "20"
  match = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*h?\b/);
  if (match) {
    const hour = parseInt(match[1]);
    const minute = match[2] ? parseInt(match[2]) : 0;
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      console.log(`🕐 PADRÃO NÚMERO: '${match[0]}' → ${hour}:${minute.toString().padStart(2, '0')}`);
      return { hour, minute };
    }
  }

  // 3. AM/PM com minutos (6:30pm, 7:15am)
  match = text.match(/\b(\d{1,2}):(\d{2})\s*(am|pm)\b/i);
  if (match) {
    let hour = parseInt(match[1]);
    const minute = parseInt(match[2]);
    const period = match[3].toLowerCase();
    if (period === 'pm' && hour < 12) hour += 12;
    if (period === 'am' && hour === 12) hour = 0;
    console.log(`🕐 AM/PM com minutos: ${match[1]}:${match[2]}${period} → ${hour}:${minute}`);
    return { hour, minute };
  }

  // 4. AM/PM simples (6pm, 7am)
  match = text.match(/\b(\d{1,2})\s*(am|pm)\b/i);
  if (match) {
    let hour = parseInt(match[1]);
    const period = match[2].toLowerCase();
    if (period === 'pm' && hour < 12) hour += 12;
    if (period === 'am' && hour === 12) hour = 0;
    console.log(`🕐 AM/PM simples: ${match[1]}${period} → ${hour}:00`);
    return { hour, minute: 0 };
  }

  // 5. Por extenso (vinte, dezenove, etc.)
  const wordNumbers: { [key: string]: number } = {
    'uma': 1, 'duas': 2, 'dois': 2, 'três': 3, 'tres': 3, 'quatro': 4, 'cinco': 5,
    'seis': 6, 'sete': 7, 'oito': 8, 'nove': 9, 'dez': 10,
    'onze': 11, 'doze': 12, 'treze': 13, 'catorze': 14, 'quatorze': 14,
    'quinze': 15, 'dezesseis': 16, 'dezessete': 17, 'dezoito': 18,
    'dezenove': 19, 'vinte': 20, 'vinte e uma': 21, 'vinte e duas': 22, 'vinte e três': 23, 'vinte e tres': 23
  };

  // NOVO: Suporte para "oito e meia", "sete e quinze", "nove e quarenta e cinco", etc.
  const extensoComMinutos = text.match(/\b(uma|duas|dois|três|tres|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|treze|catorze|quatorze|quinze|dezesseis|dezessete|dezoito|dezenove|vinte|vinte e uma|vinte e duas|vinte e três|vinte e tres)\s+e\s+(meia|quinze|minutos?|vinte|vinte e cinco|trinta|quarenta|quarenta e cinco|cinquenta|cinquenta e cinco)\b/);
  if (extensoComMinutos) {
    const horaStr = extensoComMinutos[1];
    const minStr = extensoComMinutos[2];
    let hour = wordNumbers[horaStr];
    let minute = 0;
    if (minStr.includes('meia')) minute = 30;
    else if (minStr.includes('quinze')) minute = 15;
    else if (minStr.includes('vinte e cinco')) minute = 25;
    else if (minStr.includes('vinte')) minute = 20;
    else if (minStr.includes('trinta')) minute = 30;
    else if (minStr.includes('quarenta e cinco')) minute = 45;
    else if (minStr.includes('quarenta')) minute = 40;
    else if (minStr.includes('cinquenta e cinco')) minute = 55;
    else if (minStr.includes('cinquenta')) minute = 50;
    // Ajuste para "da noite" ou "da tarde"
    if (/\b(da tarde|de tarde|da noite|de noite)\b/.test(text) && hour < 12) {
      hour += 12;
      console.log(`🌙 Ajuste período: ${wordNumbers[horaStr]} → ${hour} (${horaStr})`);
    }
    console.log(`🕐 Por extenso com minutos: ${horaStr} e ${minStr} → ${hour}:${minute.toString().padStart(2, '0')}`);
    return { hour, minute };
  }

  for (const [word, number] of Object.entries(wordNumbers)) {
    if (new RegExp(`\\b${word}\\b`).test(text)) {
      let hour = number;
      if (/\b(da tarde|de tarde|da noite|de noite)\b/.test(text) && hour < 12) {
        hour += 12;
        console.log(`🌙 Ajuste período: ${number} → ${hour} (${word})`);
      }
      console.log(`🕐 Por extenso: ${word} → ${hour}:00`);
      return { hour, minute: 0 };
    }
  }

  console.log(`❌ Nenhum horário encontrado em: "${input}"`);
  return null;
}

/**
 * Função EXATA do Telegram para extrair o nome do evento
 */
export function extractEventTitle(text: string): string {
  const textLower = text.toLowerCase();
  // CORREÇÃO COMPLETA: Limpeza robusta conforme solicitado
  const limparTitulo = (texto: string) =>
    texto
      // Remove comandos primeiro
      .replace(/\b(marque|agende|coloque|anote|lembre|crie|faça|criar|fazer)\b/gi, '')
      // Remove "me lembre de" completamente
      .replace(/\b(me\s+lembre\s+de|lembre\s+me\s+de|me\s+lembrar\s+de)\b/gi, '')
      // Remove "me" isolado que pode sobrar
      .replace(/\bme\b/gi, '')
      // Remove TODAS as palavras temporais
      .replace(/\b(às|as|a|hora|horário|horarios|h|hs|am|pm)\b/gi, '')
      // Remove TODOS os padrões de horário (com ou sem "às")
      .replace(/\b(às|as|a)?\s*\d{1,2}(:\d{2})?\s*(h|horas?|pm|am)?\b/gi, '')
      // Remove TODOS os números isolados que podem ser horários
      .replace(/\b\d{1,2}\b(?!\s*\/)/g, '')
      // Remove horários por extenso (ex: "oito e meia", "sete e quinze", "nove e quarenta e cinco")
      .replace(/\b(uma|duas|dois|três|tres|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|treze|catorze|quatorze|quinze|dezesseis|dezessete|dezoito|dezenove|vinte|vinte e uma|vinte e duas|vinte e três|vinte e tres)\s+e\s+(meia|quinze|minutos?|vinte|vinte e cinco|trinta|quarenta|quarenta e cinco|cinquenta|cinquenta e cinco)\b/gi, '')
      // Remove TODOS os dias da semana
      .replace(/\b(amanhã|amanha|hoje|ontem|segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo)(-feira)?\b/gi, '')
      // Remove TODOS os períodos do dia
      .replace(/\b(da\s+manhã|da\s+tarde|da\s+noite|de\s+manhã|de\s+tarde|de\s+noite)\b/gi, '')
      // Remove TODAS as datas
      .replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/gi, '')
      // Remove "dia" isolado
      .replace(/\bdia\b/gi, '')
      // Remove múltiplos espaços e trim
      .replace(/\s+/g, ' ')
      .trim();

  let cleanTitle = limparTitulo(text);

  // Limpeza adicional
  const temporalPatterns = [
    /\b(próxima|proxima|que\s+vem)\b/gi,
    /\b(depois|antes|agora|já|ainda)\b/gi
  ];

  for (const pattern of temporalPatterns) {
    cleanTitle = cleanTitle.replace(pattern, ' ');
  }

  // Limpeza final mais rigorosa
  cleanTitle = cleanTitle
    .replace(/\s+/g, ' ')
    .replace(/^\s*(o|a|os|as|um|uma|no|na|em|de|da|do|às|as|para|pra)\s+/i, '')
    .replace(/\s+(no|na|em|de|da|do|às|as|para|pra)\s*$/i, '')
    .replace(/^\s*(e|com|sem|por)\s+/i, '')
    .trim()
    .replace(/^./, char => char.toUpperCase());

  // Aplicar limpezaFinalNomeEvento duas vezes para garantir remoção de "amanhã"
  cleanTitle = limpezaFinalNomeEvento(cleanTitle);
  cleanTitle = limpezaFinalNomeEvento(cleanTitle);

  // Limpeza extra de espaços
  cleanTitle = cleanTitle.replace(/\s+/g, ' ').trim();

  if (cleanTitle.length > 2) {
    const finalTitle = limpezaFinalNomeEvento(cleanTitle).replace(/\s+/g, ' ').trim();
    console.log(`[extractEventTitle][FINAL] Título extraído: "${finalTitle}" para input: "${text}"`);
    return finalTitle;
  }

  // Se a limpeza não funcionou bem, usar fallbacks específicos
  const specificPatterns = [
    { regex: /reunião\s+com\s+([^,\s]+(?:\s+[^,\s]+)*)/i, format: (match: string) => `Reunião com ${match}` },
    { regex: /consulta\s+(?:com\s+)?(?:dr\.?\s+|dra\.?\s+)?([^,\s]+(?:\s+[^,\s]+)*)/i, format: (match: string) => `Consulta Dr. ${match}` },
    { regex: /aniversário\s+(?:do\s+|da\s+)?([^,\s]+(?:\s+[^,\s]+)*)/i, format: (match: string) => `Aniversário ${match}` }
  ];

  for (const pattern of specificPatterns) {
    const match = textLower.match(pattern.regex);
    if (match && match[1]) {
      const result = pattern.format(match[1].trim());
      const finalTitle = limpezaFinalNomeEvento(result.charAt(0).toUpperCase() + result.slice(1)).replace(/\s+/g, ' ').trim();
      console.log(`[extractEventTitle][FINAL] Título extraído: "${finalTitle}" para input: "${text}"`);
      return finalTitle;
    }
  }

  // Novo padrão genérico para '(.+) com (.+)' (ex: 'jantar com o Gabriel amanhã')
  const genericWithPattern = /(.+?)\s+com\s+(.+)/i;
  const genericWithMatch = text.match(genericWithPattern);
  if (genericWithMatch) {
    // Extrai a parte antes e depois do 'com'
    let before = genericWithMatch[1].trim();
    let after = genericWithMatch[2].trim();
    // Limpa palavras temporais de ambas as partes
    before = limpezaFinalNomeEvento(before).replace(/\s+/g, ' ').trim();
    after = limpezaFinalNomeEvento(after).replace(/\s+/g, ' ').trim();
    // Reconstrói e faz a limpeza final no resultado completo
    let finalTitle = `${before} com ${after}`.replace(/\s+/g, ' ').trim();
    finalTitle = limpezaFinalNomeEvento(finalTitle).replace(/\s+/g, ' ').trim();
    console.log(`[extractEventTitle][FINAL] Título extraído: "${finalTitle}" para input: "${text}"`);
    return finalTitle;
  }

  // Extrair após verbos de ação (mais rigoroso)
  const actionVerbs = [
    /(?:me\s+)?lembre?\s+de\s+(.+?)(?:\s+(?:hoje|amanhã|segunda|terça|quarta|quinta|sexta|sábado|domingo|às|na|no)|\s*$)/i,
    /marque?\s+(?:um\s+|uma\s+)?(.+?)(?:\s+(?:hoje|amanhã|segunda|terça|quarta|quinta|sexta|sábado|domingo|às|na|no)|\s*$)/i,
    /agende?\s+(.+?)(?:\s+(?:hoje|amanhã|segunda|terça|quarta|quinta|sexta|sábado|domingo|às|na|no)|\s*$)/i
  ];

  for (const verb of actionVerbs) {
    const match = text.match(verb);
    if (match && match[1]) {
      let extracted = match[1].trim();
      // Limpar novamente o que foi extraído
      extracted = extracted
        .replace(/^(um|uma|o|a|os|as)\s+/i, '')
        .replace(/\b(amanhã|amanha|hoje|ontem|segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo)(-feira)?\b/gi, '')
        .replace(/\b(às|as|a)\s*\d{1,2}(:\d{2})?\s*(h|horas?|pm|am)?\b/gi, '')
        .replace(/\b\d{1,2}(:\d{2})?\s*(h|horas?|pm|am)?\b/gi, '')
        .replace(/\b(da\s+manhã|da\s+tarde|da\s+noite|de\s+manhã|de\s+tarde|de\s+noite)\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (extracted.length > 2) {
        const finalTitle = limpezaFinalNomeEvento(extracted.charAt(0).toUpperCase() + extracted.slice(1)).replace(/\s+/g, ' ').trim();
        console.log(`[extractEventTitle][FINAL] Título extraído: "${finalTitle}" para input: "${text}"`);
        return finalTitle;
      }
    }
  }

  // Palavras-chave diretas
  const directKeywords = [
    'jantar', 'almoço', 'almoco', 'academia', 'trabalho', 'escola', 'aula',
    'compromisso', 'consulta', 'exame', 'reunião', 'reuniao', 'compras'
  ];

  for (const keyword of directKeywords) {
    if (textLower.includes(keyword)) {
      const finalTitle = limpezaFinalNomeEvento(keyword.charAt(0).toUpperCase() + keyword.slice(1)).replace(/\s+/g, ' ').trim();
      console.log(`[extractEventTitle][FINAL] Título extraído: "${finalTitle}" para input: "${text}"`);
      return finalTitle;
    }
  }

  // Fallback final mais rigoroso
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
  const finalTitle = limpezaFinalNomeEvento(cleaned.charAt(0).toUpperCase() + cleaned.slice(1) || 'Evento').replace(/\s+/g, ' ').trim();
  console.log(`[extractEventTitle][FINAL] Título extraído: "${finalTitle}" para input: "${text}"`);
  return finalTitle;
}

/**
 * Capitaliza primeira letra de uma string
 */
function capitalizeFirst(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Extrai apenas o nome do evento e a data/hora, removendo informações temporais do nome
 * Formato de resposta: { eventName: string, dateTime: string }
 * CÓPIA EXATA do Telegram
 */
export function extractEventInfo(
  input: string,
  userId: string,
  languageCode?: string
): { eventName: string; dateTime: string } {
  try {
    // Obter fuso horário do usuário
    const userTimezone = getUserTimezone(userId, languageCode);
    // Extrair data e hora primeiro
    const dateTimeResult = parseUserDateTime(input, userId, languageCode);
    // Extrair nome do evento usando a função exata do Telegram
    let eventName = extractEventTitle(input);
    // Se não conseguiu extrair data/hora, retornar apenas o nome limpo
    if (!dateTimeResult) {
      return {
        eventName: eventName,
        dateTime: "Não especificado"
      };
    }
    // Converter ISO para formato DD/MM/AAAA HH:MM
    const dateTime = DateTime.fromISO(dateTimeResult.iso, { zone: userTimezone });
    const formattedDateTime = dateTime.toFormat('dd/MM/yyyy HH:mm');
    return {
      eventName: eventName,
      dateTime: formattedDateTime
    };
  } catch (error) {
    return {
      eventName: extractEventTitle(input),
      dateTime: "Não especificado"
    };
  }
}

function limpezaFinalNomeEvento(nome: string): string {
  let resultado = nome;
  // MÚLTIPLAS PASSADAS DE LIMPEZA PARA GARANTIR QUE NADA TEMPORAL SOBREVIVA
  // Passada 0: Remove padrões compostos tipo 'daqui dois sábados', 'daqui 2 sábados', 'daqui a dois dias', 'em 3 dias', etc.
  resultado = resultado.replace(/\b(daqui\s+(a\s+)?(\d+|um|uma|dois|duas|três|tres|quatro|cinco|seis|sete|oito|nove|dez)\s+(dias?|semanas?|meses?|anos?|segundos?|minutos?|horas?|s[áa]bados?|domingos?|segundas?|terças?|tercas?|quartas?|quintas?|sextas?))\b/gi, '');
  resultado = resultado.replace(/\b(em\s+(\d+|um|uma|dois|duas|três|tres|quatro|cinco|seis|sete|oito|nove|dez)\s+(dias?|semanas?|meses?|anos?|segundos?|minutos?|horas?|s[áa]bados?|domingos?|segundas?|terças?|tercas?|quartas?|quintas?|sextas?))\b/gi, '');
  // Passada 1: Remove TODAS as palavras temporais (incluindo variações)
  resultado = resultado.replace(/\b(amanhã|amanha|hoje|ontem|segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo|de manhã|da manhã|de tarde|da tarde|de noite|da noite|próxima|proxima|que vem|depois|antes|agora|já|ainda|manhã|tarde|noite)\b/gi, '');
  // Passada extra: Remove palavras temporais no final, início ou entre pontuação
  resultado = resultado.replace(/(amanhã|amanha|hoje|ontem|segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo|de manhã|da manhã|de tarde|da tarde|de noite|da noite|próxima|proxima|que vem|depois|antes|agora|já|ainda|manhã|tarde|noite)[\s,.!?]*$/gi, '');
  // Passada 2: Remove TODOS os padrões de horário e datas
  resultado = resultado.replace(/\b(às|as|a|hora|horário|horarios|h|hs|am|pm)\b/gi, '');
  resultado = resultado.replace(/\b\d{1,2}(:\d{2})?\s*(h|horas?|pm|am)?\b/gi, '');
  resultado = resultado.replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/gi, '');
  // Passada 3: Remove "dia" isolado e outras palavras temporais
  resultado = resultado.replace(/\bdia\b/gi, '');
  // Passada 4: Remove artigos e preposições soltas
  resultado = resultado.replace(/(^|\s)(o|a|os|as|um|uma|no|na|em|de|da|do|às|as|para|pra)(?=\s|$)/gi, ' ');
  // Passada 5: Remove pontuações e barras soltas
  resultado = resultado.replace(/[\/|,.;:]+/g, ' ');
  // Passada 6: Remove múltiplos espaços e trim
  resultado = resultado.replace(/\s+/g, ' ').trim();
  // Passada 7: Primeira letra maiúscula
  resultado = resultado.replace(/^./, char => char.toUpperCase());
  return resultado;
}

