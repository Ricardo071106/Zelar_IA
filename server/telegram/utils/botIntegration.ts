import { Telegraf, Context } from 'telegraf';
import { parseUserDateTime, setUserTimezone, getUserTimezone, COMMON_TIMEZONES } from './parseDate';

/**
 * Exemplo de como usar a nova função de interpretação de datas no Telegraf
 */
export function setupDateParsingCommands(bot: Telegraf) {
  
  // Comando /fuso - permite ao usuário definir seu fuso horário
  bot.command('fuso', async (ctx: Context) => {
    try {
      const message = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
      const timezone = message.replace('/fuso', '').trim();
      const userId = ctx.from?.id.toString() || 'unknown';
      
      if (!timezone) {
        // Mostrar fuso atual e opções
        const currentTimezone = getUserTimezone(userId, ctx.from?.language_code);
        
        const timezoneList = COMMON_TIMEZONES.map(tz => `• \`${tz}\``).join('\n');
        
        await ctx.reply(
          `🌍 *Configuração de Fuso Horário*\n\n` +
          `📍 *Seu fuso atual:* \`${currentTimezone}\`\n\n` +
          `💡 *Para alterar, use:*\n\`/fuso America/Sao_Paulo\`\n\n` +
          `📋 *Fusos comuns:*\n${timezoneList}`,
          { parse_mode: 'Markdown' }
        );
        return;
      }
      
      // Tentar definir o novo fuso
      const success = setUserTimezone(userId, timezone);
      
      if (success) {
        await ctx.reply(
          `✅ *Fuso horário atualizado!*\n\n` +
          `🌍 *Novo fuso:* \`${timezone}\`\n\n` +
          `Agora todos os seus eventos serão criados neste fuso horário.`,
          { parse_mode: 'Markdown' }
        );
      } else {
        await ctx.reply(
          `❌ *Fuso horário inválido*\n\n` +
          `📝 *Você tentou:* \`${timezone}\`\n\n` +
          `💡 *Exemplos válidos:*\n` +
          `• \`America/Sao_Paulo\` (Brasil)\n` +
          `• \`America/New_York\` (EUA)\n` +
          `• \`Europe/London\` (Reino Unido)\n` +
          `• \`Asia/Tokyo\` (Japão)`,
          { parse_mode: 'Markdown' }
        );
      }
    } catch (error) {
      console.error('Erro no comando /fuso:', error);
      await ctx.reply('❌ Erro ao configurar fuso horário. Tente novamente.');
    }
  });

  // Comando /interpretar - testa interpretação de datas
  bot.command('interpretar', async (ctx: Context) => {
    try {
      const message = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
      const userInput = message.replace('/interpretar', '').trim();
      const userId = ctx.from?.id.toString() || 'unknown';
      
      if (!userInput) {
        await ctx.reply(
          '🧪 *Teste de Interpretação de Datas*\n\n' +
          '💡 *Como usar:*\n' +
          '`/interpretar sexta às 19h`\n' +
          '`/interpretar amanhã às 9`\n' +
          '`/interpretar 7 da noite`\n\n' +
          'Digite qualquer data/hora!',
          { parse_mode: 'Markdown' }
        );
        return;
      }

      const result = parseUserDateTime(userInput, userId, ctx.from?.language_code);
      
      if (result) {
        const currentTimezone = getUserTimezone(userId, ctx.from?.language_code);
        
        await ctx.reply(
          `✅ *Interpretação bem-sucedida!*\n\n` +
          `📝 *Você disse:* "${userInput}"\n\n` +
          `📅 *Resultado:*\n${result.readable}\n\n` +
          `🌍 *Fuso usado:* \`${currentTimezone}\`\n` +
          `📋 *ISO:* \`${result.iso}\``,
          { parse_mode: 'Markdown' }
        );
      } else {
        await ctx.reply(
          `❌ *Não consegui interpretar*\n\n` +
          `📝 *Você disse:* "${userInput}"\n\n` +
          `💡 *Tente algo como:*\n` +
          `• "hoje às 15h"\n` +
          `• "segunda às 9"\n` +
          `• "7 da noite"\n` +
          `• "amanhã às 19h"`
        );
      }
    } catch (error) {
      console.error('Erro no comando /interpretar:', error);
      await ctx.reply('❌ Erro ao interpretar data. Tente novamente.');
    }
  });

  // Handler principal para mensagens de evento
  bot.on('text', async (ctx, next) => {
    const message = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
    
    // Ignorar comandos
    if (message.startsWith('/')) {
      return next();
    }
    
    const userId = ctx.from?.id.toString() || 'unknown';
    
    // Tentar interpretar como evento
    const result = parseUserDateTime(message, userId, ctx.from?.language_code);
    
    if (result) {
      // Extrair título do evento (remover expressões de tempo)
      const title = extractEventTitle(message);
      
      // Gerar links para calendários
      const googleLink = generateGoogleCalendarLink(title, result.iso);
      const outlookLink = generateOutlookLink(title, result.iso);
      
      await ctx.reply(
        `✅ *Evento criado!*\n\n` +
        `🎯 *${title}*\n` +
        `📅 ${result.readable}\n\n` +
        `📅 *Adicionar ao calendário:*`,
        { 
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '📅 Google Calendar', url: googleLink },
                { text: '📅 Outlook', url: outlookLink }
              ]
            ]
          }
        }
      );
    } else {
      return next();
    }
  });
}

/**
 * Extrai título do evento removendo expressões de tempo
 */
function extractEventTitle(text: string): string {
  let title = text
    .replace(/\b(amanhã|amanha|hoje|ontem)\b/gi, '')
    .replace(/\b(segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo)(-feira)?\b/gi, '')
    .replace(/\b(próxima|proxima|que vem)\b/gi, '')
    .replace(/\bàs?\s+\d{1,2}(:\d{2})?h?\b/gi, '')
    .replace(/\b\d{1,2}(am|pm)\b/gi, '')
    .replace(/\b(da manhã|da manha|da tarde|da noite)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
    
  // Capitalizar primeira letra
  if (title) {
    title = title.charAt(0).toUpperCase() + title.slice(1);
  }
    
  return title || 'Evento';
}

/**
 * Gera link para Google Calendar
 */
function generateGoogleCalendarLink(title: string, isoDateTime: string): string {
  const eventDate = new Date(isoDateTime);
  const start = eventDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const end = new Date(eventDate.getTime() + 60 * 60 * 1000).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${start}/${end}`;
}

/**
 * Gera link para Outlook
 */
function generateOutlookLink(title: string, isoDateTime: string): string {
  const eventDate = new Date(isoDateTime);
  const endDate = new Date(eventDate.getTime() + 60 * 60 * 1000);
  
  return `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(title)}&startdt=${eventDate.toISOString()}&enddt=${endDate.toISOString()}`;
}