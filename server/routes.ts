import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupEvolutionAPI, processWhatsAppMessage, setupWhatsAppWebhook, checkInstanceStatus } from "./whatsapp/evolutionBot";

export async function registerRoutes(app: Express): Promise<Server> {
  // Rota básica de saúde da aplicação
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // ===== ROTAS WHATSAPP EVOLUTION API =====
  
  // Configurar Evolution API
  app.post('/api/whatsapp/setup', (req, res) => {
    try {
      const { baseUrl, instanceName, apiKey } = req.body;
      
      if (!baseUrl || !instanceName || !apiKey) {
        return res.status(400).json({ 
          error: 'Parâmetros obrigatórios: baseUrl, instanceName, apiKey' 
        });
      }
      
      const success = setupEvolutionAPI(baseUrl, instanceName, apiKey);
      
      if (success) {
        res.json({ 
          success: true, 
          message: 'Evolution API configurada com sucesso',
          config: { baseUrl, instanceName }
        });
      } else {
        res.status(500).json({ 
          error: 'Falha ao configurar Evolution API' 
        });
      }
    } catch (error) {
      res.status(500).json({ 
        error: 'Erro interno ao configurar Evolution API' 
      });
    }
  });

  // Webhook para receber mensagens do WhatsApp
  app.post('/api/whatsapp/webhook', async (req, res) => {
    try {
      const { data } = req.body;
      
      if (data && data.messages && data.messages.length > 0) {
        for (const message of data.messages) {
          await processWhatsAppMessage(message);
        }
      }
      
      res.status(200).json({ received: true });
    } catch (error) {
      console.error('Erro no webhook WhatsApp:', error);
      res.status(500).json({ error: 'Erro ao processar webhook' });
    }
  });

  // Configurar webhook no Evolution API
  app.post('/api/whatsapp/configure-webhook', async (req, res) => {
    try {
      const { webhookUrl } = req.body;
      
      if (!webhookUrl) {
        return res.status(400).json({ 
          error: 'URL do webhook é obrigatória' 
        });
      }
      
      const success = await setupWhatsAppWebhook(webhookUrl);
      
      if (success) {
        res.json({ 
          success: true, 
          message: 'Webhook configurado com sucesso',
          webhookUrl 
        });
      } else {
        res.status(500).json({ 
          error: 'Falha ao configurar webhook' 
        });
      }
    } catch (error) {
      res.status(500).json({ 
        error: 'Erro interno ao configurar webhook' 
      });
    }
  });

  // Verificar status da instância WhatsApp
  app.get('/api/whatsapp/status', async (req, res) => {
    try {
      const status = await checkInstanceStatus();
      res.json(status);
    } catch (error) {
      res.status(500).json({ 
        error: 'Erro ao verificar status',
        connected: false 
      });
    }
  });

  const server = createServer(app);
  return server;
}