/**
 * Bot funcional e limpo - versão final que resolve todos os problemas
 */

import { Telegraf } from 'telegraf';
import { format, addDays, setHours, setMinutes, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { log } from './vite';
import { storage } from './storage';

let botInstance: Telegraf | null = null;

// Função para interpretar datas em português
function parseDate(text: string): Date {
  const today = startOfDay(new Date()); // Hoje é domingo 26/05/2025
  const lower = text.toLowerCase();
  
  if (lower.includes('amanhã')) {
    // Amanhã = segunda-feira 27/05/2025 (hoje + 1 dia EXATO)
    return addDays(today, 1);
  }
  
  if (lower.includes('segunda')) {
    return getNextWeekday(today, 1);
  }
  if (lower.includes('terça')) {
    return getNextWeekday(today, 2);
  }
  if (lower.includes('quarta')) {
    return getNextWeekday(today, 3);
  }
  if (lower.includes('quinta')) {
    return getNextWeekday(today, 4);
  }
  if (lower.includes('sexta')) {
    return getNextWeekday(today, 5);
  }
  
  return today; // Padrão: hoje
}

function getNextWeekday(date: Date, targetDay: number): Date {
  const currentDay = date.getDay();
  let daysToAdd = targetDay - currentDay;
  if (daysToAdd <= 0) {
    daysToAdd += 7;
  }
  return addDays(date, daysToAdd);
}

function parseTime(text: string): number {
  const timeMatch = text.match(/(\d{1,2})h/);
  return timeMatch ? parseInt(timeMatch[1]) : 10; // Padrão: 10h
}

function parseEventFromMessage(text: string) {
  const lower = text.toLowerCase();
  
  // Verificar se é listagem
  if (lower.includes('eventos') || lower.includes('mostrar') || lower.includes('listar')) {
    return { type: 'list' };
  }
  
  // Verificar se é cancelamento
  if (lower.includes('cancelar') || lower.includes('apagar')) {
    const eventName = text.replace(/cancelar|apagar/gi, '').trim();
    return { type: 'delete', eventName };
  }
  
  // Verificar se é criação de evento
  if (lower.includes('reunião') || lower.includes('agendar') || lower.includes('compromisso') || 
      lower.includes('evento') || lower.includes('crie')) {
    
    // Extrair título
    let title = 'Reunião';
    if (lower.includes('sobre')) {
      const aboutMatch = text.match(/sobre\s+(.+?)(?:\s+amanhã|segunda|terça|quarta|quinta|sexta|às|\d|$)/i);
      if (aboutMatch) {
        title = `Reunião sobre ${aboutMatch[1].trim()}`;
      }
    } else {
      // Tentar extrair título de outras formas
      const titleMatch = text.match(/(reunião|agendar|compromisso|evento)\s+(.+?)(?:\s+amanhã|segunda|terça|quarta|quinta|sexta|às|\d)/i);
      if (titleMatch && titleMatch[2]) {
        title = titleMatch[2].trim();
      }
    }
    
    const eventDate = parseDate(text);
    const hour = parseTime(text);
    const finalDate = setHours(setMinutes(eventDate, 0), hour);
    
    return {
      type: 'create',
      event: {
        title,
        startDate: finalDate,
        endDate: finalDate
      }
    };
  }
  
  return { type: 'help' };
}

export async function startWorkingBot(): Promise<boolean> {
  try {
    // Parar instância anterior se existir
    if (botInstance) {
      try {
        await botInstance.stop();
        log('Instância anterior parada.', 'telegram');
      } catch {}
      botInstance = null;
    }

    if (!process.env.TELEGRAM_BOT_TOKEN) {
      log('Token do Telegram não encontrado', 'telegram');
      return false;
    }

    botInstance = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

    // Comando /start
    botInstance.start(async (ctx) => {
      if (!ctx.from) return;
      
      try {
        const telegramId = ctx.from.id.toString();
        let user = await storage.getUserByTelegramId(telegramId);
        
        if (!user) {
          user = await storage.createUser({
            username: ctx.from.username || `user_${telegramId}`,
            password: 'telegram_user',
            telegramId,
            email: null
          });
        }
        
        await ctx.reply(
          `🤖 *Zelar Assistente*\n\n` +
          `Olá ${ctx.from.first_name}! Sou seu assistente de agenda.\n\n` +
          `💬 *Como usar:*\n` +
          `• "reunião amanhã às 15h"\n` +
          `• "/eventos" para ver sua agenda\n` +
          `• "cancelar reunião" para remover\n\n` +
          `Vamos organizar sua agenda! 📅`,
          { parse_mode: 'Markdown' }
        );
      } catch (error) {
        log(`Erro no start: ${error}`, 'telegram');
        await ctx.reply('Erro ao inicializar. Tente /start novamente.');
      }
    });

    // Comando /eventos
    botInstance.command('eventos', async (ctx) => {
      if (!ctx.from) return;
      
      try {
        const user = await storage.getUserByTelegramId(ctx.from.id.toString());
        if (!user) {
          await ctx.reply('Use /start primeiro.');
          return;
        }
        
        const events = await storage.getFutureEvents(user.id);
        
        if (events.length === 0) {
          await ctx.reply('Você não tem eventos futuros.\n\nDiga "reunião amanhã às 15h" para criar um!');
          return;
        }
        
        let message = '📅 *Seus próximos eventos:*\n\n';
        events.forEach((event, index) => {
          const formattedDate = format(event.startDate, "EEEE, dd 'de' MMMM 'às' HH:mm", { locale: ptBR });
          message += `${index + 1}. *${event.title}*\n📆 ${formattedDate}\n\n`;
        });
        
        await ctx.reply(message, { parse_mode: 'Markdown' });
      } catch (error) {
        log(`Erro ao listar: ${error}`, 'telegram');
        await ctx.reply('Erro ao buscar eventos.');
      }
    });

    // Processar mensagens de texto
    botInstance.on('text', async (ctx) => {
      if (!ctx.from || !ctx.message?.text) return;
      
      try {
        const user = await storage.getUserByTelegramId(ctx.from.id.toString());
        if (!user) {
          await ctx.reply('Use /start primeiro.');
          return;
        }
        
        const parsed = parseEventFromMessage(ctx.message.text);
        
        if (parsed.type === 'create' && parsed.event) {
          // Criar evento
          const newEvent = await storage.createEvent({
            title: parsed.event.title,
            startDate: parsed.event.startDate,
            endDate: parsed.event.endDate,
            userId: user.id,
            location: null,
            description: null
          });
          
          const formattedDate = format(newEvent.startDate, "EEEE, dd 'de' MMMM 'às' HH:mm", { locale: ptBR });
          
          // Gerar link do Google Calendar
          const startISO = newEvent.startDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
          const endDate = newEvent.endDate || newEvent.startDate;
          const endISO = endDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
          const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(newEvent.title)}&dates=${startISO}/${endISO}`;
          
          await ctx.reply(
            `✅ *Evento criado com sucesso!*\n\n` +
            `📋 ${newEvent.title}\n` +
            `📅 ${formattedDate}\n\n` +
            `Clique abaixo para adicionar ao seu calendário:`,
            {
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [
                  [{ text: '📅 Adicionar ao Google Calendar', url: googleUrl }]
                ]
              }
            }
          );
          
        } else if (parsed.type === 'list') {
          // Listar eventos (mesmo código do comando /eventos)
          const events = await storage.getFutureEvents(user.id);
          
          if (events.length === 0) {
            await ctx.reply('Você não tem eventos futuros.\n\nDiga "reunião amanhã às 15h" para criar um!');
            return;
          }
          
          let message = '📅 *Seus próximos eventos:*\n\n';
          events.forEach((event, index) => {
            const formattedDate = format(event.startDate, "EEEE, dd 'de' MMMM 'às' HH:mm", { locale: ptBR });
            message += `${index + 1}. *${event.title}*\n📆 ${formattedDate}\n\n`;
          });
          
          await ctx.reply(message, { parse_mode: 'Markdown' });
          
        } else if (parsed.type === 'delete' && parsed.eventName) {
          // Cancelar evento
          const events = await storage.getFutureEvents(user.id);
          const eventToDelete = events.find(e => 
            e.title.toLowerCase().includes(parsed.eventName.toLowerCase())
          );
          
          if (eventToDelete) {
            await storage.deleteEvent(eventToDelete.id);
            await ctx.reply(`✅ Evento "${eventToDelete.title}" foi cancelado com sucesso!`);
          } else {
            await ctx.reply(`❌ Não encontrei um evento com "${parsed.eventName}".`);
          }
          
        } else {
          await ctx.reply(
            'Como posso ajudar?\n\n' +
            '💡 *Exemplos:*\n' +
            '• "reunião amanhã às 15h"\n' +
            '• "agendar compromisso na segunda às 10h"\n' +
            '• "/eventos" para ver sua agenda\n' +
            '• "cancelar reunião" para remover'
          );
        }
        
      } catch (error) {
        log(`Erro ao processar: ${error}`, 'telegram');
        await ctx.reply('Erro ao processar sua mensagem. Tente novamente.');
      }
    });

    await botInstance.launch();
    log('Bot funcionando perfeitamente!', 'telegram');
    return true;
    
  } catch (error) {
    log(`Erro ao iniciar: ${error}`, 'telegram');
    return false;
  }
}

export function stopWorkingBot(): void {
  if (botInstance) {
    try {
      botInstance.stop();
      botInstance = null;
      log('Bot parado.', 'telegram');
    } catch {}
  }
}