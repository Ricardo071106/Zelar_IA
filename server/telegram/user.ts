import { storage } from "../storage";
import { log } from "../vite";

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
}

/**
 * Cria um novo usuário a partir de um usuário do Telegram
 */
export async function createUserIfNotExists(telegramUser: TelegramUser) {
  try {
    // Verifica se o usuário já existe
    const existingUser = await storage.getUserByTelegramId(telegramUser.id.toString());
    if (existingUser) {
      log(`Usuário já existe: ${existingUser.username || existingUser.telegramId}`, 'telegram');
      return existingUser;
    }

    // Cria um nome de usuário único baseado no ID do Telegram
    const username = telegramUser.username || `telegram_${telegramUser.id}`;
    
    // Gera uma senha aleatória para autenticação na API (se necessário)
    const password = Math.random().toString(36).substring(2, 15);
    
    // Cria o usuário no banco de dados
    const newUser = await storage.createUser({
      username,
      password,
      telegramId: telegramUser.id.toString(),
      name: [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(' '),
    });

    log(`Novo usuário criado: ${newUser.username}`, 'telegram');
    return newUser;
  } catch (error) {
    log(`Erro ao criar usuário: ${error}`, 'telegram');
    throw new Error(`Falha ao criar usuário: ${error}`);
  }
}

/**
 * Encontra ou cria um usuário pelo ID do Telegram
 */
export async function findOrCreateUserByTelegramId(telegramId: string) {
  try {
    const existingUser = await storage.getUserByTelegramId(telegramId);
    if (existingUser) {
      return existingUser;
    }
    
    // Se não encontrar o usuário, precisamos de mais informações
    // Normalmente, isso não deveria acontecer, pois o usuário
    // deve ter iniciado o bot antes de enviar mensagens
    log(`Usuário não encontrado para telegramId: ${telegramId}`, 'telegram');
    
    // Cria um usuário temporário para não quebrar o fluxo
    const username = `telegram_${telegramId}`;
    const password = Math.random().toString(36).substring(2, 15);
    
    const newUser = await storage.createUser({
      username,
      password,
      telegramId,
      name: `Usuário Telegram ${telegramId}`,
    });
    
    log(`Usuário temporário criado: ${newUser.username}`, 'telegram');
    return newUser;
  } catch (error) {
    log(`Erro ao buscar/criar usuário: ${error}`, 'telegram');
    throw new Error(`Falha ao buscar/criar usuário: ${error}`);
  }
}