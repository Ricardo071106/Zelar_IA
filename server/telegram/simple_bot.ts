/**
 * Bot Telegram simples e funcional
 * Versão limpa sem complexidade desnecessária
 */

import { Telegraf } from 'telegraf';
import { parseEventWithClaude } from '../utils/claudeParser';
import { DateTime } from 'luxon';

let bot: Telegraf | null = null;

interface Event {
  title: string;
  startDate: string;
  description: string;
  displayDate: string;
}

/**
 * Gera links para adicionar evento ao calendário
 */
function generateCalendarLinks(event: Event) {
  const startDate = new Date(event.startDate);
  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1 hora depois
  
  const formatDate = (date: Date) => date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  
  const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${formatDate(startDate)}/${formatDate(endDate)}&details=${encodeURIComponent(event.description)}`;
  
  const outlookUrl = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(event.title)}&startdt=${startDate.toISOString()}&enddt=${endDate.toISOString()}&body=${encodeURIComponent(event.description)}`;
  
  return { google: googleUrl, outlook: outlookUrl };
}

/**
 * Inicia o bot simples
 */
export async function startSimpleBot(): Promise<boolean> {
  try {
    // Parar bot existente
    if (bot) {
      console.log('🔄 Parando bot anterior...');
      await bot.stop();
      bot = null;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    if (!process.env.TELEGRAM_BOT_TOKEN) {
      console.error('❌ Token do Telegram não configurado');
      return false;
    }

    console.log('🚀 Iniciando bot simples...');
    bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

    // Comando /start
    bot.command('start', async (ctx) => {
      await ctx.reply(
        '🤖 *Zelar - Assistente de Agendamento*\n\n' +
        '💡 *Como usar:*\n' +
        '• "jantar hoje às 19h"\n' +
        '• "reunião amanhã às 15h"\n' +
        '• "consulta sexta às 10h"\n\n' +
        'Envie qualquer mensagem com data e horário!',
        { parse_mode: 'Markdown' }
      );
    });

    // Processar mensagens de texto
    bot.on('text', async (ctx) => {
      try {
        const message = ctx.message.text;
        console.log(`📩 Mensagem recebida: "${message}"`);
        
        if (message.startsWith('/')) return;

        // Usar Claude para interpretar a mensagem
        const claudeResult = await parseEventWithClaude(message, 'America/Sao_Paulo');
        
        if (!claudeResult.isValid) {
          await ctx.reply(
            '❌ *Não consegui entender a data/hora*\n\n' +
            '💡 *Tente algo como:*\n' +
            '• "jantar hoje às 19h"\n' +
            '• "reunião quarta às 15h"\n' +
            '• "consulta sexta que vem às 10 da manhã"',
            { parse_mode: 'Markdown' }
          );
          return;
        }

        // Criar evento
        const eventDate = DateTime.fromObject({
          year: parseInt(claudeResult.date.split('-')[0]),
          month: parseInt(claudeResult.date.split('-')[1]),
          day: parseInt(claudeResult.date.split('-')[2]),
          hour: claudeResult.hour,
          minute: claudeResult.minute
        }, { zone: 'America/Sao_Paulo' });

        const event: Event = {
          title: claudeResult.title,
          startDate: eventDate.toISO() || eventDate.toString(),
          description: claudeResult.title,
          displayDate: eventDate.toFormat('EEEE, dd \'de\' MMMM \'às\' HH:mm', { locale: 'pt-BR' })
        };

        const links = generateCalendarLinks(event);

        await ctx.reply(
          '✅ *Evento criado com sucesso!*\n\n' +
          `🎯 *${event.title}*\n` +
          `📅 ${event.displayDate}\n\n` +
          '📅 *Adicionar ao calendário:*',
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

        console.log(`✅ Evento criado: ${event.title} em ${event.displayDate}`);

      } catch (error) {
        console.error('❌ Erro ao processar mensagem:', error);
        await ctx.reply(
          '❌ *Erro interno*\n\n' +
          'Tente novamente em alguns instantes.',
          { parse_mode: 'Markdown' }
        );
      }
    });

    // Definir comandos
    await bot.telegram.setMyCommands([
      { command: 'start', description: 'Iniciar o assistente' }
    ]);

    // Iniciar bot
    console.log('🔄 Lançando bot...');
    await bot.launch();
    
    // Verificar se funcionou
    const me = await bot.telegram.getMe();
    console.log(`✅ Bot @${me.username} ativo e funcionando!`);
    
    return true;

  } catch (error) {
    console.error('❌ Erro ao iniciar bot simples:', error);
    console.error('❌ Detalhes:', (error as Error).message);
    return false;
  }
}

/**
 * Para o bot simples
 */
export async function stopSimpleBot(): Promise<void> {
  if (bot) {
    console.log('🛑 Parando bot simples...');
    await bot.stop();
    bot = null;
  }
}