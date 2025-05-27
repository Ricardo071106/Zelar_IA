import { DateTime } from 'luxon';

/**
 * Encontra o próximo dia da semana
 */
function getNextWeekday(baseDate: DateTime, targetWeekday: number, isNext: boolean = false): DateTime {
  const currentWeekday = baseDate.weekday;
  
  let daysToAdd = targetWeekday - currentWeekday;
  
  // Se é o mesmo dia da semana e queremos "próxima", adicionar uma semana
  if (isNext || daysToAdd <= 0) {
    daysToAdd += 7;
  }
  
  return baseDate.plus({ days: daysToAdd });
}

/**
 * Extrai informações de data do texto
 */
function extractDateInfo(input: string): { type: 'relative' | 'weekday', daysOffset?: number, weekday?: number, isNext?: boolean } | null {
  // Expressões relativas (hoje, amanhã, etc.)
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
  
  // Formato só número (assumir hora cheia)
  const timeMatch3 = input.match(/\bàs?\s+(\d{1,2})\b/);
  if (timeMatch3) {
    return { hour: parseInt(timeMatch3[1]), minute: 0 };
  }
  
  // Expressões como "sete da noite", "nove da manhã"
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
 * Função utilitária para interpretar datas e horários em português informal
 * 
 * @param input Texto em português com data/hora (ex: "quarta às sete da noite", "amanhã às 9")
 * @returns Data/hora no formato ISO 8601 com offset de São Paulo ou null se não conseguir interpretar
 */
export function parseBrazilianDateTime(input: string): string | null {
  try {
    console.log(`🔍 Analisando: "${input}"`);
    
    const normalizedInput = input.toLowerCase().trim();
    
    // Extrair informações de data e hora
    const dateInfo = extractDateInfo(normalizedInput);
    const timeInfo = extractTimeInfo(normalizedInput);
    
    if (!dateInfo) {
      console.log(`❌ Não foi possível extrair data de: "${input}"`);
      return null;
    }
    
    // Criar DateTime no fuso de São Paulo
    let baseDateTime = DateTime.now().setZone('America/Sao_Paulo');
    
    // Aplicar a data extraída
    if (dateInfo.type === 'relative' && dateInfo.daysOffset !== undefined) {
      baseDateTime = baseDateTime.plus({ days: dateInfo.daysOffset });
    } else if (dateInfo.type === 'weekday' && dateInfo.weekday !== undefined) {
      baseDateTime = getNextWeekday(baseDateTime, dateInfo.weekday, dateInfo.isNext);
    }
    
    // Aplicar o horário (padrão: 9:00 se não especificado)
    const hour = timeInfo?.hour ?? 9;
    const minute = timeInfo?.minute ?? 0;
    
    const finalDateTime = baseDateTime.set({ 
      hour, 
      minute, 
      second: 0, 
      millisecond: 0 
    });
    
    const isoString = finalDateTime.toISO();
    console.log(`✅ Interpretado "${input}" como: ${isoString}`);
    return isoString;
    
  } catch (error) {
    console.error(`❌ Erro ao interpretar "${input}":`, error);
    return null;
  }
}

/**
 * Função auxiliar para formatar data/hora para exibição amigável
 */
export function formatBrazilianDateTime(isoString: string): string {
  try {
    const dt = DateTime.fromISO(isoString);
    return dt.setLocale('pt-BR').toFormat('cccc, dd \'de\' LLLL \'às\' HH:mm');
  } catch (error) {
    return isoString;
  }
}