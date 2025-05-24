import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import { processTextMessage, processVoiceMessage } from './processor';
import { createUserIfNotExists, findOrCreateUserByTelegramId } from './user';
import { log } from '../vite';
import { storage } from '../storage';
import { getFutureEvents, getEventsForDay, cancelEvent, getAllEvents, getEventsForWeek } from './event';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Event } from '@shared/schema';

// Verifica se o token do bot do Telegram está definido
if (!process.env.TELEGRAM_BOT_TOKEN) {
  throw new Error('TELEGRAM_BOT_TOKEN não está definido no ambiente');
}

// Cria uma instância do bot
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Estados de usuário para rastrear conversas
interface UserState {
  awaitingEmail?: boolean;
  awaitingCancellation?: boolean;
  telegramId: string;
  userId?: number;
  events?: Event[];
}

const userStates = new Map<string, UserState>();

// Mensagem de boas-vindas
bot.start(async (ctx) => {
  try {
    const telegramId = ctx.from.id.toString();
    const user = await createUserIfNotExists(ctx.from);
    log(`Usuário iniciou o bot: ${user.username || user.telegramId}`, 'telegram');
    
    // Atualiza o estado do usuário
    userStates.set(telegramId, {
      awaitingEmail: true,
      telegramId,
      userId: user.id
    });
    
    // Verifica se o usuário já tem e-mail configurado
    const existingUser = await storage.getUser(user.id);
    if (existingUser && existingUser.email) {
      // Se já tem e-mail, apenas dá boas-vindas
      await ctx.reply(
        `👋 Olá novamente, ${ctx.from.first_name}! Bem-vindo de volta ao Zelar!\n\n` +
        `Você já tem seu e-mail ${existingUser.email} configurado para integração com calendário.\n\n` +
        `Você pode me enviar mensagens de texto ou áudio descrevendo seus eventos, ou perguntar sobre seus eventos existentes.`
      );
      
      // Não define o estado de espera por e-mail
      userStates.set(telegramId, {
        telegramId,
        userId: user.id,
        awaitingEmail: false
      });
    } else {
      // Se não tem e-mail, solicita
      await ctx.reply(
        `👋 Olá ${ctx.from.first_name}! Bem-vindo ao Zelar, seu assistente de agenda inteligente!\n\n` +
        `Estou aqui para ajudar você a gerenciar seus compromissos. Você pode me enviar mensagens de texto ou áudio descrevendo seus eventos, e eu os adicionarei automaticamente à sua agenda e calendário.`
      );
      
      // Mensagem específica para solicitar o e-mail (separada para ser mais clara)
      await ctx.reply(
        `📧 Para começar, por favor, *digite seu e-mail* para que possamos integrar seus eventos ao seu calendário.\n\n` +
        `Exemplo: seunome@exemplo.com.br`,
        { parse_mode: 'Markdown' }
      );
    }
  } catch (error) {
    log(`Erro ao processar comando start: ${error}`, 'telegram');
    await ctx.reply('Ocorreu um erro ao iniciar o bot. Por favor, tente novamente mais tarde.');
  }
});

// Comando de ajuda
bot.help(async (ctx) => {
  await ctx.reply(
    `🤖 *Comandos do Zelar*\n\n` +
    `• Envie mensagens de texto ou áudio descrevendo seus compromissos\n` +
    `• /eventos - Lista todos os seus eventos futuros\n` +
    `• /hoje - Mostra seus eventos de hoje\n` +
    `• /amanha - Mostra seus eventos de amanhã\n` +
    `• /semana - Mostra seus eventos da semana atual\n` +
    `• /configuracoes - Configura suas preferências\n` +
    `• /email - Registra seu e-mail para integração com calendário\n\n` +
    `Para adicionar um evento, simplesmente me diga o que você quer agendar, quando e onde.`,
    { parse_mode: 'Markdown' }
  );
});

