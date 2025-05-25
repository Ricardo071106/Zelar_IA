/**
 * Bot com adição automática de eventos ao calendário
 * 
 * Esta versão adiciona eventos diretamente ao Google Calendar sem precisar clicar em links
 */

import { Telegraf } from 'telegraf';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { log } from './vite';
import { getAuthUrl, getTokensFromCode, saveUserTokens, hasUserTokens, addEventToCalendar } from './googleCalendar';

// Verificar token do Telegram
if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error('TELEGRAM_BOT_TOKEN não está definido no ambiente');
  process.exit(1);
}

// Verificar credenciais do Google
if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  console.error('Credenciais do Google não estão completas, os eventos não serão adicionados automaticamente');
}

// Inicializar bot
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Estado dos usuários
interface UserState {
  id: string;
  name: string;
  awaitingAuthCode?: boolean;
}

const users = new Map<string, UserState>();

// Comandos básicos
bot.start(async (ctx) => {
  if (!ctx.from) return;
  
  const userId = ctx.from.id.toString();
  const name = ctx.from.first_name || 'usuário';
  
  // Guardar estado do usuário
  users.set(userId, { id: userId, name });
  
  let message = `Olá, ${name}! 👋\n\n` +
    `Sou seu assistente de agenda que adiciona eventos DIRETAMENTE ao seu calendário.\n\n`;
  
  if (hasUserTokens(userId)) {
    message += `✅ Você já autorizou o acesso ao Google Calendar!\n` +
      `Agora é só me dizer o que agendar, por exemplo: "agendar reunião amanhã às 15h"\n\n`;
  } else {
    message += `Para adicionar eventos automaticamente ao seu Google Calendar, use o comando /autorizar\n\n`;
  }
  
  message += `Use /ajuda para ver todos os comandos disponíveis.`;
  
  await ctx.reply(message);
});

bot.help((ctx) => {
  ctx.reply(
    `Comandos disponíveis:\n\n` +
    `/start - Iniciar o bot\n` +
    `/autorizar - Conectar com Google Calendar\n` +
    `/criar - Criar evento de teste\n` +
    `/ajuda - Mostrar esta ajuda\n\n` +
    `Você também pode simplesmente me dizer o que agendar, como:\n` +
    `"Agendar reunião amanhã às 15h"\n` +
    `"Lembrar de ligar para médico na sexta às 10h"`
  );
});

// Comando para autorizar o acesso ao Google Calendar
bot.command('autorizar', async (ctx) => {
  if (!ctx.from) return;
  
  const userId = ctx.from.id.toString();
  
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    await ctx.reply(
      `⚠️ Não é possível autorizar o acesso ao Google Calendar no momento.\n` +
      `O administrador precisa configurar as credenciais de API do Google.`
    );
    return;
  }
  
  // Gerar URL de autorização
  const authUrl = getAuthUrl();
  
  // Marcar usuário como esperando código de autorização
  users.set(userId, {
    ...users.get(userId) || { id: userId, name: ctx.from.first_name || 'usuário' },
    awaitingAuthCode: true
  });
  
  await ctx.reply(
    `Para autorizar o acesso ao seu Google Calendar, siga estes passos:\n\n` +
    `1. Clique no link abaixo:\n${authUrl}\n\n` +
    `2. Faça login na sua conta Google e autorize o acesso\n\n` +
    `3. Você será redirecionado para uma página com um código\n\n` +
    `4. Copie esse código e envie para mim\n\n` +
    `Depois disso, poderei adicionar eventos diretamente ao seu calendário!`
  );
});

