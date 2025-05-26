/**
 * Bot único e simples - evita conflitos
 */

import { Telegraf } from 'telegraf';
import { format, addDays, setHours, setMinutes, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { log } from './vite';
import { storage } from './storage';

let botInstance: Telegraf | null = null;

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

// Função para processar texto simples
function parseMessage(text: string) {
  const lower = text.toLowerCase();
  
  if (lower.includes('meus eventos') || lower.includes('listar') || lower.includes('mostrar')) {
    return { type: 'list' };
  }
  
  if (lower.includes('cancelar') || lower.includes('apagar')) {
    const eventName = text.replace(/cancelar|apagar/gi, '').trim();
    return { type: 'delete', eventName };
  }
  
  if (lower.includes('reunião') || lower.includes('agendar') || lower.includes('compromisso')) {
    // Extrair título
    let title = 'Reunião';
    const titleMatch = text.match(/(reunião|agendar|compromisso)\s+(.+?)(?:\s+amanhã|segunda|terça|quarta|quinta|sexta|às|\d)/i);
    if (titleMatch) {
      title = titleMatch[2].trim();
    }
    
    // Calcular data
    const today = new Date();
    let eventDate = today;
    
    if (lower.includes('amanhã')) {
      // IMPORTANTE: amanhã = exatamente hoje + 1 dia
      eventDate = addDays(today, 1);
    } else if (lower.includes('segunda')) {
      eventDate = getNextWeekday(today, 1);
    } else if (lower.includes('terça')) {
      eventDate = getNextWeekday(today, 2);
    }
    
    // Extrair horário
    const timeMatch = text.match(/(\d{1,2})h/);
    if (timeMatch) {
      const hour = parseInt(timeMatch[1]);
      eventDate = setHours(setMinutes(eventDate, 0), hour);
    } else {
      eventDate = setHours(setMinutes(eventDate, 0), 10);
    }
    
    return { 
      type: 'create', 
      event: { title, startDate: eventDate, endDate: eventDate } 
    };
  }
  
  return { type: 'unknown' };
}

export async function startSingleBot(): Promise<boolean> {
  try {
    // Parar instância anterior
    if (botInstance) {
      try {
        await botInstance.stop();
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
          `Olá! Sou seu assistente de agenda.\n\n` +
          `💬 *Como usar:*\n` +
          `• "reunião amanhã às 15h"\n` +
          `• "mostrar meus eventos"\n` +
          `• "cancelar reunião"\n\n` +
          `Vamos organizar sua agenda! 📅`,
          { parse_mode: 'Markdown' }
        );
      } catch (error) {
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
          await ctx.reply('Nenhum evento futuro. Diga "reunião amanhã às 15h" para criar!');
          return;
        }
        
        let message = '📅 *Seus próximos eventos:*\n\n';
        events.forEach((event, index) => {
          const formattedDate = format(event.startDate, "EEEE, dd 'de' MMMM 'às' HH:mm", { locale: ptBR });
          message += `${index + 1}. *${event.title}*\n📆 ${formattedDate}\n\n`;
        });
        
        await ctx.reply(message, { parse_mode: 'Markdown' });
      } catch (error) {
        await ctx.reply('Erro ao buscar eventos.');
      }
    });

    // Processar mensagens
    botInstance.on('text', async (ctx) => {
      if (!ctx.from || !ctx.message?.text) return;
      
      try {
        const user = await storage.getUserByTelegramId(ctx.from.id.toString());
        if (!user) {
          await ctx.reply('Use /start primeiro.');
          return;
        }
        
        const parsed = parseMessage(ctx.message.text);
        
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
          
          // Links para calendários
          const endDate = newEvent.endDate || addDays(newEvent.startDate, 0);
          const startISO = newEvent.startDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
          const endISO = endDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
          const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(newEvent.title)}&dates=${startISO}/${endISO}`;
          const outlookUrl = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(newEvent.title)}&startdt=${newEvent.startDate.toISOString()}&enddt=${endDate.toISOString()}`;
          
          await ctx.reply(
            `✅ *Evento criado!*\n\n` +
            `📋 ${newEvent.title}\n` +
            `📅 ${formattedDate}\n\n` +
            `*Adicionar ao calendário:*`,
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
          
        } else if (parsed.type === 'list') {
          // Listar eventos
          const events = await storage.getFutureEvents(user.id);
          
          if (events.length === 0) {
            await ctx.reply('Nenhum evento futuro. Crie um dizendo "reunião amanhã às 15h"!');
            return;
          }
          
          let message = '📅 *Seus eventos:*\n\n';
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
            await ctx.reply(`✅ Evento "${eventToDelete.title}" cancelado!`);
          } else {
            await ctx.reply(`❌ Evento "${parsed.eventName}" não encontrado.`);
          }
          
        } else {
          await ctx.reply(
            'Como posso ajudar?\n\n' +
            '💡 *Exemplos:*\n' +
            '• "reunião amanhã às 15h"\n' +
            '• "mostrar meus eventos"\n' +
            '• "cancelar reunião"'
          );
        }
        
      } catch (error) {
        log(`Erro: ${error}`, 'telegram');
        await ctx.reply('Erro ao processar. Tente novamente.');
      }
    });

    await botInstance.launch();
    log('Bot único iniciado com sucesso!', 'telegram');
    return true;
    
  } catch (error) {
    log(`Erro ao iniciar bot: ${error}`, 'telegram');
    return false;
  }
}

export function stopSingleBot(): void {
  if (botInstance) {
    try {
      botInstance.stop();
    } catch {}
    botInstance = null;
    log('Bot parado.', 'telegram');
  }
}