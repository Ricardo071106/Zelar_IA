/**
 * Parser simples de eventos em português brasileiro
 * 
 * Este módulo implementa um parser de texto natural para extrair informações
 * de eventos sem depender de serviços externos de IA
 */

import { format, parse, addDays, nextDay, addWeeks, setHours, setMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Interface de evento resultante
export interface ParsedEvent {
  title: string;
  startDate: Date;
  endDate?: Date;
  location?: string;
  description?: string;
}

// Interface de resultado do parser
export interface ParserResult {
  success: boolean;
  event?: ParsedEvent;
  message?: string;
}

// Expressões regulares para extrair informações
const EVENT_PATTERNS = [
  // Padrão geral: "Reunião com fulano na segunda às 15h no escritório"
  /(?:agendar|marcar|lembrar(?:\s+de)?)\s+(.+?)(?:\s+(?:na|no|em|para|com)\s+(.+?))?(?:\s+(?:em|na|no|para|dia)\s+(hoje|amanhã|segunda|terça|quarta|quinta|sexta|sábado|domingo|segunda[- ]feira|terça[- ]feira|quarta[- ]feira|quinta[- ]feira|sexta[- ]feira|sábado|domingo|\d{1,2}\/\d{1,2}))?(?:\s+(?:às|as|em|para)\s+(\d{1,2})[h:]\s*(\d{1,2})?\s*(?:horas)?)?(?:\s+(?:em|no|na)\s+(.+))?/i,
  
  // Padrão simples: "Agendar reunião amanhã às 15h"
  /(?:agendar|marcar|lembrar(?:\s+de)?)\s+(.+?)(?:\s+para\s+)?(hoje|amanhã|segunda|terça|quarta|quinta|sexta|sábado|domingo|segunda[- ]feira|terça[- ]feira|quarta[- ]feira|quinta[- ]feira|sexta[- ]feira|sábado|domingo|\d{1,2}\/\d{1,2})(?:\s+(?:às|as|em)\s+(\d{1,2})[h:]\s*(\d{1,2})?\s*(?:horas)?)?(?:\s+(?:em|no|na)\s+(.+))?/i,
  
  // Padrão com "próxima": "Reunião na próxima segunda às 10h"
  /(?:agendar|marcar|lembrar(?:\s+de)?)\s+(.+?)(?:\s+(?:para|na|no)\s+)(?:próxima?|próximo)\s+(segunda|terça|quarta|quinta|sexta|sábado|domingo|segunda[- ]feira|terça[- ]feira|quarta[- ]feira|quinta[- ]feira|sexta[- ]feira|sábado|domingo)(?:\s+(?:às|as|em)\s+(\d{1,2})[h:]\s*(\d{1,2})?\s*(?:horas)?)?(?:\s+(?:em|no|na)\s+(.+))?/i,
  
  // Padrão com data explícita: "Reunião dia 15/06 às 14h"
  /(?:agendar|marcar|lembrar(?:\s+de)?)\s+(.+?)(?:\s+(?:para|no|em))?\s+(?:dia|data)?\s+(\d{1,2}\/\d{1,2})(?:\s+(?:às|as|em)\s+(\d{1,2})[h:]\s*(\d{1,2})?\s*(?:horas)?)?(?:\s+(?:em|no|na)\s+(.+))?/i
];

// Mapear dias da semana em português para inglês
const WEEKDAYS: Record<string, number> = {
  'domingo': 0,
  'segunda': 1,
  'segunda-feira': 1,
  'segunda feira': 1,
  'terça': 2,
  'terça-feira': 2, 
  'terça feira': 2,
  'quarta': 3,
  'quarta-feira': 3,
  'quarta feira': 3,
  'quinta': 4,
  'quinta-feira': 4,
  'quinta feira': 4,
  'sexta': 5,
  'sexta-feira': 5,
  'sexta feira': 5,
  'sábado': 6,
  'sabado': 6
};

/**
 * Extrai informações de evento a partir de texto em português
 * 
 * @param text Texto contendo informações do evento
 * @returns Resultado do parser
 */
export function parseEventText(text: string): ParserResult {
  // Normalizar texto
  const normalizedText = text.toLowerCase().trim()
    .replace(/á/g, 'a')
    .replace(/à/g, 'a')
    .replace(/â/g, 'a')
    .replace(/ã/g, 'a')
    .replace(/é/g, 'e')
    .replace(/ê/g, 'e')
    .replace(/í/g, 'i')
    .replace(/ó/g, 'o')
    .replace(/ô/g, 'o')
    .replace(/õ/g, 'o')
    .replace(/ú/g, 'u')
    .replace(/ç/g, 'c');
  
  // Verificar padrões conhecidos
  for (const pattern of EVENT_PATTERNS) {
    const match = normalizedText.match(pattern);
    
    if (match) {
      try {
        // Título do evento
        const title = match[1]?.trim() || 'Evento';
        
        // Data de início (hoje como padrão)
        let startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        
        // Extrair informações de data
        let dateText = null;
        for (let i = 2; i < match.length; i++) {
          const part = match[i]?.toLowerCase();
          if (!part) continue;
          
          if (part === 'hoje') {
            // Hoje - manter a data atual
            break;
          } else if (part === 'amanha' || part === 'amanhã') {
            // Amanhã
            startDate = addDays(startDate, 1);
            break;
          } else if (Object.prototype.hasOwnProperty.call(WEEKDAYS, part)) {
            // Dia da semana
            const targetDay = WEEKDAYS[part as keyof typeof WEEKDAYS];
            const currentDay = startDate.getDay();
            
            if (normalizedText.includes('proxima') || normalizedText.includes('proximo')) {
              // Próxima semana
              startDate = addWeeks(addDays(startDate, (targetDay + 7 - startDate.getDay()) % 7), 1);
            } else {
              // Esta semana ou próxima
              if (targetDay <= currentDay) {
                // Se o dia já passou nesta semana, vai para a próxima
                startDate = addDays(startDate, targetDay + 7 - currentDay);
              } else {
                // Dia ainda não passou nesta semana
                startDate = addDays(startDate, targetDay - currentDay);
              }
            }
            break;
          } else if (part.includes('/')) {
            // Data explícita no formato DD/MM
            try {
              const [day, month] = part.split('/').map(Number);
              const currentYear = startDate.getFullYear();
              
              startDate = new Date(currentYear, month - 1, day);
              
              // Se a data já passou este ano, assume o próximo ano
              if (startDate < new Date()) {
                startDate.setFullYear(currentYear + 1);
              }
            } catch (error) {
              console.error('Erro ao processar data:', error);
            }
            break;
          }
        }
        
        // Extrair informações de hora
        for (let i = 2; i < match.length; i++) {
          const part = match[i];
          if (!part) continue;
          
          // Verificar se é um número que representa hora
          const hourMatch = part.match(/^(\d{1,2})$/);
          if (hourMatch) {
            const hour = parseInt(hourMatch[1], 10);
            if (hour >= 0 && hour <= 23) {
              startDate = setHours(startDate, hour);
              
              // Verificar se há minutos no próximo grupo
              const minutesPart = match[i+1];
              if (minutesPart && /^\d{1,2}$/.test(minutesPart)) {
                const minutes = parseInt(minutesPart, 10);
                if (minutes >= 0 && minutes <= 59) {
                  startDate = setMinutes(startDate, minutes);
                }
              } else {
                startDate = setMinutes(startDate, 0);
              }
            }
          }
        }
        
        // Definir horário padrão se não foi especificado (9h)
        if (startDate.getHours() === 0 && startDate.getMinutes() === 0) {
          startDate = setHours(startDate, 9);
          startDate = setMinutes(startDate, 0);
        }
        
        // Calcular data de término (1 hora por padrão)
        const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
        
        // Extrair local (último grupo que não é nenhum dos anteriores)
        let location = undefined;
        for (let i = match.length - 1; i >= 0; i--) {
          const part = match[i];
          if (part && 
              !part.match(/^\d{1,2}$/) && 
              !part.match(/^\d{1,2}\/\d{1,2}$/) && 
              !['hoje', 'amanha', 'amanhã'].includes(part.toLowerCase()) && 
              !Object.keys(WEEKDAYS).includes(part.toLowerCase())) {
            
            // Verificar se não é o título
            if (part.toLowerCase() !== title.toLowerCase()) {
              location = part.trim();
              break;
            }
          }
        }
        
        // Montar o evento
        const event: ParsedEvent = {
          title,
          startDate,
          endDate,
          location
        };
        
        return {
          success: true,
          event
        };
      } catch (error) {
        console.error('Erro ao processar texto:', error);
      }
    }
  }
  
  // Se chegou aqui, não conseguiu extrair informações de evento
  return {
    success: false,
    message: 'Não consegui identificar um evento na sua mensagem. Tente ser mais específico, por exemplo: "Agendar reunião com João amanhã às 15h"'
  };
}