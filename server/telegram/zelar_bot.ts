/**
 * Bot Zelar - Versão avançada com interpretação inteligente de datas
 * Processamento avançado de eventos em português usando Luxon
 */

import { Telegraf } from 'telegraf';
import { parseUserDateTime, setUserTimezone, getUserTimezone, COMMON_TIMEZONES } from './utils/parseDate';

let bot: Telegraf | null = null;

interface Event {
  title: string;
  startDate: string; // ISO string for Google Calendar
  description: string;
  displayDate: string; // Formatted date for display
}

/**
 * Extrai título inteligente do evento
 */
function extractEventTitle(text: string): string {
  const textLower = text.toLowerCase();
  
  // Tipos específicos de eventos
  if (textLower.includes('jantar')) return 'Jantar';
  if (textLower.includes('reunião') || textLower.includes('reuniao')) return 'Reunião';
  if (textLower.includes('compromisso')) return 'Compromisso';
  if (textLower.includes('consulta')) return 'Consulta';
  if (textLower.includes('exame')) return 'Exame';
  if (textLower.includes('almoço') || textLower.includes('almoco')) return 'Almoço';
  if (textLower.includes('dentista')) return 'Dentista';
  if (textLower.includes('médico') || textLower.includes('medico')) return 'Consulta Médica';
  if (textLower.includes('academia')) return 'Academia';
  if (textLower.includes('trabalho')) return 'Trabalho';
  if (textLower.includes('escola') || textLower.includes('aula')) return 'Aula';
  if (textLower.includes('festa')) return 'Festa';
  if (textLower.includes('aniversário') || textLower.includes('aniversario')) return 'Aniversário';
  
  // Extrair título mais inteligente removendo palavras de tempo
  let title = text
    .replace(/\b(amanhã|amanha|hoje|ontem)\b/gi, '')
    .replace(/\b(segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo)(-feira)?\b/gi, '')
    .replace(/\b(próxima|proxima|que vem)\b/gi, '')
    .replace(/\bàs?\s+\d{1,2}(:\d{2})?h?\b/gi, '')
    .replace(/\b\d{1,2}(am|pm)\b/gi, '')
    .replace(/\b(da manhã|da manha|da tarde|da noite|de manhã|de manha|de tarde|de noite)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
    
  // Capitalizar primeira letra
  if (title) {
    title = title.charAt(0).toUpperCase() + title.slice(1);
  }
    
  return title || 'Evento';
}

/**
 * Processa mensagem usando interpretação avançada de datas com detecção de fuso horário
 */
function processMessage(text: string, userId: string, languageCode?: string): Event | null {
  console.log(`🔍 Processando com detecção de fuso: "${text}"`);
  
  // Usar nossa função avançada de interpretação de datas com fuso do usuário
  const result = parseUserDateTime(text, userId, languageCode);
  
  if (!result) {
    console.log('❌ Não foi possível interpretar data/hora');
    return null;
  }
  
  const title = extractEventTitle(text);
  
  console.log(`📝 Título extraído: "${title}"`);
  console.log(`📅 Data interpretada: ${result.readable}`);
  
  return {
    title,
    startDate: result.iso,
    description: text,
    displayDate: result.readable
  };
}

/**
 * Gera links para calendários usando data ISO
 */
function generateLinks(event: Event) {
  const eventDate = new Date(event.startDate);
  const start = eventDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const end = new Date(eventDate.getTime() + 60 * 60 * 1000).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  
  const google = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${start}/${end}`;
  const outlook = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(event.title)}&startdt=${eventDate.toISOString()}&enddt=${new Date(eventDate.getTime() + 60 * 60 * 1000).toISOString()}`;
  
  return { google, outlook };
}

/**
 * Iniciar bot
 */
export async function startZelarBot(): Promise<boolean> {
  try {
    if (bot) {
      try {
        await bot.stop();
        bot = null;
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (e) {
        console.log('Bot já parado');
      }
    }

    if (!process.env.TELEGRAM_BOT_TOKEN) {
      throw new Error('TELEGRAM_BOT_TOKEN não encontrado');
    }

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
      
      const success = setUserTimezone(userId, message);
      
      if (success) {
        await ctx.reply(
          `✅ *Fuso horário atualizado!*\n\n` +
          `🌍 *Novo fuso:* \`${message}\`\n\n` +
          `Todos os seus eventos agora usarão este fuso horário.`,
          { parse_mode: 'Markdown' }
        );
      } else {
        await ctx.reply(
          `❌ *Fuso horário inválido*\n\n` +
          `💡 *Exemplos válidos:*\n` +
          `• \`America/Sao_Paulo\` (Brasil)\n` +
          `• \`America/New_York\` (EUA)\n` +
          `• \`Europe/London\` (Reino Unido)`,
          { parse_mode: 'Markdown' }
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

      const userId = ctx.from?.id.toString() || 'unknown';
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
        
        if (message.startsWith('/')) return;
        
        const userId = ctx.from?.id.toString() || 'unknown';
        const event = processMessage(message, userId, ctx.from?.language_code);
        
        if (!event) {
          await ctx.reply(
            '❌ *Não consegui entender a data/hora*\n\n' +
            '💡 *Tente algo como:*\n' +
            '• "jantar hoje às 19h"\n' +
            '• "reunião quarta às 15h"\n' +
            '• "consulta sexta que vem às 10 da manhã"\n\n' +
            '🔍 Use `/interpretar sua frase` para testar!',
            { parse_mode: 'Markdown' }
          );
          return;
        }
        
        const links = generateLinks(event);

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

    await bot.launch();
    console.log('✅ Bot Zelar ativo!');
    return true;

  } catch (error) {
    console.error('❌ Erro ao iniciar bot:', error);
    return false;
  }
}

export function stopZelarBot(): void {
  if (bot) {
    bot.stop();
    bot = null;
  }
}