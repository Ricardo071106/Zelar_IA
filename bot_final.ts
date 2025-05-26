import { Telegraf } from 'telegraf';

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);
const userStates = new Map();

function getNextWeekday(date: Date, targetDay: number): Date {
  const result = new Date(date);
  const daysUntilTarget = (targetDay - date.getDay() + 7) % 7;
  if (daysUntilTarget === 0) {
    result.setDate(date.getDate() + 7);
  } else {
    result.setDate(date.getDate() + daysUntilTarget);
  }
  return result;
}

function parseMessage(text: string) {
  const now = new Date();
  let eventDate = new Date(now);
  let title = text;
  let time = '09:00';

  // Melhor detecção de horários (incluindo PM/AM e formatos diversos)
  const timePatterns = [
    /(\d{1,2}):(\d{2})\s*h?/i,  // 15:30h ou 15:30
    /(\d{1,2})h(\d{2})/i,       // 15h30
    /(\d{1,2})\s*h/i,           // 15h
    /(\d{1,2})\s*pm/i,          // 8pm
    /(\d{1,2})\s*am/i           // 8am
  ];

  for (const pattern of timePatterns) {
    const match = text.match(pattern);
    if (match) {
      let hour = parseInt(match[1]);
      let minute = 0;
      
      // Se tem minutos
      if (match[2]) {
        minute = parseInt(match[2]);
      }
      
      // Converter PM para 24h
      if (text.toLowerCase().includes('pm') && hour < 12) {
        hour += 12;
      }
      // Converter AM (garantir que 12am = 00:00)
      else if (text.toLowerCase().includes('am') && hour === 12) {
        hour = 0;
      }
      
      time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      break;
    }
  }

  if (text.includes('amanhã')) {
    eventDate.setDate(now.getDate() + 1);
  } else if (text.includes('hoje')) {
    eventDate = new Date(now);
  } else if (text.includes('segunda')) {
    eventDate = getNextWeekday(now, 1);
  } else if (text.includes('terça')) {
    eventDate = getNextWeekday(now, 2);
  } else if (text.includes('quarta')) {
    eventDate = getNextWeekday(now, 3);
  } else if (text.includes('quinta')) {
    eventDate = getNextWeekday(now, 4);
  } else if (text.includes('sexta')) {
    eventDate = getNextWeekday(now, 5);
  } else if (text.includes('sábado')) {
    eventDate = getNextWeekday(now, 6);
  } else if (text.includes('domingo')) {
    eventDate = getNextWeekday(now, 0);
  }

  const [hour, minute] = time.split(':');
  eventDate.setHours(parseInt(hour), parseInt(minute), 0, 0);

  // Melhor processamento do título
  title = text
    .replace(/(\d{1,2}):?(\d{2})?\s*(h|pm|am)?/gi, '') // Remove horários
    .replace(/\b(amanhã|hoje|segunda|terça|quarta|quinta|sexta|sábado|domingo)\b/gi, '') // Remove dias
    .replace(/\b(às?|para|com|uma?|marque?)\b/gi, '') // Remove palavras conectivas
    .replace(/\s+/g, ' ') // Remove espaços múltiplos
    .trim();

  // Se o título ficou vazio ou muito genérico, tentar extrair melhor
  if (!title || title.length < 3) {
    // Procurar por palavras que indicam o tipo de evento
    const eventMatch = text.match(/\b(reunião|jantar|almoço|consulta|dentista|médico|encontro|apresentação|compromisso|evento|visita)\b/i);
    if (eventMatch) {
      title = eventMatch[0];
    } else {
      title = 'Evento';
    }
  }

  return {
    title: title || 'Evento',
    startDate: eventDate,
    endDate: new Date(eventDate.getTime() + 60 * 60 * 1000)
  };
}

function generateCalendarLinks(event: any) {
  const formatDateForGoogle = (date: Date): string => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const startDate = formatDateForGoogle(event.startDate);
  const endDate = formatDateForGoogle(event.endDate);
  
  const googleLink = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${startDate}/${endDate}`;
  const outlookLink = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(event.title)}&startdt=${event.startDate.toISOString()}&enddt=${event.endDate.toISOString()}`;

  return { googleLink, outlookLink };
}

bot.start((ctx) => {
  const userId = ctx.from.id.toString();
  userStates.set(userId, { events: [] });
  
  ctx.reply(`🤖 *Zelar - Assistente de Agendamento*

Olá! Sou seu assistente pessoal para agendamentos.

📅 *Como usar:*
• Digite naturalmente: "reunião amanhã às 15h"
• Use /eventos para ver seus compromissos

✨ Funciono em português brasileiro!`, { parse_mode: 'Markdown' });
});

bot.command('eventos', (ctx) => {
  const userId = ctx.from.id.toString();
  const userState = userStates.get(userId) || { events: [] };
  
  if (userState.events.length === 0) {
    ctx.reply('📅 Você não tem eventos agendados.');
    return;
  }

  let message = '📅 *Seus eventos:*\n\n';
  userState.events.forEach((event: any, index: number) => {
    const date = new Date(event.startDate).toLocaleDateString('pt-BR');
    const time = new Date(event.startDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    message += `${index + 1}. ${event.title}\n📅 ${date} às ${time}\n\n`;
  });

  message += 'Para cancelar, digite: cancelar [número]';
  ctx.reply(message, { parse_mode: 'Markdown' });
});

bot.on('text', (ctx) => {
  const text = ctx.message.text.toLowerCase();
  const userId = ctx.from.id.toString();
  
  if (!userStates.has(userId)) {
    userStates.set(userId, { events: [] });
  }
  
  const userState = userStates.get(userId);

  if (text.includes('cancelar')) {
    const numberMatch = text.match(/cancelar\s+(\d+)/);
    if (numberMatch) {
      const eventIndex = parseInt(numberMatch[1]) - 1;
      if (eventIndex >= 0 && eventIndex < userState.events.length) {
        const cancelledEvent = userState.events.splice(eventIndex, 1)[0];
        ctx.reply(`✅ Evento "${cancelledEvent.title}" cancelado com sucesso!`);
        return;
      }
    }
    ctx.reply('❌ Número do evento inválido. Use /eventos para ver a lista.');
    return;
  }

  try {
    const event = parseMessage(ctx.message.text);
    userState.events.push(event);
    
    const { googleLink, outlookLink } = generateCalendarLinks(event);
    
    const formatDate = (date: Date): string => {
      return date.toLocaleDateString('pt-BR', { 
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    };

    ctx.reply(`✅ *Evento criado com sucesso!*

📋 *Detalhes:*
🎯 ${event.title}
📅 ${formatDate(event.startDate)}

📱 *Adicionar ao calendário:*`, 
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
      });
      
  } catch (error) {
    ctx.reply('❌ Não consegui entender sua mensagem. Tente algo como: "reunião amanhã às 15h"');
  }
});

console.log('🚀 Iniciando bot...');
bot.launch().then(() => {
  console.log('✅ Bot funcionando!');
}).catch(err => {
  if (err.message.includes('409')) {
    console.log('⚠️ Conflito - aguarde um momento');
  } else {
    console.log('❌ Erro:', err.message);
  }
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));