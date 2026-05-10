
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

// Carregar .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const TELEGRAM_API = 'https://api.telegram.org/bot';
const token = process.env.TELEGRAM_BOT_TOKEN;

async function testConnection() {
  console.log('🔍 Testando conexão com Telegram API...');
  console.log(`🔑 Token presente: ${!!token}`);

  if (!token) {
    console.error('❌ Token não encontrado no .env');
    return;
  }

  try {
    const url = `${TELEGRAM_API}${token}/getMe`;
    console.log(`🌐 Tentando GET ${url.replace(token, 'HIDDEN_TOKEN')}`);

    // Tentar com timeout curto primeiro
    const response = await axios.get(url, { timeout: 10000 });
    console.log('✅ Conexão bem sucedida!');
    console.log('📦 Dados:', response.data);
  } catch (error: any) {
    console.error('❌ Erro na conexão:');
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
      console.error('Headers:', error.response.headers);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('Sem resposta recebida (Timeout ou Network Error)');
      console.error('Erro Request:', error.request);
      console.error('Código:', error.code); // ETTIMEDOUT, ENOTFOUND, etc
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Erro Config:', error.message);
    }
  }
}

testConnection();
