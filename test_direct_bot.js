/**
 * Teste direto do bot Telegram para verificar se está funcionando
 */

const { Telegraf } = require('telegraf');

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.error('❌ Token não configurado');
  process.exit(1);
}

const bot = new Telegraf(token);

// Teste básico
bot.command('test', async (ctx) => {
  console.log('🔧 Comando /test recebido');
  await ctx.reply('✅ Bot funcionando perfeitamente!');
});

bot.on('text', async (ctx) => {
  const message = ctx.message.text;
  console.log(`📩 Mensagem recebida: "${message}"`);
  
  if (message.startsWith('/')) return;
  
  await ctx.reply(`✅ Recebi sua mensagem: "${message}"`);
});

console.log('🚀 Iniciando bot de teste...');
bot.launch()
  .then(() => {
    console.log('✅ Bot de teste ativo!');
    console.log('📱 Envie qualquer mensagem para testar');
  })
  .catch(err => {
    console.error('❌ Erro no bot:', err);
  });

// Parar o bot graciosamente
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));