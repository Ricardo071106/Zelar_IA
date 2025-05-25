/**
 * Solução definitiva para convites de calendário
 * 
 * Este arquivo implementa a solução para o problema das senhas de aplicativo
 * do Gmail que expiram, através de uma abordagem que não depende de credenciais
 * e funciona com qualquer provedor de email.
 */

import { Telegraf } from 'telegraf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { log } from './vite';

// Verificar token do Telegram
if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error('TELEGRAM_BOT_TOKEN não está definido no ambiente');
  process.exit(1);
}

// Inicializar bot
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Estado dos usuários
const users = new Map();

// Abordagem simples para validar email
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Função para gerar links de calendário para qualquer evento
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

// Formatar data para exibição
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
    name,
    email: null
  });
  
  await ctx.reply(
    `Olá, ${name}! 👋\n\n` +
    `Sou seu assistente de agenda com uma solução especial para o problema das senhas de aplicativo do Gmail que expiram.\n\n` +
    `Em vez de depender de emails, vou gerar links diretos para você adicionar eventos ao seu calendário favorito com apenas um clique!\n\n` +
    `Use /ajuda para ver todos os comandos disponíveis.`
  );
});

// Comando /ajuda - mostra ajuda
bot.command(['ajuda', 'help'], async (ctx) => {
  await ctx.reply(
    `📋 Comandos disponíveis:\n\n` +
    `/start - Iniciar o bot\n` +
    `/email - Configurar seu email (opcional)\n` +
    `/criar - Criar um evento de teste\n` +
    `/ajuda - Mostrar esta ajuda\n\n` +
    `Nossa solução inovadora não depende de senhas de aplicativo do Gmail que expiram!\n` +
    `Você receberá links diretos para adicionar eventos ao seu calendário favorito.`
  );
});

// Comando /email - configura email
bot.command('email', async (ctx) => {
  if (!ctx.from) return;
  
  const userId = ctx.from.id.toString();
  
  users.set(userId, {
    ...users.get(userId) || { id: userId, name: ctx.from.first_name || 'usuário' },
    awaitingEmail: true
  });
  
  await ctx.reply(
    `Por favor, envie seu endereço de email.\n\n` +
    `Nota: O email é opcional na nossa solução, pois geramos links diretos para adicionar eventos ao calendário!`
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
    id: Date.now().toString(),
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
          [{ text: '📅 Baixar arquivo .ICS', url: links.ics }]
        ]
      }
    }
  );
  
  // Se tiver email configurado, mencionar que está pronto para uso
  const user = users.get(userId);
  if (user && user.email) {
    await ctx.reply(
      `📧 Nota: Você tem o email ${user.email} configurado.\n\n` +
      `Esta solução funciona independentemente de email, pois os links diretos não precisam de credenciais do Gmail!`
    );
  }
});

// Processar mensagens de texto
bot.on('text', async (ctx) => {
  if (!ctx.from || !ctx.message || !ctx.message.text) return;
  
  const userId = ctx.from.id.toString();
  const user = users.get(userId);
  const text = ctx.message.text;
  
  // Se estiver esperando email
  if (user && user.awaitingEmail) {
    if (!isValidEmail(text)) {
      await ctx.reply('Este email não parece válido. Por favor, tente novamente ou use /cancelar para cancelar.');
      return;
    }
    
    // Atualizar email do usuário
    users.set(userId, {
      ...user,
      email: text,
      awaitingEmail: false
    });
    
    await ctx.reply(
      `✅ Email configurado: ${text}\n\n` +
      `Lembre-se: Nossa solução não depende de email para funcionar, pois usa links diretos para os calendários!\n\n` +
      `Use /criar para testar um evento agora.`
    );
    return;
  }
  
  // Para qualquer outra mensagem
  await ctx.reply(
    `Você disse: "${text}"\n\n` +
    `Use /criar para gerar um evento de teste com links diretos para calendários.\n` +
    `Use /ajuda para ver todos os comandos disponíveis.`
  );
});

// Iniciar o bot
export async function startCalendarSolution() {
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
    log('Bot de calendário iniciado com solução que não depende de senhas do Gmail!', 'bot');
    
    // Tratamento de encerramento
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
    
    return true;
  } catch (error) {
    log(`Erro ao iniciar bot: ${error}`, 'bot');
    return false;
  }
}