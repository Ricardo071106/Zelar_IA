/**
 * Bot Telegram usando webhook ao invés de polling
 * Resolve problemas de conflito e travamento
 */

import { Telegraf } from 'telegraf';
import { parseEvent, generateLinks } from '../services/eventParser';
import express from 'express';
import { getUserTimezone } from './utils/parseDate';

let bot: Telegraf | null = null;

export function setupTelegramWebhook(app: express.Application): boolean {
  try {
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      console.error('❌ Token do Telegram não configurado');
      return false;
    }

    console.log('🚀 Configurando bot Telegram via webhook...');
    bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

    bot.command('start', async (ctx) => {
      await ctx.reply(
        '🤖 *Zelar - Assistente de Agendamento*\n\n' +
        '💡 *Como usar:*\n' +
        '• "jantar hoje às 19h"\n' +
        '• "reunião amanhã às 15h"\n' +
        '• "consulta sexta às 10h"\n\n' +
        'Envie qualquer mensagem com data e horário!',
        { parse_mode: 'Markdown' },
      );
    });

    bot.on('text', async (ctx) => {
      try {
        const message = ctx.message.text;
        console.log(`📩 Mensagem recebida: "${message}"`);

        if (message.startsWith('/')) return;

        const userId = ctx.from?.id?.toString() || 'unknown';
        const languageCode = ctx.from?.language_code;
        const userTimezone = getUserTimezone(userId, languageCode);

        const event = await parseEvent(message, userId, userTimezone, languageCode);

        if (!event) {
          await ctx.reply(
            '❌ *Não consegui entender a data/hora*\n\n' +
            '💡 *Tente algo como:*\n' +
            '• "jantar hoje às 19h"\n' +
            '• "reunião quarta às 15h"',
            { parse_mode: 'Markdown' },
          );
          return;
        }

        const links = generateLinks(event);

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
                  { text: '📅 Outlook', url: links.outlook },
                ],
              ],
            },
          },
        );

        console.log(`✅ Evento: ${event.title}`);
      } catch (error) {
        console.error('❌ Erro:', error);
        await ctx.reply('❌ Erro interno. Tente novamente.');
      }
    });

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
    await bot.telegram.deleteWebhook();
    console.log('🔄 Webhook anterior removido');
    console.log('✅ Bot configurado para receber mensagens');
    return true;
  } catch (error) {
    console.error('❌ Erro ao configurar webhook:', error);
    return false;
  }
}
