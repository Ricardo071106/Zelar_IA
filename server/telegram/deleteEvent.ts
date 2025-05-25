import { log } from '../vite';
import { cancelGoogleCalendarEvent } from './googleCalendarIntegration';
import { storage } from '../storage';

/**
 * Apaga um evento do Google Calendar
 * 
 * @param eventId ID do evento no banco de dados
 * @param userId ID do usuário
 * @returns Resultado da operação
 */
export async function deleteCalendarEvent(eventId: number, userId: number): Promise<{
  success: boolean;
  message: string;
  requiresAuth?: boolean;
  authUrl?: string;
}> {
  try {
    // Verifica se o evento existe
    const event = await storage.getEvent(eventId);
    if (!event) {
      return {
        success: false,
        message: 'Evento não encontrado'
      };
    }
    
    // Verifica se o evento pertence ao usuário
    if (event.userId !== userId) {
      return {
        success: false,
        message: 'Você não tem permissão para apagar este evento'
      };
    }
    
    // Se tiver ID do Google Calendar, tenta apagar do Google Calendar
    if (event.calendarId) {
      try {
        const googleResult = await cancelGoogleCalendarEvent(event.calendarId, userId);
        if (!googleResult.success) {
          // Se for problema de autenticação
          if (googleResult.message.includes('autenticação') || googleResult.message.includes('autorize')) {
            const authUrl = `https://${process.env.REPL_SLUG}.${process.env.REPLIT_DOMAINS}/api/auth/google?userId=${userId}`;
            return {
              success: false,
              message: googleResult.message,
              requiresAuth: true,
              authUrl
            };
          }
          
          log(`Erro ao apagar evento do Google Calendar: ${googleResult.message}`, 'google');
        } else {
          log(`Evento apagado do Google Calendar: ${event.title}`, 'google');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log(`Erro ao tentar apagar evento do Google Calendar: ${errorMessage}`, 'google');
      }
    }
    
    // Apaga o evento do banco de dados
    const deleted = await storage.deleteEvent(eventId);
    
    if (!deleted) {
      return {
        success: false,
        message: 'Não foi possível apagar o evento'
      };
    }
    
    return {
      success: true,
      message: 'Evento apagado com sucesso'
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Erro ao apagar evento: ${errorMessage}`, 'telegram');
    
    return {
      success: false,
      message: `Erro ao apagar evento: ${errorMessage}`
    };
  }
}

/**
 * Lista os eventos do usuário para escolher qual apagar
 * 
 * @param userId ID do usuário
 * @returns Lista de eventos com botões para apagar
 */
export async function listEventsForDeletion(userId: number): Promise<{
  success: boolean;
  message: string;
  keyboard?: any;
}> {
  try {
    // Busca eventos do usuário
    const events = await storage.getEventsByUserId(userId);
    
    if (!events || events.length === 0) {
      return {
        success: false,
        message: 'Você não tem eventos cadastrados'
      };
    }
    
    // Cria teclado inline com eventos
    const keyboard = {
      inline_keyboard: events.map(event => {
        const date = new Date(event.startDate);
        const formattedDate = date.toLocaleDateString('pt-BR', { 
          day: '2-digit', 
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        
        return [{
          text: `${event.title} (${formattedDate})`,
          callback_data: `delete_event:${event.id}`
        }];
      })
    };
    
    return {
      success: true,
      message: 'Selecione o evento que deseja apagar:',
      keyboard
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Erro ao listar eventos para exclusão: ${errorMessage}`, 'telegram');
    
    return {
      success: false,
      message: `Erro ao listar eventos: ${errorMessage}`
    };
  }
}