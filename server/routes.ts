import type { Express } from "express";
import { createServer, type Server } from "http";

let whatsappStatus = {
  status: 'Desconectado',
  timestamp: new Date().toISOString(),
  qrCode: null
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Rota básica de saúde da aplicação
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // WhatsApp status endpoint
  app.get("/api/whatsapp/status", (req, res) => {
    res.json(whatsappStatus);
  });

  // WhatsApp send message endpoint
  app.post("/api/whatsapp/send", async (req, res) => {
    try {
      const { number, message } = req.body;
      
      if (!number || !message) {
        return res.status(400).json({
          success: false,
          error: "Número e mensagem são obrigatórios"
        });
      }

      // Forward to WhatsApp bot running on port 3000
      const response = await fetch('http://localhost:3000/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number, message })
      });

      const result = await response.json();
      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: "Erro ao conectar com WhatsApp bot"
      });
    }
  });

  // Bot dashboard status
  app.get("/api/bots/status", (req, res) => {
    res.json({
      telegram: {
        status: 'conectado',
        lastUpdate: new Date().toISOString()
      },
      whatsapp: whatsappStatus
    });
  });

  const server = createServer(app);
  return server;
}