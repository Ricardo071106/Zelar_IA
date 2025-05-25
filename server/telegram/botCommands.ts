import { Telegraf } from 'telegraf';
import { addEmailConfigCommand } from './emailCommand';
import { log } from '../vite';
import { storage } from '../storage';
import { listEventsForDeletion, deleteCalendarEvent } from './deleteEvent';

/**
 * Função para adicionar comando de apagar eventos
 */
function addDeleteCommand(bot: Telegraf) {
  // Comando para apagar eventos
  bot.command('apagar', async (ctx) => {
    try {
      const telegramId = ctx.from.id.toString();
      const user = await storage.getUserByTelegramId(telegramId);
      
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

/**
 * Adiciona todos os comandos ao bot
 * 
 * @param bot Instância do bot do Telegram
 */
export function addBotCommands(bot: Telegraf) {
  // Adiciona comando de exclusão de eventos
  addDeleteCommand(bot);
  addEmailConfigCommand(bot);
  
  // Comando para exibir ajuda e informações sobre o bot
  bot.command('ajuda', async (ctx) => {
    try {
      await ctx.reply(
        '🤖 *Zelar Assistente - Comandos Disponíveis*\n\n' +
        '✏️ Para criar um evento, basta me enviar uma mensagem como:\n' +
        '_"Agendar reunião com João amanhã às 15h"_\n\n' +
        '📝 *Comandos disponíveis:*\n\n' +
        '• /apagar - Excluir um evento\n' +
        '• /email - Alterar seu email para receber convites\n' +
        '• /configurar_email - (Admin) Configurar email remetente\n' +
        '• /ajuda - Mostrar esta mensagem de ajuda\n\n' +
        '📅 Seus eventos serão salvos e você receberá lembretes no Telegram.',
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      log(`Erro ao exibir ajuda: ${error}`, 'telegram');
    }
  });
  
  // Comando para alterar o email do usuário
  bot.command('email', async (ctx) => {
    try {
      const message = ctx.message.text.trim();
      const parts = message.split(' ');
      
      if (parts.length < 2) {
        await ctx.reply(
          '📧 *Configuração de Email*\n\n' +
          'Para alterar seu email, envie o comando:\n' +
          '/email seu@email.com\n\n' +
          'Este email será usado para receber convites de calendário.',
          { parse_mode: 'Markdown' }
        );
        return;
      }
      
      const email = parts[1].trim();
      
      // Validação simples de email
      if (!email.includes('@') || !email.includes('.')) {
        await ctx.reply('❌ Email inválido. Por favor, forneça um email válido.');
        return;
      }
      
      // Obter o ID do usuário no Telegram
      const telegramId = ctx.from.id.toString();
      
      // Atualizar o email do usuário no banco de dados
      const user = await storage.getUserByTelegramId(telegramId);
      
      if (!user) {
        await ctx.reply('❌ Usuário não encontrado. Por favor, inicie uma conversa comigo primeiro.');
        return;
      }
      
      // Atualizar o email do usuário
      await storage.updateUser(user.id, { email });
      
      await ctx.reply(
        `✅ *Email atualizado com sucesso!*\n\n` +
        `Seu email foi configurado como: ${email}\n\n` +
        `Você receberá os convites de calendário neste email.`,
        { parse_mode: 'Markdown' }
      );
      
    } catch (error) {
      log(`Erro ao atualizar email do usuário: ${error}`, 'telegram');
      await ctx.reply('❌ Ocorreu um erro ao atualizar seu email. Por favor, tente novamente mais tarde.');
    }
  });
}