import 'dotenv/config';
import { setDefaultResultOrder } from 'dns';

// Força resolução IPv4
setDefaultResultOrder('ipv4first');

import express, { type Request, Response, NextFunction } from "express";
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { createServer } from "http";
import schedule from "node-schedule";
import { registerRoutes } from "./routes";
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { startDirectBot } from "./telegram/direct_bot";
import { isTelegramBotEnabled } from "./telegram/telegramEnabled";
import { getWhatsAppBot } from "./whatsapp/whatsappBot";
import path from 'path';
import { fileURLToPath } from 'url';
import { reminderService } from './services/reminderService';
import { initDb } from './db';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// =================== SEGURANÇA ===================
app.use(helmet({
  contentSecurityPolicy: false, // Desabilitar para desenvolvimento, habilitar em produção
}));

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
}));

// =================== PERFORMANCE ===================
app.use(compression());

// IMPORTANTE: O webhook do Stripe precisa do corpo cru (raw body) para verificação de assinatura
// Deve vir ANTES do express.json() global
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// =================== MONITORAMENTO E ROBUSTEZ ===================
let requestCount = 0;
let lastRequestTime = Date.now();

// Middleware de monitoramento
app.use((req, res, next) => {
  const start = Date.now();
  const requestPath = req.path; // Renomeado para evitar conflito com import 'path'
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
    if (requestPath.startsWith("/api")) {
      let logLine = `${req.method} ${requestPath} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        const responsePreview = JSON.stringify(capturedJsonResponse);
        // Aumentado limite de 80 para 500 caracteres
        logLine += ` :: ${responsePreview.length > 400 ? responsePreview.slice(0, 400) + '...' : responsePreview}`;
      }

      log(logLine);
    }
  });

  next();
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

function setupDailyRestart(): void {
  const restartRequested = process.env.AUTO_RESTART_AT_MIDNIGHT === 'true';
  const forceEnabled = process.env.AUTO_RESTART_FORCE_ENABLE === 'true';
  const enabled = restartRequested && forceEnabled;

  if (restartRequested && !forceEnabled) {
    log('⏸️ Reinício automático está solicitado, mas desativado por segurança (AUTO_RESTART_FORCE_ENABLE != true).', 'warn');
  }
  if (!enabled) return;

  const timezone = process.env.AUTO_RESTART_TZ || 'America/Sao_Paulo';
  const cron = process.env.AUTO_RESTART_CRON || '0 0 * * *';

  const job = schedule.scheduleJob({ rule: cron, tz: timezone }, () => {
    log(`🔄 Reinício automático acionado (${timezone}, cron: ${cron})`);
    // Pequeno atraso para garantir flush de logs
    setTimeout(() => process.exit(0), 1000);
  });

  if (job) {
    log(`⏱️ Reinício diário habilitado (${timezone}, cron: ${cron})`);
  } else {
    log('⚠️ Falha ao agendar reinício automático', 'warn');
  }
}

// Health check interno rápido (não passa pelas rotas)
app.get('/_health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    requests: requestCount,
  });
});

// =================== INICIALIZAÇÃO DO SERVIDOR ===================
async function startServer() {
  try {
    // Inicializar conexão com banco (forçar IPv4 se necessário)
    await initDb();

    // Registrar rotas
    log('📋 Registrando rotas...');
    await registerRoutes(app);
    log('✅ Rotas registradas com sucesso');

    // Aplicar error handlers (DEVEM SER OS ÚLTIMOS middlewares)
    app.use(notFoundHandler);
    app.use(errorHandler);

    // Criar servidor HTTP com configurações robustas
    const server = createServer(app);

    // Configurar timeouts para evitar travamentos
    server.timeout = TIMEOUT_MS;
    server.keepAliveTimeout = 65000;
    server.headersTimeout = 66000;

    // Inicializar bots apenas se as variáveis estiverem configuradas
    const botsInitialized = await initializeBots();
    try {
      await reminderService.start();
    } catch (error) {
      log(`⚠️ Falha ao iniciar reminder service: ${error}`, 'warn');
    }
    setupDailyRestart();

    // Validar e iniciar servidor
    const port = validatePort(process.env.PORT);

    server.listen(port, () => {
      log('═══════════════════════════════════════════════════════');
      log(`🚀 Servidor iniciado na porta ${port}`);
      log(`📊 Health check: http://localhost:${port}/health`);
      log(`📊 Health interno: http://localhost:${port}/_health`);
      log(`🌐 Ambiente: ${process.env.NODE_ENV || 'development'}`);
      log(`🤖 WhatsApp: ${botsInitialized.whatsapp ? '✅' : '❌'}`);
      log(`🤖 Telegram: ${botsInitialized.telegram ? '✅' : '❌'}`);
      log('═══════════════════════════════════════════════════════');

      if (isTelegramBotEnabled() && !process.env.TELEGRAM_BOT_TOKEN) {
        log('⚠️ TELEGRAM_BOT_ENABLED=true mas TELEGRAM_BOT_TOKEN não está configurado', 'warn');
      }
      if (!isTelegramBotEnabled()) {
        log('ℹ️ Telegram desligado (defina TELEGRAM_BOT_ENABLED=true e o token para ativar)', 'info');
      }
      if (!process.env.DATABASE_URL) {
        log('⚠️ Para funcionalidades completas, configure DATABASE_URL', 'warn');
      }
    });

    // Graceful shutdown
    const shutdownSignals = ['SIGTERM', 'SIGINT'];
    shutdownSignals.forEach(signal => {
      process.on(signal, () => {
        log(`🛑 Recebido ${signal}, encerrando servidor gracefully...`);
        server.close(() => {
          log('✅ Servidor encerrado com sucesso');
          process.exit(0);
        });

        // Forçar encerramento após 10 segundos
        setTimeout(() => {
          log('⚠️ Forçando encerramento após timeout', 'error');
          process.exit(1);
        }, 10000);
      });
    });

  } catch (error) {
    log(`💥 Erro fatal ao iniciar servidor: ${error}`, 'error');
    if (error instanceof Error) {
      log(`Stack: ${error.stack}`, 'error');
    }
    process.exit(1);
  }
}

