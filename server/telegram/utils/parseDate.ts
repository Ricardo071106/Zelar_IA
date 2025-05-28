import * as chrono from 'chrono-node';
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
    
    // Tentar primeiro com preprocessamento para português
    const processedInput = preprocessPortugueseInput(input);
    
    // Usar chrono-node para interpretar a data/hora
    const parseResults = chrono.parse(processedInput, new Date(), { forwardDate: true });
    
    if (parseResults.length === 0) {
      console.log(`❌ Chrono não conseguiu interpretar: "${input}"`);
      return null;
    }
    
    // Pegar o primeiro resultado do chrono
    const chronoResult = parseResults[0];
    const parsedDate = chronoResult.start.date();
    
    console.log(`📅 Chrono interpretou como: ${parsedDate.toISOString()}`);
    
    // Converter para o fuso horário do usuário usando Luxon
    const userDateTime = DateTime.fromJSDate(parsedDate, { zone: 'UTC' })
      .setZone(userTimezone);
    
    // Gerar os dois formatos
    const iso = userDateTime.toISO()!;
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