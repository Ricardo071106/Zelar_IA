/**
 * Script para iniciar o bot com a nova solução de calendário universal
 * 
 * Esta abordagem não depende de senhas de aplicativo do Gmail que têm duração limitada
 */

import express from 'express';
import { startUniversalBot } from './server/universal_bot';
import { log } from './server/vite';

// Iniciar o servidor e o bot
async function startServer() {
  try {
    // Configurar servidor Express básico
    const app = express();
    app.use(express.json());
    
    // Iniciar o bot do Telegram com a nova solução de calendário universal
    const botStarted = await startUniversalBot();
    
    if (botStarted) {
      log('✅ Bot iniciado com sucesso usando a solução de calendário universal', 'server');
    } else {
      log('❌ Falha ao iniciar o bot. Verifique as configurações do Telegram.', 'server');
    }
    
    // Rota básica para verificar status
    app.get('/', (req, res) => {
      res.json({
        status: 'online',
        bot: botStarted ? 'running' : 'failed',
        universalCalendarSupport: true,
        timestamp: new Date().toISOString()
      });
    });
    
    // Iniciar o servidor
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      log(`🚀 Servidor rodando na porta ${PORT}`, 'server');
    });
    
    // Tratamento de encerramento
    process.once('SIGINT', () => {
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