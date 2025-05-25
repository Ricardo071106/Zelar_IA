/**
 * Bot final do Telegram com processamento de linguagem natural
 * 
 * Esta versão final:
 * 1. Entende mensagens em português brasileiro
 * 2. Não depende de APIs pagas
 * 3. Gera links diretos para adicionar a qualquer calendário
 * 4. É 100% gratuita para uso
 */

import { Telegraf } from 'telegraf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { log } from '../vite';
import { parseEventText } from './simpleParser';

// Verificar token do Telegram
if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error('TELEGRAM_BOT_TOKEN não está definido no ambiente');
  process.exit(1);
}

// Inicializar bot
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Estado dos usuários
interface UserState {
  id: string;
  name: string;
  email?: string;
  awaitingEmail?: boolean;
}

const users = new Map<string, UserState>();

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
  
  // Link para Apple Calendar (arquivo ICS)
  const appleLink = `https://ics.ecal.com/event?data=${encodeURIComponent(JSON.stringify({
    summary: event.title,
    description: event.description || '',
    location: event.location || '',
    start: new Date(event.startDate).toISOString(),
    end: new Date(event.endDate || new Date(new Date(event.startDate).getTime() + 60 * 60 * 1000)).toISOString()
  }))}`;
  
  return {
    google: googleLink,
    outlook: outlookLink,
    apple: appleLink
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
    `Sou seu assistente de agenda. Você pode me dizer coisas como:\n\n` +
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
    `Nota: O email é opcional, pois você pode adicionar eventos diretamente clicando nos links que envio.`
  );
});

// Comando /criar - cria evento de teste
bot.command('criar', async (ctx) => {
  if (!ctx.from) return;
  
  const userId = ctx.from.id.toString();
  
  // Criar evento de teste
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(15, 0, 0, 0);
  
  const event = {
    title: 'Reunião de Teste',
    startDate: tomorrow,
    endDate: new Date(tomorrow.getTime() + 60 * 60 * 1000),
    location: 'Local de Teste',
    description: 'Este é um evento de teste criado pelo Assistente de Agenda'
  };
  
  // Formatar data para exibição
  const formattedDate = formatDate(tomorrow);
  
  // Gerar links de calendário
  const links = generateCalendarLinks(event);
  
  await ctx.reply(
    `✅ Evento criado com sucesso!\n\n` +
    `📅 ${event.title}\n` +
    `📆 ${formattedDate}\n` +
    `📍 ${event.location}\n\n` +
    `Adicione ao seu calendário com apenas um clique:\n\n`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📅 Adicionar ao Google Calendar', url: links.google }],
          [{ text: '📅 Adicionar ao Outlook', url: links.outlook }],
          [{ text: '📅 Adicionar ao Apple Calendar', url: links.apple }]
        ]
      }
    }
  );
});

// Processar mensagens de texto
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
  
  // Processar texto para identificar evento
  const loadingMessage = await ctx.reply('🔍 Processando sua mensagem...');
  
  try {
    // Processar texto natural com o parser local
    const result = parseEventText(text);
    
    // Se não foi possível identificar um evento
    if (!result.success || !result.event) {
      await ctx.telegram.editMessageText(
        ctx.chat.id, 
        loadingMessage.message_id, 
        undefined,
        result.message || "Não consegui identificar um evento na sua mensagem. Tente ser mais específico, por exemplo: 'Agendar reunião com João amanhã às 15h'"
      );
      return;
    }
    
    // Evento extraído com sucesso
    const event = result.event;
    
    // Formatar data para exibição
    const formattedDate = formatDate(event.startDate);
    
    // Gerar links de calendário
    const links = generateCalendarLinks(event);
    
    // Atualizar mensagem de carregamento com o evento criado
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      loadingMessage.message_id,
      undefined,
      `✅ Evento criado com sucesso!\n\n` +
      `📅 ${event.title}\n` +
      `📆 ${formattedDate}\n` +
      (event.location ? `📍 ${event.location}\n` : '') +
      `\nAdicione ao seu calendário com apenas um clique:`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '📅 Adicionar ao Google Calendar', url: links.google }],
            [{ text: '📅 Adicionar ao Outlook', url: links.outlook }],
            [{ text: '📅 Adicionar ao Apple Calendar', url: links.apple }]
          ]
        }
      }
    );
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
export async function startFinalBot() {
  try {
    // Configurar comandos
    await bot.telegram.setMyCommands([
      { command: 'start', description: 'Iniciar o bot' },
      { command: 'ajuda', description: 'Mostrar ajuda' },
      { command: 'email', description: 'Configurar email (opcional)' },
      { command: 'criar', description: 'Criar evento de teste' }
    ]);
    
    // Iniciar bot
    await bot.launch();
    log('Bot final iniciado! Pronto para processar mensagens em português.', 'bot');
    
    // Tratamento de encerramento
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
    
    return true;
  } catch (error) {
    log(`Erro ao iniciar bot final: ${error}`, 'bot');
    return false;
  }
}

// Parar o bot
export function stopFinalBot() {
  try {
    bot.stop('SIGTERM');
    return true;
  } catch (error) {
    console.error('Erro ao parar bot:', error);
    return false;
  }
}