// Comando para criar evento de teste
bot.command('criar', async (ctx) => {
  if (!ctx.from) return;
  
  const userId = ctx.from.id.toString();
  
  // Criar evento de teste para amanhã
  const tomorrow = addDays(new Date(), 1);
  tomorrow.setHours(15, 0, 0, 0);
  
  const event = {
    title: 'Reunião de Teste',
    description: 'Este é um evento de teste criado pelo bot',
    location: 'Local de Teste',
    startDate: tomorrow,
    endDate: new Date(tomorrow.getTime() + 60 * 60 * 1000)
  };
  
  // Verificar se o usuário autorizou o Google Calendar
  if (hasUserTokens(userId)) {
    // Tentar adicionar diretamente ao calendário
    const added = await addEventToCalendar(userId, event);
    
    if (added) {
      await ctx.reply(
        `✅ Evento adicionado automaticamente ao seu Google Calendar!\n\n` +
        `📅 ${event.title}\n` +
        `📆 ${format(tomorrow, "EEEE, dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}\n` +
        `📍 ${event.location}`
      );
    } else {
      await ctx.reply(
        `❌ Não foi possível adicionar o evento automaticamente.\n` +
        `Talvez sua autorização tenha expirado. Use /autorizar para reconectar.`
      );
    }
  } else {
    // Gerar link direto para adicionar manualmente
    const startTime = tomorrow.toISOString().replace(/-|:|\.\d\d\d/g,'').slice(0,15);
    const endTime = new Date(tomorrow.getTime() + 60 * 60 * 1000).toISOString().replace(/-|:|\.\d\d\d/g,'').slice(0,15);
    
    const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${startTime}/${endTime}&details=${encodeURIComponent(event.description)}&location=${encodeURIComponent(event.location)}`;
    
    await ctx.reply(
      `⚠️ Você ainda não autorizou o acesso ao seu Google Calendar.\n\n` +
      `Use /autorizar para que eu possa adicionar eventos automaticamente!\n\n` +
      `Enquanto isso, você pode adicionar este evento manualmente:`,
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
  const user = users.get(userId) || { id: userId, name: ctx.from.first_name || 'usuário' };
  const text = ctx.message.text;
  
  // Se o usuário está esperando código de autorização
  if (user.awaitingAuthCode) {
    try {
      // Processar código de autorização
      const tokens = await getTokensFromCode(text);
      
      // Salvar tokens do usuário
      saveUserTokens(userId, tokens);
      
      // Atualizar estado do usuário
      users.set(userId, {
        ...user,
        awaitingAuthCode: false
      });
      
      await ctx.reply(
        `✅ Autorização concluída com sucesso!\n\n` +
        `Agora posso adicionar eventos diretamente ao seu Google Calendar.\n\n` +
        `Experimente dizer algo como "agendar reunião amanhã às 15h"`
      );
      return;
    } catch (error) {
      console.error('Erro ao processar código de autorização:', error);
      
      await ctx.reply(
        `❌ Não foi possível processar o código de autorização.\n\n` +
        `Por favor, tente novamente usando o comando /autorizar`
      );
      
      // Resetar estado de espera
      users.set(userId, {
        ...user,
        awaitingAuthCode: false
      });
      return;
    }
  }
  
  // Verificar se é um comando para criar evento
  const eventPattern = /(agendar|marcar|lembrar de?)\s+(.+?)(?:\s+(?:para|em|no dia|na|às|amanhã|hoje))/i;
  if (text.match(eventPattern)) {
    // Mensagem de processamento
    const loadingMsg = await ctx.reply('🔍 Processando seu evento...');
    
    // Extrair título do evento
    const titleMatch = text.match(eventPattern);
    const title = titleMatch && titleMatch[2] ? titleMatch[2].trim() : 'Evento';
    
    // Data padrão (amanhã às 15h)
    const eventDate = addDays(new Date(), 1);
    eventDate.setHours(15, 0, 0, 0);
    
    // Verificar menções a datas
    if (text.toLowerCase().includes('amanhã')) {
      // Já definimos como amanhã
    } else if (text.toLowerCase().includes('hoje')) {
      // Hoje
      eventDate.setDate(new Date().getDate());
    } else if (text.toLowerCase().includes('segunda')) {
      // Próxima segunda-feira
      let daysUntilMonday = 1 - new Date().getDay();
      if (daysUntilMonday <= 0) daysUntilMonday += 7;
      eventDate.setDate(new Date().getDate() + daysUntilMonday);
    } else if (text.toLowerCase().includes('terça')) {
      // Próxima terça-feira
      let daysUntilTuesday = 2 - new Date().getDay();
      if (daysUntilTuesday <= 0) daysUntilTuesday += 7;
      eventDate.setDate(new Date().getDate() + daysUntilTuesday);
    } else if (text.toLowerCase().includes('quarta')) {
      // Próxima quarta-feira
      let daysUntilWednesday = 3 - new Date().getDay();
      if (daysUntilWednesday <= 0) daysUntilWednesday += 7;
      eventDate.setDate(new Date().getDate() + daysUntilWednesday);
    } else if (text.toLowerCase().includes('quinta')) {
      // Próxima quinta-feira
      let daysUntilThursday = 4 - new Date().getDay();
      if (daysUntilThursday <= 0) daysUntilThursday += 7;
      eventDate.setDate(new Date().getDate() + daysUntilThursday);
    } else if (text.toLowerCase().includes('sexta')) {
      // Próxima sexta-feira
      let daysUntilFriday = 5 - new Date().getDay();
      if (daysUntilFriday <= 0) daysUntilFriday += 7;
      eventDate.setDate(new Date().getDate() + daysUntilFriday);
    } else if (text.toLowerCase().includes('sábado') || text.toLowerCase().includes('sabado')) {
      // Próximo sábado
      let daysUntilSaturday = 6 - new Date().getDay();
      if (daysUntilSaturday <= 0) daysUntilSaturday += 7;
      eventDate.setDate(new Date().getDate() + daysUntilSaturday);
    } else if (text.toLowerCase().includes('domingo')) {
      // Próximo domingo
      let daysUntilSunday = 0 - new Date().getDay();
      if (daysUntilSunday <= 0) daysUntilSunday += 7;
      eventDate.setDate(new Date().getDate() + daysUntilSunday);
    }
    
    // Verificar menções a horas
    const timeMatch = text.match(/(\d{1,2})(?:h|:)(\d{2})?/);
    if (timeMatch) {
      const hours = parseInt(timeMatch[1], 10);
      const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
      
      if (hours >= 0 && hours <= 23) {
        eventDate.setHours(hours, minutes, 0, 0);
      }
    }
    
    // Montar evento
    const event = {
      title,
      startDate: eventDate,
      endDate: new Date(eventDate.getTime() + 60 * 60 * 1000) // 1 hora depois
    };
    
    // Tentar adicionar evento diretamente ao calendário se autorizado
    if (hasUserTokens(userId)) {
      const added = await addEventToCalendar(userId, event);
      
      if (added) {
        // Sucesso
        await ctx.telegram.editMessageText(
          ctx.chat.id,
          loadingMsg.message_id,
          undefined,
          `✅ Evento adicionado automaticamente ao seu Google Calendar!\n\n` +
          `📅 ${event.title}\n` +
          `📆 ${format(eventDate, "EEEE, dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}`
        );
      } else {
        // Falha ao adicionar
        await ctx.telegram.editMessageText(
          ctx.chat.id,
          loadingMsg.message_id,
          undefined,
          `❌ Não foi possível adicionar o evento automaticamente.\n` +
          `Talvez sua autorização tenha expirado. Use /autorizar para reconectar.`
        );
      }
    } else {
      // Gerar link direto para adicionar manualmente
      const startTime = eventDate.toISOString().replace(/-|:|\.\d\d\d/g,'').slice(0,15);
      const endTime = new Date(eventDate.getTime() + 60 * 60 * 1000).toISOString().replace(/-|:|\.\d\d\d/g,'').slice(0,15);
      
      const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${startTime}/${endTime}`;
      
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        loadingMsg.message_id,
        undefined,
        `⚠️ Você ainda não autorizou o acesso ao seu Google Calendar.\n\n` +
        `Use /autorizar para que eu possa adicionar eventos automaticamente!\n\n` +
        `Enquanto isso, você pode adicionar este evento manualmente:`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Adicionar ao Google Calendar', url: googleUrl }]
            ]
          }
        }
      );
    }
  } else {
    // Mensagem não reconhecida
    await ctx.reply(
      `Não entendi o que você quer agendar. Por favor, seja mais específico.\n\n` +
      `Exemplos:\n` +
      `• "Agendar reunião amanhã às 15h"\n` +
      `• "Lembrar de ligar para médico na sexta às 10h"\n\n` +
      `Ou use o comando /criar para criar um evento de teste.`
    );
  }
});

// Iniciar o bot
export async function startDirectCalendarBot() {
  try {
    await bot.telegram.setMyCommands([
      { command: 'start', description: 'Iniciar o bot' },
      { command: 'autorizar', description: 'Conectar com Google Calendar' },
      { command: 'criar', description: 'Criar evento de teste' },
      { command: 'help', description: 'Mostrar ajuda' }
    ]);
    
    await bot.launch();
    
    log('Bot com adição direta ao calendário iniciado!', 'bot');
    
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
    
    return true;
  } catch (error) {
    log(`Erro ao iniciar bot: ${error}`, 'bot');
    return false;
  }
}

// Parar o bot
export function stopDirectCalendarBot() {
  bot.stop('SIGTERM');
  log('Bot parado', 'bot');
  return true;
}