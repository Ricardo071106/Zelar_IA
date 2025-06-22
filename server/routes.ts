import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupEvolutionAPI, processWhatsAppMessage, setupWhatsAppWebhook, checkInstanceStatus, createInstance, connectInstance, listInstances, deleteInstance } from "./whatsapp/evolutionBot";
import { setupZAPI, processZAPIMessage, checkZAPIStatus, connectZAPI } from "./whatsapp/zapiBot";

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

  // Criar nova instância WhatsApp
  app.post('/api/whatsapp/create-instance', async (req, res) => {
    try {
      const { instanceName, phone } = req.body;
      
      if (!instanceName) {
        return res.status(400).json({ 
          error: 'Nome da instância é obrigatório' 
        });
      }
      
      const result = await createInstance(instanceName, phone);
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(500).json(result);
      }
    } catch (error) {
      res.status(500).json({ 
        error: 'Erro interno ao criar instância' 
      });
    }
  });

  // Conectar instância (gerar QR Code)
  app.post('/api/whatsapp/connect', async (req, res) => {
    try {
      const result = await connectInstance();
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(500).json(result);
      }
    } catch (error) {
      res.status(500).json({ 
        error: 'Erro interno ao conectar instância' 
      });
    }
  });

  // Listar todas as instâncias
  app.get('/api/whatsapp/instances', async (req, res) => {
    try {
      const result = await listInstances();
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(500).json(result);
      }
    } catch (error) {
      res.status(500).json({ 
        error: 'Erro interno ao listar instâncias' 
      });
    }
  });

  // Deletar instância
  app.delete('/api/whatsapp/instances/:instanceName', async (req, res) => {
    try {
      const { instanceName } = req.params;
      
      if (!instanceName) {
        return res.status(400).json({ 
          error: 'Nome da instância é obrigatório' 
        });
      }
      
      const result = await deleteInstance(instanceName);
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(500).json(result);
      }
    } catch (error) {
      res.status(500).json({ 
        error: 'Erro interno ao deletar instância' 
      });
    }
  });

  // ===== ROTAS Z-API (MAIS SIMPLES) =====
  
  // Configurar Z-API
  app.post('/api/zapi/setup', async (req, res) => {
    try {
      const { instanceId, token, phone } = req.body;
      
      if (!instanceId || !token || !phone) {
        return res.status(400).json({ 
          error: 'Parâmetros obrigatórios: instanceId, token, phone' 
        });
      }
      
      // Usar nova implementação
      const { setupSimpleZAPI, testZAPICredentials } = await import('./whatsapp/simpleZAPI');
      
      const configured = setupSimpleZAPI(instanceId, token, phone);
      
      if (configured) {
        // Testa as credenciais imediatamente
        const test = await testZAPICredentials();
        
        res.json({ 
          success: test.success, 
          message: test.success ? 'Z-API configurado e testado com sucesso' : test.message,
          phone,
          credentialsValid: test.success
        });
      } else {
        res.status(500).json({ 
          error: 'Falha ao configurar Z-API' 
        });
      }
    } catch (error) {
      res.status(500).json({ 
        error: 'Erro interno ao configurar Z-API' 
      });
    }
  });

  // Webhook Z-API (automático via secrets)
  app.post('/api/zapi/webhook', async (req, res) => {
    try {
      // Verifica credenciais diretamente aqui
      const instanceId = process.env.ZAPI_INSTANCE_ID;
      const token = process.env.ZAPI_TOKEN;
      
      console.log('📱 Webhook recebido:', req.body);
      console.log('Credenciais:', { instanceId: !!instanceId, token: !!token });
      
      if (!instanceId || !token) {
        console.log('⚠️ Credenciais Z-API não encontradas');
        res.status(200).json({ received: true, error: 'Credenciais não configuradas' });
        return;
      }
      
      const { processZAPIWebhook } = await import('./whatsapp/autoZAPI');
      await processZAPIWebhook(req.body);
      res.status(200).json({ received: true });
    } catch (error) {
      console.error('Erro no webhook Z-API:', error);
      res.status(500).json({ error: 'Erro ao processar webhook' });
    }
  });

  // Status Z-API (automático via secrets)
  app.get('/api/zapi/status', async (req, res) => {
    try {
      const { checkZAPIConnection } = await import('./whatsapp/autoZAPI');
      const status = await checkZAPIConnection();
      res.json(status);
    } catch (error) {
      res.status(500).json({ 
        error: 'Erro ao verificar status',
        connected: false 
      });
    }
  });

  // Conectar Z-API (automático via secrets)
  app.post('/api/zapi/connect', async (req, res) => {
    try {
      const { generateZAPIQRCode } = await import('./whatsapp/autoZAPI');
      const result = await generateZAPIQRCode();
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(500).json(result);
      }
    } catch (error) {
      res.status(500).json({ 
        error: 'Erro interno ao conectar Z-API' 
      });
    }
  });

  const server = createServer(app);
  return server;
}