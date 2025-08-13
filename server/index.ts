import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { registerRoutes } from "./routes";
import { startDirectBot } from "./telegram/direct_bot";
import { getWhatsAppBot } from "./whatsapp/whatsappBot";
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// =================== MONITORAMENTO E ROBUSTEZ ===================
let requestCount = 0;
let lastRequestTime = Date.now();

// Middleware de monitoramento
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  requestCount++;
  lastRequestTime = Date.now();
  
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Rota de health check
app.get('/health', (req, res) => {
  const uptime = Date.now() - lastRequestTime;
  res.json({
    status: 'ok',
    uptime: Math.floor(uptime / 1000),
    requestCount,
    lastRequest: new Date(lastRequestTime).toISOString(),
    memory: process.memoryUsage(),
    telegramBot: !!process.env.TELEGRAM_BOT_TOKEN,
    database: !!process.env.DATABASE_URL
  });
});

// Health check simples para AWS
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'TelegramScheduler is running!',
    timestamp: new Date().toISOString(),
    telegramBot: !!process.env.TELEGRAM_BOT_TOKEN,
    database: !!process.env.DATABASE_URL
  });
});

// =================== TRATAMENTO DE ERROS GLOBAL ===================
process.on('uncaughtException', (error) => {
  log(`❌ ERRO CRÍTICO (uncaughtException): ${error.message}`, 'error');
  log(`Stack: ${error.stack}`, 'error');
  // Não encerrar o processo, apenas logar o erro
});

process.on('unhandledRejection', (reason, promise) => {
  log(`❌ PROMISE REJECTION: ${reason}`, 'error');
  log(`Promise: ${promise}`, 'error');
  // Não encerrar o processo, apenas logar o erro
});

// =================== CONFIGURAÇÕES DE TIMEOUT ===================
const TIMEOUT_MS = 30000; // 30 segundos

// Carregar variáveis do .env em desenvolvimento
if (process.env.NODE_ENV !== 'production') {
  import('dotenv/config');
}

// =================== INICIALIZAÇÃO CONDICIONAL DOS BOTS ===================
(async () => {
  // Registrar rotas diretamente
  await registerRoutes(app);
  
  // Criar servidor HTTP com configurações robustas
  const server = createServer(app);
  
  // Configurar timeouts para evitar travamentos
  server.timeout = TIMEOUT_MS;
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;

  // Inicializar bots apenas se as variáveis estiverem configuradas
  try {
    // Inicializar bot do WhatsApp (sempre tenta)
    log('🤖 Inicializando bot do WhatsApp...');
    const whatsappBot = getWhatsAppBot();
    await whatsappBot.initialize();
    log('✅ Bot do WhatsApp inicializado com sucesso!');
  } catch (error) {
    log(`❌ Erro ao inicializar bot do WhatsApp: ${error}`, 'error');
  }

  try {
    // Inicializar bot do Telegram apenas se o token estiver configurado
    if (process.env.TELEGRAM_BOT_TOKEN) {
      log('🤖 Inicializando bot do Telegram...');
      await startDirectBot();
      log('✅ Bot do Telegram inicializado com sucesso!');
    } else {
      log('⚠️ TELEGRAM_BOT_TOKEN não configurado - bot do Telegram desabilitado');
    }
  } catch (error) {
    log(`❌ Erro ao inicializar bot do Telegram: ${error}`, 'error');
  }

  // Iniciar servidor
  const port = process.env.PORT || 8080;
  server.listen(port, () => {
    log(`🚀 Servidor iniciado na porta ${port}`);
    log(`📊 Health check: http://localhost:${port}/health`);
    log(`🌐 Ambiente: ${process.env.NODE_ENV || 'development'}`);
    
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      log('⚠️ Para ativar o bot do Telegram, configure TELEGRAM_BOT_TOKEN');
    }
    if (!process.env.DATABASE_URL) {
      log('⚠️ Para funcionalidades completas, configure DATABASE_URL');
    }
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    log('🛑 Recebido SIGTERM, encerrando servidor...');
    server.close(() => {
      log('✅ Servidor encerrado com sucesso');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    log('🛑 Recebido SIGINT, encerrando servidor...');
    server.close(() => {
      log('✅ Servidor encerrado com sucesso');
      process.exit(0);
    });
  });

})();

function log(message: string, tag?: string) {
  const timestamp = new Date().toISOString();
  const logMessage = tag ? `[${timestamp}] [${tag}] ${message}` : `[${timestamp}] ${message}`;
  console.log(logMessage);
}