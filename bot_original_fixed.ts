import { Telegraf } from 'telegraf';

if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN não encontrado');
  process.exit(1);
}

console.log('🤖 Iniciando bot original Zelar...');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Estado dos usuários
const userStates = new Map();

// Função para calcular próximo dia da semana
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

// Função para processar mensagens de evento
function parseMessage(text: string) {
  const now = new Date();
  let eventDate = new Date(now);
  let title = text;
  let time = '09:00';

  // Extrair horário
  const timeMatch = text.match(/(\d{1,2}):?(\d{0,2})\s*h?/);
  if (timeMatch) {
    const hour = timeMatch[1];
    const minute = timeMatch[2] || '00';
    time = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
  }

  // Processar datas relativas
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

  // Definir horário
  const [hour, minute] = time.split(':');
  eventDate.setHours(parseInt(hour), parseInt(minute), 0, 0);

  // Limpar título
  title = text
    .replace(/(\d{1,2}):?(\d{0,2})\s*h?/, '')
    .replace(/\b(amanhã|hoje|segunda|terça|quarta|quinta|sexta|sábado|domingo)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    title: title || 'Evento',
    startDate: eventDate,
    endDate: new Date(eventDate.getTime() + 60 * 60 * 1000) // +1 hora
  };
}

// Função para gerar links de calendário
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

// Comando /start
bot.start((ctx) => {
  const userId = ctx.from.id.toString();
  userStates.set(userId, { events: [] });
  
  ctx.reply(`🤖 *Zelar - Assistente de Agendamento*

Olá! Sou seu assistente pessoal para agendamentos.

📅 *Como usar:*
• Digite naturalmente: "reunião amanhã às 15h"
• Use /eventos para ver seus compromissos
• Use /help para mais comandos

✨ Funciono em português brasileiro!`, 
    { parse_mode: 'Markdown' });
});

// Comando /help
bot.help((ctx) => {
  ctx.reply(`📋 *Comandos disponíveis:*

/start - Iniciar conversa
/eventos - Ver meus compromissos
/help - Esta ajuda

💡 *Exemplos de uso:*
• "reunião com João amanhã às 14h"
• "dentista na próxima segunda às 10h"
• "almoço hoje às 12h30"

Para cancelar, responda com "cancelar [número]"`, 
    { parse_mode: 'Markdown' });
});

// Comando /eventos
bot.command('eventos', (ctx) => {
  const userId = ctx.from.id.toString();
  const userState = userStates.get(userId) || { events: [] };
  
  if (userState.events.length === 0) {
    ctx.reply('📅 Você não tem eventos agendados.');
    return;
  }

  let message = '📅 *Seus eventos:*\n\n';
  userState.events.forEach((event, index) => {
    const date = new Date(event.startDate).toLocaleDateString('pt-BR');
    const time = new Date(event.startDate).toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    message += `${index + 1}. ${event.title}\n📅 ${date} às ${time}\n\n`;
  });

  message += 'Para cancelar, digite: cancelar [número]';
  
  ctx.reply(message, { parse_mode: 'Markdown' });
});

// Processar mensagens de texto
bot.on('text', (ctx) => {
  const text = ctx.message.text.toLowerCase();
  const userId = ctx.from.id.toString();
  
  // Inicializar estado do usuário se necessário
  if (!userStates.has(userId)) {
    userStates.set(userId, { events: [] });
  }
  
  const userState = userStates.get(userId);

  // Processar cancelamentos
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

  // Processar novos eventos
  try {
    const event = parseMessage(ctx.message.text);
    userState.events.push(event);
    
    const { googleLink, outlookLink } = generateCalendarLinks(event);
    
    const formatDate = (date: Date): string => {
      return date.toLocaleDateString('pt-BR', { 
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
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
    console.error('Erro ao processar evento:', error);
    ctx.reply('❌ Não consegui entender sua mensagem. Tente algo como: "reunião amanhã às 15h"');
  }
});

// Configurar graceful shutdown para evitar múltiplas instâncias
process.once('SIGINT', () => {
  console.log('🛑 Parando bot...');
  bot.stop('SIGINT');
});
process.once('SIGTERM', () => {
  console.log('🛑 Parando bot...');
  bot.stop('SIGTERM');
});

// Iniciar bot
bot.launch()
  .then(() => {
    console.log('✅ Bot original funcionando em @zelar_assistente_bot');
    console.log('📋 Use /start para começar');
  })
  .catch((error) => {
    if (error.message.includes('409')) {
      console.log('⚠️ Outra instância do bot está rodando. Aguarde alguns segundos e tente novamente.');
    } else {
      console.error('❌ Erro ao iniciar bot:', error.message);
    }
    process.exit(1);
  });