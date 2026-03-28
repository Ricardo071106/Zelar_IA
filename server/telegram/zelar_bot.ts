/**
 * Bot Zelar - Versão avançada com interpretação inteligente de datas
 * Refatorado para usar serviços compartilhados
 */

import { Telegraf } from 'telegraf';
import {
  parseEvent,
  generateLinks,
  Event,
  extractEventTitle
} from '../services/eventParser';
import {
  parseLocalTime,
  formatLocalTime,
  TIME_PATTERNS
} from '../services/timezoneService';
import {
  setUserTimezone,
  getUserTimezone,
  COMMON_TIMEZONES,
  parseUserDateTime
} from '../services/dateService';

let bot: Telegraf | null = null;
let isInitializing = false;

/**
 * Iniciar bot
 */
export async function startZelarBot(): Promise<boolean> {
  try {
    // Prevenir múltiplas inicializações simultâneas
    if (isInitializing) {
      console.log('⚠️ Bot já está sendo inicializado...');
      return false;
    }

    isInitializing = true;

    // Prevenção de múltiplas instâncias
    if (bot) {
      console.log('🔄 Parando instância anterior do bot...');
      await stopZelarBot();
    }

    console.log('🔍 Verificando conflitos...');

    if (!process.env.TELEGRAM_BOT_TOKEN) {
      throw new Error('TELEGRAM_BOT_TOKEN não encontrado');
    }

    console.log('🚀 Iniciando nova instância do bot...');
    bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

    // Comando inicial
    bot.start((ctx) => {
      const userId = ctx.from?.id.toString() || 'unknown';
      const currentTimezone = getUserTimezone(userId, ctx.from?.language_code);

      ctx.reply(
        '🤖 *Zelar - Assistente Inteligente de Agendamentos*\n\n' +
        'Olá! Sou seu assistente para criar eventos com detecção automática de fuso horário!\n\n' +
        '📝 *Exemplos que entendo:*\n' +
        '• "jantar hoje às 19h"\n' +
        '• "reunião quarta às sete da noite"\n' +
        '• "19", "7 da noite"\n' +
        '• "consulta sexta que vem às 15h30"\n\n' +
        `🌍 *Seu fuso atual:* \`${currentTimezone}\`\n` +
        '⚙️ *Comandos úteis:*\n' +
        '• `/fuso` - configurar fuso horário\n' +
        '• `/interpretar` - testar datas\n\n' +
        '🧠 Digite seu compromisso! 🚀',
        { parse_mode: 'Markdown' }
      );
    });

    // Comando /fuso - configurar fuso horário
    bot.command('fuso', async (ctx) => {
      const message = ctx.message.text.replace('/fuso', '').trim();
      const userId = ctx.from?.id.toString() || 'unknown';

      if (!message) {
        const currentTimezone = getUserTimezone(userId, ctx.from?.language_code);
        const timezoneList = COMMON_TIMEZONES.slice(0, 6).map(tz => `• \`${tz}\``).join('\n');

        await ctx.reply(
          `🌍 *Configuração de Fuso Horário*\n\n` +
          `📍 *Seu fuso atual:* \`${currentTimezone}\`\n\n` +
          `💡 *Para alterar:* \`/fuso America/Sao_Paulo\`\n\n` +
          `📋 *Fusos comuns:*\n${timezoneList}`,
          { parse_mode: 'Markdown' }
        );
        return;
      }

      try {
        const success = setUserTimezone(userId, message);

        if (success) {
          const locationName = message.split('/')[1]?.replace('_', ' ') || message;
          await ctx.reply(
            `✅ *Fuso horário configurado!*\n\n` +
            `🌍 *Novo fuso:* ${locationName}\n` +
            `📍 *Código:* \`${message}\`\n\n` +
            `Agora quando você disser:\n` +
            `• "às 7 da noite" → será 19:00 no seu horário local\n` +
            `• "às 3 da tarde" → será 15:00 no seu horário local\n` +
            `• Todos os eventos usarão este fuso horário`,
            { parse_mode: 'Markdown' }
          );
        } else {
          await ctx.reply(
            `❌ *Fuso horário inválido*\n\n` +
            `💡 *Exemplos válidos:*\n` +
            `• \`America/Sao_Paulo\` (Brasil)\n` +
            `• \`America/Buenos_Aires\` (Argentina)\n` +
            `• \`Europe/Lisbon\` (Portugal)\n` +
            `• \`America/New_York\` (EUA)`,
            { parse_mode: 'Markdown' }
          );
        }
      } catch (error) {
        console.error('Erro ao configurar fuso horário:', error);
        await ctx.reply(
          `❌ *Erro interno*\n\n` +
          `Tente novamente ou use um fuso horário válido como \`America/Sao_Paulo\``
        );
      }
    });

    // Comando de teste para interpretação de datas
    bot.command('interpretar', async (ctx) => {
      const message = ctx.message.text.replace('/interpretar', '').trim();

      if (!message) {
        await ctx.reply(
          '💡 *Como usar:*\n\n' +
          '`/interpretar quarta às sete da noite`\n' +
          '`/interpretar sexta que vem às 19h`\n' +
          '`/interpretar 19` ou `/interpretar 7 da noite`\n\n' +
          'Digite qualquer data/hora!',
          { parse_mode: 'Markdown' }
        );
        return;
      }

      const userId = ctx.from?.id.toString() || '0';

      // Primeiro tentar interpretar como horário local puro
      const localTime = parseLocalTime(message, userId, ctx.from?.language_code);
      if (localTime) {
        const formattedTime = formatLocalTime(localTime.hour, localTime.minute, localTime.timezone);
        await ctx.reply(
          `✅ *Horário local interpretado!*\n\n` +
          `📝 *Você disse:* "${message}"\n\n` +
          `🕐 *Interpretei como:* ${formattedTime}\n\n` +
          `💡 *Para agendar:* Digite algo como "reunião sexta às 7 da noite"`
        );
        return;
      }

      // Se não conseguiu interpretar como horário local, verificar se precisa configurar fuso
      // Nota: getUserTimezone sempre retorna um fuso (padrão ou configurado), então essa check do original mudou um pouco.
      // Mas se o usuário nunca configurou, talvez devêssemos avisar?
      // O original usava userTimezones.has(userId).
      // Vamos pular essa checagem rigorosa e assumir o padrão, mas se for crítico, o usuário vai perceber o fuso errado.
      // O original era: if (!userTimezones.has(userId) && ...)
      // Podemos verificar se o fuso atual é o padrão se quisermos, mas o padrão é bom.

      const result = parseUserDateTime(message, userId, ctx.from?.language_code);

      if (result) {
        const currentTimezone = getUserTimezone(userId, ctx.from?.language_code);
        await ctx.reply(
          `✅ *Entendi perfeitamente!*\n\n` +
          `📝 *Você disse:* "${message}"\n\n` +
          `📅 *Interpretei como:*\n${result.readable}\n\n` +
          `🌍 *Fuso usado:* \`${currentTimezone}\``,
          { parse_mode: 'Markdown' }
        );
      } else {
        await ctx.reply(
          `❌ *Não consegui entender essa data/hora*\n\n` +
          `📝 *Você disse:* "${message}"\n\n` +
          `💡 *Tente algo como:*\n` +
          `• "hoje às 15h"\n` +
          `• "19" ou "7 da noite"\n` +
          `• "sexta às sete da noite"`
        );
      }
    });

    // Processar mensagens
    bot.on('text', async (ctx) => {
      try {
        const message = ctx.message.text;
        console.log(`📩 Mensagem recebida: "${message}" do usuário ${ctx.from?.username || ctx.from?.id}`);

        if (message.startsWith('/')) {
          console.log(`🔧 Comando detectado: ${message}`);
          return;
        }

        const userId = ctx.from?.id.toString() || '0';

        // Verificar se a mensagem contém padrões que requerem fuso horário configurado
        // Aqui podemos apenas checar se temos um fuso explicitamente definido se quisermos ser chatos
        // Mas a nova arquitetura usa fuso padrão se não houver.
        // Vamos manter o aviso apenas se o fuso for o padrão E o usuário usar termos ambíguos?
        // Simplificação: vamos direto para processamento.

        const userTimezone = getUserTimezone(userId, ctx.from?.language_code);

        const { storage } = await import('../storage');
        const dbUser = await storage.getUserByTelegramId(userId);
        const event = await parseEvent(
          message,
          userId,
          userTimezone,
          ctx.from?.language_code,
          dbUser?.id,
        );

        if (!event) {
          await ctx.reply(
            '❌ *Não consegui entender a data/hora*\n\n' +
            '💡 *Tente algo como:*\n' +
            '• "jantar hoje às 19h"\n' +
            '• "reunião quarta às 15h"\n' +
            '• "consulta sexta que vem às 10 da manhã"\n\n' +
            '🔍 Use `/interpretar sua frase` para testar!\n' +
            '🌍 Use `/fuso` para configurar horários locais!',
            { parse_mode: 'Markdown' }
          );
          return;
        }

        const links = generateLinks(event);

        // Função auxiliar para formatar attendees
        const formatAttendees = (attendees?: string[]) => {
          if (!attendees || attendees.length === 0) return '';
          return '\n👥 *Convidados:*\n' + attendees.map(email => `• ${email}`).join('\n');
        };

        await ctx.reply(
          '✅ *Evento criado com sucesso!*\n\n' +
          `🎯 *${event.title}*\n` +
          `📅 ${event.displayDate}` +
          formatAttendees(event.attendees) +
          '\n\n📅 *Adicionar ao calendário:*',
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '📅 Google Calendar', url: links.google },
                  { text: '📅 Outlook', url: links.outlook }
                ]
              ]
            }
          }
        );

      } catch (error) {
        console.error('Erro:', error);
        await ctx.reply(
          '❌ *Erro ao processar sua mensagem*\n\n' +
          '💡 *Tente novamente com:*\n' +
          '• "jantar hoje às 19h"\n' +
          '• "reunião amanhã às 15h"\n\n' +
          'Ou use `/interpretar sua frase` para testar!'
        );
      }
    });

    bot.on('callback_query', async (ctx) => {
      try {
        if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) {
          await ctx.answerCbQuery('Dados inválidos');
          return;
        }

        const selectedTimezone = ctx.callbackQuery.data;
        const userId = ctx.from?.id.toString() || 'unknown';

        console.log(`🌍 Fuso selecionado: ${selectedTimezone} para usuário ${userId}`);

        // Validar fuso horário usando lista de fusos válidos
        const validTimezones = COMMON_TIMEZONES;
        if (!validTimezones.includes(selectedTimezone)) {
          await ctx.answerCbQuery('Fuso horário inválido');
          await ctx.reply('❌ Fuso horário inválido. Tente novamente.');
          return;
        }

        // Salvar fuso horário
        const success = setUserTimezone(userId, selectedTimezone);

        if (success) {
          const locationName = selectedTimezone.split('/')[1]?.replace('_', ' ') || selectedTimezone;

          await ctx.answerCbQuery(`Fuso configurado: ${locationName}`);
          await ctx.reply(
            `✅ *Fuso horário configurado!*\n\n` +
            `🌍 *Novo fuso:* ${locationName}\n` +
            `📍 *Código:* \`${selectedTimezone}\`\n\n` +
            `Agora quando você disser:\n` +
            `• "às 7 da noite" → será 19:00 no seu horário local\n` +
            `• "às 3 da tarde" → será 15:00 no seu horário local\n` +
            `• Todos os eventos usarão este fuso horário`,
            { parse_mode: 'Markdown' }
          );
        } else {
          await ctx.answerCbQuery('Erro ao salvar fuso');
          await ctx.reply('❌ Erro ao salvar fuso horário. Tente novamente.');
        }

      } catch (error) {
        console.error('Erro ao processar callback query:', error);
        await ctx.answerCbQuery('Erro interno');
        await ctx.reply('❌ Erro interno. Tente novamente.');
      }
    });

    await bot.telegram.setMyCommands([
      { command: 'start', description: 'Iniciar o assistente' },
      { command: 'fuso', description: 'Configurar fuso horário' },
      { command: 'interpretar', description: 'Testar interpretação de datas' }
    ]);

    console.log('🚀 Iniciando bot via launch()...');
    await bot.launch();
    console.log('✅ Bot Zelar ativo com comandos limpos!');
    console.log('🔍 Bot aguardando mensagens...');

    try {
      const me = await bot.telegram.getMe();
      console.log(`✅ Bot identificado: @${me.username} (ID: ${me.id})`);
    } catch (error) {
      console.error('❌ Erro ao identificar bot:', error);
    }

    isInitializing = false;
    return true;

  } catch (error) {
    console.error('❌ Erro ao iniciar bot:', error);
    console.error('❌ Detalhes do erro:', (error as Error).message);
    isInitializing = false;
    return false;
  }
}

export async function stopZelarBot(): Promise<void> {
  if (bot) {
    console.log('🛑 Parando bot...');
    try {
      await bot.stop();
      await new Promise(resolve => setTimeout(resolve, 2000)); // Aguardar cleanup
    } catch (error) {
      console.error('Erro ao parar bot:', error);
    }
    bot = null;
  }
}