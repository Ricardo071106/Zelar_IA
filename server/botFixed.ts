/**
 * Bot corrigido com cálculo de datas preciso e funcionalidade de cancelamento
 */

import { Telegraf } from 'telegraf';
import { format, addDays, setHours, setMinutes, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { log } from './vite';
import { storage } from './storage';
import type { InsertEvent } from '@shared/schema';

let bot: Telegraf | null = null;

// Mapa para controlar estados dos usuários
const userStates = new Map<string, any>();

/**
 * Processa texto e extrai informações de evento de forma simples e precisa
 */
function parseEventFromText(text: string): { 
  intent: 'create' | 'list' | 'delete' | 'unknown', 
  event?: any, 
  eventName?: string 
} {
  const lowerText = text.toLowerCase();
  
  // Detectar intenção de listar
  if (lowerText.includes('meus eventos') || lowerText.includes('listar') || lowerText.includes('mostrar')) {
    return { intent: 'list' };
  }
  
  // Detectar intenção de cancelar/deletar
  if (lowerText.includes('cancelar') || lowerText.includes('apagar') || lowerText.includes('remover')) {
    // Extrair nome do evento a ser cancelado
    const eventName = text.replace(/cancelar|apagar|remover/gi, '').trim();
    return { intent: 'delete', eventName };
  }
  
  // Detectar criação de evento
  if (lowerText.includes('reunião') || lowerText.includes('agendar') || lowerText.includes('encontro') || 
      lowerText.includes('compromisso') || lowerText.includes('evento') || lowerText.includes('lembrar')) {
    
    // Extrair título
    let title = text;
    const titleMatch = text.match(/(reunião|agendar|encontro|compromisso|evento|lembrar)\s+(.+?)(?:\s+na|às|em|dia|amanhã|segunda|terça|quarta|quinta|sexta|sábado|domingo)/i);
    if (titleMatch) {
      title = titleMatch[2].trim();
    }
    
    // Calcular data
    const today = new Date();
    let eventDate = new Date();
    
    if (lowerText.includes('amanhã')) {
      // Amanhã = hoje + 1 dia EXATO
      eventDate = addDays(today, 1);
    } else if (lowerText.includes('segunda')) {
      eventDate = getNextWeekday(today, 1); // Segunda = 1
    } else if (lowerText.includes('terça')) {
      eventDate = getNextWeekday(today, 2); // Terça = 2
    } else if (lowerText.includes('quarta')) {
      eventDate = getNextWeekday(today, 3);
    } else if (lowerText.includes('quinta')) {
      eventDate = getNextWeekday(today, 4);
    } else if (lowerText.includes('sexta')) {
      eventDate = getNextWeekday(today, 5);
    } else if (lowerText.includes('sábado')) {
      eventDate = getNextWeekday(today, 6);
    } else if (lowerText.includes('domingo')) {
      eventDate = getNextWeekday(today, 0);
    } else {
      // Se não especificou, usar hoje
      eventDate = today;
    }
    
    // Extrair horário
    const timeMatch = text.match(/(\d{1,2})h?(\d{2})?/);
    if (timeMatch) {
      const hour = parseInt(timeMatch[1]);
      const minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
      eventDate = setHours(setMinutes(eventDate, minute), hour);
    } else {
      // Horário padrão 10h se não especificado
      eventDate = setHours(setMinutes(eventDate, 0), 10);
    }
    
    return {
      intent: 'create',
      event: {
        title,
        startDate: eventDate,
        endDate: addDays(eventDate, 0), // Mesmo dia
        duration: 60,
        location: null,
        description: null
      }
    };
  }
  
  return { intent: 'unknown' };
}

/**
 * Calcula próxima ocorrência de um dia da semana
 */
function getNextWeekday(date: Date, targetDay: number): Date {
  const today = startOfDay(date);
  const currentDay = today.getDay();
  
  let daysToAdd = targetDay - currentDay;
  if (daysToAdd <= 0) {
    daysToAdd += 7; // Próxima semana
  }
  
  return addDays(today, daysToAdd);
}

/**
 * Formata data para exibição
 */
function formatDate(date: Date): string {
  return format(date, "EEEE, dd 'de' MMMM 'às' HH:mm", { locale: ptBR });
}

/**
 * Gera links para calendários
 */
function generateCalendarLinks(event: any) {
  const startDate = new Date(event.startDate);
  const endDate = new Date(event.endDate || event.startDate);
  
  // Google Calendar
  const googleStart = startDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const googleEnd = endDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${googleStart}/${googleEnd}`;
  
  // Outlook
  const outlookStart = startDate.toISOString();
  const outlookEnd = endDate.toISOString();
  const outlookUrl = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(event.title)}&startdt=${outlookStart}&enddt=${outlookEnd}`;
  
  return { googleUrl, outlookUrl };
}

/**
 * Inicia o bot corrigido
 */
export async function startFixedBot(): Promise<boolean> {
  try {
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      log('TELEGRAM_BOT_TOKEN não encontrado', 'telegram');
      return false;
    }

    // Parar bot anterior se existir
    if (bot) {
      await bot.stop();
      bot = null;
    }

    bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

    // Comando /start
    bot.start(async (ctx) => {
      if (!ctx.from) return;
      
      const telegramId = ctx.from.id.toString();
      
      try {
        // Buscar ou criar usuário
        let user = await storage.getUserByTelegramId(telegramId);
        if (!user) {
          user = await storage.createUser({
            username: ctx.from.username || `user_${telegramId}`,
            telegramId,
            email: null
          });
        }
        
        await ctx.reply(
          `🤖 *Zelar Assistente - Bot de Agenda*\n\n` +
          `Olá ${ctx.from.first_name}! Sou seu assistente de agenda.\n\n` +
          `📝 *Como usar:*\n` +
          `• Digite: "reunião amanhã às 15h"\n` +
          `• Digite: "mostrar meus eventos"\n` +
          `• Digite: "cancelar reunião"\n\n` +
          `Estou aqui para organizar sua agenda! 📅`,
          { parse_mode: 'Markdown' }
        );
      } catch (error) {
        log(`Erro no comando start: ${error}`, 'telegram');
        await ctx.reply('Erro ao inicializar. Tente novamente.');
      }
    });

    // Comando /eventos
    bot.command('eventos', async (ctx) => {
      if (!ctx.from) return;
      
      try {
        const user = await storage.getUserByTelegramId(ctx.from.id.toString());
        if (!user) {
          await ctx.reply('Use /start primeiro para começar.');
          return;
        }
        
        const events = await storage.getFutureEvents(user.id);
        
        if (events.length === 0) {
          await ctx.reply('Você não tem eventos futuros. Diga "reunião amanhã às 15h" para criar um!');
          return;
        }
        
        let message = '📅 *Seus próximos eventos:*\n\n';
        events.forEach((event, index) => {
          message += `${index + 1}. *${event.title}*\n📆 ${formatDate(event.startDate)}\n\n`;
        });
        
        await ctx.reply(message, { parse_mode: 'Markdown' });
      } catch (error) {
        log(`Erro ao listar eventos: ${error}`, 'telegram');
        await ctx.reply('Erro ao buscar eventos.');
      }
    });

    // Processar mensagens de texto
    bot.on('text', async (ctx) => {
      if (!ctx.from || !ctx.message || !ctx.message.text) return;
      
      const text = ctx.message.text;
      const telegramId = ctx.from.id.toString();
      
      try {
        const user = await storage.getUserByTelegramId(telegramId);
        if (!user) {
          await ctx.reply('Use /start primeiro.');
          return;
        }
        
        const parsed = parseEventFromText(text);
        
        if (parsed.intent === 'create' && parsed.event) {
          // Criar evento
          const newEvent = await storage.createEvent({
            title: parsed.event.title,
            startDate: parsed.event.startDate,
            endDate: parsed.event.endDate,
            userId: user.id,
            location: parsed.event.location,
            description: parsed.event.description
          });
          
          const formattedDate = formatDate(newEvent.startDate);
          const { googleUrl, outlookUrl } = generateCalendarLinks(newEvent);
          
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
          
        } else if (parsed.intent === 'list') {
          // Listar eventos
          const events = await storage.getFutureEvents(user.id);
          
          if (events.length === 0) {
            await ctx.reply('Sem eventos futuros. Crie um dizendo "reunião amanhã às 15h"!');
            return;
          }
          
          let message = '📅 *Seus eventos:*\n\n';
          events.forEach((event, index) => {
            message += `${index + 1}. *${event.title}*\n📆 ${formatDate(event.startDate)}\n\n`;
          });
          
          await ctx.reply(message, { parse_mode: 'Markdown' });
          
        } else if (parsed.intent === 'delete' && parsed.eventName) {
          // Cancelar evento
          const events = await storage.getFutureEvents(user.id);
          const eventToDelete = events.find(e => 
            e.title.toLowerCase().includes(parsed.eventName!.toLowerCase())
          );
          
          if (eventToDelete) {
            await storage.deleteEvent(eventToDelete.id);
            await ctx.reply(`✅ Evento "${eventToDelete.title}" cancelado com sucesso!`);
          } else {
            await ctx.reply(`❌ Evento "${parsed.eventName}" não encontrado.`);
          }
          
        } else {
          await ctx.reply(
            'Não entendi. Tente:\n' +
            '• "reunião amanhã às 15h"\n' +
            '• "mostrar meus eventos"\n' +
            '• "cancelar reunião"'
          );
        }
        
      } catch (error) {
        log(`Erro ao processar mensagem: ${error}`, 'telegram');
        await ctx.reply('Erro ao processar. Tente novamente.');
      }
    });

    await bot.launch();
    log('Bot corrigido iniciado com sucesso!', 'telegram');
    return true;
    
  } catch (error) {
    log(`Erro ao iniciar bot: ${error}`, 'telegram');
    return false;
  }
}

/**
 * Para o bot
 */
export function stopFixedBot(): void {
  if (bot) {
    bot.stop();
    bot = null;
    log('Bot corrigido parado.', 'telegram');
  }
}