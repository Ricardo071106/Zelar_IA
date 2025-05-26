/**
 * Bot Zelar standalone - funciona independentemente do servidor web
 */

import { Telegraf } from 'telegraf';
import { format, addDays, setHours, setMinutes, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Função para calcular próximo dia da semana
function getNextWeekday(date: Date, targetDay: number): Date {
  const today = startOfDay(date);
  const currentDay = today.getDay();
  
  let daysToAdd = targetDay - currentDay;
  if (daysToAdd <= 0) {
    daysToAdd += 7;
  }
  
  return addDays(today, daysToAdd);
}

// Função para processar mensagens em português brasileiro
function parseMessage(text: string) {
  const lower = text.toLowerCase();
  
  // Listar eventos
  if (lower.includes('eventos') || lower.includes('mostrar') || lower.includes('listar') || lower.includes('meus eventos')) {
    return { action: 'list' };
  }
  
  // Cancelar eventos
  if (lower.includes('cancelar') || lower.includes('apagar') || lower.includes('remover')) {
    const eventName = text.replace(/cancelar|apagar|remover/gi, '').trim();
    return { action: 'delete', eventName };
  }
  
  // Criar eventos
  if (lower.includes('reunião') || lower.includes('agendar') || lower.includes('compromisso') || 
      lower.includes('encontro') || lower.includes('evento') || lower.includes('crie') ||
      lower.includes('marcar') || lower.includes('lembrar')) {
    
    // Extrair título
    let title = 'Reunião';
    if (lower.includes('sobre')) {
      const aboutMatch = text.match(/sobre\s+(.+?)(?:\s+amanhã|segunda|terça|quarta|quinta|sexta|sábado|domingo|às|\d|$)/i);
      if (aboutMatch) {
        title = `Reunião sobre ${aboutMatch[1].trim()}`;
      }
    } else {
      // Tentar extrair título
      const titleMatch = text.match(/(reunião|agendar|compromisso|evento|encontro|marcar|lembrar)\s+(.+?)(?:\s+amanhã|segunda|terça|quarta|quinta|sexta|sábado|domingo|às|\d)/i);
      if (titleMatch && titleMatch[2]) {
        title = titleMatch[2].trim();
      }
    }
    
    // Calcular data - HOJE é domingo 26/05/2025
    const today = new Date();
    let targetDate = today;
    
    if (lower.includes('amanhã')) {
      // AMANHÃ = segunda-feira 27/05/2025 (hoje + 1 dia EXATO)
      targetDate = addDays(today, 1);
    } else if (lower.includes('segunda')) {
      targetDate = getNextWeekday(today, 1);
    } else if (lower.includes('terça')) {
      targetDate = getNextWeekday(today, 2);
    } else if (lower.includes('quarta')) {
      targetDate = getNextWeekday(today, 3);
    } else if (lower.includes('quinta')) {
      targetDate = getNextWeekday(today, 4);
    } else if (lower.includes('sexta')) {
      targetDate = getNextWeekday(today, 5);
    } else if (lower.includes('sábado')) {
      targetDate = getNextWeekday(today, 6);
    } else if (lower.includes('domingo')) {
      targetDate = getNextWeekday(today, 0);
    }
    
    // Extrair horário
    const timeMatch = text.match(/(\d{1,2})h(\d{2})?/);
    if (timeMatch) {
      const hour = parseInt(timeMatch[1]);
      const minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
      targetDate = setHours(setMinutes(targetDate, minute), hour);
    } else {
      targetDate = setHours(setMinutes(targetDate, 0), 10);
    }
    
    return { 
      action: 'create', 
      event: { 
        title,
        startDate: targetDate,
        endDate: targetDate
      } 
    };
  }
  
  return { action: 'help' };
}

// Memória simples para eventos por usuário
const userEvents = new Map<string, Array<{
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
}>>();

// Função principal do bot
async function startBot() {
  try {
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      console.log('❌ TELEGRAM_BOT_TOKEN não encontrado no ambiente');
      console.log('💡 Configure o token do seu bot do Telegram');
      return;
    }

    const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

    // Comando /start
    bot.start(async (ctx) => {
      if (!ctx.from) return;
      
      await ctx.reply(
        `🤖 *Zelar Assistente - Bot de Agenda*\n\n` +
        `Olá ${ctx.from.first_name}! Sou seu assistente de agenda.\n\n` +
        `💬 *Como usar:*\n` +
        `• "reunião amanhã às 15h"\n` +
        `• "mostrar meus eventos"\n` +
        `• "cancelar reunião"\n\n` +
        `Estou aqui para organizar sua agenda! 📅`,
        { parse_mode: 'Markdown' }
      );
    });

    // Comando /eventos
    bot.command('eventos', async (ctx) => {
      if (!ctx.from) return;
      
      const userId = ctx.from.id.toString();
      const events = userEvents.get(userId) || [];
      const futureEvents = events.filter(e => e.startDate > new Date());
      
      if (futureEvents.length === 0) {
        await ctx.reply('Você não tem eventos futuros.\n\nDiga "reunião amanhã às 15h" para criar um!');
        return;
      }
      
      let message = '📅 *Seus próximos eventos:*\n\n';
      futureEvents.forEach((event, index) => {
        const formattedDate = format(event.startDate, "EEEE, dd 'de' MMMM 'às' HH:mm", { locale: ptBR });
        message += `${index + 1}. *${event.title}*\n📆 ${formattedDate}\n\n`;
      });
      
      await ctx.reply(message, { parse_mode: 'Markdown' });
    });

    // Processar mensagens de texto
    bot.on('text', async (ctx) => {
      if (!ctx.from || !ctx.message?.text) return;
      
      const userId = ctx.from.id.toString();
      const parsed = parseMessage(ctx.message.text);
      
      if (parsed.action === 'create' && parsed.event) {
        // Criar evento
        const eventId = Date.now().toString();
        const newEvent = {
          id: eventId,
          title: parsed.event.title,
          startDate: parsed.event.startDate,
          endDate: parsed.event.endDate
        };
        
        const events = userEvents.get(userId) || [];
        events.push(newEvent);
        userEvents.set(userId, events);
        
        const formattedDate = format(newEvent.startDate, "EEEE, dd 'de' MMMM 'às' HH:mm", { locale: ptBR });
        
        // Gerar links para calendários
        const startISO = newEvent.startDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        const endISO = newEvent.endDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(newEvent.title)}&dates=${startISO}/${endISO}`;
        const outlookUrl = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(newEvent.title)}&startdt=${newEvent.startDate.toISOString()}&enddt=${newEvent.endDate.toISOString()}`;
        
        await ctx.reply(
          `✅ *Evento criado com sucesso!*\n\n` +
          `📋 ${newEvent.title}\n` +
          `📅 ${formattedDate}\n\n` +
          `*Adicionar ao seu calendário:*`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '📅 Google Calendar', url: googleUrl }],
                [{ text: '📅 Outlook', url: outlookUrl }]
              ]
            }
          }
        );
        
      } else if (parsed.action === 'list') {
        // Listar eventos
        const events = userEvents.get(userId) || [];
        const futureEvents = events.filter(e => e.startDate > new Date());
        
        if (futureEvents.length === 0) {
          await ctx.reply('Você não tem eventos futuros.\n\nCrie um dizendo "reunião amanhã às 15h"!');
          return;
        }
        
        let message = '📅 *Seus próximos eventos:*\n\n';
        futureEvents.forEach((event, index) => {
          const formattedDate = format(event.startDate, "EEEE, dd 'de' MMMM 'às' HH:mm", { locale: ptBR });
          message += `${index + 1}. *${event.title}*\n📆 ${formattedDate}\n\n`;
        });
        
        await ctx.reply(message, { parse_mode: 'Markdown' });
        
      } else if (parsed.action === 'delete' && parsed.eventName) {
        // Cancelar evento
        const events = userEvents.get(userId) || [];
        const eventIndex = events.findIndex(e => 
          e.title.toLowerCase().includes(parsed.eventName.toLowerCase())
        );
        
        if (eventIndex !== -1) {
          const deletedEvent = events[eventIndex];
          events.splice(eventIndex, 1);
          userEvents.set(userId, events);
          await ctx.reply(`✅ Evento "${deletedEvent.title}" foi cancelado com sucesso!`);
        } else {
          await ctx.reply(`❌ Não encontrei um evento com "${parsed.eventName}".`);
        }
        
      } else {
        await ctx.reply(
          'Como posso ajudar?\n\n' +
          '💡 *Exemplos:*\n' +
          '• "reunião amanhã às 15h"\n' +
          '• "agendar compromisso na segunda às 10h"\n' +
          '• "mostrar meus eventos"\n' +
          '• "cancelar reunião"'
        );
      }
    });

    await bot.launch();
    console.log('🤖 Bot Zelar funcionando perfeitamente!');
    console.log('📅 Pronto para agendar eventos em português brasileiro');
    
    // Graceful stop
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
    
  } catch (error) {
    console.error('❌ Erro ao iniciar bot:', error);
  }
}

// Iniciar o bot
startBot();