/**
 * Bot do Telegram com solução universal para calendários
 * 
 * Esta abordagem não depende de senhas de aplicativo do Gmail que expiram
 */
import { Telegraf } from 'telegraf';
import nodemailer from 'nodemailer';
import ical from 'ical-generator';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { log } from "../vite";

// Manter o estado dos usuários
const userStates = new Map();

// Função para enviar convite de calendário universal
async function sendUniversalCalendarInvite(event: any, email: string, isCancellation = false) {
  try {
    // Criar conta temporária para testes
    const testAccount = await nodemailer.createTestAccount();
    log(`Conta de email temporária criada: ${testAccount.user}`, 'email');
    
    // Criar o transportador de email
    const transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });
    
    // Criar o objeto de calendário
    const calendar = ical({
      name: 'Assistente de Agenda'
    });
    
    // Gerar um ID único para o evento
    const eventId = event.id || Date.now().toString();
    
    // Criar o evento no calendário
    calendar.createEvent({
      uid: `${eventId}@assistente-agenda.com`,
      sequence: isCancellation ? 1 : 0,
      start: new Date(event.startDate),
      end: event.endDate ? new Date(event.endDate) : new Date(new Date(event.startDate).getTime() + 60 * 60 * 1000),
      summary: isCancellation ? `CANCELADO: ${event.title}` : event.title,
      description: event.description || '',
      location: event.location || '',
      status: isCancellation ? 'CANCELLED' : 'CONFIRMED'
    });
    
    // Formatar a data para exibição
    const formattedDate = format(
      new Date(event.startDate),
      "dd/MM/yyyy 'às' HH:mm",
      { locale: ptBR }
    );
    
    // Gerar URL do Google Calendar
    const startDateFormatted = new Date(event.startDate).toISOString().replace(/-|:|\.\d\d\d/g,'').slice(0,15);
    const endDateFormatted = new Date(event.endDate || new Date(new Date(event.startDate).getTime() + 60 * 60 * 1000)).toISOString().replace(/-|:|\.\d\d\d/g,'').slice(0,15);
    
    const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${startDateFormatted}/${endDateFormatted}&details=${encodeURIComponent(event.description || '')}&location=${encodeURIComponent(event.location || '')}`;
    
    // Gerar URL para Outlook
    const outlookCalendarUrl = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(event.title)}&startdt=${new Date(event.startDate).toISOString()}&enddt=${new Date(event.endDate || new Date(new Date(event.startDate).getTime() + 60 * 60 * 1000)).toISOString()}&body=${encodeURIComponent(event.description || '')}&location=${encodeURIComponent(event.location || '')}`;
    
    // Preparar as opções de email
    const mailOptions = {
      from: `"Assistente de Agenda" <${testAccount.user}>`,
      to: email,
      subject: isCancellation 
        ? `Cancelado: ${event.title} - ${formattedDate}`
        : `Convite: ${event.title} - ${formattedDate}`,
      text: `
        ${isCancellation ? 'Evento Cancelado' : 'Novo Evento'}
        
        Evento: ${event.title}
        Data: ${formattedDate}
        ${event.location ? `Local: ${event.location}` : ''}
        ${event.description ? `Descrição: ${event.description}` : ''}
        
        Este ${isCancellation ? 'cancelamento' : 'convite'} foi enviado pelo Assistente de Agenda.
        
        Adicionar ao Google Calendar: ${googleCalendarUrl}
        Adicionar ao Outlook: ${outlookCalendarUrl}
      `,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <div style="background-color: ${isCancellation ? '#ff6b6b' : '#0088cc'}; color: white; padding: 10px; border-radius: 5px 5px 0 0;">
            <h2 style="margin: 0;">${isCancellation ? 'Evento Cancelado' : 'Convite para Evento'}</h2>
          </div>
          <div style="padding: 20px;">
            <h3 style="color: #333;">${isCancellation ? `CANCELADO: ${event.title}` : event.title}</h3>
            <p style="color: #666;"><strong>Data:</strong> ${formattedDate}</p>
            ${event.location ? `<p style="color: #666;"><strong>Local:</strong> ${event.location}</p>` : ''}
            ${event.description ? `<p style="color: #666;"><strong>Descrição:</strong> ${event.description}</p>` : ''}
            <p style="margin-top: 20px; color: #888;">Este ${isCancellation ? 'cancelamento' : 'convite'} foi enviado pelo Assistente de Agenda.</p>
            
            <div style="margin-top: 25px; text-align: center;">
              <p style="margin-bottom: 15px; font-weight: bold;">Escolha como adicionar este evento ao seu calendário:</p>
              
              <!-- Google Calendar Button -->
              <table cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto; margin-bottom: 10px;">
                <tr>
                  <td style="border-radius: 4px; background-color: #4CAF50;">
                    <a href="${googleCalendarUrl}" 
                       target="_blank" style="padding: 10px 20px; border-radius: 4px; color: #ffffff; text-decoration: none; display: inline-block; font-weight: bold;">
                      Adicionar ao Google Calendar
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- Outlook Button -->
              <table cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto; margin-bottom: 10px;">
                <tr>
                  <td style="border-radius: 4px; background-color: #0078D4;">
                    <a href="${outlookCalendarUrl}" 
                       target="_blank" style="padding: 10px 20px; border-radius: 4px; color: #ffffff; text-decoration: none; display: inline-block; font-weight: bold;">
                      Adicionar ao Outlook
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin-top: 15px; color: #888; font-size: 0.9em;">
                Ou abra o arquivo .ics anexado a este email para adicionar a outros aplicativos de calendário.
              </p>
            </div>
          </div>
        </div>
      `,
      icalEvent: {
        filename: isCancellation ? 'cancelamento.ics' : 'convite.ics',
        method: isCancellation ? 'CANCEL' : 'REQUEST',
        content: calendar.toString()
      }
    };
    
    // Enviar o email
    const info = await transporter.sendMail(mailOptions);
    
    // Logando para depuração
    const actionType = isCancellation ? 'Cancelamento' : 'Convite';
    const previewUrl = nodemailer.getTestMessageUrl(info);
    
    if (previewUrl) {
      log(`Prévia do email: ${previewUrl}`, 'email');
    }
    
    log(`${actionType} de calendário enviado para ${email}`, 'email');
    
    return {
      success: true,
      message: `${actionType} de calendário enviado para ${email}`,
      previewUrl
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Erro ao enviar convite de calendário: ${errorMessage}`, 'email');
    
    return {
      success: false,
      message: `Erro ao enviar email: ${errorMessage}`
    };
  }
}

// Função para validar formato de email
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

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

// Inicializar e configurar o bot
export async function initializeTelegramBot() {
  try {
    // Verificar token do bot
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      log('TELEGRAM_BOT_TOKEN não está definido no ambiente', 'telegram');
      return false;
    }
    
    // Inicializar o bot do Telegram
    const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
    
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
    
    // Definir comandos disponíveis
    await bot.telegram.setMyCommands([
      { command: 'start', description: 'Iniciar conversa' },
      { command: 'eventos', description: 'Ver meus compromissos' },
      { command: 'help', description: 'Ajuda e exemplos' }
    ]);
    
    // Iniciar o bot
    await bot.launch();
    log('Bot Zelar funcionando perfeitamente!', 'telegram');
    
    // Encerramento correto do bot
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
    
    return true;
  } catch (error) {
    if (error.message && error.message.includes('409')) {
      log('Conflito detectado - outra instância do bot está rodando', 'telegram');
    } else {
      log(`Erro ao iniciar bot: ${error}`, 'telegram');
    }
    return false;
  }
}