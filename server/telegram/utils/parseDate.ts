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
    
    // Estratégia híbrida: extrair hora primeiro, depois data com o horário
    const timeResult = extractTimeFromText(input);
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
      return DateTime.now().setZone(userTimezone).plus({ days: 1 }).startOf('day').toJSDate();
    }
    
    // Fallback: usar chrono-node para outros casos
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
 * Extrai horário usando parser customizado (mais preciso para português)
 */
function extractTimeFromText(input: string): { hour: number, minute: number } | null {
  const text = input.toLowerCase().trim();
  
  // 1. Formato numérico: 19h, 19:30, etc.
  const numericMatch = text.match(/\b(\d{1,2})(?::(\d{2}))?h?\b/);
  if (numericMatch) {
    const hour = parseInt(numericMatch[1]);
    const minute = parseInt(numericMatch[2] || '0');
    console.log(`🕐 Formato numérico: ${hour}:${minute}`);
    return { hour, minute };
  }
  
  // 2. Formato "às X" 
  const atMatch = text.match(/\bàs?\s+(\d{1,2})\b/);
  if (atMatch) {
    const hour = parseInt(atMatch[1]);
    console.log(`🕐 Formato "às": ${hour}:00`);
    return { hour, minute: 0 };
  }
  
  // 3. Números por extenso
  const wordNumbers: { [key: string]: number } = {
    'uma': 1, 'dois': 2, 'três': 3, 'tres': 3, 'quatro': 4, 'cinco': 5,
    'seis': 6, 'sete': 7, 'oito': 8, 'nove': 9, 'dez': 10,
    'onze': 11, 'doze': 12, 'treze': 13, 'catorze': 14, 'quatorze': 14,
    'quinze': 15, 'dezesseis': 16, 'dezessete': 17, 'dezoito': 18,
    'dezenove': 19, 'vinte': 20, 'vinte e uma': 21, 'vinte e dois': 22,
    'vinte e três': 23, 'vinte e tres': 23
  };
  
  for (const [word, number] of Object.entries(wordNumbers)) {
    if (new RegExp(`\\b${word}\\b`).test(text)) {
      let hour = number;
      
      // Ajustar para período da tarde/noite
      if (/\b(da tarde|de tarde|da noite|de noite)\b/.test(text) && hour < 12) {
        hour += 12;
        console.log(`🌙 Ajuste noite: ${number} → ${hour}`);
      }
      
      console.log(`🕐 Por extenso: ${word} → ${hour}:00`);
      return { hour, minute: 0 };
    }
  }
  
  // 4. Formato PM/AM
  const pmMatch = text.match(/(\d{1,2})\s*pm/i);
  if (pmMatch) {
    let hour = parseInt(pmMatch[1]);
    if (hour < 12) hour += 12;
    console.log(`🕐 PM: ${hour}:00`);
    return { hour, minute: 0 };
  }
  
  const amMatch = text.match(/(\d{1,2})\s*am/i);
  if (amMatch) {
    let hour = parseInt(amMatch[1]);
    if (hour === 12) hour = 0;
    console.log(`🕐 AM: ${hour}:00`);
    return { hour, minute: 0 };
  }
  
  console.log(`❌ Nenhum horário encontrado em: "${input}"`);
  return null;
}

