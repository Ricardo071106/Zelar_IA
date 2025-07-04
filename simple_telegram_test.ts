/**
 * Teste simples para verificar se o bot consegue inicializar
 */

import { Telegraf } from 'telegraf';

console.log('🚀 Iniciando teste simples do bot...');

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error('❌ Token não configurado');
  process.exit(1);
}

const bot = new Telegraf(token);

// Handler básico
bot.command('start', async (ctx) => {
  console.log('✅ Comando /start recebido');
  await ctx.reply('Bot funcionando!');
});

bot.on('text', async (ctx) => {
  console.log('📩 Mensagem recebida:', ctx.message.text);
  await ctx.reply('Recebi: ' + ctx.message.text);
});

// Inicializar
async function start() {
  try {
    console.log('🔄 Iniciando bot...');
    await bot.launch();
    console.log('✅ Bot iniciado com sucesso!');
    
    // Teste de conexão
    const me = await bot.telegram.getMe();
    console.log(`✅ Bot @${me.username} ativo`);
    
  } catch (error) {
    console.error('❌ Erro ao iniciar bot:', error);
    console.error('❌ Detalhes:', (error as Error).message);
    process.exit(1);
  }
}

start();

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));