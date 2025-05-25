import { storage } from '../storage';
import { log } from '../vite';
import { Telegraf } from 'telegraf';

export function addTestCommands(bot: Telegraf) {
  // Comando de teste para verificar todos os eventos cadastrados
  bot.command('testar', async (ctx) => {
    try {
      const telegramId = ctx.from.id.toString();
      log(`Comando de teste recebido de ${telegramId}`, 'telegram');
      
      // Tenta obter o usuário diretamente pelo ID do Telegram
      const user = await storage.getUserByTelegramId(telegramId);
      
      if (!user) {
        log(`Usuário não encontrado para Telegram ID: ${telegramId}`, 'telegram');
        await ctx.reply('Usuário não encontrado. Por favor, inicie o bot com /start');
        return;
      }
      
      log(`Usuário encontrado com ID: ${user.id}`, 'telegram');
      
      // Busca todos os eventos diretamente do banco de dados
      const eventos = await storage.getEventsByUserId(user.id);
      log(`Total de eventos encontrados: ${eventos.length}`, 'telegram');
      
      if (eventos.length === 0) {
        await ctx.reply('Você não tem nenhum evento cadastrado. Tente criar um evento primeiro.');
        return;
      }
      
      // Cria a mensagem com lista de eventos
      let message = '📋 *Lista completa de seus eventos:*\n\n';
      
      // Adiciona cada evento à mensagem, com formatação simples
      for (const evento of eventos) {
        const data = new Date(evento.startDate);
        
        message += `*ID ${evento.id}: ${evento.title}*\n`;
        message += `📅 Data: ${data.toLocaleString('pt-BR')}\n`;
        
        if (evento.location) {
          message += `📍 Local: ${evento.location}\n`;
        }
        
        message += '\n';
      }
      
      // Envia a mensagem formatada
      await ctx.reply(message, { parse_mode: 'Markdown' });
      log('Lista de teste de eventos enviada com sucesso', 'telegram');
      
    } catch (error) {
      log(`Erro ao executar comando de teste: ${error}`, 'telegram');
      await ctx.reply(`Ocorreu um erro no comando de teste: ${error}`);
    }
  });
}