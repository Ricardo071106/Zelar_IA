/**
 * Bot Zelar - Versão avançada com interpretação inteligente de datas
 * Processamento avançado de eventos em português usando Luxon
 */

import { Telegraf } from 'telegraf';
import { parseUserDateTime, setUserTimezone, getUserTimezone, COMMON_TIMEZONES } from './utils/parseDate';
import { DateTime } from 'luxon';

let bot: Telegraf | null = null;

// =================== INÍCIO: FUNCIONALIDADE DE HORÁRIOS LOCAIS ===================
// Map para armazenar o fuso horário de cada usuário (ID do usuário -> fuso horário)
const userTimezones = new Map<number, string>();

// Regex para detectar padrões de horário em português
const TIME_PATTERNS = [
  { pattern: /às\s+(\d{1,2})\s*da\s+noite/gi, type: 'noite' },        // "às 7 da noite"
  { pattern: /às\s+(\d{1,2})\s*da\s+tarde/gi, type: 'tarde' },        // "às 3 da tarde" 
  { pattern: /às\s+(\d{1,2})\s*da\s+manhã/gi, type: 'manha' },        // "às 8 da manhã"
  { pattern: /às\s+(\d{1,2})\s*horas?/gi, type: 'neutral' },          // "às 19 horas"
  { pattern: /às\s+(\d{1,2})h/gi, type: 'neutral' },                  // "às 9h"
  { pattern: /às\s+(\d{1,2})\s*pm/gi, type: 'pm' },                   // "às 7pm"
  { pattern: /às\s+(\d{1,2})\s*am/gi, type: 'am' },                   // "às 9am"
];

/**
 * Interpreta horário local conforme o fuso do usuário
 */
function parseLocalTime(text: string, userId: number): { hour: number; minute: number; timezone: string } | null {
  const userTimezone = userTimezones.get(userId);
  
  if (!userTimezone) {
    return null; // Usuário precisa definir fuso primeiro
  }

  for (const { pattern, type } of TIME_PATTERNS) {
    pattern.lastIndex = 0; // Reset regex
    const match = pattern.exec(text);
    if (match) {
      let hour = parseInt(match[1]);
      const minute = 0; // Por simplicidade, assumindo minutos = 0
      
      // Ajustar horário baseado no contexto
      if (type === 'noite' && hour < 12) {
        hour += 12; // "7 da noite" = 19h
      } else if (type === 'tarde' && hour < 12) {
        hour += 12; // "3 da tarde" = 15h
      } else if (type === 'pm' && hour < 12) {
        hour += 12; // "7pm" = 19h
      }
      // "am" e "manhã" mantém o horário como está (0-11)
      
      return { hour, minute, timezone: userTimezone };
    }
  }
  
  return null;
}

/**
 * Formata horário no fuso do usuário
 */
