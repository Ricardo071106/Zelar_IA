import { startSimplifiedBot } from './simplifiedBot';
import { log } from '../vite';

/**
 * Inicializa o bot do Telegram simplificado
 */
export async function initializeTelegramBot() {
  try {
    // Inicia o bot simplificado do Telegram
    const botStarted = await startSimplifiedBot();
    
    if (!botStarted) {
      log('Falha ao iniciar o bot do Telegram', 'telegram');
      return false;
    }
    
    log('Bot simplificado do Telegram inicializado com sucesso', 'telegram');
    return true;
  } catch (error) {
    log(`Erro ao inicializar o bot do Telegram: ${error}`, 'telegram');
    return false;
  }
}