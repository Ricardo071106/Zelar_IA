/**
 * Bot final com OpenRouter sem depender da verificação do Google
 * 
 * Esta versão:
 * 1. Usa OpenRouter para entender mensagens em português
 * 2. Gera links diretos para calendários em vez de tentar acessar a API
 * 3. Funciona 100% sem necessidade de verificação do aplicativo
 */

import { Telegraf } from 'telegraf';
import { format, addDays, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { log } from './vite';
import axios from 'axios';
import { storage } from './storage';

// Verificar token do Telegram
if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error('TELEGRAM_BOT_TOKEN não está definido no ambiente');
  process.exit(1);
}

// Verificar chave de API do OpenRouter
if (!process.env.OPENROUTER_API_KEY) {
  console.error('OPENROUTER_API_KEY não está definido no ambiente');
  console.warn('O processamento de linguagem natural não funcionará corretamente');
}

// Inicializar bot
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Estado dos usuários
interface UserState {
  id: string;
  name: string;
  events: Array<{
    id: string;
    title: string;
    startDate: Date;
    endDate?: Date;
    location?: string;
    description?: string;
  }>;
}

const users = new Map<string, UserState>();

// Função para processar linguagem natural com OpenRouter
async function processNaturalLanguage(text: string): Promise<{
  intent: 'create' | 'list' | 'delete' | 'unknown';
  event?: {
    title: string;
    startDate: Date;
    endDate?: Date;
    location?: string;
    description?: string;
  };
  eventId?: string;
  error?: string;
}> {
  try {
    // Sistema de prompt para extrair intenção e informações de evento
    const systemPrompt = `
    Você é um assistente especializado em extrair informações de mensagens em português relacionadas a eventos de calendário.
    
    Analise a mensagem e identifique se a intenção é:
    1. CRIAR um evento (ex: "agendar", "marcar", "lembrar")
    2. LISTAR eventos (ex: "mostrar", "listar", "ver", "quais")
    3. DELETAR um evento (ex: "apagar", "cancelar", "remover")
    
    Responda em formato JSON com os seguintes campos:
    
    Para criação de eventos:
    {
      "intent": "create",
      "event": {
        "title": "título do evento",
        "date": "YYYY-MM-DD",
        "time": "HH:MM",
        "duration": número de minutos (padrão 60 se não especificado),
        "location": "local do evento" (ou null se não especificado),
        "description": "descrição do evento" (ou null se não especificado)
      }
    }
    
    Para listagem de eventos:
    {
      "intent": "list",
      "period": "today" ou "week" ou "all" (dependendo se pediu eventos de hoje, da semana ou todos)
    }
    
    Para deleção de eventos:
    {
      "intent": "delete",
      "eventIdentifier": "algum identificador do evento a ser deletado" (ex: "reunião de hoje")
    }
    
    Se não conseguir identificar a intenção:
    {
      "intent": "unknown",
      "error": "descrição do erro"
    }
    
    Hoje é ${format(new Date(), 'yyyy-MM-dd')}.
    Interprete referências como "amanhã", "próxima segunda", "semana que vem", etc.
    `;
    
    // Solicitação para o OpenRouter
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: "anthropic/claude-3-haiku:20240307", // Modelo mais leve e econômico
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1 // Baixa temperatura para resultados mais determinísticos
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://replit.com',
          'X-Title': 'Assistente de Agenda Telegram'
        }
      }
    );
    
    // Extrair e processar a resposta
    const content = response.data.choices[0].message.content;
    const parsedContent = JSON.parse(content);
    
    // Verificar a intenção
    if (parsedContent.intent === 'create') {
      // Construir data e hora do evento
      let eventDate = new Date();
      
      if (parsedContent.event.date) {
        const [year, month, day] = parsedContent.event.date.split('-').map(Number);
        eventDate.setFullYear(year);
        eventDate.setMonth(month - 1); // Meses em JS são 0-indexados
        eventDate.setDate(day);
      }
      
      if (parsedContent.event.time) {
        const [hour, minute] = parsedContent.event.time.split(':').map(Number);
        eventDate.setHours(hour);
        eventDate.setMinutes(minute);
        eventDate.setSeconds(0);
        eventDate.setMilliseconds(0);
      }
      
      // Calcular data de término com base na duração
      const duration = parsedContent.event.duration || 60;
      const endDate = new Date(eventDate.getTime() + duration * 60000);
      
      return {
        intent: 'create',
        event: {
          title: parsedContent.event.title,
          startDate: eventDate,
          endDate: endDate,
          location: parsedContent.event.location || undefined,
          description: parsedContent.event.description || undefined
        }
      };
    } else if (parsedContent.intent === 'list') {
      return {
        intent: 'list'
      };
    } else if (parsedContent.intent === 'delete') {
      return {
        intent: 'delete',
        eventId: parsedContent.eventIdentifier
      };
    } else {
      return {
        intent: 'unknown',
        error: parsedContent.error || 'Não foi possível entender sua solicitação'
      };
    }
  } catch (error) {
    console.error('Erro ao processar linguagem natural:', error);
    return {
      intent: 'unknown',
      error: 'Houve um erro ao processar sua mensagem'
    };
  }
}

