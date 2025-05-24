import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import { processTextMessage, processVoiceMessage } from './processor';
import { createUserIfNotExists, findOrCreateUserByTelegramId } from './user';
import { log } from '../vite';

// Verifica se o token do bot do Telegram está definido
if (!process.env.TELEGRAM_BOT_TOKEN) {
  throw new Error('TELEGRAM_BOT_TOKEN não está definido no ambiente');
}

// Cria uma instância do bot
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Mensagem de boas-vindas
bot.start(async (ctx) => {
  try {
    const user = await createUserIfNotExists(ctx.from);
    log(`Usuário iniciou o bot: ${user.username || user.telegramId}`, 'telegram');
    
    await ctx.reply(
      `👋 Olá ${ctx.from.first_name}! Bem-vindo ao Zelar, seu assistente de agenda inteligente!\n\n` +
      `Estou aqui para ajudar você a gerenciar seus compromissos. Você pode me enviar mensagens de texto ou áudio descrevendo seus eventos, e eu os adicionarei automaticamente à sua agenda.\n\n` +
      `Por exemplo, experimente dizer: "Agendar reunião com João na próxima segunda às 10h" ou "Lembrar de buscar as crianças na escola amanhã às 17h".`
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

// Processamento de mensagens de texto
bot.on(message('text'), async (ctx) => {
  try {
    const user = await findOrCreateUserByTelegramId(ctx.from.id.toString());
    log(`Mensagem recebida de ${user.username || user.telegramId}: ${ctx.message.text}`, 'telegram');
    
    // Verifica se a mensagem é um comando
    if (ctx.message.text.startsWith('/')) {
      return; // Deixe os handlers de comando lidarem com isso
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
    const user = await findOrCreateUserByTelegramId(ctx.from.id.toString());
    log(`Mensagem de voz recebida de ${user.username || user.telegramId}`, 'telegram');
    
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