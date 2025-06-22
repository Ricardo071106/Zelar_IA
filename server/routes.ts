import type { Express } from "express";
import { createServer, type Server } from "http";
import { 
  setupEvolutionAPI, 
  createInstance, 
  connectInstance, 
  checkInstanceStatus, 
  setupWebhook, 
  sendMessage,
  processWebhookMessage,
  isConfigured,
  getConfig
} from "./whatsapp/evolutionAPI";

export async function registerRoutes(app: Express): Promise<Server> {
  // Rota básica de saúde da aplicação
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // ===== EVOLUTION API ROUTES =====

  // Configurar Evolution API
  app.post('/api/evolution/setup', async (req, res) => {
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
          message: 'Evolution API configurada com sucesso' 
        });
      } else {
        res.status(500).json({ 
          error: 'Falha ao configurar Evolution API' 
        });
      }
    } catch (error) {
      console.error('Erro ao configurar Evolution API:', error);
      res.status(500).json({ 
        error: 'Erro interno ao configurar Evolution API' 
      });
    }
  });

  // Verificar configuração
  app.get('/api/evolution/config', (req, res) => {
    const config = getConfig();
    if (config) {
      res.json({ 
        configured: true, 
        baseUrl: config.baseUrl, 
        instanceName: config.instanceName 
      });
    } else {
      res.json({ configured: false });
    }
  });

  // Criar instância
  app.post('/api/evolution/create', async (req, res) => {
    try {
      const result = await createInstance();
      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error('Erro ao criar instância:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Erro interno ao criar instância' 
      });
    }
  });

  // Conectar e gerar QR Code
  app.post('/api/evolution/connect', async (req, res) => {
    try {
      const result = await connectInstance();
      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error('Erro ao conectar instância:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Erro interno ao conectar instância' 
      });
    }
  });

  // Verificar status da instância
  app.get('/api/evolution/status', async (req, res) => {
    try {
      const result = await checkInstanceStatus();
      res.json(result);
    } catch (error) {
      console.error('Erro ao verificar status:', error);
      res.status(500).json({ 
        success: false, 
        connected: false,
        message: 'Erro interno ao verificar status' 
      });
    }
  });

  // Configurar webhook
  app.post('/api/evolution/webhook', async (req, res) => {
    try {
      const { webhookUrl } = req.body;
      
      if (!webhookUrl) {
        return res.status(400).json({ 
          error: 'URL do webhook é obrigatória' 
        });
      }
      
      const result = await setupWebhook(webhookUrl);
      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error('Erro ao configurar webhook:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Erro interno ao configurar webhook' 
      });
    }
  });

  // Enviar mensagem
  app.post('/api/evolution/send', async (req, res) => {
    try {
      const { phone, message } = req.body;
      
      if (!phone || !message) {
        return res.status(400).json({ 
          error: 'Telefone e mensagem são obrigatórios' 
        });
      }
      
      const result = await sendMessage(phone, message);
      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Erro interno ao enviar mensagem' 
      });
    }
  });

  // Webhook para receber mensagens
  app.post('/api/evolution/webhook-receive', async (req, res) => {
    try {
      await processWebhookMessage(req.body);
      res.status(200).json({ received: true });
    } catch (error) {
      console.error('Erro no webhook:', error);
      res.status(500).json({ error: 'Erro ao processar webhook' });
    }
  });

  const server = createServer(app);
  return server;
}