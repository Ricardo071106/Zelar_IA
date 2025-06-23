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

  // WhatsApp personal send message endpoint
  app.post("/api/whatsapp/send", async (req, res) => {
    try {
      const { number, message } = req.body;
      
      if (!number || !message) {
        return res.status(400).json({
          success: false,
          error: "Número e mensagem são obrigatórios"
        });
      }

      // Forward to WhatsApp personal bot running on port 3000
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
        error: "Erro ao conectar com WhatsApp pessoal"
      });
    }
  });

  // WhatsApp Business status endpoint
  app.get("/api/whatsapp-business/status", async (req, res) => {
    try {
      const response = await fetch('http://localhost:3001/status');
      const data = await response.json();
      res.json(data);
    } catch (error) {
      res.json({
        status: 'Desconectado',
        timestamp: new Date().toISOString(),
        qrCode: null,
        business: true
      });
    }
  });

  // WhatsApp Business send message endpoint
  app.post("/api/whatsapp-business/send", async (req, res) => {
    try {
      const { number, message } = req.body;
      
      if (!number || !message) {
        return res.status(400).json({
          success: false,
          error: "Número e mensagem são obrigatórios"
        });
      }

      // Forward to WhatsApp Business bot running on port 3001
      const response = await fetch('http://localhost:3001/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number, message })
      });

      const result = await response.json();
      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: "Erro ao conectar com WhatsApp Business"
      });
    }
  });

  // WhatsApp Business info endpoint
  app.get("/api/whatsapp-business/info", async (req, res) => {
    try {
      const response = await fetch('http://localhost:3001/business-info');
      const data = await response.json();
      res.json(data);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: "Erro ao obter informações Business"
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