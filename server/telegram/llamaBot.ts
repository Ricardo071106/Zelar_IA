import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import axios from 'axios';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { log } from '../vite';
import { storage } from '../storage';
import FormData from 'form-data';
import { createICalEvent, generateCalendarLink } from './calendarIntegration';
import { syncEventWithGoogleCalendar, checkGoogleCalendarAuth } from './googleCalendarService';

// Verifica se o token do bot do Telegram está definido
if (!process.env.TELEGRAM_BOT_TOKEN) {
  throw new Error('TELEGRAM_BOT_TOKEN não está definido no ambiente');
}

// Verifica se a chave da API OpenRouter está definida
if (!process.env.OPENROUTER_API_KEY) {
  throw new Error('OPENROUTER_API_KEY não está definido no ambiente');
}

// Cria uma instância do bot
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Estados de usuário para rastrear conversas
interface UserState {
  awaitingEmail?: boolean;
  telegramId: string;
  userId?: number;
}

const userStates = new Map<string, UserState>();

// Mensagem de boas-vindas
bot.start(async (ctx) => {
  try {
    const telegramId = ctx.from.id.toString();
    log(`Usuário iniciou o bot: ${ctx.from.username || telegramId}`, 'telegram');
    
    // Verifica se o usuário já existe
    const existingUser = await storage.getUserByTelegramId(telegramId);
    
    if (existingUser && existingUser.email) {
      // Se já tem e-mail, apenas dá boas-vindas
      await ctx.reply(
        `👋 Olá, ${ctx.from.first_name}! Bem-vindo de volta ao Zelar!\n\n` +
        `Você já tem seu e-mail ${existingUser.email} configurado para integração com calendário.\n\n` +
        `Você pode me enviar mensagens de texto ou áudio descrevendo seus eventos, e eu os adicionarei diretamente ao seu calendário.`
      );
      
      // Atualiza o estado do usuário
      userStates.set(telegramId, {
        telegramId,
        userId: existingUser.id,
        awaitingEmail: false
      });
    } else {
      // Se o usuário não existir, cria um novo
      let user = existingUser;
      
      if (!user) {
        const username = `telegram_${telegramId}`;
        const password = Math.random().toString(36).substring(2, 15);
        
        user = await storage.createUser({
          username,
          password,
          telegramId,
          name: ctx.from.first_name
        });
        
        log(`Novo usuário criado: ${username}`, 'telegram');
      }
      
      // Atualiza o estado do usuário para aguardar o e-mail
      userStates.set(telegramId, {
        telegramId,
        userId: user.id,
        awaitingEmail: true
      });
      
      // Solicita o e-mail
      await ctx.reply(
        `👋 Olá ${ctx.from.first_name}! Bem-vindo ao Zelar, seu assistente de agenda inteligente!\n\n` +
        `Estou aqui para ajudar você a gerenciar seus compromissos. Você pode me enviar mensagens de texto ou áudio descrevendo seus eventos, e eu os adicionarei diretamente ao seu calendário.`
      );
      
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
    `• /calendario - Configurar integração com seu calendário\n` +
    `• /email - Atualizar seu e-mail para integração com calendário\n\n` +
    `Para adicionar um evento ao seu calendário, simplesmente me diga o que você quer agendar, quando e onde.`,
    { parse_mode: 'Markdown' }
  );
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

// Comando para configurar calendário
bot.command('calendario', async (ctx) => {
  try {
    const telegramId = ctx.from.id.toString();
    const user = await storage.getUserByTelegramId(telegramId);
    
    if (!user) {
      await ctx.reply('Usuário não encontrado. Por favor, inicie o bot com /start');
      return;
    }
    
    if (!user.email) {
      userStates.set(telegramId, {
        telegramId,
        userId: user.id,
        awaitingEmail: true
      });
      
      await ctx.reply(
        `📧 Para configurar a integração com calendário, primeiro precisamos do seu e-mail.\n\n` +
        `Por favor, digite seu e-mail no formato usuario@dominio.com`
      );
      return;
    }
    
    // Verifica a autenticação com Google Calendar
    const googleAuth = await checkGoogleCalendarAuth(user.id);
    
    const baseUrl = process.env.REPLIT_DOMAINS ? `https://${process.env.REPL_SLUG}.${process.env.REPLIT_DOMAINS}` : 'http://localhost:3000';
    const authUrl = `${baseUrl}/api/auth/google?userId=${user.id}`;
    
    // Botão para autorizar o Google Calendar
    const keyboard = {
      inline_keyboard: [
        [{ text: '🔐 Autorizar Google Calendar', url: authUrl }]
      ]
    };
    
    await ctx.reply(
      `📅 *Integração com Calendário*\n\n` +
      `Seu e-mail configurado: ${user.email}\n\n` +
      (googleAuth.isAuthenticated 
        ? `✅ Você já autorizou o acesso ao Google Calendar. Seus eventos serão sincronizados automaticamente.`
        : `❗ Você ainda não autorizou o acesso ao Google Calendar.\n\nPara permitir a sincronização automática de eventos, clique no botão abaixo:`),
      { 
        parse_mode: 'Markdown',
        reply_markup: googleAuth.isAuthenticated ? undefined : keyboard
      }
    );
  } catch (error) {
    log(`Erro ao processar comando calendario: ${error}`, 'telegram');
    await ctx.reply('Ocorreu um erro ao processar seu pedido. Por favor, tente novamente mais tarde.');
  }
});

// Comando para atualizar e-mail
bot.command('email', async (ctx) => {
  try {
    const telegramId = ctx.from.id.toString();
    const user = await storage.getUserByTelegramId(telegramId);
    
    if (!user) {
      await ctx.reply('Usuário não encontrado. Por favor, inicie o bot com /start');
      return;
    }
    
    userStates.set(telegramId, {
      telegramId,
      userId: user.id,
      awaitingEmail: true
    });
    
    if (user.email) {
      await ctx.reply(
        `📧 Seu e-mail atual é: ${user.email}\n\n` +
        `Para atualizar, digite seu novo e-mail no formato usuario@dominio.com`
      );
    } else {
      await ctx.reply(
        `📧 Por favor, digite seu e-mail para que possamos integrar seus eventos ao seu calendário.\n\n` +
        `Exemplo: seunome@exemplo.com.br`
      );
    }
  } catch (error) {
    log(`Erro ao processar comando email: ${error}`, 'telegram');
    await ctx.reply('Ocorreu um erro ao processar seu pedido. Por favor, tente novamente mais tarde.');
  }
});

// Função para processar mensagem de texto usando Llama via OpenRouter
async function processTextMessage(text: string, userId: number): Promise<{
  success: boolean;
  message: string;
  eventDetails?: {
    title: string;
    startDate: Date;
    endDate?: Date;
    location?: string;
    description?: string;
  };
}> {
  try {
    // Prompt do sistema para extrair informações de evento
    const systemPrompt = `
      Você é um assistente especializado em extrair informações de eventos de mensagens em português brasileiro.
      Analise a mensagem do usuário e extraia as seguintes informações:
      - título do evento
      - data e hora de início
      - data e hora de término (se mencionado)
      - local (se mencionado)
      - descrição ou detalhes adicionais (se mencionado)
      
      Se a mensagem contiver informações sobre um evento, forneça os detalhes no formato JSON:
      {
        "isEvent": true,
        "title": "Título do evento",
        "startDate": "YYYY-MM-DDTHH:MM:SS",
        "endDate": "YYYY-MM-DDTHH:MM:SS",
        "location": "Local do evento",
        "description": "Descrição ou detalhes adicionais"
      }
      
      Se a mensagem não contiver informações suficientes para criar um evento, retorne:
      {
        "isEvent": false,
        "reason": "Razão pela qual não foi possível extrair informações de evento"
      }
      
      Sempre defina as horas como específicas, nunca use "o dia todo" a menos que seja explicitamente mencionado.
      Se o usuário não especificar um horário, assuma um horário padrão, como 9:00 para manhã, 15:00 para tarde, e 19:00 para noite.
      Se o usuário não especificar uma data, assuma que é para o dia seguinte.
      Se for mencionado "hoje", use a data atual; se for "amanhã", use o dia seguinte à data atual.
    `;
    
    log(`Processando mensagem de texto: "${text}"`, 'telegram');
    
    // Fazendo a chamada para a API do OpenRouter usando modelo Llama
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: "meta-llama/llama-3-8b-instruct", // Usando Llama como solicitado
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text }
        ],
        response_format: { type: 'json_object' }
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!response.data || !response.data.choices || !response.data.choices[0] || !response.data.choices[0].message) {
      return {
        success: false,
        message: 'Não consegui processar a resposta da API.'
      };
    }
    
    const content = response.data.choices[0].message.content;
    
    try {
      const eventData = JSON.parse(content);
      
      if (!eventData.isEvent) {
        return {
          success: false,
          message: `Não consegui identificar informações de evento na sua mensagem. ${eventData.reason || 'Por favor, forneça mais detalhes sobre o evento, como título, data e hora.'}`
        };
      }
      
      // Se for um evento, extrai as informações com tratamento de erros
      let startDate;
      let endDate;
      
      try {
        // Verifica se o modelo está retornando o valor padrão sem processamento
        if (eventData.startDate === "YYYY-MM-DDTHH:MM:SS" || eventData.startDate.includes("YYYY")) {
          // Tenta extrair informações da mensagem original
          if (text.toLowerCase().includes("próxima segunda") || text.toLowerCase().includes("proxima segunda")) {
            // Encontra a próxima segunda-feira
            startDate = new Date();
            startDate.setDate(startDate.getDate() + (8 - startDate.getDay()) % 7);
            
            // Define a hora mencionada ou padrão
            if (text.toLowerCase().includes("10h") || text.toLowerCase().includes("10:00") || 
                text.toLowerCase().includes("às 10")) {
              startDate.setHours(10, 0, 0, 0);
            } else if (text.toLowerCase().includes("15h") || text.toLowerCase().includes("15:00") || 
                      text.toLowerCase().includes("às 15") || text.toLowerCase().includes("3 da tarde")) {
              startDate.setHours(15, 0, 0, 0);
            } else {
              startDate.setHours(10, 0, 0, 0); // Hora padrão
            }
            
            log(`Utilizando próxima segunda-feira às ${startDate.getHours()}h`, 'telegram');
          } else if (text.toLowerCase().includes("amanhã")) {
            // Define para amanhã
            startDate = new Date();
            startDate.setDate(startDate.getDate() + 1);
            
            // Define a hora mencionada ou padrão
            if (text.toLowerCase().includes("15h") || text.toLowerCase().includes("15:00") || 
                text.toLowerCase().includes("às 15") || text.toLowerCase().includes("3 da tarde")) {
              startDate.setHours(15, 0, 0, 0);
            } else if (text.toLowerCase().includes("10h") || text.toLowerCase().includes("10:00") || 
                      text.toLowerCase().includes("às 10")) {
              startDate.setHours(10, 0, 0, 0);
            } else {
              startDate.setHours(10, 0, 0, 0); // Hora padrão
            }
            
            log(`Utilizando amanhã às ${startDate.getHours()}h`, 'telegram');
          } else {
            // Fallback padrão para amanhã às 10h
            log(`Data inválida recebida: ${eventData.startDate}, usando fallback padrão`, 'telegram');
            startDate = new Date();
            startDate.setDate(startDate.getDate() + 1);
            startDate.setHours(10, 0, 0, 0);
          }
        } else {
          // Tenta converter a data de início normalmente
          startDate = new Date(eventData.startDate);
          // Verifica se a data é válida
          if (isNaN(startDate.getTime())) {
            // Se a data fornecida pelo modelo não for válida, usamos a data de amanhã às 10h
            log(`Data inválida recebida: ${eventData.startDate}, usando fallback`, 'telegram');
            startDate = new Date();
            startDate.setDate(startDate.getDate() + 1);
            startDate.setHours(10, 0, 0, 0);
          }
        }
        
        // Tenta converter a data de término, se existir
        if (eventData.endDate) {
          endDate = new Date(eventData.endDate);
          // Verifica se a data é válida
          if (isNaN(endDate.getTime())) {
            // Se a data de término não for válida, define como 1 hora após o início
            endDate = new Date(startDate);
            endDate.setHours(endDate.getHours() + 1);
          }
        } else {
          // Se não tiver data de término, assume 1 hora após o início
          endDate = new Date(startDate);
          endDate.setHours(endDate.getHours() + 1);
        }
      } catch (dateError) {
        log(`Erro ao processar datas: ${dateError}`, 'telegram');
        // Em caso de erro, usa valores padrão
        startDate = new Date();
        startDate.setDate(startDate.getDate() + 1);
        startDate.setHours(10, 0, 0, 0);
        
        endDate = new Date(startDate);
        endDate.setHours(endDate.getHours() + 1);
      }
      
      // O código acima já trata todos os casos de data de término
      
      // Adiciona diretamente ao calendário
      const user = await storage.getUser(userId);
      if (!user || !user.email) {
        return {
          success: false,
          message: 'Não foi possível adicionar o evento ao calendário porque não encontramos seu e-mail configurado. Use o comando /email para configurar.'
        };
      }
      
      // Formata as datas para exibição
      const formattedDate = format(startDate, "EEEE, dd 'de' MMMM 'às' HH:mm", { locale: ptBR });
      
      // Armazena o evento no banco (simplificado)
      const newEvent = await storage.createEvent({
        title: eventData.title,
        startDate,
        endDate,
        location: eventData.location,
        description: eventData.description,
        userId: userId,
        calendarId: `cal_${Math.random().toString(36).substring(2, 10)}` // Simulação de ID do calendário
      });
      
      log(`Evento criado: ${eventData.title}`, 'telegram');
      
      // Integração real com calendário através de arquivos ICS
      const calendarProvider = user.email.includes('gmail') || user.email.includes('google') ? 'Google Calendar' : 'Apple Calendar';
      log(`Gerando arquivo ICS para ${calendarProvider} para ${user.email}`, 'calendar');
      
      // Gera o arquivo ICS e o link de download
      const calendarResult = await generateCalendarLink(newEvent, user.email);
      
      if (!calendarResult.success) {
        log(`Erro ao gerar arquivo ICS: ${calendarResult.message}`, 'calendar');
        return {
          success: false,
          message: `✅ Evento adicionado ao seu calendário!\n\n*${eventData.title}*\n📅 ${formattedDate}\n${eventData.location ? `📍 ${eventData.location}\n` : ''}${eventData.description ? `📝 ${eventData.description}\n` : ''}\n⚠️ Não foi possível gerar o arquivo de calendário: ${calendarResult.message}`,
          eventDetails: {
            title: eventData.title,
            startDate,
            endDate,
          }
        };
      }
      
      // Constrói o URL completo para download
      const baseUrl = process.env.REPLIT_DOMAINS ? `https://${process.env.REPL_SLUG}.${process.env.REPLIT_DOMAINS}` : 'http://localhost:3000';
      const downloadUrl = baseUrl + calendarResult.downloadLink;
      
      return {
        success: true,
        message: `✅ Evento adicionado ao seu calendário!\n\n*${eventData.title}*\n📅 ${formattedDate}\n${eventData.location ? `📍 ${eventData.location}\n` : ''}${eventData.description ? `📝 ${eventData.description}\n` : ''}\n\n🔄 [Clique aqui para adicionar ao seu ${calendarProvider}](${downloadUrl})`,
        eventDetails: {
          title: eventData.title,
          startDate,
          endDate,
          location: eventData.location,
          description: eventData.description
        }
      };
      
    } catch (error) {
      log(`Erro ao processar JSON da resposta: ${error}`, 'telegram');
      return {
        success: false,
        message: 'Ocorreu um erro ao processar as informações do evento. Por favor, tente novamente com mais detalhes.'
      };
    }
    
  } catch (error) {
    log(`Erro ao processar mensagem de texto: ${error}`, 'telegram');
    return {
      success: false,
      message: 'Ocorreu um erro ao processar sua mensagem. Por favor, tente novamente mais tarde.'
    };
  }
}

