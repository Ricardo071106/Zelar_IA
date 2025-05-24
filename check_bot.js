// Script para verificar informações do bot
require('dotenv').config();
const axios = require('axios');

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.error('TELEGRAM_BOT_TOKEN não está definido no ambiente');
  process.exit(1);
}

async function checkBotInfo() {
  try {
    const response = await axios.get(`https://api.telegram.org/bot${token}/getMe`);
    console.log('Informações do bot:');
    console.log(JSON.stringify(response.data, null, 2));
    
    if (response.data.ok && response.data.result) {
      const bot = response.data.result;
      console.log('\nNome do bot:', bot.first_name);
      console.log('Nome de usuário:', bot.username);
      console.log('\nLink do bot:', `https://t.me/${bot.username}`);
    }
  } catch (error) {
    console.error('Erro ao obter informações do bot:', error.message);
    if (error.response) {
      console.error('Resposta da API:', error.response.data);
    }
  }
}

checkBotInfo();