// Gerar arquivo ICS para Apple Calendar
function generateICSContent(event: any): string {
  const formatDateForICS = (date: Date): string => {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  };

  const startDate = formatDateForICS(event.startDate);
  const endDate = formatDateForICS(event.endDate);
  const now = formatDateForICS(new Date());
  
  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Zelar//Zelar Bot//PT
BEGIN:VEVENT
UID:${event.id || Math.random().toString(36).substr(2, 9)}@zelar.bot
DTSTART:${startDate}
DTEND:${endDate}
DTSTAMP:${now}
SUMMARY:${event.title}
DESCRIPTION:${event.description || ''}
LOCATION:${event.location || ''}
STATUS:CONFIRMED
SEQUENCE:0
END:VEVENT
END:VCALENDAR`;
}

// Gerar links diretos para calendários
function generateCalendarLinks(event: any, saveToDb = false) {
  // Formatar datas para URL do Google Calendar
  const startDateFormatted = event.startDate.toISOString().replace(/-|:|\.\d\d\d/g,'').slice(0,15);
  const endDateFormatted = event.endDate.toISOString().replace(/-|:|\.\d\d\d/g,'').slice(0,15);
  
  // Link direto para o Google Calendar
  const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${startDateFormatted}/${endDateFormatted}${event.description ? `&details=${encodeURIComponent(event.description)}` : ''}${event.location ? `&location=${encodeURIComponent(event.location)}` : ''}`;
  
  // Link direto para o Outlook
  const outlookUrl = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(event.title)}&startdt=${event.startDate.toISOString()}&enddt=${event.endDate.toISOString()}${event.description ? `&body=${encodeURIComponent(event.description)}` : ''}${event.location ? `&location=${encodeURIComponent(event.location)}` : ''}`;
  
  // Link para Apple Calendar - usando nosso endpoint do servidor
  const baseUrl = process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}` : 'http://localhost:3000';
  const appleUrl = `${baseUrl}/calendar/${event.id}.ics`;
  
  return {
    google: googleUrl,
    outlook: outlookUrl,
    apple: appleUrl
  };
}

// Formatar data para exibição
function formatDate(date: Date): string {
  return format(date, "EEEE, dd 'de' MMMM 'às' HH:mm", { locale: ptBR });
}

// Comando /start - inicia o bot
bot.start(async (ctx) => {
  if (!ctx.from) return;
  
  const userId = ctx.from.id.toString();
  const name = ctx.from.first_name || 'usuário';
  
  // Inicializar estado do usuário
  users.set(userId, {
    id: userId,
    name,
    events: []
  });
  
  await ctx.reply(
    `Olá, ${name}! 👋\n\n` +
    `Sou seu assistente de agenda inteligente com processamento de linguagem natural.\n\n` +
    `Você pode me dizer coisas como:\n` +
    `• "Agendar reunião com João amanhã às 15h"\n` +
    `• "Mostrar meus eventos de hoje"\n` +
    `• "Cancelar a reunião de amanhã"\n\n` +
    `Use /ajuda para ver todos os comandos disponíveis.`
  );
});

