import express, { Express } from 'express';
import { startSimpleBot } from './simple_telegram_bot_fixed';
import { log } from './vite';

// Função para iniciar o servidor e o bot
async function startServer() {
  try {
    // Inicializar servidor Express
    const app: Express = express();
    
    // Configurações básicas
    app.use(express.json());
    
    // Iniciar o bot do Telegram
    const botStarted = await startSimpleBot();
    
    if (botStarted) {
      log('Bot do Telegram iniciado com sucesso!', 'server');
    } else {
      log('Falha ao iniciar o bot do Telegram. Verifique as configurações.', 'server');
    }
    
    // Definir porta
    const PORT = process.env.PORT || 5000;
    
    // Iniciar servidor
    app.listen(PORT, () => {
      log(`Servidor rodando na porta ${PORT}`, 'server');
    });
    
    // Rota simples para verificar status
    app.get('/status', (req, res) => {
      res.json({
        status: 'online',
        bot: botStarted ? 'running' : 'stopped',
        timestamp: new Date().toISOString()
      });
    });
    
    // Manipulação de encerramento gracioso
    process.on('SIGINT', () => {
      log('Encerrando servidor...', 'server');
      process.exit(0);
    });
    
  } catch (error) {
    log(`Erro ao iniciar servidor: ${error}`, 'server');
  }
}

// Iniciar o servidor
startServer().catch(error => {
  log(`Erro fatal: ${error}`, 'server');
});