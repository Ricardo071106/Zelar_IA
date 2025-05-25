/**
 * Bot completo com processamento de linguagem natural via OpenRouter
 * 
 * Esta versão:
 * 1. Entende linguagem natural em português via OpenRouter
 * 2. Adiciona eventos diretamente ao Google Calendar
 * 3. Permite ver e apagar eventos
 */

import { Telegraf } from 'telegraf';
import { format, addDays, isToday, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { log } from './vite';
import axios from 'axios';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

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

// Verificar credenciais do Google
if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) {
  console.error('Credenciais do Google não estão completas');
  console.warn('A integração direta com Google Calendar não funcionará');
}

// Inicializar bot
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Estado dos usuários
interface UserState {
  id: string;
  name: string;
  awaitingAuthCode?: boolean;
  googleTokens?: any;
  events: Array<{
    id: string;
    title: string;
    startDate: Date;
    endDate?: Date;
    location?: string;
    description?: string;
    googleEventId?: string;
  }>;
}

const users = new Map<string, UserState>();

// Configurar cliente OAuth2 do Google
const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || 'https://developers.google.com/oauthplayground'
);

// Escopos necessários para o Google Calendar
const SCOPES = ['https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/calendar.events'];

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

// Gerar URL de autorização do Google
function getGoogleAuthUrl(): string {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent'
  });
}

// Processar código de autorização
async function getTokensFromCode(code: string): Promise<any> {
  try {
    const { tokens } = await oauth2Client.getToken(code);
    return tokens;
  } catch (error) {
    console.error('Erro ao obter tokens:', error);
    throw error;
  }
}

// Adicionar evento ao Google Calendar
async function addToGoogleCalendar(tokens: any, event: any): Promise<string | null> {
  try {
    // Configurar cliente com os tokens do usuário
    oauth2Client.setCredentials(tokens);
    
    // Criar cliente do Calendar
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    // Criar evento
    const googleEvent = {
      summary: event.title,
      location: event.location,
      description: event.description,
      start: {
        dateTime: event.startDate.toISOString(),
        timeZone: 'America/Sao_Paulo',
      },
      end: {
        dateTime: event.endDate.toISOString(),
        timeZone: 'America/Sao_Paulo',
      },
      reminders: {
        useDefault: true
      }
    };
    
    // Inserir evento
    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: googleEvent
    });
    
    return response.data.id || null;
  } catch (error) {
    console.error('Erro ao adicionar evento ao Google Calendar:', error);
    return null;
  }
}

// Listar eventos do Google Calendar
async function listGoogleEvents(tokens: any, maxResults = 10): Promise<any[]> {
  try {
    // Configurar cliente com os tokens do usuário
    oauth2Client.setCredentials(tokens);
    
    // Criar cliente do Calendar
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    // Listar eventos
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: new Date().toISOString(),
      maxResults: maxResults,
      singleEvents: true,
      orderBy: 'startTime',
    });
    
    return response.data.items || [];
  } catch (error) {
    console.error('Erro ao listar eventos do Google Calendar:', error);
    return [];
  }
}

// Deletar evento do Google Calendar
async function deleteGoogleEvent(tokens: any, eventId: string): Promise<boolean> {
  try {
    // Configurar cliente com os tokens do usuário
    oauth2Client.setCredentials(tokens);
    
    // Criar cliente do Calendar
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    // Deletar evento
    await calendar.events.delete({
      calendarId: 'primary',
      eventId: eventId
    });
    
    return true;
  } catch (error) {
    console.error('Erro ao deletar evento do Google Calendar:', error);
    return false;
  }
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
  
  let message = `Olá, ${name}! 👋\n\n` +
    `Sou seu assistente de agenda inteligente. Você pode me dizer coisas como:\n\n` +
    `• "Agendar reunião com João amanhã às 15h"\n` +
    `• "Mostrar meus eventos de hoje"\n` +
    `• "Cancelar a reunião de amanhã"\n\n`;
  
  const user = users.get(userId);
  if (user?.googleTokens) {
    message += `✅ Você já está conectado ao Google Calendar!\n\n`;
  } else {
    message += `Para adicionar eventos automaticamente ao Google Calendar, use /autorizar\n\n`;
  }
  
  message += `Use /ajuda para ver todos os comandos disponíveis.`;
  
  await ctx.reply(message);
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
    `/autorizar - Conectar ao Google Calendar\n` +
    `/eventos - Listar seus eventos\n` +
    `/criar - Criar evento de teste\n` +
    `/ajuda - Mostrar esta ajuda`
  );
});

