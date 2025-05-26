/**
 * Bot Inteligente Zelar - Inspirado no HeyDola
 * 
 * Processamento avançado de linguagem natural para criar eventos
 * com títulos precisos e datas corretas
 */

import { Telegraf, Context } from 'telegraf';
import { db } from '../db';
import { events, users, type InsertEvent } from '@shared/schema';
import { eq } from 'drizzle-orm';

let bot: Telegraf | null = null;

interface EventData {
  title: string;
  startDate: Date;
  endDate?: Date;
  location?: string;
  description?: string;
}

/**
 * Processamento inteligente de eventos usando IA
 */
async function processNaturalLanguageEvent(text: string): Promise<EventData> {
  const now = new Date();
  const textLower = text.toLowerCase().trim();

  // 1. PROCESSAMENTO DE HORÁRIOS
  let startTime = '10:00';
  let endTime: string | null = null;
  
  // Detectar horários de início
  const timePatterns = [
    { pattern: /(?:às?|as)\s*(\d{1,2})(?::(\d{2}))?\s*(?:h|hs)?(?:oras?)?/i, type: 'formal' },
    { pattern: /(?:começando|comecando|inicio|inicia)\s+(?:às?|as)\s*(\d{1,2})(?::(\d{2}))?\s*(?:h|hs)?/i, type: 'start' },
    { pattern: /(\d{1,2})(?::(\d{2}))?\s*(?:h|hs)(?:oras?)?/i, type: 'simple' },
    { pattern: /(\d{1,2})\s*(?:da\s+)?(?:manhã|manha)/i, type: 'morning' },
    { pattern: /(\d{1,2})\s*(?:da\s+)?(?:tarde)/i, type: 'afternoon' },
    { pattern: /(\d{1,2})\s*(?:da\s+)?(?:noite)/i, type: 'night' }
  ];

  for (const { pattern, type } of timePatterns) {
    const match = textLower.match(pattern);
    if (match) {
      let hour = parseInt(match[1]);
      const minute = match[2] ? parseInt(match[2]) : 0;
      
      // Ajustes de horário baseados no contexto
      if (type === 'afternoon' && hour < 12) hour += 12;
      if (type === 'night' && hour < 18) hour += 12;
      if (type === 'morning' && hour > 12) hour = hour;
      
      startTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      break;
    }
  }

  // Detectar horários de fim
  const endTimePatterns = [
    /(?:até|ate|acabando|terminando|finalizando)\s+(?:às?|as)\s*(\d{1,2})(?::(\d{2}))?\s*(?:h|hs)?/i,
    /(?:e|até|ate)\s+(\d{1,2})(?::(\d{2}))?\s*(?:h|hs)?/i
  ];

  for (const pattern of endTimePatterns) {
    const match = textLower.match(pattern);
    if (match) {
      let hour = parseInt(match[1]);
      const minute = match[2] ? parseInt(match[2]) : 0;
      endTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      break;
    }
  }

  // 2. PROCESSAMENTO DE DATAS
  let eventDate = new Date(now);
  
  // Função para calcular próximo dia da semana
  function getNextWeekday(currentDate: Date, targetDay: number): Date {
    const result = new Date(currentDate);
    const currentDay = result.getDay();
    let daysToAdd = targetDay - currentDay;
    if (daysToAdd <= 0) daysToAdd += 7;
    result.setDate(result.getDate() + daysToAdd);
    return result;
  }

  // Detectar datas relativas e absolutas
  const datePatterns = [
    { pattern: /(?:amanha|amanhã)/, days: 1 },
    { pattern: /hoje/, days: 0 },
    { pattern: /depois\s+de\s+amanha|depois\s+de\s+amanhã/, days: 2 },
    { pattern: /(?:na\s+)?(?:próxima\s+)?(?:segunda(?:-feira)?|seg)/, weekday: 1 },
    { pattern: /(?:na\s+)?(?:próxima\s+)?(?:terça(?:-feira)?|ter)/, weekday: 2 },
    { pattern: /(?:na\s+)?(?:próxima\s+)?(?:quarta(?:-feira)?|qua)/, weekday: 3 },
    { pattern: /(?:na\s+)?(?:próxima\s+)?(?:quinta(?:-feira)?|qui)/, weekday: 4 },
    { pattern: /(?:na\s+)?(?:próxima\s+)?(?:sexta(?:-feira)?|sex)/, weekday: 5 },
    { pattern: /(?:no\s+)?(?:próximo\s+)?(?:sábado|sabado|sab)/, weekday: 6 },
    { pattern: /(?:no\s+)?(?:próximo\s+)?(?:domingo|dom)/, weekday: 0 },
    { pattern: /(?:daqui\s+a\s+)?(\d+)\s+(?:dias?|day)/, relativeDays: true },
    { pattern: /(?:em\s+)?(\d+)\s+(?:semanas?|week)/, relativeWeeks: true }
  ];

  for (const datePattern of datePatterns) {
    const match = textLower.match(datePattern.pattern);
    if (match) {
      if ('days' in datePattern && typeof datePattern.days === 'number') {
        eventDate.setDate(now.getDate() + datePattern.days);
        break;
      } else if ('weekday' in datePattern && typeof datePattern.weekday === 'number') {
        eventDate = getNextWeekday(now, datePattern.weekday);
        break;
      } else if (datePattern.relativeDays) {
        const days = parseInt(match[1]);
        eventDate.setDate(now.getDate() + days);
        break;
      } else if (datePattern.relativeWeeks) {
        const weeks = parseInt(match[1]);
        eventDate.setDate(now.getDate() + (weeks * 7));
        break;
      }
    }
  }

  // 3. PROCESSAMENTO INTELIGENTE DE TÍTULOS
  let title = 'Evento';
  
  // Remover palavras temporais e de horário para extrair o título
  let cleanText = text
    .replace(/(?:amanha|amanhã|hoje|depois\s+de\s+amanha|ontem)/gi, '')
    .replace(/(?:segunda|terça|quarta|quinta|sexta|sábado|sabado|domingo)(?:-feira)?/gi, '')
    .replace(/(?:às?|as|começa|comeca|inicio|inicia|termina|acaba|até|ate)\s*\d{1,2}(?::\d{2})?\s*(?:h|hs|am|pm)?/gi, '')
    .replace(/\d{1,2}(?::\d{2})?\s*(?:h|hs|am|pm|da\s+manhã|da\s+tarde|da\s+noite)/gi, '')
    .replace(/(?:reserve|agende|marque|lembre|lembrar)\s+(?:um\s+)?(?:horário|horario|compromisso)/gi, '')
    .replace(/(?:para|pra|de|da|do|na|no|em)\s+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Detectar tipos específicos de eventos
  const eventTypes = [
    { patterns: [/(?:reunião|reuniao|meeting|call)(?:\s+(?:de|com|sobre))?/i], name: 'Reunião' },
    { patterns: [/(?:consulta|appointment)(?:\s+(?:com|no|na))?/i], name: 'Consulta' },
    { patterns: [/(?:dentista|dental)/i], name: 'Dentista' },
    { patterns: [/(?:médico|medico|doctor|dr\.?)/i], name: 'Médico' },
    { patterns: [/(?:almoço|almoco|lunch)/i], name: 'Almoço' },
    { patterns: [/(?:jantar|dinner|janta)/i], name: 'Jantar' },
    { patterns: [/(?:café|coffee|cafezinho)/i], name: 'Café' },
    { patterns: [/(?:academia|gym|treino|exercício|exercicio)/i], name: 'Academia' },
    { patterns: [/(?:aula|class|curso|workshop)/i], name: 'Aula' },
    { patterns: [/(?:apresentação|apresentacao|presentation)/i], name: 'Apresentação' },
    { patterns: [/(?:entrevista|interview)/i], name: 'Entrevista' },
    { patterns: [/(?:festa|party|aniversário|aniversario)/i], name: 'Festa' },
    { patterns: [/(?:viagem|trip|travel)/i], name: 'Viagem' },
    { patterns: [/(?:compras|shopping|mercado)/i], name: 'Compras' },
    { patterns: [/(?:lembrete|reminder|lembrar)/i], name: 'Lembrete' }
  ];

  let eventType = '';
  let specificDetails = '';

  for (const type of eventTypes) {
    for (const pattern of type.patterns) {
      if (textLower.match(pattern)) {
        eventType = type.name;
        
        // Extrair detalhes específicos baseados no tipo
        if (eventType === 'Reunião') {
          const meetingPatterns = [
            /reunião\s+(?:de\s+)?(?:1:1|um\s+para\s+um|individual)/i,
            /reunião\s+com\s+([a-zA-ZÀ-ÿ\s]+?)(?:\s+(?:amanha|hoje|na|no|às|as|\d))/i,
            /reunião\s+(?:sobre|de)\s+([a-zA-ZÀ-ÿ\s]+?)(?:\s+(?:amanha|hoje|na|no|às|as|\d))/i,
            /call\s+com\s+([a-zA-ZÀ-ÿ\s]+?)(?:\s+(?:amanha|hoje|na|no|às|as|\d))/i
          ];
          
          for (const mPattern of meetingPatterns) {
            const mMatch = text.match(mPattern);
            if (mMatch) {
              if (mPattern.source.includes('1:1')) {
                specificDetails = '1:1';
              } else if (mMatch[1]) {
                specificDetails = mMatch[1].trim();
              }
              break;
            }
          }
        } else if (eventType === 'Consulta') {
          const consultaPatterns = [
            /consulta\s+(?:com\s+)?(?:o\s+)?(?:dr\.?\s+)?([a-zA-ZÀ-ÿ\s]+?)(?:\s+(?:amanha|hoje|na|no|às|as|\d))/i,
            /consulta\s+(?:no\s+|na\s+)?([a-zA-ZÀ-ÿ\s]+?)(?:\s+(?:amanha|hoje|na|no|às|as|\d))/i
          ];
          
          for (const cPattern of consultaPatterns) {
            const cMatch = text.match(cPattern);
            if (cMatch && cMatch[1]) {
              specificDetails = cMatch[1].trim();
              break;
            }
          }
        } else if (eventType === 'Lembrete') {
          // Para lembretes, extrair o que precisa lembrar
          const lembretePatterns = [
            /lembr(?:ar|ete)\s+(?:de\s+)?(?:comprar\s+)?([a-zA-ZÀ-ÿ\s]+?)(?:\s+(?:amanha|hoje|na|no|às|as|\d))/i,
            /me\s+lembr(?:ar|e)\s+(?:de\s+)?([a-zA-ZÀ-ÿ\s]+?)(?:\s+(?:amanha|hoje|na|no|às|as|\d))/i
          ];
          
          for (const lPattern of lembretePatterns) {
            const lMatch = text.match(lPattern);
            if (lMatch && lMatch[1]) {
              specificDetails = lMatch[1].trim();
              break;
            }
          }
        }
        break;
      }
    }
    if (eventType) break;
  }

  // Construir título final
  if (eventType && specificDetails) {
    title = `${eventType} - ${specificDetails}`;
  } else if (eventType) {
    title = eventType;
  } else if (cleanText.length > 3 && cleanText.length < 50) {
    // Se não detectou tipo específico, usar texto limpo
    title = cleanText.charAt(0).toUpperCase() + cleanText.slice(1);
  }

  // 4. APLICAR HORÁRIOS À DATA
  const [startHour, startMinute] = startTime.split(':').map(Number);
  eventDate.setHours(startHour, startMinute, 0, 0);

  let endDate: Date | undefined;
  if (endTime) {
    endDate = new Date(eventDate);
    const [endHour, endMinute] = endTime.split(':').map(Number);
    endDate.setHours(endHour, endMinute, 0, 0);
  }

  return {
    title,
    startDate: eventDate,
    endDate,
    description: text
  };
}

/**
 * Gerar links de calendário
 */
function generateCalendarLinks(event: EventData) {
  const formatDateForGoogle = (date: Date): string => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }) + ' às ' + date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const startFormatted = formatDateForGoogle(event.startDate);
  const endFormatted = event.endDate ? formatDateForGoogle(event.endDate) : 
    formatDateForGoogle(new Date(event.startDate.getTime() + 60 * 60 * 1000)); // +1 hora se não especificado

  const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${startFormatted}/${endFormatted}&details=${encodeURIComponent(event.description || '')}`;

  const outlookUrl = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(event.title)}&startdt=${startFormatted}&enddt=${endFormatted}&body=${encodeURIComponent(event.description || '')}`;

  return {
    google: googleUrl,
    outlook: outlookUrl,
    formatted: formatDate(event.startDate)
  };
}

