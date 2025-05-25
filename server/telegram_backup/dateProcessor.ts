import { log } from '../vite';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Processa datas em mensagens de texto em português
 * Utilitário para extrair datas de mensagens como "próxima sexta às 10h"
 */
export function processDate(text: string): Date {
  const today = new Date();
  let resultDate = new Date();
  const textoLower = text.toLowerCase();
  
  // Próximos dias da semana
  if (textoLower.includes("próxima segunda") || textoLower.includes("proxima segunda")) {
    // Encontra a próxima segunda-feira
    resultDate.setDate(today.getDate() + (8 - today.getDay()) % 7);
    log(`Data calculada: próxima segunda-feira`, 'date');
  } else if (textoLower.includes("próxima terça") || textoLower.includes("proxima terca")) {
    // Encontra a próxima terça-feira
    resultDate.setDate(today.getDate() + (9 - today.getDay()) % 7);
    log(`Data calculada: próxima terça-feira`, 'date');
  } else if (textoLower.includes("próxima quarta") || textoLower.includes("proxima quarta")) {
    // Encontra a próxima quarta-feira
    resultDate.setDate(today.getDate() + (10 - today.getDay()) % 7);
    log(`Data calculada: próxima quarta-feira`, 'date');
  } else if (textoLower.includes("próxima quinta") || textoLower.includes("proxima quinta")) {
    // Encontra a próxima quinta-feira
    resultDate.setDate(today.getDate() + (11 - today.getDay()) % 7);
    log(`Data calculada: próxima quinta-feira`, 'date');
  } else if (textoLower.includes("próxima sexta") || textoLower.includes("proxima sexta")) {
    // Encontra a próxima sexta-feira
    resultDate.setDate(today.getDate() + (12 - today.getDay()) % 7);
    log(`Data calculada: próxima sexta-feira`, 'date');
  } else if (textoLower.includes("próximo sábado") || textoLower.includes("proximo sabado")) {
    // Encontra o próximo sábado
    resultDate.setDate(today.getDate() + (13 - today.getDay()) % 7);
    log(`Data calculada: próximo sábado`, 'date');
  } else if (textoLower.includes("próximo domingo") || textoLower.includes("proximo domingo")) {
    // Encontra o próximo domingo
    resultDate.setDate(today.getDate() + (14 - today.getDay()) % 7);
    log(`Data calculada: próximo domingo`, 'date');
  } else if (textoLower.includes("amanhã") || textoLower.includes("amanha")) {
    // Define para amanhã
    resultDate = addDays(today, 1);
    log(`Data calculada: amanhã`, 'date');
  } else {
    // Se não encontrou uma data específica, define para amanhã por padrão
    resultDate = addDays(today, 1);
    log(`Nenhuma data específica encontrada, usando amanhã como padrão`, 'date');
  }
  
  // Define a hora mencionada ou padrão
  if (textoLower.includes("10h") || textoLower.includes("10:00") || 
      textoLower.includes("às 10") || textoLower.includes("as 10")) {
    resultDate.setHours(10, 0, 0, 0);
    log(`Horário: 10:00`, 'date');
  } else if (textoLower.includes("15h") || textoLower.includes("15:00") || 
             textoLower.includes("às 15") || textoLower.includes("as 15") || 
             textoLower.includes("3 da tarde")) {
    resultDate.setHours(15, 0, 0, 0);
    log(`Horário: 15:00`, 'date');
  } else {
    resultDate.setHours(10, 0, 0, 0); // Hora padrão
    log(`Nenhum horário específico encontrado, usando 10:00 como padrão`, 'date');
  }
  
  log(`Data final calculada: ${resultDate.toISOString()}`, 'date');
  return resultDate;
}

/**
 * Formata uma data para exibição em português
 */
export function formatBrazilianDate(date: Date): string {
  return format(date, "EEEE, dd 'de' MMMM 'às' HH:mm", { locale: ptBR });
}