// Comando /autorizar - autoriza acesso ao Google Calendar
bot.command('autorizar', async (ctx) => {
  if (!ctx.from) return;
  
  const userId = ctx.from.id.toString();
  const userState = users.get(userId) || { id: userId, name: ctx.from.first_name || 'usuário', events: [] };
  
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    await ctx.reply(
      `⚠️ Não é possível autorizar o Google Calendar no momento.\n` +
      `O administrador precisa configurar as credenciais de API.`
    );
    return;
  }
  
  // Gerar URL de autorização
  const authUrl = getGoogleAuthUrl();
  
  // Marcar usuário como esperando código
  userState.awaitingAuthCode = true;
  users.set(userId, userState);
  
  await ctx.reply(
    `Para conectar seu Google Calendar, siga estes passos:\n\n` +
    `1. Clique no link abaixo:\n${authUrl}\n\n` +
    `2. Faça login na sua conta Google e autorize o acesso\n\n` +
    `3. Você receberá um código. Copie e envie para mim\n\n` +
    `Depois disso, poderei adicionar eventos diretamente ao seu calendário!`
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
  
  const loadingMsg = await ctx.reply('🔍 Buscando seus eventos...');
  
  if (userState.googleTokens) {
    // Buscar eventos do Google Calendar
    const events = await listGoogleEvents(userState.googleTokens);
    
    if (events.length === 0) {
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        loadingMsg.message_id,
        undefined,
        'Você não tem eventos agendados próximos.'
      );
      return;
    }
    
    // Formatar lista de eventos
    let message = '📅 Seus próximos eventos:\n\n';
    
    events.forEach((event, index) => {
      const start = event.start.dateTime || event.start.date;
      const startDate = new Date(start);
      const formattedDate = formatDate(startDate);
      
      message += `${index + 1}. ${event.summary}\n📆 ${formattedDate}\n${event.location ? `📍 ${event.location}\n` : ''}${event.description ? `📝 ${event.description}\n` : ''}\n`;
    });
    
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      loadingMsg.message_id,
      undefined,
      message
    );
  } else {
    // Não tem autorização do Google Calendar
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      loadingMsg.message_id,
      undefined,
      `Você ainda não autorizou o acesso ao Google Calendar.\n\n` +
      `Use /autorizar para conectar sua conta e ver seus eventos.`
    );
  }
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
  
  const loadingMsg = await ctx.reply('⏳ Criando evento de teste...');
  
  // Se tem tokens do Google, adicionar diretamente ao calendar
  if (userState.googleTokens) {
    const eventId = await addToGoogleCalendar(userState.googleTokens, event);
    
    if (eventId) {
      // Salvar evento na memória também
      event.googleEventId = eventId;
      userState.events.push(event);
      users.set(userId, userState);
      
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        loadingMsg.message_id,
        undefined,
        `✅ Evento adicionado automaticamente ao seu Google Calendar!\n\n` +
        `📅 ${event.title}\n` +
        `📆 ${formatDate(event.startDate)}\n` +
        `📍 ${event.location}\n` +
        `📝 ${event.description}`
      );
    } else {
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        loadingMsg.message_id,
        undefined,
        `❌ Não foi possível adicionar o evento ao Google Calendar.\n\n` +
        `Tente reconectar sua conta usando /autorizar`
      );
    }
  } else {
    // Não tem autorização, adicionar apenas localmente
    userState.events.push(event);
    users.set(userId, userState);
    
    // Gerar link para adicionar manualmente
    const startTime = tomorrow.toISOString().replace(/-|:|\.\d\d\d/g,'').slice(0,15);
    const endTime = new Date(tomorrow.getTime() + 60 * 60 * 1000).toISOString().replace(/-|:|\.\d\d\d/g,'').slice(0,15);
    
    const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${startTime}/${endTime}&details=${encodeURIComponent(event.description)}&location=${encodeURIComponent(event.location)}`;
    
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      loadingMsg.message_id,
      undefined,
      `⚠️ Você ainda não autorizou o acesso ao Google Calendar.\n\n` +
      `Use /autorizar para adicionar eventos automaticamente!\n\n` +
      `Enquanto isso, você pode adicionar o evento manualmente:`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Adicionar ao Google Calendar', url: googleUrl }]
          ]
        }
      }
    );
  }
});

// Processar mensagens de texto
bot.on('text', async (ctx) => {
  if (!ctx.from || !ctx.message || !ctx.message.text) return;
  
  const userId = ctx.from.id.toString();
  const userState = users.get(userId) || { id: userId, name: ctx.from.first_name || 'usuário', events: [] };
  const text = ctx.message.text;
  
  // Se o usuário está esperando código de autorização
  if (userState.awaitingAuthCode) {
    try {
      const loadingMsg = await ctx.reply('🔄 Processando seu código de autorização...');
      
      // Processar código de autorização
      const tokens = await getTokensFromCode(text);
      
      // Salvar tokens
      userState.googleTokens = tokens;
      userState.awaitingAuthCode = false;
      users.set(userId, userState);
      
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        loadingMsg.message_id,
        undefined,
        `✅ Autorização concluída com sucesso!\n\n` +
        `Agora posso adicionar eventos diretamente ao seu Google Calendar.\n\n` +
        `Experimente dizer algo como "agendar reunião amanhã às 15h"`
      );
    } catch (error) {
      await ctx.reply(
        `❌ Código inválido ou expirado.\n\n` +
        `Por favor, tente novamente usando /autorizar`
      );
      
      // Resetar estado
      userState.awaitingAuthCode = false;
      users.set(userId, userState);
    }
    
    return;
  }
  
  // Processar mensagem com IA
  const loadingMsg = await ctx.reply('🧠 Processando sua mensagem...');
  
  try {
    const result = await processNaturalLanguage(text);
    
    if (result.intent === 'create' && result.event) {
      // Criar evento
      const event = {
        id: Date.now().toString(),
        ...result.event
      };
      
      // Se tem tokens do Google, adicionar diretamente ao calendar
      if (userState.googleTokens) {
        const eventId = await addToGoogleCalendar(userState.googleTokens, event);
        
        if (eventId) {
          // Salvar evento na memória também
          event.googleEventId = eventId;
          userState.events.push(event);
          users.set(userId, userState);
          
          await ctx.telegram.editMessageText(
            ctx.chat.id,
            loadingMsg.message_id,
            undefined,
            `✅ Evento adicionado automaticamente ao seu Google Calendar!\n\n` +
            `📅 ${event.title}\n` +
            `📆 ${formatDate(event.startDate)}\n` +
            `${event.location ? `📍 ${event.location}\n` : ''}` +
            `${event.description ? `📝 ${event.description}\n` : ''}`
          );
        } else {
          await ctx.telegram.editMessageText(
            ctx.chat.id,
            loadingMsg.message_id,
            undefined,
            `❌ Não foi possível adicionar o evento ao Google Calendar.\n\n` +
            `Tente reconectar sua conta usando /autorizar`
          );
        }
      } else {
        // Não tem autorização, adicionar apenas localmente
        userState.events.push(event);
        users.set(userId, userState);
        
        // Gerar link para adicionar manualmente
        const startTime = event.startDate.toISOString().replace(/-|:|\.\d\d\d/g,'').slice(0,15);
        const endTime = event.endDate.toISOString().replace(/-|:|\.\d\d\d/g,'').slice(0,15);
        
        const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${startTime}/${endTime}${event.description ? `&details=${encodeURIComponent(event.description)}` : ''}${event.location ? `&location=${encodeURIComponent(event.location)}` : ''}`;
        
        await ctx.telegram.editMessageText(
          ctx.chat.id,
          loadingMsg.message_id,
          undefined,
          `⚠️ Você ainda não autorizou o acesso ao Google Calendar.\n\n` +
          `Use /autorizar para adicionar eventos automaticamente!\n\n` +
          `Enquanto isso, você pode adicionar o evento manualmente:`,
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: 'Adicionar ao Google Calendar', url: googleUrl }]
              ]
            }
          }
        );
      }
    } else if (result.intent === 'list') {
      // Listar eventos
      if (userState.googleTokens) {
        // Buscar eventos do Google Calendar
        const events = await listGoogleEvents(userState.googleTokens);
        
        if (events.length === 0) {
          await ctx.telegram.editMessageText(
            ctx.chat.id,
            loadingMsg.message_id,
            undefined,
            'Você não tem eventos agendados próximos.'
          );
          return;
        }
        
        // Formatar lista de eventos
        let message = '📅 Seus próximos eventos:\n\n';
        
        events.forEach((event, index) => {
          const start = event.start.dateTime || event.start.date;
          const startDate = new Date(start);
          const formattedDate = formatDate(startDate);
          
          message += `${index + 1}. ${event.summary}\n📆 ${formattedDate}\n${event.location ? `📍 ${event.location}\n` : ''}${event.description ? `📝 ${event.description}\n` : ''}\n`;
        });
        
        await ctx.telegram.editMessageText(
          ctx.chat.id,
          loadingMsg.message_id,
          undefined,
          message
        );
      } else {
        // Listar eventos locais
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
      }
    } else if (result.intent === 'delete' && result.eventId) {
      // Deletar evento
      if (userState.googleTokens) {
        // Buscar eventos do Google Calendar
        const events = await listGoogleEvents(userState.googleTokens);
        
        // Tentar encontrar o evento pelo identificador fornecido
        const searchTerm = result.eventId.toLowerCase();
        const eventToDelete = events.find(event => 
          event.summary.toLowerCase().includes(searchTerm) ||
          (event.description && event.description.toLowerCase().includes(searchTerm))
        );
        
        if (eventToDelete) {
          // Deletar do Google Calendar
          const deleted = await deleteGoogleEvent(userState.googleTokens, eventToDelete.id);
          
          if (deleted) {
            // Deletar também da memória local
            userState.events = userState.events.filter(e => e.googleEventId !== eventToDelete.id);
            users.set(userId, userState);
            
            await ctx.telegram.editMessageText(
              ctx.chat.id,
              loadingMsg.message_id,
              undefined,
              `✅ Evento "${eventToDelete.summary}" foi cancelado com sucesso!`
            );
          } else {
            await ctx.telegram.editMessageText(
              ctx.chat.id,
              loadingMsg.message_id,
              undefined,
              `❌ Não foi possível cancelar o evento. Tente novamente mais tarde.`
            );
          }
        } else {
          await ctx.telegram.editMessageText(
            ctx.chat.id,
            loadingMsg.message_id,
            undefined,
            `❌ Não encontrei nenhum evento com "${result.eventId}". Por favor, seja mais específico.`
          );
        }
      } else {
        await ctx.telegram.editMessageText(
          ctx.chat.id,
          loadingMsg.message_id,
          undefined,
          `⚠️ Você ainda não autorizou o acesso ao Google Calendar.\n\n` +
          `Use /autorizar para gerenciar seus eventos automaticamente!`
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
export async function startOpenRouterBot() {
  try {
    await bot.telegram.setMyCommands([
      { command: 'start', description: 'Iniciar o bot' },
      { command: 'autorizar', description: 'Conectar ao Google Calendar' },
      { command: 'eventos', description: 'Listar seus eventos' },
      { command: 'criar', description: 'Criar evento de teste' },
      { command: 'ajuda', description: 'Mostrar ajuda' }
    ]);
    
    await bot.launch();
    
    log('Bot com OpenRouter e Google Calendar iniciado com sucesso!', 'bot');
    
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
    
    return true;
  } catch (error) {
    log(`Erro ao iniciar bot: ${error}`, 'bot');
    return false;
  }
}

// Parar o bot
export function stopOpenRouterBot() {
  bot.stop('SIGTERM');
  log('Bot parado', 'bot');
  return true;
}