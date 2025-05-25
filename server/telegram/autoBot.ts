/**
 * Bot do Telegram com interpretação de linguagem natural
 * 
 * Este módulo implementa um bot que entende mensagens em português brasileiro
 * e cria eventos diretamente nos calendários dos usuários
 */

import { Telegraf } from 'telegraf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { log } from '../vite';
import { parseEventText } from './simpleParser';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

// Verificar token do Telegram
if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error('TELEGRAM_BOT_TOKEN não está definido no ambiente');
  process.exit(1);
}

// Verificar credenciais do Google
if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) {
  console.error('Credenciais do Google não estão definidas no ambiente');
  console.warn('A integração direta com Google Calendar estará indisponível');
}

// Inicializar bot
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Estado dos usuários
interface UserState {
  id: string;
  name: string;
  email?: string;
  awaitingEmail?: boolean;
  googleAuth?: {
    tokens?: any;
    authUrl?: string;
    pendingAuth?: boolean;
  };
}

const users = new Map<string, UserState>();

// Configurar cliente OAuth2 do Google
const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Escopos necessários para o Google Calendar
const SCOPES = ['https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/calendar.events'];

/**
 * Gera URL de autorização do Google
 */
function getGoogleAuthUrl(): string {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent'
  });
}

/**
 * Função para adicionar evento diretamente ao Google Calendar
 */
async function addToGoogleCalendar(userState: UserState, event: any): Promise<boolean> {
  if (!userState.googleAuth?.tokens) {
    return false;
  }
  
  try {
    // Configurar cliente com os tokens do usuário
    oauth2Client.setCredentials(userState.googleAuth.tokens);
    
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
    
    return !!response.data.id;
  } catch (error) {
    console.error('Erro ao adicionar evento ao Google Calendar:', error);
    return false;
  }
}

/**
 * Abordagem simples para validar email
 */
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Função para gerar links de calendário para qualquer evento
 */
function generateCalendarLinks(event: any) {
  // Formatar datas para URL do Google Calendar
  const startDateFormatted = new Date(event.startDate).toISOString().replace(/-|:|\.\d\d\d/g,'').slice(0,15);
  const endDateFormatted = new Date(event.endDate || new Date(new Date(event.startDate).getTime() + 60 * 60 * 1000))
    .toISOString().replace(/-|:|\.\d\d\d/g,'').slice(0,15);
  
  // Link direto para o Google Calendar
  const googleLink = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${startDateFormatted}/${endDateFormatted}&details=${encodeURIComponent(event.description || '')}&location=${encodeURIComponent(event.location || '')}`;
  
  // Link direto para o Outlook
  const outlookLink = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(event.title)}&startdt=${new Date(event.startDate).toISOString()}&enddt=${new Date(event.endDate || new Date(new Date(event.startDate).getTime() + 60 * 60 * 1000)).toISOString()}&body=${encodeURIComponent(event.description || '')}&location=${encodeURIComponent(event.location || '')}`;
  
  // Link para gerar arquivo ICS
  const icsLink = `https://ics.ecal.com/event?data=${encodeURIComponent(JSON.stringify({
    summary: event.title,
    description: event.description || '',
    location: event.location || '',
    start: new Date(event.startDate).toISOString(),
    end: new Date(event.endDate || new Date(new Date(event.startDate).getTime() + 60 * 60 * 1000)).toISOString()
  }))}`;
  
  return {
    google: googleLink,
    outlook: outlookLink,
    ics: icsLink
  };
}

/**
 * Formatar data para exibição em português
 */
function formatDate(date: Date): string {
  return format(date, "EEEE, dd 'de' MMMM 'às' HH:mm", { locale: ptBR });
}

// Comando /start - inicia o bot
bot.start(async (ctx) => {
  if (!ctx.from) return;
  
  const userId = ctx.from.id.toString();
  const name = ctx.from.first_name || ctx.from.username || 'usuário';
  
  users.set(userId, { 
    id: userId,
    name
  });
  
  await ctx.reply(
    `Olá, ${name}! 👋\n\n` +
    `Sou seu assistente inteligente de agenda. Você pode me dizer coisas como:\n\n` +
    `• "Agendar reunião com João amanhã às 15h"\n` +
    `• "Marcar dentista na próxima terça às 9h"\n` +
    `• "Lembrar de ligar para Maria na sexta às 14h"\n\n` +
    `Use /ajuda para ver todos os comandos disponíveis.`
  );
});

