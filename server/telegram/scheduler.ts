import { scheduleJob } from 'node-schedule';
import { getPendingReminders, markReminderAsSent } from './event';
import { log } from '../vite';
import bot from './bot';
import { storage } from '../storage';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Configura o agendador para verificar lembretes a cada minuto
 */
export function setupReminderScheduler() {
  // Agenda para executar a cada minuto
  const job = scheduleJob('* * * * *', async function() {
    try {
      log('Verificando lembretes pendentes...', 'scheduler');
      await checkAndSendReminders();
    } catch (error) {
      log(`Erro ao verificar lembretes: ${error}`, 'scheduler');
    }
  });
  
  log('Agendador de lembretes configurado com sucesso', 'scheduler');
  return job;
}

/**
 * Verifica lembretes pendentes e envia notificações
 */
async function checkAndSendReminders() {
  try {
    const pendingReminders = await getPendingReminders();
    
    if (pendingReminders.length === 0) {
      return;
    }
    
    log(`${pendingReminders.length} lembretes pendentes encontrados`, 'scheduler');
    
    for (const reminder of pendingReminders) {
      try {
        // Busca informações do evento
        const event = await storage.getEvent(reminder.eventId);
        if (!event) {
          log(`Evento não encontrado para o lembrete ${reminder.id}`, 'scheduler');
          continue;
        }
        
        // Busca informações do usuário
        const user = await storage.getUser(event.userId);
        if (!user || !user.telegramId) {
          log(`Usuário não encontrado para o evento ${event.id}`, 'scheduler');
          continue;
        }
        
        // Formata a mensagem do lembrete
        const startDate = new Date(event.startDate);
        const formattedDate = format(startDate, "EEEE, dd 'de' MMMM 'às' HH:mm", { locale: ptBR });
        
        let message = '';
        
        if (reminder.type === '24h') {
          message = `⏰ *Lembrete: Evento amanhã*\n\n`;
        } else if (reminder.type === '30min') {
          message = `⏰ *Lembrete: Evento em 30 minutos*\n\n`;
        } else {
          message = `⏰ *Lembrete*\n\n`;
        }
        
        message += `📅 *${event.title}*\n`;
        message += `🕒 ${formattedDate}\n`;
        
        if (event.location) {
          message += `📍 ${event.location}\n`;
        }
        
        if (event.description) {
          message += `📝 ${event.description}\n`;
        }
        
        // Envia a mensagem
        await bot.telegram.sendMessage(user.telegramId, message, { parse_mode: 'Markdown' });
        log(`Lembrete enviado para o usuário ${user.username}`, 'scheduler');
        
        // Marca o lembrete como enviado
        await markReminderAsSent(reminder.id);
      } catch (error) {
        log(`Erro ao processar lembrete ${reminder.id}: ${error}`, 'scheduler');
      }
    }
  } catch (error) {
    log(`Erro ao verificar lembretes pendentes: ${error}`, 'scheduler');
  }
}