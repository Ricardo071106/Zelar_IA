import { storage } from '../storage';
import { log } from '../vite';
import { InsertEvent, InsertReminder } from '@shared/schema';

/**
 * Cria um novo evento no banco de dados
 */
export async function createEvent(eventData: InsertEvent) {
  try {
    const event = await storage.createEvent(eventData);
    log(`Evento criado: ${event.title}`, 'telegram');
    return event;
  } catch (error) {
    log(`Erro ao criar evento: ${error}`, 'telegram');
    throw new Error(`Falha ao criar evento: ${error}`);
  }
}

/**
 * Cancela um evento e seus lembretes
 */
export async function cancelEvent(eventId: number): Promise<boolean> {
  try {
    // Primeiro, tenta cancelar o evento no calendário externo
    try {
      const { cancelEventFromCalendar } = await import('./calendar');
      await cancelEventFromCalendar(eventId);
    } catch (error) {
      log(`Aviso: Não foi possível cancelar o evento no calendário externo: ${error}`, 'telegram');
      // Continua mesmo se a sincronização falhar
    }
    
    // Agora, exclui o evento do banco de dados (isso também remove os lembretes)
    const deleted = await storage.deleteEvent(eventId);
    
    if (deleted) {
      log(`Evento ${eventId} cancelado com sucesso`, 'telegram');
    } else {
      log(`Evento ${eventId} não encontrado para cancelamento`, 'telegram');
    }
    
    return deleted;
  } catch (error) {
    log(`Erro ao cancelar evento: ${error}`, 'telegram');
    throw new Error(`Falha ao cancelar evento: ${error}`);
  }
}

/**
 * Cria um novo lembrete para um evento
 */
export async function createReminder(reminderData: InsertReminder) {
  try {
    const reminder = await storage.createReminder(reminderData);
    log(`Lembrete criado para o evento ${reminderData.eventId}`, 'telegram');
    return reminder;
  } catch (error) {
    log(`Erro ao criar lembrete: ${error}`, 'telegram');
    throw new Error(`Falha ao criar lembrete: ${error}`);
  }
}

/**
 * Busca eventos futuros para um usuário
 */
export async function getFutureEvents(userId: number) {
  try {
    const events = await storage.getEventsByUserId(userId);
    
    // Filtra apenas eventos futuros
    const now = new Date();
    const futureEvents = events.filter(event => {
      const eventDate = new Date(event.startDate);
      return eventDate > now;
    });
    
    // Ordena por data (do mais próximo para o mais distante)
    futureEvents.sort((a, b) => {
      const dateA = new Date(a.startDate);
      const dateB = new Date(b.startDate);
      return dateA.getTime() - dateB.getTime();
    });
    
    return futureEvents;
  } catch (error) {
    log(`Erro ao buscar eventos futuros: ${error}`, 'telegram');
    throw new Error(`Falha ao buscar eventos futuros: ${error}`);
  }
}

/**
 * Busca todos os eventos para um usuário (passados e futuros)
 */
export async function getAllEvents(userId: number) {
  try {
    const events = await storage.getEventsByUserId(userId);
    
    // Ordena por data (do mais recente para o mais antigo)
    events.sort((a, b) => {
      const dateA = new Date(a.startDate);
      const dateB = new Date(b.startDate);
      return dateB.getTime() - dateA.getTime(); // Ordem inversa para mostrar mais recentes primeiro
    });
    
    return events;
  } catch (error) {
    log(`Erro ao buscar todos os eventos: ${error}`, 'telegram');
    throw new Error(`Falha ao buscar todos os eventos: ${error}`);
  }
}

/**
 * Busca eventos para um dia específico
 */
export async function getEventsForDay(userId: number, date: Date) {
  try {
    const events = await storage.getEventsByUserId(userId);
    
    // Filtra eventos para o dia especificado
    const filteredEvents = events.filter(event => {
      const eventDate = new Date(event.startDate);
      return (
        eventDate.getFullYear() === date.getFullYear() &&
        eventDate.getMonth() === date.getMonth() &&
        eventDate.getDate() === date.getDate()
      );
    });
    
    // Ordena por hora
    filteredEvents.sort((a, b) => {
      const timeA = new Date(a.startDate).getTime();
      const timeB = new Date(b.startDate).getTime();
      return timeA - timeB;
    });
    
    return filteredEvents;
  } catch (error) {
    log(`Erro ao buscar eventos para o dia: ${error}`, 'telegram');
    throw new Error(`Falha ao buscar eventos para o dia: ${error}`);
  }
}

/**
 * Busca eventos para a semana atual (a partir de hoje até 7 dias)
 */
export async function getEventsForWeek(userId: number) {
  try {
    const events = await storage.getEventsByUserId(userId);
    const now = new Date();
    
    // Define o início e fim da semana
    const startOfWeek = new Date(now);
    const endOfWeek = new Date(now);
    endOfWeek.setDate(now.getDate() + 7); // 7 dias a partir de hoje
    
    // Filtra eventos para a semana
    const weekEvents = events.filter(event => {
      const eventDate = new Date(event.startDate);
      return eventDate >= startOfWeek && eventDate < endOfWeek;
    });
    
    // Ordena por data
    weekEvents.sort((a, b) => {
      const dateA = new Date(a.startDate);
      const dateB = new Date(b.startDate);
      return dateA.getTime() - dateB.getTime();
    });
    
    return weekEvents;
  } catch (error) {
    log(`Erro ao buscar eventos da semana: ${error}`, 'telegram');
    throw new Error(`Falha ao buscar eventos da semana: ${error}`);
  }
}

/**
 * Busca lembretes pendentes para envio
 */
export async function getPendingReminders() {
  try {
    const now = new Date();
    const reminders = await storage.getPendingReminders(now);
    
    return reminders;
  } catch (error) {
    log(`Erro ao buscar lembretes pendentes: ${error}`, 'telegram');
    throw new Error(`Falha ao buscar lembretes pendentes: ${error}`);
  }
}

/**
 * Marca um lembrete como enviado
 */
export async function markReminderAsSent(reminderId: number) {
  try {
    await storage.updateReminderStatus(reminderId, 'sent');
    log(`Lembrete ${reminderId} marcado como enviado`, 'telegram');
    return true;
  } catch (error) {
    log(`Erro ao marcar lembrete como enviado: ${error}`, 'telegram');
    return false;
  }
}