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
    memory: process.memoryUsage()
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

(async () => {
  // Registrar rotas diretamente
  await registerRoutes(app);
  
  // Criar servidor HTTP com configurações robustas
  const server = createServer(app);
  
  // Configurar timeouts para evitar travamentos
  server.timeout = TIMEOUT_MS;
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;

  // Middleware de tratamento de erros
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    log(`❌ ERRO ${status}: ${message}`, 'error');
    if (err.stack) {
      log(`Stack: ${err.stack}`, 'error');
    }

    res.status(status).json({ message });
    // Não fazer throw do erro para evitar crash do servidor
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    // await setupVite(app, server);
    // Servir arquivos estáticos do frontend em desenvolvimento também
    app.use(express.static(path.join(__dirname, '../dist/public')));

    // Fallback: servir index.html para qualquer rota não-API
    app.get(/^((?!\/api).)*$/, (req, res) => {
      res.sendFile(path.join(__dirname, '../dist/public/index.html'));
    });
  } else {
    // serveStatic(app);
    // Servir arquivos estáticos do frontend
    app.use(express.static(path.join(__dirname, '../dist/public')));

    // Fallback: servir index.html para qualquer rota não-API
    app.get(/^((?!\/api).)*$/, (req, res) => {
      res.sendFile(path.join(__dirname, '../dist/public/index.html'));
    });
  }

  // ALWAYS serve the app on port 9000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = Number(process.env.PORT) || 3000;
  server.listen(port, "0.0.0.0", async () => {
    log(`serving on port ${port}`);
    log(`🌐 Acesse localmente: http://localhost:${port}`);
    log(`📱 Acesse na rede: http://192.168.68.112:${port}`);
    log(`💓 Health check: http://192.168.68.112:${port}/health`);
    
    // Inicializar bot Telegram direto
    try {
      await startDirectBot();
      log('✅ Bot Telegram ativado com sucesso!', 'telegram');
    } catch (error) {
      log('⚠️ Bot temporariamente indisponível', 'telegram');
      log(`Erro: ${error}`, 'telegram');
    }

    // Iniciar WhatsApp bot automaticamente (pode falhar no Replit)
    try {
      const whatsappBot = getWhatsAppBot();
      await whatsappBot.initialize();
      log('✅ WhatsApp bot iniciado com sucesso!', 'whatsapp');
    } catch (error) {
      log('⚠️ WhatsApp bot indisponível no Replit (requer Chrome)', 'whatsapp');
      log('💡 Para usar WhatsApp, execute localmente ou configure servidor próprio', 'whatsapp');
      log(`Erro: ${error}`, 'whatsapp');
    }

    log('🤖 Sistema Zelar funcionando com foco dual-platform', 'system');
    
    // =================== MONITORAMENTO CONTÍNUO ===================
    setInterval(() => {
      const now = Date.now();
      const timeSinceLastRequest = now - lastRequestTime;
      
      // Log a cada 5 minutos
      if (now % 300000 < 1000) {
        log(`📊 Status: ${requestCount} requests, último há ${Math.floor(timeSinceLastRequest/1000)}s`, 'monitor');
      }
      
      // Alertar se não houve requests por mais de 10 minutos
      if (timeSinceLastRequest > 600000) {
        log(`⚠️ Sem requests há ${Math.floor(timeSinceLastRequest/1000)}s`, 'monitor');
      }
    }, 60000); // Verificar a cada minuto
  });
  
  // =================== GRACEFUL SHUTDOWN ===================
  process.on('SIGTERM', () => {
    log('🛑 Recebido SIGTERM, encerrando graciosamente...', 'shutdown');
    server.close(() => {
      log('✅ Servidor encerrado com sucesso', 'shutdown');
      process.exit(0);
    });
  });
  
  process.on('SIGINT', () => {
    log('🛑 Recebido SIGINT, encerrando graciosamente...', 'shutdown');
    server.close(() => {
      log('✅ Servidor encerrado com sucesso', 'shutdown');
      process.exit(0);
    });
  });
})();

// Logger simples substituto
function log(message: string, tag?: string) {
  const timestamp = new Date().toISOString();
  if (tag) {
    console.log(`[${timestamp}] [${tag}] ${message}`);
  } else {
    console.log(`[${timestamp}] ${message}`);
  }
}