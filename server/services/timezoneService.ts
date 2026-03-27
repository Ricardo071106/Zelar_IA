
import { DateTime } from 'luxon';
import { getUserTimezone } from './dateService';

// Regex para detectar padrões de horário em português
const TIME_PATTERNS = [
  { pattern: /às\s+(\d{1,2})\s*da\s+noite/gi, type: 'noite' },        // "às 7 da noite"
  { pattern: /às\s+(\d{1,2})\s*da\s+tarde/gi, type: 'tarde' },        // "às 3 da tarde" 
  { pattern: /às\s+(\d{1,2})\s*da\s+manhã/gi, type: 'manha' },        // "às 8 da manhã"
  { pattern: /às\s+(\d{1,2})\s*horas?/gi, type: 'neutral' },          // "às 19 horas"
  { pattern: /às\s+(\d{1,2})h/gi, type: 'neutral' },                  // "às 9h"
  { pattern: /às\s+(\d{1,2})\s*pm/gi, type: 'pm' },                   // "às 7pm"
  { pattern: /às\s+(\d{1,2})\s*am/gi, type: 'am' },                   // "às 9am"
];

/**
 * Interpreta horário local conforme o fuso do usuário
 */
export function parseLocalTime(text: string, userId: string, languageCode?: string): { hour: number; minute: number; timezone: string } | null {
  const userTimezone = getUserTimezone(userId, languageCode);

  // Se o usuário não tem timezone configurado explicitamente, getUserTimezone retorna um padrão ou detectado.
  // No código original, ele retornava null se o usuário não tivesse configurado.
  // Mas aqui vamos assumir que queremos tentar interpretar sempre que possível usando o timezone do dateService.
  // POREM, o comportamento original do bot era: "se não tem userTimezone no map, retorna null" para forçar config.
  // Aqui, o getUserTimezone sempre retorna algo.
  // Vamos manter a lógica: se quisermos forçar, teremos que checar se é padrão?
  // O original usava `userTimezones.get(userId)`.

  // Vamos assumir que essa função retorna o horário SE encontrar o padrão.
  // A verificação de "precisa configurar fuso" pode ser feita fora ou adaptada.

  if (!userTimezone) {
    return null;
  }

  for (const { pattern, type } of TIME_PATTERNS) {
    pattern.lastIndex = 0; // Reset regex
    const match = pattern.exec(text);
    if (match) {
      let hour = parseInt(match[1]);
      const minute = 0; // Por simplicidade, assumindo minutos = 0

      // Ajustar horário baseado no contexto
      if (type === 'noite' && hour < 12) {
        hour += 12; // "7 da noite" = 19h
      } else if (type === 'tarde' && hour < 12) {
        hour += 12; // "3 da tarde" = 15h
      } else if (type === 'pm' && hour < 12) {
        hour += 12; // "7pm" = 19h
      }
      // "am" e "manhã" mantém o horário como está (0-11)

      return { hour, minute, timezone: userTimezone };
    }
  }

  return null;
}

/**
 * Formata horário no fuso do usuário
 */
export function formatLocalTime(hour: number, minute: number, timezone: string): string {
  const now = DateTime.now().setZone(timezone);
  const targetTime = now.set({ hour, minute, second: 0, millisecond: 0 });
  const locationName = timezone.split('/')[1]?.replace('_', ' ') || timezone;

  return `${targetTime.toFormat('HH:mm')} no horário de ${locationName}`;
}

export { TIME_PATTERNS };
