import type { Express } from "express";
import { createServer, type Server } from "http";

export async function registerRoutes(app: Express): Promise<Server> {
  // Rota básica de saúde da aplicação
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Bot dashboard status
  app.get("/api/bots/status", (req, res) => {
    res.json({
      telegram: {
        status: 'conectado',
        lastUpdate: new Date().toISOString()
      },
      whatsapp: {
        status: 'Em desenvolvimento',
        lastUpdate: new Date().toISOString()
      }
    });
  });

  // Início do servidor HTTP
  const server = createServer(app);
  return server;
}