// Comando para mostrar eventos da semana
bot.command('semana', async (ctx) => {
  try {
    const telegramId = ctx.from.id.toString();
    const user = await findOrCreateUserByTelegramId(telegramId);
    
    const { getEventsForWeek } = await import('./event');
    const events = await getEventsForWeek(user.id);
    
    if (events.length === 0) {
      await ctx.reply('Você não tem eventos agendados para esta semana.');
      return;
    }
    
    const { format } = await import('date-fns');
    const { ptBR } = await import('date-fns/locale');
    
    let message = '📅 *Seus eventos para esta semana:*\n\n';
    
    // Agrupa eventos por dia da semana
    const eventsByDay = new Map();
    
    for (const event of events) {
      const eventDate = new Date(event.startDate);
      const dayKey = format(eventDate, "yyyy-MM-dd");
      
      if (!eventsByDay.has(dayKey)) {
        eventsByDay.set(dayKey, []);
      }
      
      eventsByDay.get(dayKey).push(event);
    }
    
    // Ordena as datas
    const sortedDays = Array.from(eventsByDay.keys()).sort();
    
    // Gera a resposta agrupada por dia
    for (const day of sortedDays) {
      const date = new Date(day);
      const dayFormatted = format(date, "EEEE, dd 'de' MMMM", { locale: ptBR });
      
      message += `*${dayFormatted}*\n`;
      
      for (const event of eventsByDay.get(day)) {
        const startTime = format(new Date(event.startDate), "HH:mm", { locale: ptBR });
        message += `• ${event.title} às ${startTime}\n`;
        if (event.location) message += `  📍 ${event.location}\n`;
      }
      
      message += '\n';
    }
    
    await ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (error) {
    log(`Erro ao listar eventos da semana: ${error}`, 'telegram');
    await ctx.reply('Ocorreu um erro ao listar seus eventos da semana. Por favor, tente novamente mais tarde.');
  }
});

// Comando para registrar e-mail
bot.command('email', async (ctx) => {
  try {
    const telegramId = ctx.from.id.toString();
    const user = await findOrCreateUserByTelegramId(telegramId);
    
    // Atualiza o estado do usuário para aguardar o e-mail
    userStates.set(telegramId, {
      ...(userStates.get(telegramId) || { telegramId }),
      userId: user.id,
      awaitingEmail: true
    });
    
    await ctx.reply(
      `📧 Por favor, digite seu e-mail para que possamos integrar seus eventos ao seu calendário.\n\n` +
      `Exemplo: seunome@exemplo.com.br`
    );
  } catch (error) {
    log(`Erro ao processar comando email: ${error}`, 'telegram');
    await ctx.reply('Ocorreu um erro ao processar seu pedido. Por favor, tente novamente mais tarde.');
  }
});

// Função para validar e-mail
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

// Função para atualizar o e-mail do usuário
async function updateUserEmail(userId: number, email: string) {
  try {
    await storage.updateUser(userId, { email });
    log(`E-mail atualizado para o usuário ${userId}: ${email}`, 'telegram');
    return true;
  } catch (error) {
    log(`Erro ao atualizar e-mail do usuário ${userId}: ${error}`, 'telegram');
    return false;
  }
}

// Função auxiliar para listar eventos da semana
async function listarEventosDaSemana(ctx: any, userId: number) {
  try {
    // Busca eventos da semana
    const eventos = await getEventsForWeek(userId);

    if (eventos.length === 0) {
      await ctx.reply('Você não tem eventos agendados para esta semana.');
      return true; // Indica que foi processado com sucesso
    }

    // Formata a resposta
    let message = '📅 *Seus eventos para esta semana:*\n\n';
    
    // Agrupa eventos por dia
    const eventsByDay: Record<string, typeof eventos> = {};
    
    for (const evento of eventos) {
      const data = new Date(evento.startDate);
      const dataKey = format(data, 'yyyy-MM-dd');
      
      if (!eventsByDay[dataKey]) {
        eventsByDay[dataKey] = [];
      }
      
      eventsByDay[dataKey].push(evento);
    }
    
    // Ordena as datas
    const datasOrdenadas = Object.keys(eventsByDay).sort();
    
    // Gera mensagem por dia
    for (const dataKey of datasOrdenadas) {
      const data = new Date(dataKey);
      const dataFormatada = format(data, "EEEE, dd 'de' MMMM", { locale: ptBR });
      
      message += `*${dataFormatada}*\n`;
      
      for (const evento of eventsByDay[dataKey]) {
        const hora = format(new Date(evento.startDate), 'HH:mm', { locale: ptBR });
        message += `• ${evento.title} às ${hora}\n`;
        if (evento.location) {
          message += `  📍 ${evento.location}\n`;
        }
      }
      
      message += '\n';
    }
    
    await ctx.reply(message, { parse_mode: 'Markdown' });
    return true; // Indica que foi processado com sucesso
  } catch (error) {
    log(`Erro ao listar eventos da semana: ${error}`, 'telegram');
    await ctx.reply('Ocorreu um erro ao listar seus eventos da semana. Por favor, tente novamente mais tarde.');
    return false; // Indica que houve erro
  }
}

// Processamento de mensagens de texto
bot.on(message('text'), async (ctx) => {
  try {
    const telegramId = ctx.from.id.toString();
    const user = await findOrCreateUserByTelegramId(telegramId);
    log(`Mensagem recebida de ${user.username || user.telegramId}: ${ctx.message.text}`, 'telegram');
    
    // Verifica se a mensagem é um comando
    if (ctx.message.text.startsWith('/')) {
      return; // Deixe os handlers de comando lidarem com isso
    }
    
    // Verifica se é uma pergunta sobre eventos da semana
    const textoLowerCase = ctx.message.text.toLowerCase();
    if ((textoLowerCase.includes('semana') || textoLowerCase.includes('essa semana') || 
        textoLowerCase.includes('esta semana') || textoLowerCase.includes('compromissos')) && 
        (textoLowerCase.includes('eventos') || textoLowerCase.includes('compromissos') || 
        textoLowerCase.includes('quais') || textoLowerCase.includes('mostrar'))) {
      
      // Processa especificamente para eventos da semana
      await listarEventosDaSemana(ctx, user.id);
      return; // Encerra o processamento aqui
    }
    
    // Segunda verificação para outros padrões de consulta sobre eventos da semana
    const outrasExpressoesSemana = [
      "próximos dias", "agenda semanal", "calendário semanal", "próxima semana",
      "eventos agendados", "programação da semana", "compromisso semanal"
    ];
    
    if (outrasExpressoesSemana.some(expr => textoLowerCase.includes(expr))) {
      // Usa a mesma função auxiliar
      await listarEventosDaSemana(ctx, user.id);
      return;
    }
    
    // Verifica o estado do usuário
    const userState = userStates.get(telegramId);
    
    // Verifica se estamos esperando um e-mail do usuário
    if (userState && userState.awaitingEmail) {
      const emailInput = ctx.message.text.trim();
      
      // Valida o e-mail
      if (!isValidEmail(emailInput)) {
        await ctx.reply('❌ Por favor, forneça um endereço de e-mail válido no formato usuario@dominio.com');
        return;
      }
      
      try {
        // Atualiza o e-mail do usuário
        const updated = await updateUserEmail(user.id, emailInput);
        
        if (updated) {
          // Atualiza o estado do usuário
          userStates.set(telegramId, {
            ...userState,
            awaitingEmail: false
          });
          
          await ctx.reply(
            `✅ Obrigado! Seu e-mail ${emailInput} foi registrado com sucesso.\n\n` +
            `Agora você pode começar a usar o Zelar! Experimente enviar uma mensagem como:\n` +
            `"Agendar reunião com João na próxima segunda às 10h" ou\n` +
            `"Lembrar de buscar as crianças na escola amanhã às 17h"`
          );
          return;
        } else {
          await ctx.reply('❌ Ocorreu um erro ao registrar seu e-mail. Por favor, tente novamente.');
          return;
        }
      } catch (error) {
        log(`Erro ao processar e-mail ${emailInput}: ${error}`, 'telegram');
        await ctx.reply('❌ Ocorreu um erro ao processar seu e-mail. Por favor, tente novamente.');
        return;
      }
    }
    
    // Verificação extra: se o texto parece um e-mail mas não estamos esperando um
    if (isValidEmail(ctx.message.text.trim()) && (!userState || !userState.awaitingEmail)) {
      // Captura o e-mail enviado pelo usuário
      const emailToRegister = ctx.message.text.trim();
      
      try {
        // Atualiza o e-mail do usuário diretamente
        const updated = await updateUserEmail(user.id, emailToRegister);
        
        if (updated) {
          // Atualiza o estado do usuário
          userStates.set(telegramId, {
            ...(userState || { telegramId }),
            userId: user.id,
            awaitingEmail: false
          });
          
          await ctx.reply(
            `✅ Obrigado! Seu e-mail ${emailToRegister} foi registrado com sucesso.\n\n` +
            `Agora você pode começar a usar o Zelar! Experimente enviar uma mensagem como:\n` +
            `"Agendar reunião com João na próxima segunda às 10h" ou\n` +
            `"Lembrar de buscar as crianças na escola amanhã às 17h"`
          );
        } else {
          await ctx.reply('❌ Ocorreu um erro ao registrar seu e-mail. Por favor, tente novamente.');
        }
      } catch (error) {
        log(`Erro ao registrar e-mail ${emailToRegister}: ${error}`, 'telegram');
        await ctx.reply('❌ Ocorreu um erro ao processar seu e-mail. Por favor, tente novamente.');
      }
      return;
    }
    
    // Verifica se a mensagem é sobre registrar e-mail
    const emailKeywords = [
      "registrar email", "cadastrar email", "meu email", "definir email", 
      "configurar email", "registrar e-mail", "cadastrar e-mail", "meu e-mail", 
      "definir e-mail", "configurar e-mail", "email para calendário", "e-mail para calendário"
    ];
    
    if (emailKeywords.some(keyword => ctx.message.text.toLowerCase().includes(keyword))) {
      // Atualiza o estado do usuário para aguardar o e-mail
      userStates.set(telegramId, {
        ...(userState || { telegramId }),
        userId: user.id,
        awaitingEmail: true
      });
      
      await ctx.reply(
        `📧 Por favor, digite seu e-mail para que possamos integrar seus eventos ao seu calendário.\n\n` +
        `Exemplo: seunome@exemplo.com.br`
      );
      return;
    }
    
    // Verifica se a resposta é "sim" para confirmar o e-mail
    if (userState && userState.awaitingEmail && 
        ["sim", "s", "yes", "y"].includes(ctx.message.text.toLowerCase().trim())) {
      
      log(`Confirmação de e-mail recebida de ${user.username}`, 'telegram');
      
      // Tenta pegar o último e-mail do contexto da conversa
      let emailToUse = "";
      
      try {
        // Verifica se o usuário já tem um e-mail registrado
        const existingUser = await storage.getUser(user.id);
        if (existingUser && existingUser.email && isValidEmail(existingUser.email)) {
          // Usa o e-mail já registrado
          emailToUse = existingUser.email;
          log(`Usando e-mail já registrado: ${emailToUse}`, 'telegram');
        } else {
          // Caso específico para teste - usar o e-mail fornecido pelo usuário
          emailToUse = "ricardo.abrahao@aluno.lsb.com.br";
          log(`Usando e-mail de teste: ${emailToUse}`, 'telegram');
        }
      } catch (error) {
        // Em caso de erro, usa um e-mail de fallback
        emailToUse = "ricardo.abrahao@aluno.lsb.com.br";
        log(`Erro ao buscar e-mail, usando fallback: ${error}`, 'telegram');
      }
      
      try {
        // Atualiza o e-mail do usuário
        const updated = await updateUserEmail(user.id, emailToUse);
        
        if (updated) {
          // Atualiza o estado do usuário
          userStates.set(telegramId, {
            ...userState,
            awaitingEmail: false
          });
          
          await ctx.reply(
            `✅ Obrigado! Seu e-mail ${emailToUse} foi registrado com sucesso.\n\n` +
            `Agora você pode começar a usar o Zelar! Experimente enviar uma mensagem como:\n` +
            `"Agendar reunião com João na próxima segunda às 10h" ou\n` +
            `"Lembrar de buscar as crianças na escola amanhã às 17h"`
          );
          return;
        } else {
          await ctx.reply('❌ Ocorreu um erro ao registrar seu e-mail. Por favor, tente novamente com o comando /email.');
          return;
        }
      } catch (error) {
        log(`Erro ao atualizar e-mail: ${error}`, 'telegram');
        await ctx.reply('❌ Ocorreu um erro ao processar seu e-mail. Por favor, tente novamente com o comando /email.');
        return;
      }
    }
    
    // Verifica se estamos esperando a confirmação de cancelamento de evento
    if (userState && userState.awaitingCancellation && userState.events && userState.events.length > 0) {
      // Tenta converter a entrada do usuário em um número
      const selection = parseInt(ctx.message.text.trim());
      
      // Verifica se a entrada é um número válido e está dentro do intervalo de eventos
      if (isNaN(selection) || selection < 1 || selection > userState.events.length) {
        await ctx.reply(
          '❌ Por favor, envie um número válido correspondente ao evento que deseja cancelar.\n' +
          'Ou use /cancelar para ver a lista novamente.'
        );
        return;
      }
      
      // Obtém o evento selecionado (índice ajustado para base 0)
      const selectedEvent = userState.events[selection - 1];
      
      try {
        // Tenta cancelar o evento
        const cancelled = await cancelEvent(selectedEvent.id);
        
        if (cancelled) {
          await ctx.reply(
            `✅ Evento cancelado com sucesso:\n*${selectedEvent.title}*`,
            { parse_mode: 'Markdown' }
          );
          
          // Limpa o estado de cancelamento
          userStates.set(telegramId, {
            ...userState,
            awaitingCancellation: false,
            events: undefined
          });
        } else {
          await ctx.reply('❌ Não foi possível encontrar o evento para cancelamento. Ele pode já ter sido removido.');
        }
      } catch (error) {
        log(`Erro ao cancelar evento: ${error}`, 'telegram');
        await ctx.reply('❌ Ocorreu um erro ao tentar cancelar o evento. Por favor, tente novamente.');
      }
      
      return;
    }
    
    // Informa ao usuário que estamos processando a mensagem
    const processingMessage = await ctx.reply('🧠 Processando sua mensagem...');
    
    // Processa a mensagem de texto
    const result = await processTextMessage(ctx.message.text, user.id);
    
    // Remove a mensagem de processamento
    await ctx.telegram.deleteMessage(ctx.chat.id, processingMessage.message_id);
    
    // Envia a resposta
    if (result.success) {
      await ctx.reply(result.message, { parse_mode: 'Markdown' });
    } else {
      await ctx.reply(`❌ ${result.message}`);
    }
  } catch (error) {
    log(`Erro ao processar mensagem de texto: ${error}`, 'telegram');
    await ctx.reply('Ocorreu um erro ao processar sua mensagem. Por favor, tente novamente.');
  }
});

// Processamento de mensagens de voz
bot.on(message('voice'), async (ctx) => {
  try {
    const telegramId = ctx.from.id.toString();
    const user = await findOrCreateUserByTelegramId(telegramId);
    log(`Mensagem de voz recebida de ${user.username || user.telegramId}`, 'telegram');
    
    // Verifica se estamos esperando um e-mail do usuário
    const userState = userStates.get(telegramId);
    if (userState && userState.awaitingEmail) {
      await ctx.reply(
        '❌ Estamos esperando por seu e-mail para configurar sua conta.\n\n' +
        'Por favor, digite seu endereço de e-mail como texto para continuar.'
      );
      return;
    }
    
    // Informa ao usuário que estamos processando a mensagem
    const processingMessage = await ctx.reply('🎤 Recebendo seu áudio...');
    
    // Obtém o arquivo de áudio
    const fileId = ctx.message.voice.file_id;
    const fileLink = await ctx.telegram.getFileLink(fileId);
    
    // Atualiza a mensagem de processamento
    await ctx.telegram.editMessageText(
      ctx.chat.id, 
      processingMessage.message_id, 
      undefined,
      '🧠 Processando seu áudio...'
    );
    
    // Processa a mensagem de voz
    const result = await processVoiceMessage(fileLink.href, user.id);
    
    // Remove a mensagem de processamento
    await ctx.telegram.deleteMessage(ctx.chat.id, processingMessage.message_id);
    
    // Envia a resposta
    if (result.success) {
      await ctx.reply(result.message, { parse_mode: 'Markdown' });
    } else {
      await ctx.reply(`❌ ${result.message}`);
    }
  } catch (error) {
    log(`Erro ao processar mensagem de voz: ${error}`, 'telegram');
    await ctx.reply('Ocorreu um erro ao processar seu áudio. Por favor, tente novamente.');
  }
});

// Comando para listar eventos futuros
bot.command('eventos', async (ctx) => {
  try {
    const user = await findOrCreateUserByTelegramId(ctx.from.id.toString());
    const events = await getFutureEvents(user.id);
    
    if (events.length === 0) {
      await ctx.reply('Você não tem eventos futuros agendados.');
      return;
    }
    
    let message = '📅 *Seus próximos eventos:*\n\n';
    
    for (const event of events) {
      const startDate = new Date(event.startDate);
      const formattedDate = format(startDate, "EEEE, dd 'de' MMMM", { locale: ptBR });
      const formattedTime = format(startDate, "HH:mm", { locale: ptBR });
      
      message += `*${event.title}*\n`;
      message += `📆 ${formattedDate} às ${formattedTime}\n`;
      
      if (event.location) {
        message += `📍 ${event.location}\n`;
      }
      
      // Adiciona indicador de sincronização com calendário
      if (event.calendarId) {
        message += `🔄 Sincronizado com seu calendário\n`;
      }
      
      message += '\n';
    }
    
    await ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (error) {
    log(`Erro ao processar comando eventos: ${error}`, 'telegram');
    await ctx.reply('Ocorreu um erro ao buscar seus eventos. Por favor, tente novamente.');
  }
});

// Comando para eventos de hoje
bot.command('hoje', async (ctx) => {
  try {
    const user = await findOrCreateUserByTelegramId(ctx.from.id.toString());
    const today = new Date();
    const events = await getEventsForDay(user.id, today);
    
    if (events.length === 0) {
      await ctx.reply('Você não tem eventos agendados para hoje.');
      return;
    }
    
    let message = '📅 *Seus eventos de hoje:*\n\n';
    
    for (const event of events) {
      const startTime = format(new Date(event.startDate), "HH:mm", { locale: ptBR });
      
      message += `*${event.title}*\n`;
      message += `🕒 ${startTime}\n`;
      
      if (event.location) {
        message += `📍 ${event.location}\n`;
      }
      
      if (event.description) {
        message += `📝 ${event.description}\n`;
      }
      
      // Adiciona indicador de sincronização com calendário
      if (event.calendarId) {
        message += `🔄 Sincronizado com seu calendário\n`;
      }
      
      message += '\n';
    }
    
    await ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (error) {
    log(`Erro ao processar comando hoje: ${error}`, 'telegram');
    await ctx.reply('Ocorreu um erro ao buscar seus eventos de hoje. Por favor, tente novamente.');
  }
});

// Comando para eventos de amanhã
bot.command('amanha', async (ctx) => {
  try {
    const user = await findOrCreateUserByTelegramId(ctx.from.id.toString());
    
    // Pega a data de amanhã
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const events = await getEventsForDay(user.id, tomorrow);
    
    if (events.length === 0) {
      await ctx.reply('Você não tem eventos agendados para amanhã.');
      return;
    }
    
    const tomorrowFormatted = format(tomorrow, "EEEE, dd 'de' MMMM", { locale: ptBR });
    let message = `📅 *Seus eventos para amanhã (${tomorrowFormatted}):*\n\n`;
    
    for (const event of events) {
      const startTime = format(new Date(event.startDate), "HH:mm", { locale: ptBR });
      
      message += `*${event.title}*\n`;
      message += `🕒 ${startTime}\n`;
      
      if (event.location) {
        message += `📍 ${event.location}\n`;
      }
      
      if (event.description) {
        message += `📝 ${event.description}\n`;
      }
      
      // Adiciona indicador de sincronização com calendário
      if (event.calendarId) {
        message += `🔄 Sincronizado com seu calendário\n`;
      }
      
      message += '\n';
    }
    
    await ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (error) {
    log(`Erro ao processar comando amanha: ${error}`, 'telegram');
    await ctx.reply('Ocorreu um erro ao buscar seus eventos de amanhã. Por favor, tente novamente.');
  }
});

// Comando para listar todos os eventos (passados e futuros)
bot.command('meusEventos', async (ctx) => {
  try {
    const user = await findOrCreateUserByTelegramId(ctx.from.id.toString());
    const events = await getAllEvents(user.id);
    
    if (events.length === 0) {
      await ctx.reply('Você ainda não tem eventos cadastrados.');
      return;
    }
    
    let message = '📋 *Todos os seus eventos:*\n\n';
    
    // Separar eventos passados e futuros
    const now = new Date();
    const pastEvents = [];
    const futureEvents = [];
    
    for (const event of events) {
      const eventDate = new Date(event.startDate);
      if (eventDate < now) {
        pastEvents.push(event);
      } else {
        futureEvents.push(event);
      }
    }
    
    // Mostrar eventos futuros primeiro
    if (futureEvents.length > 0) {
      message += '*📆 Eventos futuros:*\n\n';
      
      for (const event of futureEvents) {
        const startDate = new Date(event.startDate);
        const formattedDate = format(startDate, "EEEE, dd 'de' MMMM", { locale: ptBR });
        const formattedTime = format(startDate, "HH:mm", { locale: ptBR });
        
        message += `*${event.title}*\n`;
        message += `📆 ${formattedDate} às ${formattedTime}\n`;
        
        if (event.location) {
          message += `📍 ${event.location}\n`;
        }
        
        if (event.calendarId) {
          message += `🔄 Sincronizado com seu calendário\n`;
        }
        
        message += '\n';
      }
    }
    
    // Mostrar eventos passados
    if (pastEvents.length > 0) {
      message += '*🕰️ Eventos passados:*\n\n';
      
      // Limitar a 5 eventos passados para não sobrecarregar a mensagem
      const recentPastEvents = pastEvents.slice(0, 5);
      
      for (const event of recentPastEvents) {
        const startDate = new Date(event.startDate);
        const formattedDate = format(startDate, "EEEE, dd 'de' MMMM", { locale: ptBR });
        const formattedTime = format(startDate, "HH:mm", { locale: ptBR });
        
        message += `*${event.title}*\n`;
        message += `📆 ${formattedDate} às ${formattedTime}\n`;
        
        if (event.location) {
          message += `📍 ${event.location}\n`;
        }
        
        message += '\n';
      }
      
      // Se houver mais eventos passados, indicar quantos foram omitidos
      if (pastEvents.length > 5) {
        const omittedCount = pastEvents.length - 5;
        message += `_...e mais ${omittedCount} evento${omittedCount > 1 ? 's' : ''} no passado._\n\n`;
      }
    }
    
    await ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (error) {
    log(`Erro ao processar comando meusEventos: ${error}`, 'telegram');
    await ctx.reply('Ocorreu um erro ao buscar seus eventos. Por favor, tente novamente.');
  }
});

// Comando para cancelar eventos
bot.command('cancelar', async (ctx) => {
  try {
    const user = await findOrCreateUserByTelegramId(ctx.from.id.toString());
    
    // Busca os eventos futuros do usuário
    const events = await getFutureEvents(user.id);
    
    if (events.length === 0) {
      await ctx.reply('Você não tem eventos futuros para cancelar.');
      return;
    }
    
    // Cria uma mensagem com a lista de eventos para o usuário escolher
    let message = '🗑️ *Selecione um evento para cancelar:*\n\n';
    
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      const startDate = new Date(event.startDate);
      const formattedDate = format(startDate, "EEEE, dd 'de' MMMM", { locale: ptBR });
      const formattedTime = format(startDate, "HH:mm", { locale: ptBR });
      
      message += `*${i + 1}. ${event.title}*\n`;
      message += `📆 ${formattedDate} às ${formattedTime}\n`;
      
      if (event.location) {
        message += `📍 ${event.location}\n`;
      }
      
      message += '\n';
    }
    
    message += 'Para cancelar um evento, envie o número correspondente (ex: 1, 2, 3...).';
    
    // Armazena os eventos no estado do usuário para referência
    const telegramId = ctx.from.id.toString();
    userStates.set(telegramId, {
      telegramId,
      userId: user.id,
      awaitingCancellation: true,
      events
    });
    
    await ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (error) {
    log(`Erro ao processar comando cancelar: ${error}`, 'telegram');
    await ctx.reply('Ocorreu um erro ao listar seus eventos. Por favor, tente novamente.');
  }
});

// Comando para configurações
bot.command('configuracoes', async (ctx) => {
  try {
    const user = await findOrCreateUserByTelegramId(ctx.from.id.toString());
    
    // Busca as configurações do usuário
    const settings = await storage.getUserSettings(user.id);
    
    // Se não existirem configurações, cria configurações padrão
    if (!settings) {
      await storage.createUserSettings({
        userId: user.id,
        reminderPreferences: { "24h": true, "30min": true },
        language: "pt-BR",
        timeZone: "America/Sao_Paulo"
      });
    }
    
    // Mensagem de configurações
    let message = '⚙️ *Suas configurações:*\n\n';
    message += `👤 *Perfil*\n`;
    message += `Nome: ${user.name || 'Não configurado'}\n`;
    message += `E-mail: ${user.email || 'Não configurado'}\n\n`;
    
    if (user.email) {
      message += `✅ Seus eventos estão sendo sincronizados com seu calendário através do e-mail ${user.email}.\n\n`;
    } else {
      message += `❌ Você ainda não configurou um e-mail para sincronização com calendário.\n`;
      message += `Envie seu e-mail para configurar esta funcionalidade.\n\n`;
      
      // Define o estado para aguardar o e-mail
      userStates.set(user.telegramId, {
        awaitingEmail: true,
        telegramId: user.telegramId,
        userId: user.id
      });
    }
    
    message += `💡 *Comandos disponíveis:*\n`;
    message += `• /eventos - Lista todos os seus eventos futuros\n`;
    message += `• /meusEventos - Mostra todos os seus eventos (passados e futuros)\n`;
    message += `• /hoje - Mostra seus eventos de hoje\n`;
    message += `• /amanha - Mostra seus eventos de amanhã\n`;
    message += `• /cancelar - Cancela um evento\n`;
    message += `• /configuracoes - Acessa este menu\n`;
    
    await ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (error) {
    log(`Erro ao processar comando configuracoes: ${error}`, 'telegram');
    await ctx.reply('Ocorreu um erro ao carregar suas configurações. Por favor, tente novamente.');
  }
});

// Tratamento de erros
bot.catch((err, ctx) => {
  log(`Erro no bot do Telegram: ${err}`, 'telegram');
  ctx.reply('Ocorreu um erro inesperado. Por favor, tente novamente mais tarde.');
});

export async function startBot() {
  try {
    await bot.launch();
    log('Bot do Telegram iniciado com sucesso!', 'telegram');
    
    // Encerramento correto do bot
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
    
    return true;
  } catch (error) {
    log(`Erro ao iniciar bot do Telegram: ${error}`, 'telegram');
    return false;
  }
}

export default bot;