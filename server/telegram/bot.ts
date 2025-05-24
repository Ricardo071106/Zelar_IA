import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import { processTextMessage, processVoiceMessage } from './processor';
import { createUserIfNotExists, findOrCreateUserByTelegramId } from './user';
import { log } from '../vite';
import { storage } from '../storage';

// Verifica se o token do bot do Telegram está definido
if (!process.env.TELEGRAM_BOT_TOKEN) {
  throw new Error('TELEGRAM_BOT_TOKEN não está definido no ambiente');
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
    const user = await createUserIfNotExists(ctx.from);
    log(`Usuário iniciou o bot: ${user.username || user.telegramId}`, 'telegram');
    
    // Atualiza o estado do usuário
    userStates.set(telegramId, {
      awaitingEmail: true,
      telegramId,
      userId: user.id
    });
    
    await ctx.reply(
      `👋 Olá ${ctx.from.first_name}! Bem-vindo ao Zelar, seu assistente de agenda inteligente!\n\n` +
      `Estou aqui para ajudar você a gerenciar seus compromissos. Você pode me enviar mensagens de texto ou áudio descrevendo seus eventos, e eu os adicionarei automaticamente à sua agenda e calendário.\n\n` +
      `Para começar, por favor, compartilhe seu e-mail para que possamos integrar seus eventos ao seu calendário.`
    );
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
    `• /configuracoes - Configura suas preferências\n\n` +
    `Para adicionar um evento, simplesmente me diga o que você quer agendar, quando e onde.`,
    { parse_mode: 'Markdown' }
  );
});

// Função para validar e-mail
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
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
    
    // Verifica se estamos esperando um e-mail do usuário
    const userState = userStates.get(telegramId);
    if (userState && userState.awaitingEmail) {
      const email = ctx.message.text.trim();
      
      // Valida o e-mail
      if (!isValidEmail(email)) {
        await ctx.reply('❌ Por favor, forneça um endereço de e-mail válido.');
        return;
      }
      
      // Atualiza o e-mail do usuário
      const updated = await updateUserEmail(user.id, email);
      
      if (updated) {
        // Atualiza o estado do usuário
        userStates.set(telegramId, {
          ...userState,
          awaitingEmail: false
        });
        
        await ctx.reply(
          `✅ Obrigado! Seu e-mail ${email} foi registrado com sucesso.\n\n` +
          `Agora você pode começar a usar o Zelar! Experimente enviar uma mensagem como:\n` +
          `"Agendar reunião com João na próxima segunda às 10h" ou\n` +
          `"Lembrar de buscar as crianças na escola amanhã às 17h"`
        );
        return;
      } else {
        await ctx.reply('❌ Ocorreu um erro ao registrar seu e-mail. Por favor, tente novamente.');
        return;
      }
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
    // Implementação será adicionada
    await ctx.reply('Funcionalidade em desenvolvimento. Em breve você poderá ver todos os seus eventos aqui!');
  } catch (error) {
    log(`Erro ao processar comando eventos: ${error}`, 'telegram');
    await ctx.reply('Ocorreu um erro ao buscar seus eventos. Por favor, tente novamente.');
  }
});

// Comando para eventos de hoje
bot.command('hoje', async (ctx) => {
  try {
    const user = await findOrCreateUserByTelegramId(ctx.from.id.toString());
    // Implementação será adicionada
    await ctx.reply('Funcionalidade em desenvolvimento. Em breve você poderá ver os eventos de hoje aqui!');
  } catch (error) {
    log(`Erro ao processar comando hoje: ${error}`, 'telegram');
    await ctx.reply('Ocorreu um erro ao buscar seus eventos de hoje. Por favor, tente novamente.');
  }
});

// Comando para eventos de amanhã
bot.command('amanha', async (ctx) => {
  try {
    const user = await findOrCreateUserByTelegramId(ctx.from.id.toString());
    // Implementação será adicionada
    await ctx.reply('Funcionalidade em desenvolvimento. Em breve você poderá ver os eventos de amanhã aqui!');
  } catch (error) {
    log(`Erro ao processar comando amanha: ${error}`, 'telegram');
    await ctx.reply('Ocorreu um erro ao buscar seus eventos de amanhã. Por favor, tente novamente.');
  }
});

// Comando para configurações
bot.command('configuracoes', async (ctx) => {
  try {
    const user = await findOrCreateUserByTelegramId(ctx.from.id.toString());
    // Implementação será adicionada
    await ctx.reply('Funcionalidade em desenvolvimento. Em breve você poderá configurar suas preferências aqui!');
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