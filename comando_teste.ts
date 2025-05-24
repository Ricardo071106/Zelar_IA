import { Telegraf } from 'telegraf';
import { storage } from './server/storage';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { log } from './server/vite';

// Certifique-se de que o token do bot está disponível
if (!process.env.TELEGRAM_BOT_TOKEN) {
  throw new Error('TELEGRAM_BOT_TOKEN não está definido no ambiente');
}

// Cria uma instância do bot
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Função auxiliar para obter o usuário pelo ID do Telegram
async function findUserByTelegramId(telegramId: string) {
  try {
    const user = await storage.getUserByTelegramId(telegramId);
    return user;
  } catch (error) {
    log(`Erro ao buscar usuário pelo Telegram ID: ${error}`, 'telegram');
    return null;
  }
}

// Comando de teste para listar todos os eventos
bot.command('listar', async (ctx) => {
  try {
    const telegramId = ctx.from.id.toString();
    const user = await findUserByTelegramId(telegramId);
    
    if (!user) {
      await ctx.reply('Usuário não encontrado. Por favor, inicie o bot com /start');
      return;
    }
    
    // Busca TODOS os eventos sem filtro
    const eventos = await storage.getEventsByUserId(user.id);
    
    if (!eventos || eventos.length === 0) {
      await ctx.reply('Você não tem nenhum evento cadastrado no banco de dados.');
      return;
    }
    
    let message = '🔍 *Seus eventos:*\n\n';
    
    // Mostra todos os eventos
    for (const evento of eventos) {
      try {
        const data = new Date(evento.startDate);
        message += `📝 *${evento.title}*\n`;
        message += `📅 Data: ${data.toLocaleString('pt-BR')}\n`;
        
        if (evento.location) {
          message += `📍 Local: ${evento.location}\n`;
        }
        
        message += '\n';
      } catch (error) {
        message += `📝 *${evento.title}*\n`;
        message += `⚠️ Data não disponível\n\n`;
      }
    }
    
    await ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (error) {
    log(`Erro ao listar eventos: ${error}`, 'telegram');
    await ctx.reply(`Erro ao listar eventos: ${error.message}`);
  }
});

// Inicia o bot
export async function iniciarBot() {
  try {
    await bot.launch();
    log('Bot de teste iniciado', 'telegram');
    return true;
  } catch (error) {
    log(`Erro ao iniciar bot de teste: ${error}`, 'telegram');
    return false;
  }
}

// Função para parar o bot
export function pararBot() {
  bot.stop();
  log('Bot de teste parado', 'telegram');
}