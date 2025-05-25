import express, { Express } from 'express';
import { startSimpleBot } from './simple_telegram_bot';
import { log } from './vite';

// Função para iniciar o servidor e o bot
async function startServer() {
  // Cria o aplicativo Express
  const app = express();
  
  // Configura o middleware básico
  app.use(express.json());
  
  // Rota básica para verificar se o servidor está funcionando
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Servidor rodando!' });
  });
  
  // Define a porta
  const port = process.env.PORT || 5000;
  
  // Inicia o servidor
  const server = app.listen(port, () => {
    log(`Servidor iniciado na porta ${port}`, 'express');
  });
  
  // Inicia o bot do Telegram
  try {
    await startSimpleBot();
    log('Bot do Telegram iniciado com sucesso!', 'express');
  } catch (error) {
    log(`Erro ao iniciar o bot: ${error}`, 'express');
  }
  
  return server;
}

// Inicia o servidor
startServer().catch(err => {
  console.error('Erro ao iniciar o servidor:', err);
  process.exit(1);
});