// =================== FUNÇÕES AUXILIARES ===================

/**
 * Valida e retorna porta válida
 */
function validatePort(portEnv: string | undefined): number {
  const port = parseInt(portEnv || '8080', 10);

  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`Porta inválida: ${portEnv}. Deve ser um número entre 1 e 65535.`);
  }

  return port;
}

/**
 * Inicializa os bots (WhatsApp e Telegram)
 */
async function initializeBots(): Promise<{ whatsapp: boolean; telegram: boolean }> {
  const results = { whatsapp: false, telegram: false };

  // Inicializar bot do WhatsApp
  try {
    log('🤖 Inicializando bot do WhatsApp...');
    const whatsappBot = getWhatsAppBot();
    await whatsappBot.initialize();
    log('✅ Bot do WhatsApp inicializado com sucesso!');
    results.whatsapp = true;
  } catch (error) {
    log(`❌ Erro ao inicializar bot do WhatsApp: ${error}`, 'error');
    if (process.env.REQUIRE_WHATSAPP === 'true') {
      throw error; // Falhar se WhatsApp é obrigatório
    }
  }

  // Telegram: opt-in (TELEGRAM_BOT_ENABLED=true); só token não basta mais
  try {
    if (!isTelegramBotEnabled()) {
      log('ℹ️ Telegram desligado (TELEGRAM_BOT_ENABLED não é true, ou DISABLE_TELEGRAM_BOT=true)', 'info');
    } else if (process.env.TELEGRAM_BOT_TOKEN) {
      log('🤖 Inicializando bot do Telegram...');
      await startDirectBot();
      log('✅ Bot do Telegram inicializado com sucesso!');
      results.telegram = true;
    } else {
      log('⚠️ TELEGRAM_BOT_ENABLED=true mas TELEGRAM_BOT_TOKEN ausente — bot do Telegram não iniciado', 'warn');
    }
  } catch (error) {
    log(`❌ Erro ao inicializar bot do Telegram: ${error}`, 'error');
    if (process.env.REQUIRE_TELEGRAM === 'true') {
      throw error; // Falhar se Telegram é obrigatório
    }
  }

  return results;
}

/**
 * Sistema de logging estruturado
 */
function log(message: string, level: 'info' | 'warn' | 'error' = 'info') {
  const timestamp = new Date().toISOString();
  const emoji = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : 'ℹ️';
  const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

  if (level === 'error') {
    console.error(logMessage);
  } else if (level === 'warn') {
    console.warn(logMessage);
  } else {
    console.log(logMessage);
  }
}

// =================== INICIAR SERVIDOR ===================
startServer();
