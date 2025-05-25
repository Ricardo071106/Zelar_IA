// Este arquivo é um adaptador para o bot simplificado
import { startSimpleBot } from "../simple_telegram_bot";

export async function initializeTelegramBot() {
  // Redireciona para o bot simplificado
  return await startSimpleBot();
}