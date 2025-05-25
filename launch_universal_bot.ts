/**
 * Script para iniciar o bot com suporte universal para calendários
 * 
 * Este script usa o módulo universalCalendarInvite que não depende
 * de senhas de aplicativo do Gmail com duração limitada
 */

import express from 'express';
import { startSimpleBot } from './server/simple_telegram_bot_fixed';
import { log } from './server/vite';

// Iniciar o servidor e o bot
async function startServer() {
  try {
    // Configurar servidor Express básico
    const app = express();
    app.use(express.json());
    
    // Iniciar o bot do Telegram
    const botStarted = await startSimpleBot();
    
    if (botStarted) {
      log('✅ Bot iniciado com sucesso usando convites universais de calendário', 'server');
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
    const PORT = process.env.PORT || 3000;
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