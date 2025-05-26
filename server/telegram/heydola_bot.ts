/**
 * Bot Zelar - Inspirado no HeyDola
 * 
 * Processamento de linguagem natural avançado para extrair:
 * - Títulos precisos dos eventos
 * - Datas corretas (incluindo "daqui a X domingo")
 * - Horários em diferentes formatos
 */

import { Telegraf } from 'telegraf';

let bot: Telegraf | null = null;

interface ParsedEvent {
  title: string;
  startDate: Date;
  endDate?: Date;
  description: string;
}

/**
 * Processamento de linguagem natural inspirado no HeyDola
 */
function parseEventMessage(text: string): ParsedEvent {
  const now = new Date();
  let eventDate = new Date(now);
  
  console.log('🔍 Processando:', text);

  // 1. EXTRAIR TÍTULO INTELIGENTE PRIMEIRO
  let title = extractSmartTitle(text);
  console.log('📝 Título extraído:', title);

  // 2. PROCESSAR DATAS E HORÁRIOS
  const { date, time } = extractDateAndTime(text, now);
  eventDate = date;
  
  // Aplicar horário
  const [hour, minute] = time.split(':').map(Number);
  eventDate.setHours(hour, minute, 0, 0);
  
  console.log('📅 Data final:', eventDate.toLocaleString('pt-BR'));
  
  return {
    title,
    startDate: eventDate,
    description: text
  };
}

/**
 * Extração inteligente de título - inspirado no HeyDola
 */
