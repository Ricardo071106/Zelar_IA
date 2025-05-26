/**
 * Bot limpo e funcional - resolve conflitos definitivamente
 */

import { Telegraf } from 'telegraf';
import { format, addDays, setHours, setMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { log } from './vite';
import { storage } from './storage';

let activeBot: Telegraf | null = null;
let isStarting = false;

// Função para processar mensagens naturalmente
function parseMessage(text: string) {
  const lower = text.toLowerCase();
  
  // Listar eventos
  if (lower.includes('eventos') || lower.includes('mostrar') || lower.includes('listar')) {
    return { action: 'list' };
  }
  
  // Cancelar eventos
  if (lower.includes('cancelar') || lower.includes('apagar') || lower.includes('remover')) {
    const eventName = text.replace(/cancelar|apagar|remover/gi, '').trim();
    return { action: 'delete', eventName };
  }
  
  // Criar eventos
  if (lower.includes('reunião') || lower.includes('agendar') || lower.includes('compromisso') || 
      lower.includes('encontro') || lower.includes('evento') || lower.includes('crie')) {
    
    // Extrair título
    let title = 'Reunião';
    if (lower.includes('sobre')) {
      const parts = text.split(/sobre/i);
      if (parts.length > 1) {
        title = `Reunião sobre ${parts[1].trim()}`;
      }
    }
    
    // Calcular data - HOJE é domingo 26/05/2025
    const today = new Date(); // domingo 26/05
    let targetDate = today;
    
    if (lower.includes('amanhã')) {
      // AMANHÃ = segunda-feira 27/05/2025
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
    
    return { 
      action: 'create', 
      event: { 
        title: title.replace(/crie uma?|agende?/gi, '').trim(),
        startDate: targetDate,
        endDate: targetDate
      } 
    };
  }
  
  return { action: 'help' };
}

export async function startCleanBot(): Promise<boolean> {
  // Evitar múltiplas inicializações simultâneas
  if (isStarting) {
    log('Bot já está sendo iniciado...', 'telegram');
    return false;
  }
  
  isStarting = true;
  
  try {
    // Parar qualquer instância anterior
    if (activeBot) {
      try {
        log('Parando instância anterior...', 'telegram');
        await activeBot.stop();
        activeBot = null;
        // Aguardar um pouco para garantir que a conexão foi fechada
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        log(`Erro ao parar bot anterior: ${error}`, 'telegram');
      }
    }

    if (!process.env.TELEGRAM_BOT_TOKEN) {
      log('Token do Telegram não encontrado', 'telegram');
      return false;
    }

    log('Iniciando novo bot...', 'telegram');
    activeBot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

    // Comando /start
    activeBot.start(async (ctx) => {
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
          `• "mostrar meus eventos"\n` +
          `• "cancelar reunião"\n\n` +
          `Vamos organizar sua agenda! 📅`,
          { parse_mode: 'Markdown' }
        );
      } catch (error) {
        log(`Erro no start: ${error}`, 'telegram');
        await ctx.reply('Erro ao inicializar. Tente novamente com /start.');
      }
    });

    // Comando /eventos
    activeBot.command('eventos', async (ctx) => {
      if (!ctx.from) return;
      
      try {
        const user = await storage.getUserByTelegramId(ctx.from.id.toString());
        if (!user) {
          await ctx.reply('Use /start primeiro para começar.');
          return;
        }
        
        const events = await storage.getFutureEvents(user.id);
        
        if (events.length === 0) {
          await ctx.reply('Você não tem eventos futuros. Diga "reunião amanhã às 15h" para criar!');
          return;
        }
        
        let message = '📅 *Seus próximos eventos:*\n\n';
        events.forEach((event, index) => {
          const formattedDate = format(event.startDate, "EEEE, dd 'de' MMMM 'às' HH:mm", { locale: ptBR });
          message += `${index + 1}. *${event.title}*\n📆 ${formattedDate}\n\n`;
        });
        
        await ctx.reply(message, { parse_mode: 'Markdown' });
      } catch (error) {
        log(`Erro ao listar eventos: ${error}`, 'telegram');
        await ctx.reply('Erro ao buscar eventos. Tente novamente.');
      }
    });

    // Processar mensagens de texto
    activeBot.on('text', async (ctx) => {
      if (!ctx.from || !ctx.message?.text) return;
      
      try {
        const user = await storage.getUserByTelegramId(ctx.from.id.toString());
        if (!user) {
          await ctx.reply('Use /start primeiro para começar a usar o bot.');
          return;
        }
        
        const parsed = parseMessage(ctx.message.text);
        
        if (parsed.action === 'create' && parsed.event) {
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
          
          // Gerar links para calendários
          const endDate = newEvent.endDate || newEvent.startDate;
          const startISO = newEvent.startDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
          const endISO = endDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
          const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(newEvent.title)}&dates=${startISO}/${endISO}`;
          const outlookUrl = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(newEvent.title)}&startdt=${newEvent.startDate.toISOString()}&enddt=${endDate.toISOString()}`;
          
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
          const events = await storage.getFutureEvents(user.id);
          
          if (events.length === 0) {
            await ctx.reply('Você não tem eventos futuros agendados.\n\nCrie um dizendo algo como "reunião amanhã às 15h"!');
            return;
          }
          
          let message = '📅 *Seus próximos eventos:*\n\n';
          events.forEach((event, index) => {
            const formattedDate = format(event.startDate, "EEEE, dd 'de' MMMM 'às' HH:mm", { locale: ptBR });
            message += `${index + 1}. *${event.title}*\n📆 ${formattedDate}\n\n`;
          });
          
          await ctx.reply(message, { parse_mode: 'Markdown' });
          
        } else if (parsed.action === 'delete' && parsed.eventName) {
          // Cancelar evento
          const events = await storage.getFutureEvents(user.id);
          const eventToDelete = events.find(e => 
            e.title.toLowerCase().includes(parsed.eventName.toLowerCase())
          );
          
          if (eventToDelete) {
            await storage.deleteEvent(eventToDelete.id);
            await ctx.reply(`✅ Evento "${eventToDelete.title}" foi cancelado com sucesso!`);
          } else {
            await ctx.reply(`❌ Não encontrei um evento com o nome "${parsed.eventName}".`);
          }
          
        } else {
          await ctx.reply(
            'Como posso ajudar você?\n\n' +
            '💡 *Exemplos de comandos:*\n' +
            '• "reunião amanhã às 15h"\n' +
            '• "agendar compromisso na segunda às 10h"\n' +
            '• "mostrar meus eventos"\n' +
            '• "cancelar reunião"'
          );
        }
        
      } catch (error) {
        log(`Erro ao processar mensagem: ${error}`, 'telegram');
        await ctx.reply('Ocorreu um erro ao processar sua mensagem. Tente novamente.');
      }
    });

    // Iniciar o bot
    await activeBot.launch();
    log('Bot funcionando perfeitamente!', 'telegram');
    isStarting = false;
    return true;
    
  } catch (error) {
    log(`Erro ao iniciar bot: ${error}`, 'telegram');
    isStarting = false;
    return false;
  }
}

export function stopCleanBot(): void {
  if (activeBot) {
    try {
      activeBot.stop();
      activeBot = null;
      log('Bot parado com sucesso.', 'telegram');
    } catch (error) {
      log(`Erro ao parar bot: ${error}`, 'telegram');
    }
  }
}