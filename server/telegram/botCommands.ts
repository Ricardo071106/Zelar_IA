import { Telegraf } from 'telegraf';
import { log } from '../vite';

/**
 * Função para adicionar comando de apagar eventos
 */
function addDeleteCommand(bot: Telegraf) {
  bot.command('apagar', async (ctx) => {
    try {
      await ctx.reply('🔧 Funcionalidade em desenvolvimento!\n\nEm breve você poderá apagar eventos criados.');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log(`Erro no comando apagar: ${errorMessage}`, 'telegram');
      await ctx.reply('❌ Ocorreu um erro. Por favor, tente novamente.');
    }
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
  
  // Comando para exibir ajuda e informações sobre o bot
  bot.command('ajuda', async (ctx) => {
    try {
      await ctx.reply(
        '🤖 *Zelar - Seu Assistente de Calendário*\n\n' +
        '🎯 *Como usar:*\n' +
        '✏️ Para criar um evento, basta me enviar uma mensagem como:\n' +
        '_"Agendar reunião com João amanhã às 15h"_\n\n' +
        '📝 *Comandos disponíveis:*\n\n' +
        '• /apagar - Excluir um evento\n' +
        '• /ajuda - Mostrar esta mensagem de ajuda\n\n' +
        '📅 Seus eventos serão salvos e você receberá lembretes no Telegram.',
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      log(`Erro ao exibir ajuda: ${error}`, 'telegram');
    }
  });
  
  // Comando de início/boas-vindas
  bot.command('start', async (ctx) => {
    try {
      await ctx.reply(
        '🎉 *Bem-vindo ao Zelar!*\n\n' +
        '🤖 Sou seu assistente pessoal para criar eventos no calendário.\n\n' +
        '💡 *Como funciona:*\n' +
        'Simplesmente me envie uma mensagem descrevendo seu evento em português, como:\n\n' +
        '• "Reunião com cliente amanhã às 14h"\n' +
        '• "Dentista na sexta-feira às 10h"\n' +
        '• "Festa de aniversário sábado às 19h"\n\n' +
        '🎯 Eu interpreto sua mensagem e crio um evento com links para Google Calendar e Outlook!\n\n' +
        'Digite /ajuda para ver todos os comandos disponíveis.',
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      log(`Erro ao exibir mensagem de boas-vindas: ${error}`, 'telegram');
    }
  });
}