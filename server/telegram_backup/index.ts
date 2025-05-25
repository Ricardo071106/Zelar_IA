import { startLlamaBot } from './llamaBot';
import { log } from '../vite';

/**
 * Inicializa o bot do Telegram usando o modelo Llama
 */
export async function initializeTelegramBot() {
  try {
    // Inicia o bot do Telegram com Llama
    const botStarted = await startLlamaBot();
    
    if (!botStarted) {
      log('Falha ao iniciar o bot do Telegram', 'telegram');
      return false;
    }
    
    log('Bot do Telegram com Llama inicializado com sucesso', 'telegram');
    return true;
  } catch (error) {
    log(`Erro ao inicializar o bot do Telegram: ${error}`, 'telegram');
    return false;
  }
}