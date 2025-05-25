import ical from 'ical-generator';
import * as fs from 'fs';
import * as path from 'path';
import { log } from '../vite';
import { Event } from '@shared/schema';

// Diretório para armazenar os arquivos de calendário
const CALENDAR_DIR = path.join(process.cwd(), 'calendar_files');

// Garante que o diretório de calendário exista
if (!fs.existsSync(CALENDAR_DIR)) {
  fs.mkdirSync(CALENDAR_DIR, { recursive: true });
  log(`Diretório de calendário criado: ${CALENDAR_DIR}`, 'calendar');
}

/**
 * Cria um arquivo ICS para um evento que pode ser importado no Apple Calendar
 * 
 * @param event O evento a ser adicionado ao calendário
 * @param userEmail Email do usuário para configurar o calendário
 * @returns Informações sobre o arquivo criado
 */
export async function createICalEvent(event: Event, userEmail: string): Promise<{ 
  success: boolean; 
  filePath?: string;
  calendarId?: string;
  message: string;
}> {
  try {
    // Cria um novo calendário
    const calendar = ical({
      name: 'Zelar Assistant Calendar',
      timezone: 'America/Sao_Paulo',
      prodId: { company: 'zelar', product: 'calendar-assistant' },
      scale: 'gregorian'
    });
    
    // Gera um ID único para o evento
    const eventId = `event-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    // Verifica se temos datas válidas
    if (!event.startDate) {
      return {
        success: false,
        message: 'A data de início do evento é obrigatória'
      };
    }
    
    const startDate = new Date(event.startDate);
    if (isNaN(startDate.getTime())) {
      return {
        success: false,
        message: 'A data de início do evento é inválida'
      };
    }
    
    let endDate: Date;
    if (event.endDate) {
      endDate = new Date(event.endDate);
      if (isNaN(endDate.getTime())) {
        // Se a data de término for inválida, definimos como 1 hora após o início
        endDate = new Date(startDate);
        endDate.setHours(endDate.getHours() + 1);
      }
    } else {
      // Se não tiver data de término, definimos como 1 hora após o início
      endDate = new Date(startDate);
      endDate.setHours(endDate.getHours() + 1);
    }
    
    // Adiciona o evento ao calendário
    calendar.createEvent({
      id: eventId,
      start: startDate,
      end: endDate,
      summary: event.title,
      description: event.description || '',
      location: event.location || '',
      organizer: {
        name: 'Zelar Assistant',
        email: 'assistant@zelar.com'
      },
      attendees: [
        {
          name: userEmail.split('@')[0],
          email: userEmail,
          rsvp: true
        }
      ]
    });
    
    // Gera um nome de arquivo único para o evento
    const fileName = `${event.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${Date.now()}.ics`;
    const filePath = path.join(CALENDAR_DIR, fileName);
    
    // Salva o arquivo ICS
    await fs.promises.writeFile(filePath, calendar.toString());
    
    log(`Arquivo ICS criado: ${filePath}`, 'calendar');
    
    return {
      success: true,
      filePath,
      calendarId: eventId,
      message: `Evento criado com sucesso! Arquivo ICS disponível para download.`
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Erro ao criar arquivo ICS: ${errorMessage}`, 'calendar');
    return {
      success: false,
      message: `Erro ao criar arquivo ICS: ${errorMessage}`
    };
  }
}

/**
 * Gera um link de download para o arquivo ICS de um evento
 * 
 * @param event O evento para o qual gerar o link
 * @param userEmail Email do usuário para configurar o calendário
 * @returns Informações sobre o link gerado
 */
export async function generateCalendarLink(event: Event, userEmail: string): Promise<{
  success: boolean;
  downloadLink?: string;
  calendarId?: string;
  message: string;
}> {
  try {
    // Cria o arquivo ICS
    const icsResult = await createICalEvent(event, userEmail);
    
    if (!icsResult.success) {
      return {
        success: false,
        message: icsResult.message
      };
    }
    
    // Gera um link de download relativo (que precisa ser transformado em URL completa)
    if (!icsResult.filePath) {
      return {
        success: false,
        message: "Falha ao gerar o arquivo ICS: caminho do arquivo não disponível"
      };
    }
    
    const downloadPath = icsResult.filePath.replace(process.cwd(), '');
    const downloadLink = `/download${downloadPath}`;
    
    return {
      success: true,
      downloadLink,
      calendarId: icsResult.calendarId,
      message: `Link de calendário gerado com sucesso! Use este link para adicionar ao seu Apple Calendar.`
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Erro ao gerar link de calendário: ${errorMessage}`, 'calendar');
    return {
      success: false,
      message: `Erro ao gerar link de calendário: ${errorMessage}`
    };
  }
}

/**
 * Obtém o caminho do arquivo ICS para um evento
 * 
 * @param fileName Nome do arquivo ICS
 * @returns Caminho completo para o arquivo
 */
export function getICalFilePath(fileName: string): string {
  return path.join(CALENDAR_DIR, fileName);
}

/**
 * Exclui um arquivo ICS
 * 
 * @param fileName Nome do arquivo ICS
 * @returns Informações sobre a exclusão
 */
export async function deleteICalFile(fileName: string): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    const filePath = getICalFilePath(fileName);
    
    if (!fs.existsSync(filePath)) {
      return {
        success: false,
        message: `Arquivo não encontrado: ${fileName}`
      };
    }
    
    await fs.promises.unlink(filePath);
    
    log(`Arquivo ICS excluído: ${filePath}`, 'calendar');
    
    return {
      success: true,
      message: `Arquivo ICS excluído com sucesso!`
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Erro ao excluir arquivo ICS: ${errorMessage}`, 'calendar');
    return {
      success: false,
      message: `Erro ao excluir arquivo ICS: ${errorMessage}`
    };
  }
}