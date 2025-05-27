import { Telegraf, Context } from 'telegraf';
import { parseBrazilianDateTime, formatBrazilianDateTime } from './dateParser';

/**
 * Exemplo de como integrar a função de interpretação de datas no Telegraf
 */
export function setupDateParserCommands(bot: Telegraf) {
  
  // Comando /interpretar - interpreta data/hora de uma mensagem
  bot.command('interpretar', async (ctx: Context) => {
    try {
      // Extrair o texto após o comando
      const message = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
      const userInput = message.replace('/interpretar', '').trim();
      
      if (!userInput) {
        await ctx.reply(
          '📅 *Como usar o comando /interpretar:*\n\n' +
          '`/interpretar quarta às sete da noite`\n' +
          '`/interpretar sexta que vem às 19h`\n' +
          '`/interpretar amanhã às 9`\n' +
          '`/interpretar hoje às 18h`\n\n' +
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
          `📅 *Data interpretada:*\n${friendlyFormat}\n\n` +
          `🕐 *Formato técnico:*\n\`${parsedDateTime}\``,
          { parse_mode: 'Markdown' }
        );
      } else {
        // Erro - não conseguiu interpretar
        await ctx.reply(
          `❌ *Não consegui entender essa data/hora*\n\n` +
          `📝 *Você disse:* "${userInput}"\n\n` +
          `💡 *Tente algo como:*\n` +
          `• "hoje às 15h"\n` +
          `• "segunda que vem às 9 da manhã"\n` +
          `• "sexta às sete da noite"\n` +
          `• "amanhã às 18:30"`
        );
      }
    } catch (error) {
      console.error('Erro no comando /interpretar:', error);
      await ctx.reply('❌ Ocorreu um erro ao processar sua solicitação.');
    }
  });

  // Comando /agendar - cria um evento usando interpretação de data
  bot.command('agendar', async (ctx: Context) => {
    try {
      const message = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
      const userInput = message.replace('/agendar', '').trim();
      
      if (!userInput) {
        await ctx.reply(
          '📋 *Como usar o comando /agendar:*\n\n' +
          '`/agendar reunião amanhã às 15h`\n' +
          '`/agendar consulta médica sexta às 10h`\n' +
          '`/agendar jantar romântico sábado às 20h`\n\n' +
          'Descreva o evento com data e hora!',
          { parse_mode: 'Markdown' }
        );
        return;
      }

      // Interpretar a data/hora do texto
      const parsedDateTime = parseBrazilianDateTime(userInput);
      
      if (parsedDateTime) {
        const friendlyFormat = formatBrazilianDateTime(parsedDateTime);
        
        // Aqui você pode salvar o evento no banco de dados
        // ou integrar com sua lógica de criação de eventos
        
        await ctx.reply(
          `📅 *Evento agendado com sucesso!*\n\n` +
          `📝 *Descrição:* ${userInput}\n\n` +
          `🕐 *Data e hora:*\n${friendlyFormat}\n\n` +
          `✅ O evento foi salvo no seu calendário!`,
          { parse_mode: 'Markdown' }
        );
      } else {
        await ctx.reply(
          `❌ *Não consegui entender a data/hora*\n\n` +
          `📝 *Você disse:* "${userInput}"\n\n` +
          `💡 *Inclua uma data/hora clara, como:*\n` +
          `• "reunião amanhã às 15h"\n` +
          `• "consulta segunda às 10:30"\n` +
          `• "jantar sexta às 20h"`
        );
      }
    } catch (error) {
      console.error('Erro no comando /agendar:', error);
      await ctx.reply('❌ Ocorreu um erro ao criar o evento.');
    }
  });

  // Middleware para detectar automaticamente datas em mensagens
  bot.use(async (ctx, next) => {
    const message = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
    
    // Ignorar comandos
    if (message.startsWith('/')) {
      return next();
    }
    
    // Detectar se a mensagem contém indicadores temporais
    const temIndicadorTemporal = /\b(amanhã|amanha|hoje|ontem|segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo|próxima|proxima|que vem|\d{1,2}h|\d{1,2}:\d{2}|manhã|manha|tarde|noite)\b/i;
    
    if (temIndicadorTemporal.test(message)) {
      const parsed = parseBrazilianDateTime(message);
      
      if (parsed) {
        const friendly = formatBrazilianDateTime(parsed);
        
        await ctx.reply(
          `🤖 *Detectei uma data/hora na sua mensagem!*\n\n` +
          `📅 *Interpretei como:* ${friendly}\n\n` +
          `💡 *Dicas:*\n` +
          `• Use /agendar para criar um evento\n` +
          `• Use /interpretar para testar outras datas`,
          { parse_mode: 'Markdown' }
        );
      }
    }
    
    return next();
  });
}

/**
 * Exemplo de função para criar evento usando nossa interpretação de datas
 */
export async function createEventFromText(eventText: string, userId: string) {
  const parsedDateTime = parseBrazilianDateTime(eventText);
  
  if (!parsedDateTime) {
    throw new Error('Não foi possível interpretar a data/hora do evento');
  }
  
  // Extrair título do evento (parte sem data/hora)
  const title = extractEventTitle(eventText);
  
  const event = {
    title,
    startDate: parsedDateTime,
    description: eventText,
    userId
  };
  
  // Aqui você salvaria no banco de dados
  console.log('📅 Evento criado:', event);
  
  return event;
}

/**
 * Função auxiliar para extrair título do evento
 */
function extractEventTitle(text: string): string {
  // Remove expressões de tempo comuns
  let title = text
    .replace(/\b(amanhã|amanha|hoje|ontem)\b/gi, '')
    .replace(/\b(segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo)(-feira)?\b/gi, '')
    .replace(/\b(próxima|proxima|que vem)\b/gi, '')
    .replace(/\bàs?\s+\d{1,2}(:\d{2})?h?\b/gi, '')
    .replace(/\b(da manhã|da manha|da tarde|da noite|de manhã|de manha|de tarde|de noite)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
    
  return title || 'Evento';
}