// Comando /ajuda - mostra ajuda
bot.command(['ajuda', 'help'], async (ctx) => {
  await ctx.reply(
    `📋 Como usar o assistente de agenda:\n\n` +
    `📝 Para criar eventos, diga algo como:\n` +
    `• "Agendar reunião amanhã às 15h"\n` +
    `• "Marcar consulta na próxima segunda às 10h"\n\n` +
    `📋 Para ver seus eventos, diga:\n` +
    `• "Mostrar meus eventos"\n` +
    `• "Quais são meus compromissos de hoje?"\n\n` +
    `❌ Para cancelar eventos, diga:\n` +
    `• "Cancelar reunião de amanhã"\n` +
    `• "Apagar o evento da consulta"\n\n` +
    `📌 Comandos disponíveis:\n` +
    `/start - Iniciar o bot\n` +
    `/eventos - Listar seus eventos\n` +
    `/criar - Criar evento de teste\n` +
    `/ajuda - Mostrar esta ajuda`
  );
});

// Comando /eventos - lista eventos
bot.command('eventos', async (ctx) => {
  if (!ctx.from) return;
  
  const userId = ctx.from.id.toString();
  const userState = users.get(userId);
  
  if (!userState) {
    await ctx.reply('Por favor, use /start para começar a usar o bot.');
    return;
  }
  
  if (userState.events.length === 0) {
    await ctx.reply('Você não tem eventos agendados.');
    return;
  }
  
  let message = '📅 Seus eventos:\n\n';
  
  userState.events.forEach((event, index) => {
    const formattedDate = formatDate(event.startDate);
    
    message += `${index + 1}. ${event.title}\n📆 ${formattedDate}\n${event.location ? `📍 ${event.location}\n` : ''}${event.description ? `📝 ${event.description}\n` : ''}\n`;
  });
  
  await ctx.reply(message);
});

// Comando /criar - cria evento de teste
bot.command('criar', async (ctx) => {
  if (!ctx.from) return;
  
  const userId = ctx.from.id.toString();
  const userState = users.get(userId) || { id: userId, name: ctx.from.first_name || 'usuário', events: [] };
  
  // Criar evento de teste para amanhã
  const tomorrow = addDays(new Date(), 1);
  tomorrow.setHours(15, 0, 0, 0);
  
  const event = {
    id: Date.now().toString(),
    title: 'Reunião de Teste',
    startDate: tomorrow,
    endDate: new Date(tomorrow.getTime() + 60 * 60 * 1000),
    location: 'Local de Teste',
    description: 'Este é um evento de teste criado pelo bot'
  };
  
  // Adicionar evento à lista do usuário
  userState.events.push(event);
  users.set(userId, userState);
  
  // Gerar links para calendários
  const links = generateCalendarLinks(event);
  
  await ctx.reply(
    `✅ Evento criado com sucesso!\n\n` +
    `📅 ${event.title}\n` +
    `📆 ${formatDate(event.startDate)}\n` +
    `📍 ${event.location}\n` +
    `📝 ${event.description}\n\n` +
    `Adicione ao seu calendário com um clique:`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Adicionar ao Google Calendar', url: links.google }],
          [{ text: 'Adicionar ao Outlook', url: links.outlook }],
          [{ text: 'Adicionar ao Apple Calendar', url: links.apple }]
        ]
      }
    }
  );
});