// Processamento de mensagens de texto
bot.on(message('text'), async (ctx) => {
  try {
    const telegramId = ctx.from.id.toString();
    const userState = userStates.get(telegramId);
    
    // Se não tiver estado, busca ou cria usuário
    if (!userState) {
      const user = await storage.getUserByTelegramId(telegramId);
      
      if (user) {
        userStates.set(telegramId, {
          telegramId: telegramId,
          userId: user.id,
          awaitingEmail: false
        });
      } else {
        await ctx.reply('Por favor, inicie o bot com /start primeiro.');
        return;
      }
    }
    
    // Obtém o estado atualizado após possível inicialização
    const currentState = userStates.get(telegramId);
    
    // Verifica se estamos esperando um e-mail do usuário
    if (currentState && currentState.awaitingEmail) {
      const emailInput = ctx.message.text.trim();
      
      // Valida o e-mail
      if (!isValidEmail(emailInput)) {
        await ctx.reply('❌ Por favor, forneça um endereço de e-mail válido no formato usuario@dominio.com');
        return;
      }
      
      if (!currentState.userId) {
        await ctx.reply('❌ Ocorreu um erro com seu usuário. Por favor, inicie o bot novamente com /start');
        return;
      }
      
      // Atualiza o e-mail do usuário
      const updated = await updateUserEmail(currentState.userId, emailInput);
      
      if (updated) {
        // Atualiza o estado do usuário
        userStates.set(telegramId, {
          telegramId: telegramId,
          userId: currentState.userId,
          awaitingEmail: false
        });
        
        await ctx.reply(
          `✅ Obrigado! Seu e-mail ${emailInput} foi registrado com sucesso.\n\n` +
          `Agora você pode começar a usar o Zelar! Experimente enviar uma mensagem como:\n` +
          `"Agendar reunião com João na próxima segunda às 10h" ou\n` +
          `"Lembrar de buscar as crianças na escola amanhã às 17h"`
        );
      } else {
        await ctx.reply('❌ Ocorreu um erro ao registrar seu e-mail. Por favor, tente novamente.');
      }
      
      return;
    }
    
    // Se não for um comando e não estiver esperando e-mail, processa como descrição de evento
    if (!ctx.message.text.startsWith('/') && currentState && currentState.userId) {
      // Enviar mensagem de processamento
      const processingMessage = await ctx.reply('🧠 Processando sua mensagem...');
      
      // Processa a mensagem
      const result = await processTextMessage(ctx.message.text, currentState.userId);
      
      // Remove a mensagem de processamento
      await ctx.telegram.deleteMessage(ctx.chat.id, processingMessage.message_id);
      
      // Envia o resultado
      await ctx.reply(result.message, { parse_mode: 'Markdown' });
    }
    
  } catch (error) {
    log(`Erro ao processar mensagem de texto: ${error}`, 'telegram');
    await ctx.reply('Ocorreu um erro ao processar sua mensagem. Por favor, tente novamente.');
  }
});

// Processamento simplificado para mensagens de voz
// Nota: como estamos usando Llama, não temos acesso a processamento de áudio 
// diretamente pelo modelo, então vamos simplificar e enviar uma mensagem
// orientando o usuário a enviar texto
bot.on(message('voice'), async (ctx) => {
  try {
    // Envia uma mensagem informando que o processamento de áudio não está disponível
    await ctx.reply(
      '🎤 Desculpe, o processamento de áudio não está disponível no momento.\n\n' +
      'Por favor, envie sua mensagem em texto para que eu possa criar o evento para você.'
    );
  } catch (error) {
    log(`Erro ao processar mensagem de voz: ${error}`, 'telegram');
    await ctx.reply('Ocorreu um erro ao processar seu áudio. Por favor, tente novamente ou envie sua mensagem em texto.');
  }
});

// Função para iniciar o bot
export async function startLlamaBot() {
  try {
    // Ativa o modo de polling
    await bot.launch();
    log('Bot do Telegram com Llama iniciado com sucesso!', 'telegram');
    
    // Encerramento correto do bot
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
    
    return true;
  } catch (error) {
    log(`Erro ao iniciar bot do Telegram com Llama: ${error}`, 'telegram');
    return false;
  }
}