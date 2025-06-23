import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { startZelarBot } from "./telegram/zelar_bot";
import { spawn } from "child_process";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
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

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, async () => {
    log(`serving on port ${port}`);
    
    // Inicializar bot Telegram Zelar
    try {
      await startZelarBot();
      log('✅ Bot Telegram Zelar ativado com sucesso!', 'telegram');
    } catch (error) {
      log('⚠️ Bot temporariamente indisponível - site funcionando perfeitamente!', 'telegram');
    }

    // Inicializar WhatsApp Bots
    let whatsappBot: any = null;
    let whatsappBusinessBot: any = null;

    try {
      log('📱 Iniciando WhatsApp Personal Bot...', 'whatsapp');
      whatsappBot = spawn('node', ['whatsapp-bot.js'], {
        stdio: 'pipe',
        cwd: process.cwd()
      });

      whatsappBot.stdout?.on('data', (data: any) => {
        log(`[WhatsApp Personal] ${data.toString().trim()}`, "whatsapp");
      });

      whatsappBot.stderr?.on('data', (data: any) => {
        log(`[WhatsApp Personal Error] ${data.toString().trim()}`, "whatsapp");
      });

      whatsappBot.on('error', (error: any) => {
        log(`❌ Erro no WhatsApp Personal: ${error.message}`, "whatsapp");
      });

      whatsappBot.on('close', (code: any) => {
        log(`📴 WhatsApp Personal encerrado com código: ${code}`, "whatsapp");
      });

      log('✅ WhatsApp Personal Bot iniciado!', 'whatsapp');
    } catch (error) {
      log('⚠️ WhatsApp Personal Bot não pôde ser iniciado', 'whatsapp');
    }

    try {
      log('🏢 Iniciando WhatsApp Business Bot...', 'whatsapp-business');
      whatsappBusinessBot = spawn('node', ['whatsapp-business-bot.js'], {
        stdio: 'pipe',
        cwd: process.cwd()
      });

      whatsappBusinessBot.stdout?.on('data', (data: any) => {
        log(`[WhatsApp Business] ${data.toString().trim()}`, "whatsapp-business");
      });

      whatsappBusinessBot.stderr?.on('data', (data: any) => {
        log(`[WhatsApp Business Error] ${data.toString().trim()}`, "whatsapp-business");
      });

      whatsappBusinessBot.on('error', (error: any) => {
        log(`❌ Erro no WhatsApp Business: ${error.message}`, "whatsapp-business");
      });

      whatsappBusinessBot.on('close', (code: any) => {
        log(`📴 WhatsApp Business encerrado com código: ${code}`, "whatsapp-business");
      });

      log('✅ WhatsApp Business Bot iniciado!', 'whatsapp-business');
    } catch (error) {
      log('⚠️ WhatsApp Business Bot não pôde ser iniciado', 'whatsapp-business');
    }

    // Tratar encerramento limpo para ambos os bots
    const cleanupBots = () => {
      log('🛑 Encerrando aplicação...');
      if (whatsappBot) whatsappBot.kill('SIGTERM');
      if (whatsappBusinessBot) whatsappBusinessBot.kill('SIGTERM');
      process.exit(0);
    };

    process.on('SIGINT', cleanupBots);
    process.on('SIGTERM', cleanupBots);
  });
})();