// Comando /ajuda - mostra ajuda
bot.command(['ajuda', 'help'], async (ctx) => {
  await ctx.reply(
    `📋 Como usar o assistente de agenda:\n\n` +
    `1️⃣ Fale naturalmente sobre seus eventos:\n` +
    `   "Reunião com equipe amanhã às 10h"\n\n` +
    `2️⃣ Eu vou processar sua mensagem e criar o evento\n\n` +
    `3️⃣ Você receberá links para adicionar ao seu calendário\n\n` +
    `📌 Comandos disponíveis:\n` +
    `/start - Iniciar o bot\n` +
    `/email - Configurar seu email (opcional)\n` +
    `/google - Conectar sua conta Google (para adicionar eventos automaticamente)\n` +
    `/criar - Criar um evento de teste\n` +
    `/ajuda - Mostrar esta ajuda`
  );
});

// Comando /email - configura email
bot.command('email', async (ctx) => {
  if (!ctx.from) return;
  
  const userId = ctx.from.id.toString();
  const userState = users.get(userId) || { id: userId, name: ctx.from.first_name || 'usuário' };
  
  userState.awaitingEmail = true;
  users.set(userId, userState);
  
  await ctx.reply(
    `Por favor, envie seu endereço de email.\n\n` +
    `O email é usado para enviar convites de calendário.`
  );
});

// Comando /google - conecta ao Google Calendar
bot.command('google', async (ctx) => {
  if (!ctx.from) return;
  
  // Verificar se temos as credenciais do Google
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) {
    await ctx.reply(
      `⚠️ A integração com Google Calendar não está disponível neste momento.\n\n` +
      `Por favor, use os links diretos para adicionar eventos ao seu calendário.`
    );
    return;
  }
  
  const userId = ctx.from.id.toString();
  const userState = users.get(userId) || { id: userId, name: ctx.from.first_name || 'usuário' };
  
  // Gerar URL de autorização
  const authUrl = getGoogleAuthUrl();
  
  userState.googleAuth = {
    authUrl,
    pendingAuth: true
  };
  
  users.set(userId, userState);
  
  await ctx.reply(
    `Para conectar sua conta do Google Calendar, clique no link abaixo:\n\n` +
    `${authUrl}\n\n` +
    `Após autorizar, você será redirecionado para uma página. Copie o código que aparece na URL e envie para mim.`
  );
});

// Comando /criar - cria evento de teste
bot.command('criar', async (ctx) => {
  if (!ctx.from) return;
  
  const userId = ctx.from.id.toString();
  const userState = users.get(userId) || { id: userId, name: ctx.from.first_name || 'usuário' };
  
  // Criar evento de teste
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(15, 0, 0, 0);
  
  const event = {
    id: Date.now().toString(),
    title: 'Reunião de Teste',
    startDate: tomorrow,
    endDate: new Date(tomorrow.getTime() + 60 * 60 * 1000),
    location: 'Local de Teste',
    description: 'Este é um evento de teste criado pelo Assistente de Agenda'
  };
  
  // Tentar adicionar diretamente ao Google Calendar se o usuário estiver autenticado
  let addedToGoogle = false;
  if (userState.googleAuth?.tokens) {
    addedToGoogle = await addToGoogleCalendar(userState, event);
  }
  
  // Formatar data para exibição
  const formattedDate = formatDate(tomorrow);
  
  // Gerar links de calendário
  const links = generateCalendarLinks(event);
  
  let message = `✅ Evento criado com sucesso!\n\n` +
    `📅 ${event.title}\n` +
    `📆 ${formattedDate}\n` +
    `📍 ${event.location}\n\n`;
  
  if (addedToGoogle) {
    message += `✅ Evento adicionado automaticamente ao seu Google Calendar!\n\n`;
  } else {
    message += `Adicione ao seu calendário com apenas um clique:\n\n`;
  }
  
  await ctx.reply(message, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '📅 Adicionar ao Google Calendar', url: links.google }],
        [{ text: '📅 Adicionar ao Outlook', url: links.outlook }],
        [{ text: '📅 Baixar arquivo .ICS', url: links.ics }]
      ]
    }
  });
});

