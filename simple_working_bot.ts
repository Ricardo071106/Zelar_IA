/**
 * Bot simples que funciona - sem conflitos
 */

import { Telegraf } from 'telegraf';
import { format, addDays, setHours, setMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);

// Memória simples para eventos (sem banco para evitar complicações)
const userEvents = new Map<string, Array<{
  id: string;
  title: string;
  date: Date;
}>>();

function parseMessage(text: string, userId: string) {
  const lower = text.toLowerCase();
  
  // Listar eventos
  if (lower.includes('eventos') || lower.includes('mostrar') || lower.includes('listar')) {
    const events = userEvents.get(userId) || [];
    const futureEvents = events.filter(e => e.date > new Date());
    
    if (futureEvents.length === 0) {
      return { type: 'response', message: 'Você não tem eventos futuros. Diga "reunião amanhã às 15h" para criar!' };
    }
    
    let message = '📅 *Seus próximos eventos:*\n\n';
    futureEvents.forEach((event, index) => {
      const formattedDate = format(event.date, "EEEE, dd 'de' MMMM 'às' HH:mm", { locale: ptBR });
      message += `${index + 1}. *${event.title}*\n📆 ${formattedDate}\n\n`;
    });
    
    return { type: 'response', message };
  }
  
  // Cancelar eventos  
  if (lower.includes('cancelar') || lower.includes('apagar')) {
    const events = userEvents.get(userId) || [];
    const eventName = text.replace(/cancelar|apagar/gi, '').trim();
    
    const eventIndex = events.findIndex(e => 
      e.title.toLowerCase().includes(eventName.toLowerCase())
    );
    
    if (eventIndex !== -1) {
      const deletedEvent = events[eventIndex];
      events.splice(eventIndex, 1);
      userEvents.set(userId, events);
      return { type: 'response', message: `✅ Evento "${deletedEvent.title}" cancelado!` };
    } else {
      return { type: 'response', message: `❌ Evento "${eventName}" não encontrado.` };
    }
  }
  
  // Criar eventos
  if (lower.includes('reunião') || lower.includes('agendar') || lower.includes('compromisso')) {
    
    // Extrair título
    let title = 'Reunião';
    if (lower.includes('sobre')) {
      const parts = text.split(/sobre/i);
      if (parts.length > 1) {
        title = `Reunião sobre ${parts[1].trim()}`;
      }
    }
    
    // Calcular data - HOJE é domingo 26/05
    const today = new Date();
    let targetDate = today;
    
    if (lower.includes('amanhã')) {
      // AMANHÃ = segunda-feira 27/05
      targetDate = addDays(today, 1);
    }
    
    // Extrair horário
    const timeMatch = text.match(/(\d{1,2})h/);
    if (timeMatch) {
      const hour = parseInt(timeMatch[1]);
      targetDate = setHours(setMinutes(targetDate, 0), hour);
    } else {
      targetDate = setHours(setMinutes(targetDate, 0), 10);
    }
    
    // Criar evento
    const eventId = Date.now().toString();
    const newEvent = { id: eventId, title, date: targetDate };
    
    const events = userEvents.get(userId) || [];
    events.push(newEvent);
    userEvents.set(userId, events);
    
    const formattedDate = format(targetDate, "EEEE, dd 'de' MMMM 'às' HH:mm", { locale: ptBR });
    
    // Links para calendários
    const startISO = targetDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const endISO = addDays(targetDate, 0).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${startISO}/${endISO}`;
    
    return { 
      type: 'event_created', 
      message: `✅ *Evento criado!*\n\n📋 ${title}\n📅 ${formattedDate}`,
      googleUrl
    };
  }
  
  return { 
    type: 'response', 
    message: 'Como posso ajudar?\n\n💡 Exemplos:\n• "reunião amanhã às 15h"\n• "mostrar meus eventos"\n• "cancelar reunião"' 
  };
}

// Comando /start
bot.start(async (ctx) => {
  await ctx.reply(
    `🤖 *Zelar Assistente*\n\n` +
    `Olá! Sou seu assistente de agenda.\n\n` +
    `💬 *Como usar:*\n` +
    `• "reunião amanhã às 15h"\n` +
    `• "mostrar meus eventos"\n` +
    `• "cancelar reunião"\n\n` +
    `Vamos organizar sua agenda! 📅`,
    { parse_mode: 'Markdown' }
  );
});

// Comando /eventos
bot.command('eventos', async (ctx) => {
  if (!ctx.from) return;
  
  const userId = ctx.from.id.toString();
  const result = parseMessage('mostrar eventos', userId);
  
  await ctx.reply(result.message, { parse_mode: 'Markdown' });
});

// Processar mensagens
bot.on('text', async (ctx) => {
  if (!ctx.from || !ctx.message?.text) return;
  
  const userId = ctx.from.id.toString();
  const result = parseMessage(ctx.message.text, userId);
  
  if (result.type === 'event_created' && result.googleUrl) {
    await ctx.reply(result.message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📅 Adicionar ao Google Calendar', url: result.googleUrl }]
        ]
      }
    });
  } else {
    await ctx.reply(result.message, { parse_mode: 'Markdown' });
  }
});

async function start() {
  try {
    await bot.launch();
    console.log('Bot funcionando!');
  } catch (error) {
    console.error('Erro:', error);
  }
}

start();