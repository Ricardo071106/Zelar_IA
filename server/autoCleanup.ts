import { storage } from './storage';
import { log } from './vite';
import { db } from './db';
import { lt, and, eq } from 'drizzle-orm';
import { events, reminders } from '@shared/schema';

/**
 * Remove eventos passados do banco de dados
 * 
 * Esta função é executada periodicamente para limpar eventos
 * que já aconteceram, evitando acúmulo de dados desnecessários
 */
export async function cleanupPastEvents(): Promise<{
  success: boolean;
  message: string;
  count?: number;
}> {
  try {
    const now = new Date();
    
    // Busca todos os eventos passados diretamente do banco de dados
    const pastEvents = await db.select().from(events).where(lt(events.startDate, now));
    
    if (pastEvents.length === 0) {
      return {
        success: true,
        message: 'Nenhum evento passado para excluir',
        count: 0
      };
    }
    
    // Exclui cada evento passado
    let successCount = 0;
    
    for (const event of pastEvents) {
      try {
        // Primeiro exclui todos os lembretes associados
        await db.delete(reminders).where(eq(reminders.eventId, event.id));
        
        // Depois exclui o evento
        await db.delete(events).where(eq(events.id, event.id));
        
        successCount++;
        log(`Evento passado excluído: ${event.title} (ID: ${event.id})`, 'cleanup');
      } catch (error) {
        log(`Erro ao excluir evento passado ${event.id}: ${error}`, 'cleanup');
      }
    }
    
    log(`Limpeza de eventos passados concluída: ${successCount}/${pastEvents.length} excluídos`, 'cleanup');
    
    return {
      success: true,
      message: `Limpeza de eventos passados concluída: ${successCount}/${pastEvents.length} excluídos`,
      count: successCount
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Erro ao limpar eventos passados: ${errorMessage}`, 'cleanup');
    
    return {
      success: false,
      message: `Erro ao limpar eventos passados: ${errorMessage}`
    };
  }
}