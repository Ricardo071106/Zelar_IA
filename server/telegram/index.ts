import { startBot } from './bot';
import { setupReminderScheduler } from './scheduler';
import { log } from '../vite';

/**
 * Inicializa o bot do Telegram e o agendador de lembretes
 */
export async function initializeTelegramBot() {
  try {
    // Inicia o bot do Telegram
    const botStarted = await startBot();
    
    if (!botStarted) {
      log('Falha ao iniciar o bot do Telegram', 'telegram');
      return false;
    }
    
    // Configura o agendador de lembretes
    const scheduler = setupReminderScheduler();
    
    log('Bot do Telegram e agendador de lembretes inicializados com sucesso', 'telegram');
    return true;
  } catch (error) {
    log(`Erro ao inicializar o bot do Telegram: ${error}`, 'telegram');
    return false;
  }
}