// Processar mensagens de texto - O CORAÇÃO DO BOT
bot.on('text', async (ctx) => {
  if (!ctx.from || !ctx.message || !ctx.message.text) return;
  
  const userId = ctx.from.id.toString();
  const userState = users.get(userId) || { id: userId, name: ctx.from.first_name || 'usuário' };
  const text = ctx.message.text;
  
  // Se estiver esperando email
  if (userState.awaitingEmail) {
    if (!isValidEmail(text)) {
      await ctx.reply('Este email não parece válido. Por favor, tente novamente ou use /cancelar para cancelar.');
      return;
    }
    
    // Atualizar email do usuário
    userState.email = text;
    userState.awaitingEmail = false;
    users.set(userId, userState);
    
    await ctx.reply(
      `✅ Email configurado: ${text}\n\n` +
      `Agora você pode me dizer coisas como "Agendar reunião amanhã às 15h" e eu vou entender.`
    );
    return;
  }
  
  // Se estiver esperando código de autorização do Google
  if (userState.googleAuth?.pendingAuth) {
    try {
      // Tentar obter tokens com o código
      const { tokens } = await oauth2Client.getToken(text);
      
      // Salvar tokens
      userState.googleAuth.tokens = tokens;
      userState.googleAuth.pendingAuth = false;
      users.set(userId, userState);
      
      await ctx.reply(
        `✅ Sua conta do Google Calendar foi conectada com sucesso!\n\n` +
        `Agora seus eventos serão adicionados automaticamente ao seu calendário.`
      );
    } catch (error) {
      console.error('Erro ao obter tokens:', error);
      await ctx.reply(
        `❌ Não foi possível conectar sua conta do Google Calendar. O código pode estar incorreto ou expirado.\n\n` +
        `Use /google para tentar novamente.`
      );
    }
    return;
  }
  
  // Processar texto para identificar evento
  const loadingMessage = await ctx.reply('🔍 Processando sua mensagem...');
  
  try {
    // Processar texto natural
    const result = parseEventText(text);
    
    // Se não foi possível identificar um evento
    if (!result.success || !result.event) {
      await ctx.telegram.editMessageText(
        ctx.chat.id, 
        loadingMessage.message_id, 
        undefined,
        result.message || "Não consegui identificar um evento na sua mensagem. Tente ser mais específico."
      );
      return;
    }
    
    // Evento extraído com sucesso
    const event = result.event;
    
    // Tentar adicionar diretamente ao Google Calendar se o usuário estiver autenticado
    let addedToGoogle = false;
    if (userState.googleAuth?.tokens) {
      addedToGoogle = await addToGoogleCalendar(userState, event);
    }
    
    // Formatar data para exibição
    const formattedDate = formatDate(event.startDate);
    
    // Gerar links de calendário
    const links = generateCalendarLinks(event);
    
    // Preparar mensagem
    let message = `✅ Evento criado com sucesso!\n\n` +
      `📅 ${event.title}\n` +
      `📆 ${formattedDate}\n` +
      (event.location ? `📍 ${event.location}\n` : '') +
      (event.description ? `📝 ${event.description}\n` : '') + 
      `\n`;
    
    if (addedToGoogle) {
      message += `✅ Evento adicionado automaticamente ao seu Google Calendar!\n\n`;
    } else {
      message += `Adicione ao seu calendário com apenas um clique:\n\n`;
    }
    
    // Atualizar mensagem de carregamento com o evento criado
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      loadingMessage.message_id,
      undefined,
      message,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '📅 Adicionar ao Google Calendar', url: links.google }],
            [{ text: '📅 Adicionar ao Outlook', url: links.outlook }],
            [{ text: '📅 Baixar arquivo .ICS', url: links.ics }]
          ]
        }
      }
    );
    
    // Se tiver email mas não tiver Google Calendar, oferecer conexão
    if (userState.email && !userState.googleAuth?.tokens && process.env.GOOGLE_CLIENT_ID) {
      await ctx.reply(
        `💡 Dica: Conecte sua conta do Google Calendar para adicionar eventos automaticamente!\n\n` +
        `Use o comando /google para conectar.`
      );
    }
  } catch (error) {
    console.error('Erro ao processar mensagem:', error);
    
    // Em caso de erro, atualizar mensagem de carregamento
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      loadingMessage.message_id,
      undefined,
      'Desculpe, houve um erro ao processar sua mensagem. Por favor, tente novamente.'
    );
  }
});

// Iniciar o bot
export async function startAutoBot() {
  try {
    // Configurar comandos
    await bot.telegram.setMyCommands([
      { command: 'start', description: 'Iniciar o bot' },
      { command: 'ajuda', description: 'Mostrar ajuda' },
      { command: 'email', description: 'Configurar email (opcional)' },
      { command: 'google', description: 'Conectar Google Calendar' },
      { command: 'criar', description: 'Criar evento de teste' }
    ]);
    
    // Iniciar bot
    await bot.launch();
    log('Bot inteligente iniciado! Pronto para processar mensagens em português.', 'bot');
    
    // Tratamento de encerramento
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
    
    return true;
  } catch (error) {
    log(`Erro ao iniciar bot inteligente: ${error}`, 'bot');
    return false;
  }
}

// Parar o bot
export function stopAutoBot() {
  try {
    bot.stop('SIGTERM');
    return true;
  } catch (error) {
    console.error('Erro ao parar bot:', error);
    return false;
  }
}