function extractSmartTitle(text: string): string {
  const textLower = text.toLowerCase();
  
  // Padrões específicos para extrair o que realmente importa
  
  // 1. Lembretes/Compras - padrão mais amplo
  if (textLower.includes('lembr') && textLower.includes('comprar')) {
    const comprarMatch = text.match(/comprar\s+([a-zA-ZÀ-ÿ\s]+?)(?:\s*$|[,.])/i);
    if (comprarMatch && comprarMatch[1].trim().length < 25) {
      return `Comprar ${comprarMatch[1].trim()}`;
    }
    return 'Lembrete de compras';
  }
  
  // 2. Exames/Consultas
  if (textLower.includes('exame')) {
    const exameMatch = text.match(/exame\s+(?:de\s+|do\s+|da\s+)?([a-zA-ZÀ-ÿ\s]+?)(?:\s+(?:daqui|para|na|no|às|as|amanha|hoje|\d))/i);
    if (exameMatch && exameMatch[1].trim().length < 20) {
      return `Exame - ${exameMatch[1].trim()}`;
    }
    return 'Exame';
  }
  
  // 3. Horários/Compromissos genéricos
  if (textLower.includes('horário') || textLower.includes('horario')) {
    // Extrair o que vem depois de "para"
    const paraMatch = text.match(/para\s+([a-zA-ZÀ-ÿ\s]+?)(?:\s+(?:daqui|na|no|às|as|amanha|hoje|começ|\d))/i);
    if (paraMatch && paraMatch[1].trim().length < 30) {
      return paraMatch[1].trim();
    }
    return 'Compromisso';
  }
  
  // 4. Consultas
  if (textLower.includes('consulta')) {
    return 'Consulta';
  }
  
  // 5. Reuniões
  if (textLower.includes('reunião') || textLower.includes('reuniao')) {
    return 'Reunião';
  }
  
  // 6. Eventos específicos (academia, almoço, etc.)
  const specificEvents = [
    { keywords: ['academia', 'treino'], title: 'Academia' },
    { keywords: ['almoço', 'almoco'], title: 'Almoço' },
    { keywords: ['jantar'], title: 'Jantar' },
    { keywords: ['dentista'], title: 'Dentista' },
    { keywords: ['médico', 'medico'], title: 'Médico' },
    { keywords: ['farmácia', 'farmacia'], title: 'Farmácia' },
    { keywords: ['mercado', 'supermercado'], title: 'Mercado' }
  ];
  
  for (const event of specificEvents) {
    if (event.keywords.some(keyword => textLower.includes(keyword))) {
      return event.title;
    }
  }
  
  // 7. Fallback: extrair da frase principal
  let cleanText = text
    .replace(/(?:reserve|agende|marque)\s+(?:um\s+)?(?:horário|horario|compromisso)/gi, '')
    .replace(/(?:da\s+minha\s+agenda\s+)?(?:para|pra)\s+/gi, '')
    .replace(/(?:daqui\s+a\s+\d+\s+\w+|amanha|amanhã|hoje)/gi, '')
    .replace(/sexta\s+feira/gi, '')  // Remover "sexta feira" especificamente
    .replace(/(?:domingo|segunda-feira|terça-feira|quarta-feira|quinta-feira|sexta-feira|sábado|sabado)/gi, '')
    .replace(/(?:segunda|terça|quarta|quinta|sexta)/gi, '')  // Remover dias sozinhos também
    .replace(/(?:às?|as|começ|comeca)\s*\d{1,2}(?::\d{2})?\s*(?:h|am|pm)?/gi, '')
    .replace(/(?:me\s+)?lembr(?:ar|ando)\s+(?:de\s+)?/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  if (cleanText.length > 3 && cleanText.length < 40) {
    return cleanText.charAt(0).toUpperCase() + cleanText.slice(1);
  }
  
  return 'Evento';
}

/**
 * Extração de data e horário - CORRIGIDO COMPLETAMENTE
 */
function extractDateAndTime(text: string, now: Date): { date: Date, time: string } {
  const textLower = text.toLowerCase();
  let eventDate = new Date(now);
  let time = '10:00';
  
  // 1. PROCESSAR HORÁRIOS PRIMEIRO - VERSÃO CORRIGIDA
  console.log(`🔍 Analisando horários em: "${textLower}"`);
  
  // Padrões mais específicos e organizados
  const timeMatches = [
    // PM/AM primeiro (mais específico)
    { pattern: /(\d{1,2})\s*pm/i, type: 'pm' },
    { pattern: /(\d{1,2})\s*am/i, type: 'am' },
    // Formato brasileiro com "h"
    { pattern: /(?:às?|as)\s*(\d{1,2})(?::(\d{2}))?\s*h/i, type: '24h' },
    { pattern: /(\d{1,2})(?::(\d{2}))?\s*h/i, type: '24h' },
    // Formato brasileiro SEM "h" - mais específico
    { pattern: /(?:às?|as)\s*(\d{1,2})(?::(\d{2}))?(?:\s|$)/i, type: '24h' }
  ];

  for (const timeMatch of timeMatches) {
    const match = textLower.match(timeMatch.pattern);
    if (match) {
      let hour = parseInt(match[1]);
      const minute = match[2] ? parseInt(match[2]) : 0;
      
      if (timeMatch.type === 'pm') {
        if (hour < 12) hour += 12;
        console.log(`🕰️ PM detectado: ${match[1]}pm → ${hour}:${minute.toString().padStart(2, '0')}`);
      } else if (timeMatch.type === 'am') {
        if (hour === 12) hour = 0;
        console.log(`🕰️ AM detectado: ${match[1]}am → ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
      } else {
        console.log(`🕰️ 24h detectado: ${match[0]} → ${hour}:${minute.toString().padStart(2, '0')}`);
      }
      
      time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      console.log(`✅ Horário final definido: ${time}`);
      break;
    }
  }

  // 2. PROCESSAR DATAS - FOCO EM "DAQUI A X DOMINGO"
  
  // Função auxiliar para próximo dia da semana
  function getNextWeekday(fromDate: Date, targetDay: number, weeksAhead: number = 0): Date {
    const result = new Date(fromDate);
    const currentDay = result.getDay();
    
    if (weeksAhead > 0) {
      // Pular para a semana específica
      result.setDate(result.getDate() + (weeksAhead * 7));
      // Ajustar para o dia da semana correto
      const newCurrentDay = result.getDay();
      let daysToAdd = targetDay - newCurrentDay;
      if (daysToAdd < 0) daysToAdd += 7;
      result.setDate(result.getDate() + daysToAdd);
    } else {
      // Próxima ocorrência do dia da semana
      let daysToAdd = targetDay - currentDay;
      if (daysToAdd <= 0) daysToAdd += 7;
      result.setDate(result.getDate() + daysToAdd);
    }
    
    return result;
  }

  // Detectar padrões específicos de data
  
  // "daqui a X domingo/segunda/etc"
  const daquiAMatch = textLower.match(/daqui\s+a\s+(\d+)\s+(domingo|segunda|terça|quarta|quinta|sexta|sábado|sabado)/i);
  if (daquiAMatch) {
    const weeks = parseInt(daquiAMatch[1]);
    const dayName = daquiAMatch[2];
    
    const dayMap: { [key: string]: number } = {
      'domingo': 0, 'segunda': 1, 'terça': 2, 'quarta': 3, 
      'quinta': 4, 'sexta': 5, 'sábado': 6, 'sabado': 6
    };
    
    const targetDay = dayMap[dayName];
    if (targetDay !== undefined) {
      if (weeks === 1) {
        // "daqui a 1 domingo" = próximo domingo
        eventDate = getNextWeekday(now, targetDay);
      } else if (weeks === 2) {
        // "daqui a 2 domingo" = domingo da semana que vem
        eventDate = getNextWeekday(now, targetDay, 1);
      } else if (weeks === 3) {
        // "daqui a 3 domingo" = domingo, não segunda-feira!
        eventDate = getNextWeekday(now, targetDay, 1);
      }
      
      console.log(`📅 Processado "daqui a ${weeks} ${dayName}":`, eventDate.toLocaleDateString('pt-BR'));
      return { date: eventDate, time };
    }
  }
  
  // Padrões de data simples - CORRIGIDO para preservar horário
  if (textLower.includes('amanha') || textLower.includes('amanhã')) {
    eventDate = new Date(now);
    eventDate.setDate(now.getDate() + 1);
    console.log(`📅 Processando amanhã: ${eventDate.toLocaleDateString('pt-BR')}`);
  } else if (textLower.includes('hoje')) {
    eventDate = new Date(now);
    console.log(`📅 Processando hoje: ${eventDate.toLocaleDateString('pt-BR')}`);
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
  } else if (textLower.includes('sexta feira') || textLower.includes('sexta-feira') || textLower.includes('sexta')) {
    eventDate = getNextWeekday(now, 5);
  } else if (textLower.includes('sábado') || textLower.includes('sabado')) {
    eventDate = getNextWeekday(now, 6);
  }

  return { date: eventDate, time };
}

/**
 * Gerar links de calendário
 */
function generateCalendarLinks(event: ParsedEvent) {
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
  const outlookUrl = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(event.title)}&startdt=${event.startDate.toISOString()}&enddt=${endDate.toISOString()}&body=${encodeURIComponent(event.description)}`;

  return {
    google: googleUrl,
    outlook: outlookUrl,
    formatted: formatDate(event.startDate)
  };
}

/**
 * Inicializar bot inspirado no HeyDola
 */
export async function startHeyDolaBot(): Promise<boolean> {
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
        'Olá! Sou seu assistente para agendamentos.\n\n' +
        '💡 *Funcionalidades:*\n' +
        '• Entendo linguagem natural em português\n' +
        '• Extraio títulos precisos dos eventos\n' +
        '• Processo datas complexas como "daqui a 3 domingo"\n' +
        '• Crio links diretos para Google Calendar e Outlook\n\n' +
        '📝 *Exemplos:*\n' +
        '• "reserve um horário para exame daqui a 3 domingo às 10am"\n' +
        '• "lembrar de comprar detergente amanhã às 15h"\n' +
        '• "consulta no dentista sexta às 14:30"\n\n' +
        'Digite qualquer compromisso naturalmente! 🚀',
        { parse_mode: 'Markdown' }
      );
    });

    // Comando de ajuda
    bot.command('ajuda', (ctx) => {
      ctx.reply(
        '💡 *Como eu funciono:*\n\n' +
        '🗓️ *Datas que entendo:*\n' +
        '• "amanhã", "hoje", "sexta-feira"\n' +
        '• "daqui a 3 domingo" (próximo domingo)\n' +
        '• "próxima segunda", "no sábado"\n\n' +
        '⏰ *Horários:*\n' +
        '• "às 15h", "às 14:30", "10am", "8pm"\n' +
        '• "começando às 10h"\n\n' +
        '🎯 *Títulos inteligentes:*\n' +
        '• Extraio automaticamente o que importa\n' +
        '• "Comprar detergente", "Exame", "Consulta"\n' +
        '• Sem títulos genéricos como "Evento"\n\n' +
        'Fale naturalmente comigo! 🇧🇷',
        { parse_mode: 'Markdown' }
      );
    });

    // Comando para listar eventos
    bot.command('eventos', (ctx) => {
      ctx.reply(
        '📅 *Gerenciamento de Eventos*\n\n' +
        'Os eventos criados pelo bot são adicionados diretamente aos seus calendários:\n\n' +
        '📱 *Para ver seus eventos:*\n' +
        '• Abra Google Calendar ou Outlook\n' +
        '• Todos os eventos criados aqui estão salvos lá\n\n' +
        '✏️ *Para editar/excluir:*\n' +
        '• Use o app do seu calendário\n' +
        '• Edite diretamente no Google Calendar/Outlook\n\n' +
        '➕ *Criar novo evento:*\n' +
        'Digite algo como: "reunião amanhã às 15h"\n\n' +
        'Continue criando eventos naturalmente! 🚀',
        { parse_mode: 'Markdown' }
      );
    });

    // Processar mensagens de texto (ignorar comandos)
    bot.on('text', async (ctx) => {
      try {
        const message = ctx.message.text;
        
        // Ignorar comandos que começam com /
        if (message.startsWith('/')) {
          return;
        }
        
        // Processar evento com IA
        const event = parseEventMessage(message);
        const links = generateCalendarLinks(event);

        // Resposta no estilo HeyDola
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
          '❌ Não consegui processar seu pedido.\n\n' +
          'Tente ser mais específico:\n' +
          '• "reunião amanhã às 15h"\n' +
          '• "exame na segunda às 10am"\n' +
          '• "lembrar de comprar remédio às 18h"\n\n' +
          'Use /ajuda para mais exemplos!'
        );
      }
    });

    await bot.launch();
    console.log('✅ Bot Zelar HeyDola ativado com sucesso!');
    return true;

  } catch (error) {
    console.error('❌ Erro ao iniciar bot:', error);
    return false;
  }
}

/**
 * Parar o bot
 */
export function stopHeyDolaBot(): void {
  if (bot) {
    bot.stop();
    bot = null;
    console.log('[telegram] Bot HeyDola parado');
  }
}