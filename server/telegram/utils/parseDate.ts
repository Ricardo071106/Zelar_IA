import { DateTime } from 'luxon';

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
 * Define o fuso horário para um usuário específico
 */
export function setUserTimezone(userId: string, timezone: string): boolean {
  try {
    // Validar se o fuso horário é válido
    DateTime.now().setZone(timezone);
    userTimezones.set(userId, timezone);
    console.log(`🌍 Fuso horário definido para usuário ${userId}: ${timezone}`);
    return true;
  } catch (error) {
    console.error(`❌ Fuso horário inválido: ${timezone}`);
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
 * Função auxiliar para interpretar expressões em português que o chrono pode não entender
 */
function preprocessPortugueseInput(input: string): string {
  let processed = input.toLowerCase().trim();
  
  // Substituições para melhorar interpretação do chrono
  const replacements: { [key: string]: string } = {
    'amanhã': 'tomorrow',
    'amanha': 'tomorrow',
    'hoje': 'today',
    'ontem': 'yesterday',
    'próxima': 'next',
    'proxima': 'next',
    'que vem': 'next',
    'da manhã': 'AM',
    'da manha': 'AM',
    'da tarde': 'PM',
    'da noite': 'PM',
    'às': 'at',
    'as': 'at',
    'segunda': 'monday',
    'terça': 'tuesday',
    'terca': 'tuesday',
    'quarta': 'wednesday',
    'quinta': 'thursday',
    'sexta': 'friday',
    'sábado': 'saturday',
    'sabado': 'saturday',
    'domingo': 'sunday'
  };
  
  // Aplicar substituições
  Object.entries(replacements).forEach(([pt, en]) => {
    const regex = new RegExp(`\\b${pt}\\b`, 'gi');
    processed = processed.replace(regex, en);
  });
  
  console.log(`🔄 Preprocessado: "${input}" → "${processed}"`);
  return processed;
}

/**
 * Função principal para interpretar datas com fuso horário do usuário
 */
export function parseUserDateTime(
  input: string, 
  userId: string, 
  languageCode?: string
): { iso: string; readable: string } | null {
  try {
    console.log(`🔍 Analisando "${input}" para usuário ${userId}`);
    
    // Obter fuso horário do usuário
    const userTimezone = getUserTimezone(userId, languageCode);
    
    // Usar parser customizado para português
    const parsedDateTime = parsePortugueseDateTime(input, userTimezone);
    
    if (!parsedDateTime) {
      console.log(`❌ Não conseguiu interpretar: "${input}"`);
      return null;
    }
    
    console.log(`📅 Interpretado como: ${parsedDateTime.toISO()}`);
    
    // Gerar os dois formatos
    const iso = parsedDateTime.toISO()!;
    const readable = parsedDateTime.setLocale('pt-BR').toFormat('cccc, dd \'de\' LLLL \'às\' HH:mm');
    
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
 * Parser customizado para datas em português
 */
function parsePortugueseDateTime(input: string, timezone: string): DateTime | null {
  const text = input.toLowerCase().trim();
  
  // Obter data base
  const dateInfo = extractDateInfo(text);
  const timeInfo = extractTimeInfo(text);
  
  if (!dateInfo) {
    return null;
  }
  
  // Criar DateTime no fuso especificado
  let baseDateTime = DateTime.now().setZone(timezone);
  
  // Aplicar a data extraída
  if (dateInfo.type === 'relative') {
    baseDateTime = baseDateTime.plus({ days: dateInfo.daysOffset });
  } else if (dateInfo.type === 'weekday') {
    baseDateTime = getNextWeekday(baseDateTime, dateInfo.weekday, dateInfo.isNext);
  }
  
  // Aplicar o horário (padrão: 9:00 se não especificado)
  const hour = timeInfo?.hour ?? 9;
  const minute = timeInfo?.minute ?? 0;
  
  return baseDateTime.set({ 
    hour, 
    minute, 
    second: 0, 
    millisecond: 0 
  });
}

/**
 * Extrai informações de data do texto
 */
function extractDateInfo(input: string): { type: 'relative' | 'weekday', daysOffset?: number, weekday?: number, isNext?: boolean } | null {
  // Expressões relativas
  if (/\b(hoje)\b/.test(input)) {
    return { type: 'relative', daysOffset: 0 };
  }
  if (/\b(amanhã|amanha)\b/.test(input)) {
    return { type: 'relative', daysOffset: 1 };
  }
  
  // Dias da semana
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

/**
 * Extrai informações de horário do texto
 */
function extractTimeInfo(input: string): { hour: number, minute: number } | null {
  // Formato HH:MM
  const timeMatch1 = input.match(/\b(\d{1,2}):(\d{2})\b/);
  if (timeMatch1) {
    return { hour: parseInt(timeMatch1[1]), minute: parseInt(timeMatch1[2]) };
  }
  
  // Formato HHh ou HHhMM
  const timeMatch2 = input.match(/\b(\d{1,2})h(\d{2})?\b/);
  if (timeMatch2) {
    return { hour: parseInt(timeMatch2[1]), minute: parseInt(timeMatch2[2] || '0') };
  }
  
  // Formato só número com "às"
  const timeMatch3 = input.match(/\bàs?\s+(\d{1,2})\b/);
  if (timeMatch3) {
    return { hour: parseInt(timeMatch3[1]), minute: 0 };
  }
  
  // Número sozinho no final
  const timeMatch4 = input.match(/\b(\d{1,2})\s*$/);
  if (timeMatch4) {
    return { hour: parseInt(timeMatch4[1]), minute: 0 };
  }
  
  // Expressões como "sete da noite"
  const wordNumbers: { [key: string]: number } = {
    'uma': 1, 'dois': 2, 'três': 3, 'tres': 3, 'quatro': 4, 'cinco': 5,
    'seis': 6, 'sete': 7, 'oito': 8, 'nove': 9, 'dez': 10,
    'onze': 11, 'doze': 12
  };
  
  for (const [word, number] of Object.entries(wordNumbers)) {
    if (new RegExp(`\\b${word}\\b`).test(input)) {
      let hour = number;
      
      // Ajustar para período da tarde/noite
      if (/\b(da tarde|de tarde|da noite|de noite)\b/.test(input) && hour < 12) {
        hour += 12;
      }
      
      return { hour, minute: 0 };
    }
  }
  
  return null;
}

/**
 * Encontra o próximo dia da semana
 */
function getNextWeekday(baseDate: DateTime, targetWeekday: number, isNext: boolean = false): DateTime {
  const currentWeekday = baseDate.weekday;
  
  let daysToAdd = targetWeekday - currentWeekday;
  
  if (isNext || daysToAdd <= 0) {
    daysToAdd += 7;
  }
  
  return baseDate.plus({ days: daysToAdd });
}