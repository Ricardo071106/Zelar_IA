import { addDays, format, nextMonday, nextTuesday, nextWednesday, nextThursday, nextFriday, nextSaturday, nextSunday } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Processa uma string de texto em português e extrai informações de data mencionadas
 * Particularmente útil para frases como "próxima segunda" ou "amanhã às 15h"
 * 
 * @param text O texto a ser analisado
 * @returns Uma data calculada baseada no texto ou undefined se não for possível extrair
 */
export function extractDateFromText(text: string): Date | undefined {
  const textoLower = text.toLowerCase();
  let resultDate = new Date();
  let dateFound = false;
  
  // Próximos dias da semana
  if (textoLower.includes("próxima segunda") || textoLower.includes("proxima segunda")) {
    resultDate = nextMonday(new Date());
    dateFound = true;
  } else if (textoLower.includes("próxima terça") || textoLower.includes("proxima terca")) {
    resultDate = nextTuesday(new Date());
    dateFound = true;
  } else if (textoLower.includes("próxima quarta") || textoLower.includes("proxima quarta")) {
    resultDate = nextWednesday(new Date());
    dateFound = true;
  } else if (textoLower.includes("próxima quinta") || textoLower.includes("proxima quinta")) {
    resultDate = nextThursday(new Date());
    dateFound = true;
  } else if (textoLower.includes("próxima sexta") || textoLower.includes("proxima sexta")) {
    resultDate = nextFriday(new Date());
    dateFound = true;
  } else if (textoLower.includes("próximo sábado") || textoLower.includes("proximo sabado")) {
    resultDate = nextSaturday(new Date());
    dateFound = true;
  } else if (textoLower.includes("próximo domingo") || textoLower.includes("proximo domingo")) {
    resultDate = nextSunday(new Date());
    dateFound = true;
  } else if (textoLower.includes("amanhã") || textoLower.includes("amanha")) {
    resultDate = addDays(new Date(), 1);
    dateFound = true;
  } else if (textoLower.includes("hoje")) {
    // Já está configurado para hoje
    dateFound = true;
  }
  
  // Se uma data foi encontrada, define a hora
  if (dateFound) {
    // Define horário padrão para 9h da manhã
    resultDate.setHours(9, 0, 0, 0);
    
    // Sobrescreve com horário específico se mencionado
    if (textoLower.includes("10h") || textoLower.includes("10:00") || 
        textoLower.includes("às 10") || textoLower.includes("as 10")) {
      resultDate.setHours(10, 0, 0, 0);
    } else if (textoLower.includes("11h") || textoLower.includes("11:00") || 
              textoLower.includes("às 11") || textoLower.includes("as 11")) {
      resultDate.setHours(11, 0, 0, 0);
    } else if (textoLower.includes("12h") || textoLower.includes("12:00") || 
              textoLower.includes("às 12") || textoLower.includes("as 12") || 
              textoLower.includes("meio dia")) {
      resultDate.setHours(12, 0, 0, 0);
    } else if (textoLower.includes("13h") || textoLower.includes("13:00") || 
              textoLower.includes("às 13") || textoLower.includes("as 13") || 
              textoLower.includes("1 da tarde")) {
      resultDate.setHours(13, 0, 0, 0);
    } else if (textoLower.includes("14h") || textoLower.includes("14:00") || 
              textoLower.includes("às 14") || textoLower.includes("as 14") || 
              textoLower.includes("2 da tarde")) {
      resultDate.setHours(14, 0, 0, 0);
    } else if (textoLower.includes("15h") || textoLower.includes("15:00") || 
              textoLower.includes("às 15") || textoLower.includes("as 15") || 
              textoLower.includes("3 da tarde")) {
      resultDate.setHours(15, 0, 0, 0);
    } else if (textoLower.includes("16h") || textoLower.includes("16:00") || 
              textoLower.includes("às 16") || textoLower.includes("as 16") || 
              textoLower.includes("4 da tarde")) {
      resultDate.setHours(16, 0, 0, 0);
    } else if (textoLower.includes("17h") || textoLower.includes("17:00") || 
              textoLower.includes("às 17") || textoLower.includes("as 17") || 
              textoLower.includes("5 da tarde")) {
      resultDate.setHours(17, 0, 0, 0);
    } else if (textoLower.includes("18h") || textoLower.includes("18:00") || 
              textoLower.includes("às 18") || textoLower.includes("as 18") || 
              textoLower.includes("6 da tarde")) {
      resultDate.setHours(18, 0, 0, 0);
    } else if (textoLower.includes("19h") || textoLower.includes("19:00") || 
              textoLower.includes("às 19") || textoLower.includes("as 19") || 
              textoLower.includes("7 da noite")) {
      resultDate.setHours(19, 0, 0, 0);
    } else if (textoLower.includes("20h") || textoLower.includes("20:00") || 
              textoLower.includes("às 20") || textoLower.includes("as 20") || 
              textoLower.includes("8 da noite")) {
      resultDate.setHours(20, 0, 0, 0);
    }
    
    return resultDate;
  }
  
  // Se não encontrou nenhuma data específica, retorna undefined
  return undefined;
}

/**
 * Formata uma data para exibição amigável em português
 * 
 * @param date A data para formatar
 * @returns String formatada (ex: "segunda-feira, 26 de maio às 10:00")
 */
export function formatDateForDisplay(date: Date): string {
  return format(date, "EEEE, dd 'de' MMMM 'às' HH:mm", { locale: ptBR });
}