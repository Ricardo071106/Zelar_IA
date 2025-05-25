import { storage } from '../storage';
import { log } from '../vite';

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
    
    // Busca todos os eventos passados
    const pastEvents = await storage.getPastEvents(now);
    
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
        await storage.deleteEvent(event.id);
        successCount++;
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