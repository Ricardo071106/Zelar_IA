/**
 * Bot Zelar - Versão avançada com interpretação inteligente de datas
 * Processamento avançado de eventos em português usando Luxon
 */

import { Telegraf } from 'telegraf';
import { parseBrazilianDateTime } from '../utils/dateParser';

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
 * Processa mensagem usando interpretação avançada de datas
 */
function processMessage(text: string): Event | null {
  console.log(`🔍 Processando com IA: "${text}"`);
  
  // Usar nossa função avançada de interpretação de datas
  const result = parseBrazilianDateTime(text);
  
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
      ctx.reply(
        '🤖 *Zelar - Assistente Inteligente de Agendamentos*\n\n' +
        'Olá! Sou seu assistente para criar eventos com interpretação avançada de datas!\n\n' +
        '📝 *Exemplos que entendo:*\n' +
        '• "jantar hoje às 19h"\n' +
        '• "reunião quarta às sete da noite"\n' +
        '• "consulta sexta que vem às 15h30"\n' +
        '• "dentista próxima segunda às 10 da manhã"\n\n' +
        '🧠 Agora entendo datas em português natural! Digite seu compromisso! 🚀',
        { parse_mode: 'Markdown' }
      );
    });

    // Comando de teste para interpretação de datas
    bot.command('interpretar', async (ctx) => {
      const message = ctx.message.text.replace('/interpretar', '').trim();
      
      if (!message) {
        await ctx.reply(
          '💡 *Como usar:*\n\n' +
          '`/interpretar quarta às sete da noite`\n' +
          '`/interpretar sexta que vem às 19h`\n' +
          '`/interpretar amanhã às 9`\n\n' +
          'Digite qualquer data/hora em português!',
          { parse_mode: 'Markdown' }
        );
        return;
      }

      const result = parseBrazilianDateTime(message);
      
      if (result) {
        await ctx.reply(
          `✅ *Entendi perfeitamente!*\n\n` +
          `📝 *Você disse:* "${message}"\n\n` +
          `📅 *Interpretei como:*\n${result.readable}`,
          { parse_mode: 'Markdown' }
        );
      } else {
        await ctx.reply(
          `❌ *Não consegui entender essa data/hora*\n\n` +
          `📝 *Você disse:* "${message}"\n\n` +
          `💡 *Tente algo como:*\n` +
          `• "hoje às 15h"\n` +
          `• "segunda que vem às 9 da manhã"\n` +
          `• "sexta às sete da noite"`
        );
      }
    });

    // Processar mensagens
    bot.on('text', async (ctx) => {
      try {
        const message = ctx.message.text;
        
        if (message.startsWith('/')) return;
        
        const event = processMessage(message);
        
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