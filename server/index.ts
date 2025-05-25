import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initializeTelegramBot } from "./telegram";
import { startCalendarSolution } from "./calendar_solution";

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
    
    // Inicializa o bot final do Telegram - 100% gratuito sem dependências externas
    try {
      // Iniciar bot final
      const { startFinalBot } = await import('./telegram/finalBot');
      const finalBotInitialized = await startFinalBot();
      
      if (finalBotInitialized) {
        log('Bot final iniciado com sucesso! 100% gratuito e sem dependências externas.', 'telegram');
      } else {
        log('Erro ao iniciar bot final, tentando soluções alternativas...', 'telegram');
        
        // Tentativa alternativa 1: Bot com solução universal para calendário
        const calendarSolutionInitialized = await startCalendarSolution();
        if (calendarSolutionInitialized) {
          log('Bot com solução universal para calendário iniciado como alternativa!', 'telegram');
        } else {
          log('Tentando bot tradicional como último recurso...', 'telegram');
          
          // Tentativa alternativa 2: Bot tradicional
          const botInitialized = await initializeTelegramBot();
          if (botInitialized) {
            log('Bot do Telegram tradicional iniciado como último recurso!', 'telegram');
          } else {
            log('Não foi possível iniciar nenhuma versão do bot.', 'telegram');
          }
        }
      }
    } catch (error) {
      log(`Erro ao iniciar o bot do Telegram: ${error}`, 'telegram');
    }
  });
})();
