/**
 * Bot Zelar - Versão limpa e funcional
 * Processamento simples e eficaz de eventos em português
 */

import { Telegraf } from 'telegraf';

let bot: Telegraf | null = null;

interface Event {
  title: string;
  startDate: Date;
  description: string;
}

/**
 * Processa mensagem e extrai evento
 */
function processMessage(text: string): Event {
  const now = new Date();
  let eventDate = new Date(now);
  let title = 'Evento';
  
  console.log(`🔍 Processando: "${text}"`);
  
  // 1. EXTRAIR TÍTULO
  const textLower = text.toLowerCase();
  
  if (textLower.includes('jantar')) title = 'Jantar';
  else if (textLower.includes('reunião') || textLower.includes('reuniao')) title = 'Reunião';
  else if (textLower.includes('compromisso')) title = 'Compromisso';
  else if (textLower.includes('consulta')) title = 'Consulta';
  else if (textLower.includes('exame')) title = 'Exame';
  else if (textLower.includes('almoço') || textLower.includes('almoco')) title = 'Almoço';
  
  console.log(`📝 Título: ${title}`);
  
  // 2. PROCESSAR DATA
  if (textLower.includes('amanhã') || textLower.includes('amanha')) {
    eventDate.setDate(now.getDate() + 1);
    console.log('📅 Data: amanhã');
  } else if (textLower.includes('hoje')) {
    console.log('📅 Data: hoje');
  } else {
    // Default: amanhã
    eventDate.setDate(now.getDate() + 1);
    console.log('📅 Data: amanhã (padrão)');
  }
  
  // 3. PROCESSAR HORÁRIO - VERSÃO SIMPLES E FUNCIONAL
  let hour = 10; // Padrão
  let minute = 0;
  
  // PM/AM
  if (textLower.includes('pm')) {
    const pmMatch = text.match(/(\d{1,2})\s*pm/i);
    if (pmMatch) {
      hour = parseInt(pmMatch[1]);
      if (hour < 12) hour += 12; // Converter PM para 24h
      console.log(`🕰️ PM: ${pmMatch[1]}pm = ${hour}:00`);
    }
  } else if (textLower.includes('am')) {
    const amMatch = text.match(/(\d{1,2})\s*am/i);
    if (amMatch) {
      hour = parseInt(amMatch[1]);
      if (hour === 12) hour = 0; // 12am = 00:00
      console.log(`🕰️ AM: ${amMatch[1]}am = ${hour}:00`);
    }
  } else {
    // Formato brasileiro
    const timeMatch = text.match(/(?:às?|as)\s*(\d{1,2})(?:h)?/i) || text.match(/(\d{1,2})h/i);
    if (timeMatch) {
      hour = parseInt(timeMatch[1]);
      console.log(`🕰️ 24h: ${hour}:00`);
    }
  }
  
  eventDate.setHours(hour, minute, 0, 0);
  console.log(`📅 Data/hora final: ${eventDate.toLocaleString('pt-BR')}`);
  
  return {
    title,
    startDate: eventDate,
    description: text
  };
}

/**
 * Gera links para calendários
 */
function generateLinks(event: Event) {
  const start = event.startDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const end = new Date(event.startDate.getTime() + 60 * 60 * 1000).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  
  const google = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${start}/${end}`;
  const outlook = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(event.title)}&startdt=${event.startDate.toISOString()}&enddt=${new Date(event.startDate.getTime() + 60 * 60 * 1000).toISOString()}`;
  
  const formatted = event.startDate.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  }) + ' às ' + event.startDate.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit'
  });
  
  return { google, outlook, formatted };
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
        '🤖 *Zelar - Assistente de Agendamentos*\n\n' +
        'Olá! Sou seu assistente para criar eventos.\n\n' +
        '📝 *Exemplos:*\n' +
        '• "jantar hoje às 19h"\n' +
        '• "reunião amanhã às 7pm"\n' +
        '• "consulta amanhã às 15"\n\n' +
        'Digite seu compromisso naturalmente! 🚀',
        { parse_mode: 'Markdown' }
      );
    });

    // Processar mensagens
    bot.on('text', async (ctx) => {
      try {
        const message = ctx.message.text;
        
        if (message.startsWith('/')) return;
        
        const event = processMessage(message);
        const links = generateLinks(event);

        ctx.reply(
          '✅ *Evento criado!*\n\n' +
          `🎯 ${event.title}\n` +
          `📅 ${links.formatted}\n\n` +
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
        ctx.reply('❌ Erro ao processar. Tente: "jantar hoje às 19h"');
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