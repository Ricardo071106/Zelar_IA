/**
 * Bot Zelar Smart - Processamento inteligente inspirado no HeyDola
 * 
 * Corrige problemas de título genérico e datas incorretas
 */

import { Telegraf } from 'telegraf';

let bot: Telegraf | null = null;

interface SmartEvent {
  title: string;
  startDate: Date;
  endDate?: Date;
  description: string;
}

/**
 * Processamento inteligente de eventos - inspirado no HeyDola
 */
function parseSmartEvent(text: string): SmartEvent {
  const now = new Date();
  let eventDate = new Date(now);
  
  // 1. DETECTAR HORÁRIOS (corrigido)
  let time = '10:00';
  
  // Padrões de horário mais específicos
  const timePatterns = [
    /(?:às?|as)\s+(\d{1,2})(?::(\d{2}))?\s*(?:h|hs)?/i,  // "às 15" ou "às 15:30"
    /(?:começando|comecando)\s+(?:às?|as)\s+(\d{1,2})(?::(\d{2}))?\s*(?:h|hs)?/i,
    /(\d{1,2})(?::(\d{2}))?\s*(?:h|hs|am|pm)/i,
    /(\d{1,2})\s*(?:da\s+)?(?:manhã|manha)/i,
    /(\d{1,2})\s*(?:da\s+)?tarde/i
  ];

  for (const pattern of timePatterns) {
    const match = text.match(pattern);
    if (match) {
      let hour = parseInt(match[1]);
      const minute = match[2] ? parseInt(match[2]) : 0;
      
      // Ajustar PM/AM
      if (text.includes('tarde') && hour < 12) hour += 12;
      if (text.includes('pm') && hour < 12) hour += 12;
      if (text.includes('am') && hour === 12) hour = 0;
      
      time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      break;
    }
  }

  // 2. DETECTAR DATAS (corrigido)
  const textLower = text.toLowerCase();
  
  // Função auxiliar para próximo dia da semana
  function getNextWeekday(date: Date, targetDay: number): Date {
    const result = new Date(date);
    const currentDay = result.getDay();
    let daysToAdd = targetDay - currentDay;
    if (daysToAdd <= 0) daysToAdd += 7;
    result.setDate(result.getDate() + daysToAdd);
    return result;
  }

  // Processar datas específicas
  if (textLower.includes('amanha') || textLower.includes('amanhã')) {
    eventDate.setDate(now.getDate() + 1);
  } else if (textLower.includes('hoje')) {
    eventDate = new Date(now);
  } else if (textLower.includes('daqui a 3 domingo') || textLower.includes('daqui a 3 domingos')) {
    // "daqui a 3 domingo" = próximo domingo
    eventDate = getNextWeekday(now, 0);
  } else if (textLower.includes('daqui a exatamente 1 mes') || textLower.includes('daqui a 1 mês')) {
    // "daqui a 1 mês"
    eventDate.setMonth(now.getMonth() + 1);
  } else if (textLower.includes('próximo final de semana') || textLower.includes('proximo final de semana')) {
    // "próximo final de semana" = próximo sábado
    eventDate = getNextWeekday(now, 6);
  } else if (textLower.includes('domingo')) {
    eventDate = getNextWeekday(now, 0);
  } else if (textLower.includes('segunda')) {
    eventDate = getNextWeekday(now, 1);
  } else if (textLower.includes('terça')) {
    eventDate = getNextWeekday(now, 2);
  } else if (textLower.includes('quarta')) {
    eventDate = getNextWeekday(now, 3);
  } else if (textLower.includes('quinta')) {
    eventDate = getNextWeekday(now, 4);
  } else if (textLower.includes('sexta')) {
    eventDate = getNextWeekday(now, 5);
  } else if (textLower.includes('sábado') || textLower.includes('sabado')) {
    eventDate = getNextWeekday(now, 6);
  }

  // Aplicar horário
  const [hour, minute] = time.split(':').map(Number);
  eventDate.setHours(hour, minute, 0, 0);

  // 3. EXTRAIR TÍTULO INTELIGENTE (inspirado no HeyDola)
  let title = 'Evento';
  
  // Remover palavras temporais para extrair o título limpo
  let cleanText = text
    .replace(/(?:reserve|agende|marque|lembre|lembrar)\s+(?:um\s+)?(?:horário|horario|compromisso|evento)/gi, '')
    .replace(/(?:da\s+minha\s+agenda\s+)?(?:para|pra)\s+/gi, '')
    .replace(/(?:amanha|amanhã|hoje|domingo|segunda|terça|quarta|quinta|sexta|sábado|sabado)(?:-feira)?/gi, '')
    .replace(/(?:às?|as|começa|comeca)\s+\d{1,2}(?::\d{2})?\s*(?:h|hs|am|pm)?/gi, '')
    .replace(/(?:daqui\s+a\s+\d+\s+)/gi, '')
    .replace(/(?:e\s+acabando|acabando|terminando)\s+\d{1,2}(?::\d{2})?\s*(?:h|hs|am|pm)?/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Detectar tipos específicos de eventos e extrair detalhes
  if (cleanText.includes('consulta') || cleanText.includes('exame')) {
    if (cleanText.includes('dentista')) {
      title = 'Consulta - Dentista';
    } else {
      // Extrair tipo de consulta/exame
      const consultaMatch = cleanText.match(/(?:consulta|exame)\s+(?:no|na|com|de)?\s*([a-zA-ZÀ-ÿ\s]+)/i);
      if (consultaMatch && consultaMatch[1].trim().length < 20) {
        title = `Consulta - ${consultaMatch[1].trim()}`;
      } else {
        title = 'Consulta';
      }
    }
  } else if (cleanText.includes('reunião') || cleanText.includes('reuniao')) {
    if (cleanText.includes('1:1')) {
      title = 'Reunião 1:1';
    } else {
      // Extrair com quem é a reunião
      const reuniaoMatch = cleanText.match(/reunião\s+(?:com|de)\s+(?:a\s+)?([a-zA-ZÀ-ÿ\s]+)/i);
      if (reuniaoMatch && reuniaoMatch[1].trim().length < 15) {
        title = `Reunião com ${reuniaoMatch[1].trim()}`;
      } else {
        title = 'Reunião';
      }
    }
  } else if (cleanText.includes('lembr')) {
    // Extrair o que precisa lembrar
    const lembreteMatch = cleanText.match(/lembr(?:ar|ete)\s+(?:de\s+)?(?:comprar\s+)?([a-zA-ZÀ-ÿ\s]+)/i);
    if (lembreteMatch && lembreteMatch[1].trim().length < 25) {
      title = `Lembrete: ${lembreteMatch[1].trim()}`;
    } else {
      title = 'Lembrete';
    }
  } else if (cleanText.includes('comprar') || cleanText.includes('compras')) {
    const comprarMatch = cleanText.match(/comprar\s+([a-zA-ZÀ-ÿ\s]+)/i);
    if (comprarMatch && comprarMatch[1].trim().length < 20) {
      title = `Comprar ${comprarMatch[1].trim()}`;
    } else {
      title = 'Compras';
    }
  } else if (cleanText.includes('almoço') || cleanText.includes('almoco')) {
    title = 'Almoço';
  } else if (cleanText.includes('jantar')) {
    title = 'Jantar';
  } else if (cleanText.includes('academia') || cleanText.includes('treino')) {
    title = 'Academia';
  } else {
    // Usar texto limpo se não detectou tipo específico
    if (cleanText.length > 3 && cleanText.length < 40) {
      title = cleanText.charAt(0).toUpperCase() + cleanText.slice(1);
    }
  }

  return {
    title,
    startDate: eventDate,
    description: text
  };
}

/**
 * Gerar links de calendário
 */
function generateCalendarLinks(event: SmartEvent) {
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
  const endDate = event.endDate || new Date(event.startDate.getTime() + 60 * 60 * 1000);
  const endFormatted = formatDateForGoogle(endDate);

  const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${startFormatted}/${endFormatted}&details=${encodeURIComponent(event.description)}`;
  const outlookUrl = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(event.title)}&startdt=${startFormatted}&enddt=${endFormatted}&body=${encodeURIComponent(event.description)}`;

  return {
    google: googleUrl,
    outlook: outlookUrl,
    formatted: formatDate(event.startDate)
  };
}

/**
 * Inicializar bot inteligente
 */
export async function startSmartBot(): Promise<boolean> {
  try {
    if (bot) {
      console.log('[telegram] Parando bot existente...');
      await bot.stop();
    }

    if (!process.env.TELEGRAM_BOT_TOKEN) {
      throw new Error('TELEGRAM_BOT_TOKEN não encontrado');
    }

    bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

    // Comando inicial
    bot.start((ctx) => {
      ctx.reply(
        '🤖 *Zelar - Assistente Inteligente*\n\n' +
        'Olá! Sou seu assistente para agendamentos inteligentes.\n\n' +
        '📝 *Como usar:*\n' +
        '• "reunião com João amanhã às 15h"\n' +
        '• "lembrar de comprar detergente na segunda às 10am"\n' +
        '• "consulta no dentista sexta às 14:30"\n\n' +
        '⚡ *Comandos:*\n' +
        '• /eventos - Ver próximos eventos\n' +
        '• /ajuda - Mais exemplos\n\n' +
        'Digite qualquer compromisso naturalmente! 🚀',
        { parse_mode: 'Markdown' }
      );
    });

    // Comando de ajuda
    bot.command('ajuda', (ctx) => {
      ctx.reply(
        '💡 *Exemplos do que eu entendo:*\n\n' +
        '🗓️ *Datas:*\n' +
        '• "amanhã", "hoje", "segunda-feira"\n' +
        '• "próximo domingo", "daqui a 3 domingo"\n\n' +
        '⏰ *Horários:*\n' +
        '• "às 15h", "às 14:30", "às 8am"\n' +
        '• "começa às 10h", "10 da manhã"\n\n' +
        '🎯 *Eventos que reconheço:*\n' +
        '• Reuniões: "reunião 1:1 com Maria"\n' +
        '• Consultas: "consulta no dentista"\n' +
        '• Lembretes: "lembrar de comprar remédio"\n' +
        '• Outros: "almoço", "academia", "treino"\n\n' +
        'Fale naturalmente comigo! 🇧🇷',
        { parse_mode: 'Markdown' }
      );
    });

    // Lista de eventos (simulada)
    bot.command('eventos', (ctx) => {
      ctx.reply('📅 Comando em desenvolvimento. Em breve você poderá ver seus eventos salvos!');
    });

    // Processar mensagens de texto
    bot.on('text', async (ctx) => {
      try {
        const message = ctx.message.text;
        
        // Processar evento inteligentemente
        const event = parseSmartEvent(message);
        const links = generateCalendarLinks(event);

        // Resposta formatada
        ctx.reply(
          '✅ *Evento criado com sucesso!*\n\n' +
          '📋 *Detalhes:*\n' +
          `🎯 ${event.title}\n` +
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
          '• "lembrar de comprar detergente às 18h"\n\n' +
          'Use /ajuda para mais exemplos!'
        );
      }
    });

    await bot.launch();
    console.log('✅ Bot Zelar Smart ativado com sucesso!');
    return true;

  } catch (error) {
    console.error('❌ Erro ao iniciar bot:', error);
    return false;
  }
}

/**
 * Parar o bot
 */
export function stopSmartBot(): void {
  if (bot) {
    bot.stop();
    bot = null;
    console.log('[telegram] Bot smart parado');
  }
}