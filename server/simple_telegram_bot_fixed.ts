/**
 * Bot de Telegram simplificado para gerenciamento de eventos
 * 
 * Este bot permite agendar eventos e enviar convites de calendário
 * usando uma abordagem universal que não depende de credenciais Gmail
 */

import { Telegraf } from 'telegraf';
import { format, addDays, addHours, parse, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { storage } from './storage';
import { log } from './vite';
import { sendUniversalCalendarInvite } from './email/universalCalendarInvite';

// Verificar token do bot
if (!process.env.TELEGRAM_BOT_TOKEN) {
  throw new Error('TELEGRAM_BOT_TOKEN não está definido no ambiente');
}

// Inicializar o bot do Telegram
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Manter o estado dos usuários
interface UserState {
  awaitingEmail?: boolean;
  awaitingCancellation?: boolean;
  telegramId: string;
  userId?: number;
  events?: any[];
}

// Map para armazenar o estado dos usuários
const userStates = new Map<string, UserState>();

// Função para enviar convite de calendário usando a abordagem universal
async function sendCalendarInvite(
  event: any, 
  email: string, 
  isCancelled = false
): Promise<{
  success: boolean;
  message: string;
  previewUrl?: string;
}> {
  try {
    // Usar a abordagem universal que não depende de credenciais de email
    log(`Enviando convite universal para ${email}`, 'email');
    return await sendUniversalCalendarInvite(event, email, isCancelled);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Erro ao enviar convite de calendário: ${errorMessage}`, 'email');
    
    return {
      success: false,
      message: `Erro ao enviar email: ${errorMessage}`
    };
  }
}

// Verifica se uma mensagem parece descrever um evento
function isEventMessage(text: string): boolean {
  // Palavras-chave que indicam possíveis eventos
  const eventKeywords = [
    'agende', 'agendar', 'marcar', 'marque', 'reunião', 'encontro', 
    'compromisso', 'evento', 'lembrete', 'lembre', 'lembrar',
    'às', 'amanhã', 'hoje', 'depois', 'próximo', 'próxima',
    'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'
  ];
  
  // Texto em minúsculas para comparação
  const lowerText = text.toLowerCase();
  
  // Verifica se pelo menos uma das palavras-chave está na mensagem
  return eventKeywords.some(keyword => lowerText.includes(keyword));
}

// Extrai informações de evento de uma mensagem de texto
function extractEventInfo(text: string): {
  title: string;
  startDate: Date;
  endDate?: Date;
  location?: string;
  description?: string;
} {
  // Expressões para detecção básica de datas
  const datePatterns = {
    hoje: new Date(),
    amanhã: addDays(new Date(), 1),
    'depois de amanhã': addDays(new Date(), 2),
  };
  
  // Texto normalizado para processamento
  const lowerText = text.toLowerCase();
  
  // Tenta encontrar uma data mencionada no texto
  let startDate = new Date();
  startDate.setHours(10, 0, 0, 0); // Padrão: 10h da manhã
  
  // Verificar padrões comuns de data
  for (const [pattern, date] of Object.entries(datePatterns)) {
    if (lowerText.includes(pattern)) {
      startDate = new Date(date);
      startDate.setHours(10, 0, 0, 0);
      break;
    }
  }
  
  // Buscar por dias da semana
  const weekdays = [
    { day: 'segunda', index: 1 },
    { day: 'terça', index: 2 },
    { day: 'quarta', index: 3 },
    { day: 'quinta', index: 4 },
    { day: 'sexta', index: 5 },
    { day: 'sábado', index: 6 },
    { day: 'domingo', index: 0 }
  ];
  
  for (const { day, index } of weekdays) {
    if (lowerText.includes(day)) {
      // Calcular próximo dia da semana
      const today = new Date().getDay();
      const daysUntil = (index - today + 7) % 7;
      startDate = addDays(new Date(), daysUntil > 0 ? daysUntil : 7);
      startDate.setHours(10, 0, 0, 0);
      break;
    }
  }
  
  // Extrair horário (formato 24h ou 12h)
  const timePatterns = [
    /(\d{1,2})[hH](\d{0,2})/,      // 15h, 15h30
    /(\d{1,2}):(\d{2})/,           // 15:30
    /(\d{1,2}) ?(?:horas|hora)/    // 15 horas
  ];
  
  for (const pattern of timePatterns) {
    const match = lowerText.match(pattern);
    if (match) {
      const hours = parseInt(match[1]);
      const minutes = match[2] ? parseInt(match[2]) : 0;
      if (hours >= 0 && hours <= 23) {
        startDate.setHours(hours, minutes, 0, 0);
        break;
      }
    }
  }
  
  // Verificar formato de data específico (ex: 25/05)
  const specificDateMatch = lowerText.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
  if (specificDateMatch) {
    const day = parseInt(specificDateMatch[1]);
    const month = parseInt(specificDateMatch[2]) - 1; // mês em JS é 0-11
    const year = specificDateMatch[3] ? parseInt(specificDateMatch[3]) : new Date().getFullYear();
    const correctedYear = year < 100 ? 2000 + year : year;
    
    const specificDate = new Date(correctedYear, month, day);
    specificDate.setHours(startDate.getHours(), startDate.getMinutes(), 0, 0);
    
    if (isValid(specificDate)) {
      startDate = specificDate;
    }
  }
  
  // Duração padrão: 1 hora
  const endDate = addHours(startDate, 1);
  
  // Tenta extrair um título/assunto do evento
  let title = 'Novo Evento';
  let description = '';
  let location = '';
  
  // Procurar por padrões comuns que indicam o título do evento
  const titlePatterns = [
    /(?:sobre|com|para)\s+(.+?)(?:\s+(?:em|às|no dia|na|no|as))/i,
    /(?:reunião|encontro|conversa|evento)\s+(?:sobre|com|para)\s+(.+?)(?:\s+(?:em|às|no dia|na|no|as))?/i,
    /(?:agendar|marcar)\s+(.+?)(?:\s+(?:em|às|no dia|na|no|as))/i
  ];
  
  for (const pattern of titlePatterns) {
    const match = text.match(pattern);
    if (match && match[1] && match[1].length > 2) {
      title = match[1].trim();
      if (title.length > 50) title = title.substring(0, 50) + '...';
      break;
    }
  }
  
  // Se não conseguir extrair um título dos padrões, usa as primeiras palavras
  if (title === 'Novo Evento') {
    const words = text.split(' ').filter(w => w.length > 2);
    if (words.length >= 3) {
      title = words.slice(0, 3).join(' ');
      if (title.length > 50) title = title.substring(0, 50) + '...';
    }
  }
  
  // Buscar possível localização
  const locationPatterns = [
    /(?:em|na|no)\s+(.+?)(?:\s+(?:às|as|no dia|em))/i,
    /(?:local|lugar|localização):\s+(.+?)(?:\s+(?:às|as|no dia|em))?/i
  ];
  
  for (const pattern of locationPatterns) {
    const match = text.match(pattern);
    if (match && match[1] && match[1].length > 2) {
      location = match[1].trim();
      if (location.length > 100) location = location.substring(0, 100) + '...';
      break;
    }
  }
  
  // Usar o texto original como descrição, limitando o tamanho
  if (text.length > 0) {
    description = text.length > 200 ? text.substring(0, 200) + '...' : text;
  }
  
  return {
    title,
    startDate,
    endDate,
    location,
    description
  };
}

// Busca ou cria um usuário no banco de dados
async function findOrCreateUser(telegramUser: any) {
  try {
    const telegramId = telegramUser.id.toString();
    
    // Verificar se o usuário já existe
    let user = await storage.getUserByTelegramId(telegramId);
    
    if (!user) {
      // Criar novo usuário
      const username = telegramUser.username || 
                      `${telegramUser.first_name || ''} ${telegramUser.last_name || ''}`.trim() || 
                      `telegram_${telegramId}`;
      
      const fullName = `${telegramUser.first_name || ''} ${telegramUser.last_name || ''}`.trim();
      
      user = await storage.createUser({
        username,
        telegramId,
        name: fullName,
        email: null,
        password: `telegram_${Date.now()}` // Senha gerada aleatoriamente, não usada
      });
      
      log(`Novo usuário criado: ${username} (${telegramId})`, 'telegram');
    }
    
    return user;
  } catch (error) {
    log(`Erro ao processar usuário: ${error}`, 'telegram');
    throw error;
  }
}

// Valida formato de email
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Comando /start - Inicia o bot
bot.start(async (ctx) => {
  try {
    if (!ctx.from) return;
    
    const user = await findOrCreateUser(ctx.from);
    const telegramId = ctx.from.id.toString();
    
    // Inicializar ou redefinir o estado do usuário
    userStates.set(telegramId, { telegramId, userId: user.id });
    
    await ctx.reply(
      `Olá, ${user.fullName || user.username}! Sou seu assistente de agenda. 😊\n\n` +
      `Você pode me enviar mensagens para agendar eventos, como:\n` +
      `"Agendar reunião com João amanhã às 15h"\n\n` +
      `Para ver seus eventos, use /eventos\n` +
      `Para apagar um evento, use /apagar\n` +
      `Para configurar seu email, use /configurar_email\n\n` +
      `Estou aqui para ajudar com sua agenda!`
    );
  } catch (error) {
    log(`Erro no comando start: ${error}`, 'telegram');
    await ctx.reply('Ocorreu um erro ao iniciar o bot. Por favor, tente novamente mais tarde.');
  }
});

// Comando /ajuda - Mostra instruções de uso
bot.command('ajuda', async (ctx) => {
  try {
    await ctx.reply(
      `Comandos disponíveis:\n\n` +
      `/start - Inicia o bot\n` +
      `/eventos - Lista seus próximos eventos\n` +
      `/apagar - Remove um evento existente\n` +
      `/configurar_email - Configura seu email para receber convites\n\n` +
      `Você também pode me enviar mensagens para agendar eventos:\n` +
      `"Reunião com o time na quinta às 14h"\n` +
      `"Lembrar de ligar para o cliente amanhã às 10h"\n` +
      `"Agendar médico dia 15/06 às 9h"\n\n` +
      `Farei o possível para entender e criar o evento para você!`
    );
  } catch (error) {
    log(`Erro no comando ajuda: ${error}`, 'telegram');
    await ctx.reply('Ocorreu um erro ao processar seu comando. Por favor, tente novamente.');
  }
});

// Comando /configurar_email - Configura email do usuário
bot.command('configurar_email', async (ctx) => {
  try {
    if (!ctx.from) return;
    
    const telegramId = ctx.from.id.toString();
    const user = await storage.getUserByTelegramId(telegramId);
    
    if (!user) {
      await ctx.reply('Você precisa iniciar o bot primeiro com /start');
      return;
    }
    
    // Atualizar estado para aguardar email
    userStates.set(telegramId, { 
      ...userStates.get(telegramId) || { telegramId },
      userId: user.id,
      awaitingEmail: true 
    });
    
    await ctx.reply(
      `Por favor, envie seu endereço de email para receber convites de calendário.\n\n` +
      `Seu email atual: ${user.email || 'Não configurado'}`
    );
  } catch (error) {
    log(`Erro ao configurar email: ${error}`, 'telegram');
    await ctx.reply('Ocorreu um erro ao processar seu comando. Por favor, tente novamente.');
  }
});

// Comando /eventos - Lista eventos do usuário
bot.command('eventos', async (ctx) => {
  try {
    if (!ctx.from) return;
    
    const telegramId = ctx.from.id.toString();
    const user = await storage.getUserByTelegramId(telegramId);
    
    if (!user) {
      await ctx.reply('Você precisa iniciar o bot primeiro com /start');
      return;
    }
    
    // Buscar eventos futuros do usuário
    const events = await storage.getFutureEvents(user.id);
    
    if (events.length === 0) {
      await ctx.reply('Você não tem eventos futuros agendados.');
      return;
    }
    
    // Formatar lista de eventos
    let message = 'Seus próximos eventos:\n\n';
    events.forEach((event, index) => {
      const formattedDate = format(
        new Date(event.startDate), 
        "dd/MM/yyyy 'às' HH:mm", 
        { locale: ptBR }
      );
      
      message += `${index + 1}. ${event.title}\n`;
      message += `   📅 ${formattedDate}\n`;
      if (event.location) message += `   📍 ${event.location}\n`;
      message += '\n';
    });
    
    await ctx.reply(message);
    
    // Armazenar eventos no estado para referência
    userStates.set(telegramId, {
      ...userStates.get(telegramId) || { telegramId },
      userId: user.id,
      events
    });
  } catch (error) {
    log(`Erro ao listar eventos: ${error}`, 'telegram');
    await ctx.reply('Ocorreu um erro ao buscar seus eventos. Por favor, tente novamente.');
  }
});

// Comando /apagar - Inicia processo de remoção de evento
bot.command('apagar', async (ctx) => {
  try {
    if (!ctx.from) return;
    
    const telegramId = ctx.from.id.toString();
    const user = await storage.getUserByTelegramId(telegramId);
    
    if (!user) {
      await ctx.reply('Você precisa iniciar o bot primeiro com /start');
      return;
    }
    
    // Buscar eventos futuros
    const events = await storage.getFutureEvents(user.id);
    
    if (events.length === 0) {
      await ctx.reply('Você não tem eventos futuros para apagar.');
      return;
    }
    
    // Montar teclado inline com os eventos
    const keyboard = events.map((event, index) => {
      const formattedDate = format(
        new Date(event.startDate), 
        "dd/MM 'às' HH:mm", 
        { locale: ptBR }
      );
      return [{ text: `${index + 1}. ${event.title} (${formattedDate})`, callback_data: `delete_${event.id}` }];
    });
    
    await ctx.reply('Selecione o evento que deseja apagar:', {
      reply_markup: {
        inline_keyboard: keyboard
      }
    });
    
    // Armazenar eventos no estado para referência
    userStates.set(telegramId, {
      ...userStates.get(telegramId) || { telegramId },
      userId: user.id,
      events,
      awaitingCancellation: true
    });
  } catch (error) {
    log(`Erro ao preparar apagar evento: ${error}`, 'telegram');
    await ctx.reply('Ocorreu um erro ao processar seu comando. Por favor, tente novamente.');
  }
});

// Processar callback de botões inline
bot.on('callback_query', async (ctx) => {
  try {
    if (!ctx.from || !ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;
    
    const data = ctx.callbackQuery.data;
    const telegramId = ctx.from.id.toString();
    const user = await storage.getUserByTelegramId(telegramId);
    
    if (!user) {
      await ctx.answerCbQuery('Sessão expirada. Por favor, use /start para reiniciar.');
      return;
    }
    
    // Processar deleção de evento
    if (data.startsWith('delete_')) {
      const eventId = parseInt(data.replace('delete_', ''));
      const event = await storage.getEvent(eventId);
      
      if (!event) {
        await ctx.answerCbQuery('Evento não encontrado ou já apagado.');
        await ctx.editMessageText('Evento não encontrado ou já apagado.');
        return;
      }
      
      // Confirmar exclusão
      const keyboard = [
        [
          { text: '✅ Sim, apagar', callback_data: `confirm_delete_${eventId}` },
          { text: '❌ Não, cancelar', callback_data: 'cancel_delete' }
        ]
      ];
      
      const formattedDate = format(
        new Date(event.startDate), 
        "dd/MM/yyyy 'às' HH:mm", 
        { locale: ptBR }
      );
      
      await ctx.editMessageText(
        `Confirma a exclusão do evento?\n\n` +
        `📅 ${event.title}\n` +
        `📆 ${formattedDate}\n` +
        (event.location ? `📍 ${event.location}\n` : '') +
        `\nEsta ação não pode ser desfeita.`,
        {
          reply_markup: {
            inline_keyboard: keyboard
          }
        }
      );
    }
    // Processar confirmação de deleção
    else if (data.startsWith('confirm_delete_')) {
      const eventId = parseInt(data.replace('confirm_delete_', ''));
      const event = await storage.getEvent(eventId);
      
      if (!event) {
        await ctx.answerCbQuery('Evento não encontrado ou já apagado.');
        await ctx.editMessageText('Evento não encontrado ou já apagado.');
        return;
      }
      
      // Se o usuário tem email configurado, enviar cancelamento
      if (user.email) {
        try {
          // Enviar email de cancelamento
          const cancelResult = await sendCalendarInvite(event, user.email, true);
          
          if (cancelResult.success) {
            await ctx.answerCbQuery('Evento apagado e cancelamento enviado!');
            log(`Email de cancelamento enviado para ${user.email}`, 'email');
          } else {
            await ctx.answerCbQuery('Evento apagado, mas falha ao enviar cancelamento.');
            log(`Falha ao enviar cancelamento: ${cancelResult.message}`, 'email');
          }
        } catch (emailError) {
          log(`Erro ao enviar cancelamento: ${emailError}`, 'email');
        }
      }
      
      // Apagar o evento do banco de dados
      await storage.deleteEvent(eventId);
      
      await ctx.editMessageText('✅ Evento apagado com sucesso!');
    }
    // Cancelar deleção
    else if (data === 'cancel_delete') {
      await ctx.answerCbQuery('Operação cancelada.');
      await ctx.editMessageText('Operação cancelada. O evento não foi apagado.');
    }
    
  } catch (error) {
    log(`Erro ao processar callback: ${error}`, 'telegram');
    await ctx.answerCbQuery('Ocorreu um erro. Por favor, tente novamente.');
  }
});

// Processar mensagens de texto
bot.on('text', async (ctx) => {
  try {
    if (!ctx.message || !ctx.message.text || !ctx.from) return;
    
    const text = ctx.message.text;
    const telegramId = ctx.from.id.toString();
    const userState = userStates.get(telegramId) || { telegramId };
    
    // Verificar se está esperando email
    if (userState.awaitingEmail) {
      const email = text.trim();
      
      if (!isValidEmail(email)) {
        await ctx.reply('O email informado não parece válido. Por favor, tente novamente com um formato correto, como exemplo@dominio.com');
        return;
      }
      
      try {
        // Atualizar email do usuário
        if (userState.userId) {
          await storage.updateUser(userState.userId, { email });
          
          // Atualizar estado do usuário
          userStates.set(telegramId, {
            ...userState,
            awaitingEmail: false
          });
          
          await ctx.reply(`✅ Seu email foi configurado com sucesso para: ${email}`);
          log(`Email atualizado para usuário ${userState.userId}: ${email}`, 'telegram');
        } else {
          throw new Error('ID de usuário não encontrado');
        }
      } catch (error) {
        log(`Erro ao salvar email: ${error}`, 'telegram');
        await ctx.reply('Ocorreu um erro ao salvar seu email. Por favor, tente novamente mais tarde.');
      }
      
      return;
    }
    
    // Verificar se a mensagem parece descrever um evento
    if (isEventMessage(text)) {
      log(`Processando mensagem: ${text}`, 'telegram');
      
      try {
        // Extrair informações do evento
        const eventInfo = extractEventInfo(text);
        log(`Evento extraído: ${eventInfo.title} em ${eventInfo.startDate.toISOString()}`, 'telegram');
        
        // Buscar usuário
        const user = await storage.getUserByTelegramId(telegramId);
        
        if (!user) {
          await ctx.reply('Por favor, inicie o bot primeiro com /start');
          return;
        }
        
        // Criar o evento no banco de dados
        const event = await storage.createEvent({
          userId: user.id,
          title: eventInfo.title,
          startDate: eventInfo.startDate,
          endDate: eventInfo.endDate,
          location: eventInfo.location,
          description: eventInfo.description,
          createdAt: new Date(),
          calendarId: null
        });
        
        // Formatar data para exibição
        const formattedDate = format(
          new Date(event.startDate),
          "EEEE, dd 'de' MMMM 'às' HH:mm",
          { locale: ptBR }
        );
        
        // Enviar confirmação
        await ctx.reply(
          `✅ Evento agendado com sucesso!\n\n` +
          `📅 ${event.title}\n` +
          `📆 ${formattedDate}\n` +
          (event.location ? `📍 ${event.location}\n` : '') +
          `\nPara cancelar este evento, use /apagar`
        );
        
        // Se o usuário tem email configurado, enviar convite de calendário
        if (user.email) {
          try {
            // Enviar convite de calendário universal
            const inviteResult = await sendCalendarInvite(event, user.email);
            
            if (inviteResult.success) {
              await ctx.reply(`✉️ Enviamos um convite de calendário para ${user.email}`);
              
              // Mostrar o link de preview se estiver disponível (para testes)
              if (inviteResult.previewUrl) {
                await ctx.reply(`🔍 [Prévia do email](${inviteResult.previewUrl})`, { parse_mode: 'Markdown' });
              }
            } else {
              log(`Falha ao enviar convite: ${inviteResult.message}`, 'email');
              await ctx.reply('⚠️ Não foi possível enviar o convite de calendário. Por favor, tente novamente mais tarde.');
            }
          } catch (emailError) {
            log(`Erro ao enviar convite: ${emailError}`, 'email');
            await ctx.reply('⚠️ Ocorreu um erro ao enviar o convite de calendário.');
          }
        } else {
          // Sugerir configuração de email
          await ctx.reply(
            `📧 Você ainda não configurou seu email para receber convites de calendário.\n` +
            `Use /configurar_email para adicionar seu email e receber convites automáticos.`
          );
        }
      } catch (error) {
        log(`Erro ao processar evento: ${error}`, 'telegram');
        await ctx.reply('Ocorreu um erro ao processar seu evento. Por favor, tente novamente.');
      }
      
      return;
    }
    
    // Se chegou aqui, não reconheceu um comando ou evento
    await ctx.reply(
      'Não entendi o que você quis dizer. Você pode:\n\n' +
      '- Usar /ajuda para ver os comandos disponíveis\n' +
      '- Enviar uma mensagem descrevendo um evento, como "Reunião com João amanhã às 15h"'
    );
    
  } catch (error) {
    log(`Erro ao processar mensagem: ${error}`, 'telegram');
    await ctx.reply('Ocorreu um erro ao processar sua mensagem. Por favor, tente novamente mais tarde.');
  }
});

// Iniciar o bot
export async function startSimpleBot() {
  try {
    await bot.launch();
    log('Bot do Telegram iniciado com sucesso!', 'telegram');
    return true;
  } catch (error) {
    log(`Erro ao iniciar bot: ${error}`, 'telegram');
    return false;
  }
}

// Parar o bot (útil para graceful shutdown)
export function stopSimpleBot() {
  bot.stop('SIGINT');
  log('Bot do Telegram parado.', 'telegram');
}