function formatLocalTime(hour: number, minute: number, timezone: string): string {
  const now = DateTime.now().setZone(timezone);
  const targetTime = now.set({ hour, minute, second: 0, millisecond: 0 });
  const locationName = timezone.split('/')[1]?.replace('_', ' ') || timezone;
  
  return `${targetTime.toFormat('HH:mm')} no horário de ${locationName}`;
}
// =================== FIM: FUNCIONALIDADE DE HORÁRIOS LOCAIS ===================

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

    // =================== INÍCIO: COMANDO /setfuso ===================
    // Comando /setfuso - definir fuso horário local do usuário
    bot.command('setfuso', async (ctx) => {
      const timezoneArg = ctx.message.text.replace('/setfuso', '').trim();
      const userId = ctx.from?.id || 0;
      
      if (!timezoneArg) {
        await ctx.reply(
          '🌍 *Configurar Fuso Horário Local*\n\n' +
          '💡 *Como usar:*\n' +
          '`/setfuso America/Sao_Paulo`\n' +
          '`/setfuso America/Buenos_Aires`\n' +
          '`/setfuso Europe/Lisbon`\n\n' +
          '📋 *Fusos comuns:*\n' +
          '• `America/Sao_Paulo` (Brasil)\n' +
          '• `America/Buenos_Aires` (Argentina)\n' +
          '• `Europe/Lisbon` (Portugal)\n' +
          '• `America/New_York` (EUA)\n' +
          '• `Europe/London` (Reino Unido)',
          { parse_mode: 'Markdown' }
        );
        return;
      }
      
      // Validar se o fuso horário é válido
      try {
        DateTime.now().setZone(timezoneArg);
        userTimezones.set(userId, timezoneArg);
        
        const locationName = timezoneArg.split('/')[1]?.replace('_', ' ') || timezoneArg;
        await ctx.reply(
          `✅ *Fuso horário configurado!*\n\n` +
          `🌍 *Novo fuso:* ${locationName}\n` +
          `📍 *Código:* \`${timezoneArg}\`\n\n` +
          `Agora quando você disser "às 7 da noite", será interpretado como 19:00 no horário de ${locationName}.`,
          { parse_mode: 'Markdown' }
        );
      } catch (error) {
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
    });
    // =================== FIM: COMANDO /setfuso ===================

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

      // =================== INÍCIO: INTEGRAÇÃO HORÁRIOS LOCAIS ===================
      const userId = ctx.from?.id || 0;
      
      // Primeiro tentar interpretar como horário local puro
      const localTime = parseLocalTime(message, userId);
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
      if (!userTimezones.has(userId) && (message.includes('às') || message.includes('da noite') || message.includes('da tarde'))) {
        await ctx.reply(
          `⚠️ *Configure seu fuso horário primeiro!*\n\n` +
          `💡 *Use:* \`/setfuso America/Sao_Paulo\`\n\n` +
          `Depois você poderá usar horários como "às 7 da noite" que serão interpretados no seu fuso local.`,
          { parse_mode: 'Markdown' }
        );
        return;
      }
      // =================== FIM: INTEGRAÇÃO HORÁRIOS LOCAIS ===================

      const result = parseUserDateTime(message, userId.toString(), ctx.from?.language_code);
      
      if (result) {
        const currentTimezone = getUserTimezone(userId.toString(), ctx.from?.language_code);
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
        
        const userId = ctx.from?.id || 0;
        const userIdString = userId.toString();
        
        // =================== INÍCIO: VERIFICAÇÃO HORÁRIOS LOCAIS ===================
        // Verificar se a mensagem contém padrões que requerem fuso horário configurado
        const hasTimePattern = TIME_PATTERNS.some(({ pattern }) => {
          pattern.lastIndex = 0;
          return pattern.test(message);
        });
        
        // Se contém padrão de horário mas não tem fuso configurado, pedir configuração
        if (hasTimePattern && !userTimezones.has(userId)) {
          await ctx.reply(
            `⚠️ *Configure seu fuso horário primeiro!*\n\n` +
            `💡 *Use:* \`/setfuso America/Sao_Paulo\`\n\n` +
            `Depois você poderá usar expressões como:\n` +
            `• "às 7 da noite" → 19:00 no seu horário local\n` +
            `• "às 3 da tarde" → 15:00 no seu horário local\n` +
            `• "às 9am" → 09:00 no seu horário local\n\n` +
            `📋 *Fusos comuns:*\n` +
            `• \`America/Sao_Paulo\` (Brasil)\n` +
            `• \`America/Buenos_Aires\` (Argentina)\n` +
            `• \`Europe/Lisbon\` (Portugal)`,
            { parse_mode: 'Markdown' }
          );
          return;
        }
        // =================== FIM: VERIFICAÇÃO HORÁRIOS LOCAIS ===================
        
        const event = processMessage(message, userIdString, ctx.from?.language_code);
        
        if (!event) {
          await ctx.reply(
            '❌ *Não consegui entender a data/hora*\n\n' +
            '💡 *Tente algo como:*\n' +
            '• "jantar hoje às 19h"\n' +
            '• "reunião quarta às 15h"\n' +
            '• "consulta sexta que vem às 10 da manhã"\n\n' +
            '🔍 Use `/interpretar sua frase` para testar!\n' +
            '🌍 Use `/setfuso` para configurar horários locais!',
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