// Processar mensagens de texto
bot.on('text', async (ctx) => {
  if (!ctx.from || !ctx.message || !ctx.message.text) return;
  
  const userId = ctx.from.id.toString();
  const userState = users.get(userId) || { id: userId, name: ctx.from.first_name || 'usuário', events: [] };
  const text = ctx.message.text;
  
  // Processar mensagem com IA
  const loadingMsg = await ctx.reply('🧠 Processando sua mensagem...');
  
  try {
    const result = await processNaturalLanguage(text);
    
    if (result.intent === 'create' && result.event) {
      // Primeiro precisamos encontrar ou criar o usuário no banco
      let dbUser;
      try {
        dbUser = await storage.getUserByTelegramId(userId);
        if (!dbUser) {
          // Criar usuário se não existir
          dbUser = await storage.createUser({
            username: ctx.from.username || ctx.from.first_name || `user_${userId}`,
            telegramId: userId
          });
        }
      } catch (userError) {
        console.error('Erro ao buscar/criar usuário:', userError);
        await ctx.telegram.editMessageText(
          ctx.chat.id,
          loadingMsg.message_id,
          undefined,
          `❌ Erro ao processar usuário. Tente novamente.`
        );
        return;
      }

      // Agora salvar o evento no banco de dados
      const eventData = {
        title: result.event.title,
        startDate: result.event.startDate,
        endDate: result.event.endDate,
        location: result.event.location,
        description: result.event.description,
        userId: dbUser.id
      };
      
      try {
        const savedEvent = await storage.createEvent(eventData);
        
        // Adicionar evento à lista do usuário em memória também
        const event = {
          id: savedEvent.id.toString(),
          ...result.event
        };
        userState.events.push(event);
        users.set(userId, userState);
        
        // Gerar links para calendários
        const links = generateCalendarLinks(savedEvent);
      
        await ctx.telegram.editMessageText(
          ctx.chat.id,
          loadingMsg.message_id,
          undefined,
          `✅ Evento criado com sucesso!\n\n` +
          `📅 ${savedEvent.title}\n` +
          `📆 ${formatDate(savedEvent.startDate)}\n` +
          `${savedEvent.location ? `📍 ${savedEvent.location}\n` : ''}` +
          `${savedEvent.description ? `📝 ${savedEvent.description}\n` : ''}\n` +
          `Adicione ao seu calendário com um clique:`,
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: 'Adicionar ao Google Calendar', url: links.google }],
                [{ text: 'Adicionar ao Outlook', url: links.outlook }],
                [{ text: 'Adicionar ao Apple Calendar', url: links.apple }]
              ]
            }
          }
        );
      } catch (dbError) {
        console.error('Erro ao salvar evento:', dbError);
        await ctx.telegram.editMessageText(
          ctx.chat.id,
          loadingMsg.message_id,
          undefined,
          `❌ Erro ao salvar o evento no banco de dados. Tente novamente.`
        );
      }
    } else if (result.intent === 'list') {
      // Listar eventos
      if (userState.events.length === 0) {
        await ctx.telegram.editMessageText(
          ctx.chat.id,
          loadingMsg.message_id,
          undefined,
          'Você não tem eventos agendados.'
        );
        return;
      }
      
      let message = '📅 Seus eventos:\n\n';
      
      userState.events.forEach((event, index) => {
        const formattedDate = formatDate(event.startDate);
        
        message += `${index + 1}. ${event.title}\n📆 ${formattedDate}\n${event.location ? `📍 ${event.location}\n` : ''}${event.description ? `📝 ${event.description}\n` : ''}\n`;
      });
      
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        loadingMsg.message_id,
        undefined,
        message
      );
    } else if (result.intent === 'delete' && result.eventId) {
      // Deletar evento
      const searchTerm = result.eventId.toLowerCase();
      const eventIndex = userState.events.findIndex(event => 
        event.title.toLowerCase().includes(searchTerm) ||
        (event.description && event.description.toLowerCase().includes(searchTerm))
      );
      
      if (eventIndex !== -1) {
        const event = userState.events[eventIndex];
        userState.events.splice(eventIndex, 1);
        users.set(userId, userState);
        
        await ctx.telegram.editMessageText(
          ctx.chat.id,
          loadingMsg.message_id,
          undefined,
          `✅ Evento "${event.title}" foi cancelado com sucesso!`
        );
      } else {
        await ctx.telegram.editMessageText(
          ctx.chat.id,
          loadingMsg.message_id,
          undefined,
          `❌ Não encontrei nenhum evento com "${result.eventId}". Por favor, seja mais específico.`
        );
      }
    } else {
      // Intenção desconhecida
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        loadingMsg.message_id,
        undefined,
        `Não entendi o que você quis dizer. Por favor, tente novamente ou use /ajuda para ver os comandos disponíveis.`
      );
    }
  } catch (error) {
    console.error('Erro ao processar mensagem:', error);
    
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      loadingMsg.message_id,
      undefined,
      `Desculpe, houve um erro ao processar sua mensagem. Por favor, tente novamente.`
    );
  }
});

// Iniciar o bot
export async function startFinalOpenRouterBot() {
  try {
    await bot.telegram.setMyCommands([
      { command: 'start', description: 'Iniciar o bot' },
      { command: 'eventos', description: 'Listar seus eventos' },
      { command: 'criar', description: 'Criar evento de teste' },
      { command: 'ajuda', description: 'Mostrar ajuda' }
    ]);
    
    await bot.launch();
    
    log('Bot final com OpenRouter iniciado com sucesso!', 'bot');
    
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
    
    return true;
  } catch (error) {
    log(`Erro ao iniciar bot final: ${error}`, 'bot');
    return false;
  }
}

// Parar o bot
export function stopFinalOpenRouterBot() {
  bot.stop('SIGTERM');
  log('Bot parado', 'bot');
  return true;
}