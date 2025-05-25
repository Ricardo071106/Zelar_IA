import { Telegraf } from 'telegraf';
// As funções de exclusão estão diretamente no arquivo deleteEvent.ts
import { addEmailConfigCommand } from './emailCommand';
import { log } from '../vite';
import { storage } from '../storage';

/**
 * Adiciona todos os comandos ao bot
 * 
 * @param bot Instância do bot do Telegram
 */
export function addBotCommands(bot: Telegraf) {
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