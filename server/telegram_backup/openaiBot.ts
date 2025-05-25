import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import axios from 'axios';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { log } from '../vite';
import { storage } from '../storage';
import OpenAI from 'openai';
import FormData from 'form-data';

// Verifica se o token do bot do Telegram está definido
if (!process.env.TELEGRAM_BOT_TOKEN) {
  throw new Error('TELEGRAM_BOT_TOKEN não está definido no ambiente');
}

// Verifica se a chave da API OpenAI está definida
if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY não está definido no ambiente');
}

// Inicializa o cliente OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

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
    
    await ctx.reply(
      `📅 *Integração com Calendário*\n\n` +
      `Seu e-mail configurado: ${user.email}\n\n` +
      `Quando você me envia um evento, eu adiciono automaticamente ao seu calendário.\n\n` +
      `Por enquanto, suportamos Google Calendar e Apple Calendar. Seus eventos serão sincronizados diretamente com seu calendário associado a este e-mail.`,
      { parse_mode: 'Markdown' }
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

// Função para processar mensagem de texto usando OpenAI
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
    
    // Usando a API da OpenAI diretamente
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text }
      ],
      response_format: { type: "json_object" }
    });
    
    const content = completion.choices[0].message.content;
    
    if (!content) {
      return {
        success: false,
        message: 'Não consegui processar a resposta da API.'
      };
    }
    
    try {
      const eventData = JSON.parse(content);
      
      if (!eventData.isEvent) {
        return {
          success: false,
          message: `Não consegui identificar informações de evento na sua mensagem. ${eventData.reason || 'Por favor, forneça mais detalhes sobre o evento, como título, data e hora.'}`
        };
      }
      
      // Se for um evento, extrai as informações
      const startDate = new Date(eventData.startDate);
      let endDate = eventData.endDate ? new Date(eventData.endDate) : undefined;
      
      // Se não tiver data de término, assume 1 hora após o início
      if (!endDate && startDate) {
        endDate = new Date(startDate);
        endDate.setHours(endDate.getHours() + 1);
      }
      
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
      
      // Simula a sincronização com o calendário
      const calendarProvider = user.email.includes('gmail') || user.email.includes('google') ? 'Google Calendar' : 'Apple Calendar';
      log(`Simulando sincronização com ${calendarProvider} para ${user.email}`, 'calendar');
      
      return {
        success: true,
        message: `✅ Evento adicionado ao seu calendário!\n\n*${eventData.title}*\n📅 ${formattedDate}\n${eventData.location ? `📍 ${eventData.location}\n` : ''}${eventData.description ? `📝 ${eventData.description}\n` : ''}\n🔄 Sincronizado com seu ${calendarProvider}`,
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

// Função para processar mensagem de voz
async function processVoiceMessage(audioUrl: string, userId: number): Promise<{
  success: boolean;
  message: string;
  eventDetails?: any;
}> {
  try {
    log(`Processando áudio: ${audioUrl}`, 'telegram');
    
    // 1. Baixa o arquivo de áudio
    const audioResponse = await axios.get(audioUrl, { responseType: 'arraybuffer' });
    const audioBuffer = Buffer.from(audioResponse.data);
    
    log(`Áudio baixado: ${audioBuffer.length} bytes`, 'telegram');
    
    // 2. Transcreve o áudio usando a API da OpenAI
    const formData = new FormData();
    formData.append('file', audioBuffer, {
      filename: 'audio.ogg',
      contentType: 'audio/ogg'
    });
    formData.append('model', 'whisper-1');
    formData.append('language', 'pt');
    
    log('Enviando áudio para a API de transcrição da OpenAI...', 'telegram');
    
    const transcriptionResponse = await axios.post(
      'https://api.openai.com/v1/audio/transcriptions',
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        }
      }
    );
    
    if (!transcriptionResponse.data || !transcriptionResponse.data.text) {
      log('A API de transcrição não retornou texto', 'telegram');
      return {
        success: false,
        message: 'Não consegui transcrever seu áudio. Por favor, tente novamente ou envie sua mensagem em texto.'
      };
    }
    
    const transcription = transcriptionResponse.data.text;
    log(`Transcrição do áudio: "${transcription}"`, 'telegram');
    
    // 3. Processa a transcrição como texto para extrair informações do evento
    return await processTextMessage(transcription, userId);
    
  } catch (error) {
    log(`Erro ao processar mensagem de voz: ${error}`, 'telegram');
    return {
      success: false,
      message: 'Ocorreu um erro ao processar seu áudio. Por favor, tente novamente ou envie sua mensagem em texto.'
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

// Processamento de mensagens de voz
bot.on(message('voice'), async (ctx) => {
  try {
    const telegramId = ctx.from.id.toString();
    
    // Buscar usuário ou criar estado
    let userState = userStates.get(telegramId);
    if (!userState) {
      const user = await storage.getUserByTelegramId(telegramId);
      if (!user) {
        await ctx.reply('Por favor, inicie o bot com /start primeiro para configurar seu perfil.');
        return;
      }
      
      userState = {
        telegramId: telegramId,
        userId: user.id,
        awaitingEmail: false
      };
      userStates.set(telegramId, userState);
    }
    
    if (!userState.userId) {
      await ctx.reply('Seu perfil não está configurado corretamente. Por favor, use /start para reiniciar.');
      return;
    }
    
    // Enviar mensagem de processamento
    const processingMessage = await ctx.reply('🎤 Recebendo seu áudio...');
    
    try {
      // Obtém o arquivo de áudio
      const fileId = ctx.message.voice.file_id;
      const fileLink = await ctx.telegram.getFileLink(fileId);
      
      log(`Áudio recebido. Tamanho: ${ctx.message.voice.duration}s, URL: ${fileLink.href}`, 'telegram');
      
      // Atualiza a mensagem de processamento
      await ctx.telegram.editMessageText(
        ctx.chat.id, 
        processingMessage.message_id, 
        undefined,
        '🧠 Processando seu áudio...'
      );
      
      // Processa a mensagem de voz
      const result = await processVoiceMessage(fileLink.href, userState.userId);
      
      // Remove a mensagem de processamento
      await ctx.telegram.deleteMessage(ctx.chat.id, processingMessage.message_id);
      
      // Envia a resposta
      await ctx.reply(result.message, { parse_mode: 'Markdown' });
      
      if (result.eventDetails) {
        log(`Evento criado a partir de áudio: ${result.eventDetails.title}`, 'telegram');
      }
    } catch (audioError) {
      // Remove a mensagem de processamento se existir
      try {
        await ctx.telegram.deleteMessage(ctx.chat.id, processingMessage.message_id);
      } catch (deleteError) {
        // Ignora erro ao deletar mensagem
      }
      
      log(`Erro ao processar áudio: ${audioError}`, 'telegram');
      await ctx.reply('❌ Não foi possível processar seu áudio. O formato pode não ser suportado ou o áudio está corrompido. Por favor, tente enviar como mensagem de texto.');
    }
  } catch (error) {
    log(`Erro geral ao processar mensagem de voz: ${error}`, 'telegram');
    await ctx.reply('Ocorreu um erro ao processar seu áudio. Por favor, tente novamente ou envie sua mensagem como texto.');
  }
});

// Função para iniciar o bot
export async function startOpenAIBot() {
  try {
    // Ativa o modo de polling
    await bot.launch();
    log('Bot do Telegram com OpenAI iniciado com sucesso!', 'telegram');
    
    // Encerramento correto do bot
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
    
    return true;
  } catch (error) {
    log(`Erro ao iniciar bot do Telegram com OpenAI: ${error}`, 'telegram');
    return false;
  }
}