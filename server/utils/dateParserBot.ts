import { Telegraf, Context } from 'telegraf';
import { parseBrazilianDateTime, formatBrazilianDateTime } from './dateParser';

/**
 * Bot de exemplo para demonstrar o uso da função de interpretação de datas
 */
export function createDateParserBot(token: string): Telegraf {
  const bot = new Telegraf(token);

  // Comando /interpretar - interpreta data/hora de uma mensagem
  bot.command('interpretar', async (ctx: Context) => {
    try {
      // Extrair o texto após o comando
      const message = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
      const userInput = message.replace('/interpretar', '').trim();
      
      if (!userInput) {
        await ctx.reply(
          '📅 *Como usar:*\n\n' +
          '`/interpretar quarta às sete da noite`\n' +
          '`/interpretar sexta que vem às 19h`\n' +
          '`/interpretar amanhã às 9`\n\n' +
          'Digite qualquer data/hora em português informal!',
          { parse_mode: 'Markdown' }
        );
        return;
      }

      // Usar nossa função para interpretar a data
      const parsedDateTime = parseBrazilianDateTime(userInput);
      
      if (parsedDateTime) {
        // Sucesso - mostrar resultado
        const friendlyFormat = formatBrazilianDateTime(parsedDateTime);
        
        await ctx.reply(
          `✅ *Entendi perfeitamente!*\n\n` +
          `📝 *Você disse:* "${userInput}"\n\n` +
          `📅 *Interpretei como:*\n${friendlyFormat}\n\n` +
          `🕐 *Formato ISO:*\n\`${parsedDateTime}\``,
          { parse_mode: 'Markdown' }
        );
      } else {
        // Erro - não conseguiu interpretar
        await ctx.reply(
          `❌ *Não consegui entender essa data/hora*\n\n` +
          `📝 *Você disse:* "${userInput}"\n\n` +
          `💡 *Tente algo como:*\n` +
          `• "amanhã às 15h"\n` +
          `• "segunda que vem às 9 da manhã"\n` +
          `• "sexta às sete da noite"\n` +
          `• "hoje às 18:30"`
        );
      }
    } catch (error) {
      console.error('Erro no comando /interpretar:', error);
      await ctx.reply('❌ Ocorreu um erro ao processar sua solicitação.');
    }
  });

  // Comando /teste - testa vários exemplos
  bot.command('teste', async (ctx: Context) => {
    const exemplos = [
      'amanhã às 9',
      'quarta às sete da noite',
      'sexta que vem às 19h',
      'segunda-feira às 14:30',
      'hoje às 18h',
      'próxima terça às 10 da manhã'
    ];

    let resultado = '🧪 *Teste de Interpretação de Datas*\n\n';

    for (const exemplo of exemplos) {
      const parsed = parseBrazilianDateTime(exemplo);
      if (parsed) {
        const friendly = formatBrazilianDateTime(parsed);
        resultado += `✅ "${exemplo}" → ${friendly}\n\n`;
      } else {
        resultado += `❌ "${exemplo}" → Não interpretado\n\n`;
      }
    }

    await ctx.reply(resultado, { parse_mode: 'Markdown' });
  });

  // Listener para qualquer mensagem de texto (opcional)
  bot.on('text', async (ctx: Context) => {
    const message = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
    
    // Ignorar comandos
    if (message.startsWith('/')) return;
    
    // Tentar interpretar automaticamente se parecer uma data/hora
    const temIndicadorTemporal = /\b(amanhã|amanha|hoje|ontem|segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo|próxima|proxima|que vem|\d{1,2}h|\d{1,2}:\d{2}|manhã|manha|tarde|noite)\b/i;
    
    if (temIndicadorTemporal.test(message)) {
      const parsed = parseBrazilianDateTime(message);
      
      if (parsed) {
        const friendly = formatBrazilianDateTime(parsed);
        await ctx.reply(
          `🤖 *Detectei uma data/hora na sua mensagem!*\n\n` +
          `📅 *Interpretei como:* ${friendly}\n\n` +
          `💡 *Dica:* Use /interpretar para testar outras datas`,
          { parse_mode: 'Markdown' }
        );
      }
    }
  });

  // Comando de ajuda
  bot.command('help', async (ctx: Context) => {
    await ctx.reply(
      '🤖 *Bot Interpretador de Datas*\n\n' +
      '*Comandos disponíveis:*\n' +
      '/interpretar [texto] - Interpreta data/hora em português\n' +
      '/teste - Testa vários exemplos\n' +
      '/help - Mostra esta ajuda\n\n' +
      '*Exemplos de uso:*\n' +
      '• /interpretar amanhã às 15h\n' +
      '• /interpretar sexta que vem às 19h\n' +
      '• /interpretar quarta às sete da noite\n\n' +
      'Ou simplesmente digite uma mensagem com data/hora que eu detectarei automaticamente!',
      { parse_mode: 'Markdown' }
    );
  });

  return bot;
}

/**
 * Função para iniciar o bot de teste
 */
export async function startDateParserBot(): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  
  if (!token) {
    console.error('❌ TELEGRAM_BOT_TOKEN não está configurado!');
    return;
  }

  try {
    const bot = createDateParserBot(token);
    
    // Configurar comandos no Telegram
    await bot.telegram.setMyCommands([
      { command: 'interpretar', description: 'Interpretar data/hora em português' },
      { command: 'teste', description: 'Testar vários exemplos' },
      { command: 'help', description: 'Mostrar ajuda' }
    ]);
    
    await bot.launch();
    console.log('🤖 Bot interpretador de datas iniciado com sucesso!');
    
    // Parar graciosamente
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
    
  } catch (error) {
    console.error('❌ Erro ao iniciar bot:', error);
  }
}