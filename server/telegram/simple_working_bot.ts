/**
 * Bot Zelar - Versão Simplificada e Funcional
 */
import { Telegraf } from 'telegraf';
import { log } from "../vite";

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

  // Melhor detecção de horários (incluindo PM/AM e números soltos)
  const timePatterns = [
    /(\d{1,2}):(\d{2})\s*h?/i,  // 15:30h ou 15:30
    /(\d{1,2})h(\d{2})/i,       // 15h30
    /(\d{1,2})\s*h/i,           // 15h
    /(\d{1,2})\s*pm/i,          // 8pm
    /(\d{1,2})\s*am/i,          // 8am
    /\b(\d{1,2})\b(?!\d)/i      // 15 (número solto sem h/pm/am)
  ];

  for (const pattern of timePatterns) {
    const match = text.match(pattern);
    if (match) {
      let hour = parseInt(match[1]);
      let minute = 0;
      
      if (match[2]) {
        minute = parseInt(match[2]);
      }
      
      // Converter PM para 24h
      if (text.toLowerCase().includes('pm') && hour < 12) {
        hour += 12;
      }
      // Converter AM
      else if (text.toLowerCase().includes('am') && hour === 12) {
        hour = 0;
      }
      // Para números soltos (sem pm/am), assumir formato 24h se >= 7, senão assumir PM se < 7
      else if (!text.toLowerCase().includes('pm') && !text.toLowerCase().includes('am') && !text.includes('h') && hour >= 1 && hour <= 23) {
        // Manter o horário como está se for um número válido de 24h
        hour = hour;
      }
      
      time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      break;
    }
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

  // Processamento mais inteligente do título
  let cleanText = text.toLowerCase();
  
  // Primeiro, tentar encontrar o evento específico mencionado
  const eventTypes = [
    'reunião', 'jantar', 'almoço', 'consulta', 'dentista', 'médico', 
    'encontro', 'apresentação', 'compromisso', 'evento', 'visita',
    'aula', 'curso', 'palestra', 'workshop', 'entrevista', 'cinema',
    'teatro', 'show', 'festa', 'aniversário', 'casamento'
  ];
  
  let foundEvent = null;
  for (const eventType of eventTypes) {
    if (cleanText.includes(eventType)) {
      foundEvent = eventType;
      break;
    }
  }
  
  if (foundEvent) {
    // Se encontrou "reunião", verificar se tem especificação (1:1, com pessoa, etc.)
    if (foundEvent === 'reunião') {
      const reuniaoMatch = cleanText.match(/reunião\s+(de\s+)?(.+?)(?:\s+(?:amanhã|hoje|segunda|terça|quarta|quinta|sexta|sábado|domingo|\d{1,2}))/i);
      if (reuniaoMatch && reuniaoMatch[2] && reuniaoMatch[2].length < 20) {
        title = `Reunião ${reuniaoMatch[2].trim()}`;
      } else {
        title = 'Reunião';
      }
    } else {
      title = foundEvent.charAt(0).toUpperCase() + foundEvent.slice(1);
    }
  } else {
    // Se não encontrou tipo específico, extrair da frase
    title = text
      .replace(/\b(\d{1,2}):?(\d{2})?\s*(h|pm|am)?\b/gi, '') // Remove horários completos
      .replace(/\b\d{1,2}\b(?!\d)/gi, '') // Remove números soltos (horários)
      .replace(/\b(amanhã|hoje|segunda|terça|quarta|quinta|sexta|sábado|domingo)\b/gi, '') // Remove dias
      .replace(/\b(ola|olá|oi|marque?|marcar|agendar|às?|para|com|uma?|de|a|o|mim|me|favor|por)\b/gi, '') // Remove palavras conectivas
      .replace(/\s+/g, ' ') // Remove espaços múltiplos
      .trim();
      
    // Se ainda ficou muito longo ou vazio, usar padrão
    if (!title || title.length < 2 || title.length > 30) {
      title = 'Evento';
    } else {
      // Capitalizar primeira letra
      title = title.charAt(0).toUpperCase() + title.slice(1);
    }
  }

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
export async function initializeSimpleBot() {
  try {
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      log('TELEGRAM_BOT_TOKEN não está definido', 'telegram');
      return false;
    }
    
    const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
    
    // Comando /start
    bot.start((ctx) => {
      const userId = ctx.from?.id.toString();
      if (userId) {
        userStates.set(userId, { events: [] });
      }
      
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
      const userId = ctx.from?.id.toString();
      if (!userId) return;
      
      const userState = userStates.get(userId) || { events: [] };
      
      if (userState.events.length === 0) {
        ctx.reply('📅 Você não tem eventos agendados.');
        return;
      }

      let message = '📅 *Seus eventos:*\n\n';
      userState.events.forEach((event: any, index: number) => {
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
      const text = ctx.message?.text?.toLowerCase();
      const userId = ctx.from?.id.toString();
      
      if (!text || !userId) return;
      
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
        log(`Erro ao processar evento: ${error}`, 'telegram');
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
  } catch (error: any) {
    if (error.message && error.message.includes('409')) {
      log('Conflito detectado - outra instância do bot está rodando', 'telegram');
    } else {
      log(`Erro ao iniciar bot: ${error}`, 'telegram');
    }
    return false;
  }
}