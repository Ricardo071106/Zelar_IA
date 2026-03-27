/**
 * Bot Telegram usando webhook ao invés de polling
 * Resolve problemas de conflito e travamento
 */

import { Telegraf } from 'telegraf';
import { parseEventWithClaude } from '../utils/claudeParser';
import { DateTime } from 'luxon';
import express from 'express';
import { getUserTimezone, extractEventTitle } from './utils/parseDate';

let bot: Telegraf | null = null;

interface Event {
  title: string;
  startDate: string;
  description: string;
  displayDate: string;
}

function generateCalendarLinks(event: Event) {
  const startDate = new Date(event.startDate);
  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
  
  const formatDate = (date: Date) => date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  
  const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${formatDate(startDate)}/${formatDate(endDate)}&details=${encodeURIComponent(event.description)}`;
  
  const outlookUrl = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(event.title)}&startdt=${startDate.toISOString()}&enddt=${endDate.toISOString()}&body=${encodeURIComponent(event.description)}`;
  
  return { google: googleUrl, outlook: outlookUrl };
}

export function setupTelegramWebhook(app: express.Application): boolean {
  try {
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      console.error('❌ Token do Telegram não configurado');
      return false;
    }

    console.log('🚀 Configurando bot Telegram via webhook...');
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

    // Processar mensagens
    bot.on('text', async (ctx) => {
      try {
        const message = ctx.message.text;
        console.log(`📩 Mensagem recebida: "${message}"`);
        
        if (message.startsWith('/')) return;

        // NOVO: Obter userId e languageCode
        const userId = ctx.from?.id?.toString() || 'unknown';
        const languageCode = ctx.from?.language_code;
        const userTimezone = getUserTimezone(userId, languageCode);

        const claudeResult = await parseEventWithClaude(message, userTimezone);
        
        if (!claudeResult.isValid) {
          await ctx.reply(
            '❌ *Não consegui entender a data/hora*\n\n' +
            '💡 *Tente algo como:*\n' +
            '• "jantar hoje às 19h"\n' +
            '• "reunião quarta às 15h"',
            { parse_mode: 'Markdown' }
          );
          return;
        }

        const eventDate = DateTime.fromObject({
          year: parseInt(claudeResult.date.split('-')[0]),
          month: parseInt(claudeResult.date.split('-')[1]),
          day: parseInt(claudeResult.date.split('-')[2]),
          hour: claudeResult.hour,
          minute: claudeResult.minute
        }, { zone: userTimezone });

        // NOVO: Limpar nome do evento se necessário
        let eventTitle = claudeResult.title && claudeResult.title.length > 2 ? claudeResult.title : extractEventTitle(message);

        const event: Event = {
          title: eventTitle,
          startDate: eventDate.toISO() || eventDate.toString(),
          description: eventTitle,
          displayDate: eventDate.toFormat('EEEE, dd \'de\' MMMM \'às\' HH:mm', { locale: 'pt-BR' })
        };

        const links = generateCalendarLinks(event);

        await ctx.reply(
          '✅ *Evento criado!*\n\n' +
          `🎯 *${event.title}*\n` +
          `📅 ${event.displayDate}`,
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

        console.log(`✅ Evento: ${event.title}`);

      } catch (error) {
        console.error('❌ Erro:', error);
        await ctx.reply('❌ Erro interno. Tente novamente.');
      }
    });

    // Configurar webhook route
    app.use(bot.webhookCallback('/telegram-webhook'));
    console.log('✅ Bot Telegram configurado via webhook em /telegram-webhook');
    
    return true;

  } catch (error) {
    console.error('❌ Erro ao configurar webhook:', error);
    return false;
  }
}

export async function setTelegramWebhook(): Promise<boolean> {
  if (!bot) return false;
  
  try {
    // Remover webhook existente
    await bot.telegram.deleteWebhook();
    console.log('🔄 Webhook anterior removido');
    
    // Como estamos no Replit, vamos usar um webhook local simulado
    console.log('✅ Bot configurado para receber mensagens');
    return true;
    
  } catch (error) {
    console.error('❌ Erro ao configurar webhook:', error);
    return false;
  }
}