/**
 * Inicializar o bot inteligente
 */
export async function startIntelligentBot(): Promise<boolean> {
  try {
    if (bot) {
      console.log('[telegram] Parando bot existente...');
      await bot.stop();
    }

    if (!process.env.TELEGRAM_BOT_TOKEN) {
      throw new Error('TELEGRAM_BOT_TOKEN não encontrado');
    }

    bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

    // Comando de início
    bot.start((ctx) => {
      ctx.reply(
        '🤖 *Zelar - Assistente Inteligente*\n\n' +
        'Olá! Sou seu assistente para agendamentos.\n\n' +
        '📝 *Como usar:*\n' +
        '• Digite naturalmente: "reunião com João amanhã às 15h"\n' +
        '• Ou: "lembrar de comprar detergente na segunda às 10am"\n' +
        '• Ou: "consulta no dentista sexta que vem às 14:30"\n\n' +
        '⚡ *Comandos úteis:*\n' +
        '• /eventos - Ver seus próximos eventos\n' +
        '• /ajuda - Exemplos de uso\n\n' +
        'Digite qualquer compromisso e eu criarei automaticamente! 🚀',
        { parse_mode: 'Markdown' }
      );
    });

    // Comando de ajuda
    bot.command('ajuda', (ctx) => {
      ctx.reply(
        '💡 *Exemplos de comandos:*\n\n' +
        '📅 *Datas:*\n' +
        '• "amanhã", "hoje", "segunda-feira"\n' +
        '• "daqui a 3 dias", "próxima sexta"\n\n' +
        '⏰ *Horários:*\n' +
        '• "às 15h", "às 14:30", "às 8am"\n' +
        '• "começando às 10h e acabando 11h"\n\n' +
        '🎯 *Tipos de evento:*\n' +
        '• Reuniões: "reunião 1:1 com Maria"\n' +
        '• Consultas: "consulta no Dr. Silva"\n' +
        '• Lembretes: "lembrar de comprar remédio"\n' +
        '• Outros: "almoço", "academia", "aula"\n\n' +
        'Seja natural! Eu entendo português brasileiro 🇧🇷',
        { parse_mode: 'Markdown' }
      );
    });

    // Listar eventos
    bot.command('eventos', async (ctx) => {
      try {
        const userEvents = await db.select().from(events).where(eq(events.userId, ctx.from.id.toString()));
        
        if (userEvents.length === 0) {
          ctx.reply('📅 Você não tem eventos agendados ainda.\n\nDigite algo como "reunião amanhã às 15h" para criar seu primeiro evento!');
          return;
        }

        let response = '📅 *Seus próximos eventos:*\n\n';
        userEvents.forEach((event, index) => {
          const date = new Date(event.startDate);
          const formatted = date.toLocaleDateString('pt-BR', {
            weekday: 'short',
            day: '2-digit',
            month: '2-digit'
          }) + ' às ' + date.toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit'
          });
          
          response += `${index + 1}. ${event.title}\n📅 ${formatted}\n\n`;
        });

        response += 'Para cancelar: "cancelar número" (ex: cancelar 1)';
        ctx.reply(response, { parse_mode: 'Markdown' });
      } catch (error) {
        console.error('Erro ao listar eventos:', error);
        ctx.reply('❌ Erro ao buscar eventos. Tente novamente.');
      }
    });

    // Processar mensagens de texto
    bot.on('text', async (ctx) => {
      try {
        const message = ctx.message.text;
        
        // Verificar se é comando de cancelamento
        const cancelMatch = message.match(/cancelar\s+(\d+)/i);
        if (cancelMatch) {
          const eventIndex = parseInt(cancelMatch[1]) - 1;
          const userEvents = await db.select().from(events).where(eq(events.userId, ctx.from.id.toString()));
          
          if (userEvents[eventIndex]) {
            await db.delete(events).where(eq(events.id, userEvents[eventIndex].id));
            ctx.reply('✅ Evento cancelado com sucesso!');
          } else {
            ctx.reply('❌ Evento não encontrado. Use /eventos para ver a lista.');
          }
          return;
        }

        // Processar criação de evento
        const eventData = await processNaturalLanguageEvent(message);
        
        // Salvar no banco de dados
        const [savedEvent] = await db.insert(events).values({
          userId: ctx.from.id.toString(),
          title: eventData.title,
          startDate: eventData.startDate,
          endDate: eventData.endDate,
          description: eventData.description
        }).returning();

        // Gerar links de calendário
        const links = generateCalendarLinks(eventData);

        // Resposta formatada
        ctx.reply(
          '✅ *Evento criado com sucesso!*\n\n' +
          '📋 *Detalhes:*\n' +
          `🎯 ${eventData.title}\n` +
          `📅 ${links.formatted}\n\n` +
          '📅 *Adicionar ao calendário:*',
          { 
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '📅 Google Calendar', url: links.google },
                  { text: '📅 Outlook', url: links.outlook }
                ]
              ]
            }
          }
        );

      } catch (error) {
        console.error('Erro ao processar mensagem:', error);
        ctx.reply(
          '❌ Não consegui entender seu pedido.\n\n' +
          'Tente algo como:\n' +
          '• "reunião amanhã às 15h"\n' +
          '• "consulta na segunda às 10am"\n' +
          '• "lembrar de comprar remédio às 18h"\n\n' +
          'Use /ajuda para mais exemplos!'
        );
      }
    });

    await bot.launch();
    console.log('✅ Bot Zelar Inteligente ativado com sucesso!');
    return true;

  } catch (error) {
    console.error('❌ Erro ao iniciar bot:', error);
    return false;
  }
}

/**
 * Parar o bot
 */
export function stopIntelligentBot(): void {
  if (bot) {
    bot.stop();
    bot = null;
    console.log('[telegram] Bot inteligente parado');
  }
}