import { Telegraf } from 'telegraf';
import { log } from '../vite';
import { listEventsForDeletion, deleteCalendarEvent } from './deleteEvent';

/**
 * Adiciona o comando /apagar ao bot
 * 
 * @param bot Instância do bot do Telegram
 */
export function addDeleteCommand(bot: Telegraf) {
  // Comando para apagar eventos
  bot.command('apagar', async (ctx) => {
    try {
      const telegramId = ctx.from.id.toString();
      const user = await ctx.telegram.getChat(telegramId);
      
      if (!user) {
        await ctx.reply('Usuário não encontrado. Por favor, inicie o bot com /start');
        return;
      }
      
      // Lista eventos para o usuário escolher qual apagar
      const result = await listEventsForDeletion(Number(telegramId));
      
      if (!result.success) {
        await ctx.reply(result.message);
        return;
      }
      
      // Envia mensagem com botões para escolher qual evento apagar
      await ctx.reply(result.message, {
        reply_markup: result.keyboard
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log(`Erro ao processar comando apagar: ${errorMessage}`, 'telegram');
      await ctx.reply('Ocorreu um erro ao listar seus eventos. Por favor, tente novamente mais tarde.');
    }
  });
  
  // Tratamento de callbacks para apagar eventos
  bot.action(/delete_event:(\d+)/, async (ctx) => {
    try {
      const eventId = parseInt(ctx.match[1]);
      const telegramId = ctx.from.id.toString();
      
      // Confirma se o usuário realmente quer apagar o evento
      await ctx.reply(`Tem certeza que deseja apagar este evento?`, {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Sim, apagar', callback_data: `confirm_delete:${eventId}` },
              { text: '❌ Não, cancelar', callback_data: 'cancel_delete' }
            ]
          ]
        }
      });
      
      // Responde ao callback para evitar o ícone de carregamento
      await ctx.answerCbQuery();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log(`Erro ao processar callback de exclusão: ${errorMessage}`, 'telegram');
      await ctx.reply('Ocorreu um erro ao processar sua solicitação. Por favor, tente novamente.');
      await ctx.answerCbQuery();
    }
  });
  
  // Confirmação de exclusão
  bot.action(/confirm_delete:(\d+)/, async (ctx) => {
    try {
      const eventId = parseInt(ctx.match[1]);
      const telegramId = ctx.from.id.toString();
      
      // Apaga o evento
      const result = await deleteCalendarEvent(eventId, Number(telegramId));
      
      if (result.success) {
        await ctx.reply(`✅ Evento apagado com sucesso!`);
      } else if (result.requiresAuth && result.authUrl) {
        // Se precisar de autenticação, envia link
        await ctx.reply(`❗ ${result.message}`, {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔐 Autorizar Google Calendar', url: result.authUrl }]
            ]
          }
        });
      } else {
        await ctx.reply(`❌ ${result.message}`);
      }
      
      // Responde ao callback para evitar o ícone de carregamento
      await ctx.answerCbQuery();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log(`Erro ao confirmar exclusão: ${errorMessage}`, 'telegram');
      await ctx.reply('Ocorreu um erro ao apagar o evento. Por favor, tente novamente.');
      await ctx.answerCbQuery();
    }
  });
  
  // Cancelamento de exclusão
  bot.action('cancel_delete', async (ctx) => {
    await ctx.reply('Exclusão cancelada.');
    await ctx.answerCbQuery();
  });
}