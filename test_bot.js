/**
 * Teste simples do bot Telegram
 */

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!TELEGRAM_BOT_TOKEN) {
  console.error('❌ Token do Telegram não configurado');
  process.exit(1);
}

// Função para testar webhook
async function testWebhook() {
  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`);
    const data = await response.json();
    console.log('📡 Webhook info:', data);
    
    if (data.result.url) {
      console.log('✅ Webhook configurado:', data.result.url);
    } else {
      console.log('⚠️ Webhook não configurado - usando polling');
    }
  } catch (error) {
    console.error('❌ Erro ao verificar webhook:', error);
  }
}

// Função para testar bot
async function testBot() {
  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe`);
    const data = await response.json();
    
    if (data.ok) {
      console.log('✅ Bot funcionando:', data.result.username);
    } else {
      console.log('❌ Bot com erro:', data.description);
    }
  } catch (error) {
    console.error('❌ Erro ao testar bot:', error);
  }
}

// Executar testes
async function runTests() {
  console.log('🚀 Iniciando testes do bot Telegram...');
  await testBot();
  await testWebhook();
}

runTests();