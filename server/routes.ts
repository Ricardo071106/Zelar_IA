import type { Express } from "express";
import { createServer, type Server } from "http";

// WhatsApp integrations
import { whatsappBusiness } from './whatsapp/businessAPI';

interface WhatsAppMessage {
  id: string;
  from?: string;
  to?: string;
  message: string;
  timestamp: string;
  direction: 'sent' | 'received';
}

let whatsappBusinessConnected = false;
let whatsappBusinessConfigured = false;
let whatsappMessages: WhatsAppMessage[] = [];
let messageCount = 0;

export async function registerRoutes(app: Express): Promise<Server> {
  // WhatsApp API endpoints
  app.get('/api/whatsapp/status', (req, res) => {
    res.json({
      connected: whatsappConnected,
      hasQR: !!whatsappQRCode,
      messageCount: whatsappMessages.length,
      timestamp: new Date().toISOString()
    });
  });

  app.post('/api/whatsapp/generate-qr', async (req, res) => {
    try {
      const qrData = `whatsapp_connection_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      whatsappQRCode = await QRCode.toDataURL(qrData, {
        width: 300,
        margin: 2,
        color: { dark: '#000000', light: '#FFFFFF' }
      });
      
      console.log('QR Code gerado para WhatsApp');
      res.json({ success: true, qrCode: whatsappQRCode });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao gerar QR Code' });
    }
  });

  app.post('/api/whatsapp/connect', (req, res) => {
    whatsappConnected = true;
    whatsappQRCode = null;
    console.log('WhatsApp conectado com sucesso');
    
    // Simular mensagem inicial
    setTimeout(() => {
      whatsappMessages.push({
        id: Date.now().toString(),
        from: '5511987654321',
        message: 'Olá! Como posso agendar um compromisso?',
        timestamp: new Date().toISOString(),
        direction: 'received'
      });
      
      // Auto-resposta
      setTimeout(() => {
        whatsappMessages.push({
          id: (Date.now() + 1).toString(),
          to: '5511987654321',
          message: 'Olá, aqui é o Zelar! Para agendar compromissos, use nosso bot do Telegram.',
          timestamp: new Date().toISOString(),
          direction: 'sent'
        });
      }, 2000);
    }, 3000);
    
    res.json({ success: true, connected: true });
  });

  app.post('/api/whatsapp/send', (req, res) => {
    const { number, message } = req.body;
    
    if (!whatsappConnected) {
      return res.status(503).json({ error: 'WhatsApp não conectado' });
    }
    
    const messageData: WhatsAppMessage = {
      id: Date.now().toString(),
      to: number,
      message: message,
      timestamp: new Date().toISOString(),
      direction: 'sent'
    };
    
    whatsappMessages.push(messageData);
    console.log(`Mensagem WhatsApp enviada para ${number}: ${message}`);
    
    res.json({ success: true, messageId: messageData.id });
  });

  app.get('/api/whatsapp/messages', (req, res) => {
    const limit = parseInt(req.query.limit as string) || 20;
    res.json({
      messages: whatsappMessages.slice(-limit),
      total: whatsappMessages.length
    });
  });

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

  // WhatsApp Business API endpoints
  app.get('/api/whatsapp-business/status', (_req, res) => {
    res.json({
      connected: whatsappBusinessConnected,
      configured: whatsappBusinessConfigured,
      messageCount: messageCount,
      phoneNumber: whatsappBusiness.isConfigured() ? 'Configurado' : undefined,
      timestamp: new Date().toISOString()
    });
  });

  app.post('/api/whatsapp-business/configure', (req, res) => {
    try {
      const { phoneNumber, accessToken, phoneNumberId, businessAccountId } = req.body;
      
      if (!phoneNumber || !accessToken || !phoneNumberId) {
        return res.status(400).json({ 
          success: false, 
          error: 'Campos obrigatórios: phoneNumber, accessToken, phoneNumberId' 
        });
      }

      whatsappBusiness.setCredentials({
        phoneNumber,
        accessToken,
        phoneNumberId,
        businessAccountId
      });

      whatsappBusinessConfigured = whatsappBusiness.isConfigured();
      
      console.log('WhatsApp Business API configurada');
      res.json({ success: true, configured: whatsappBusinessConfigured });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Erro ao configurar WhatsApp Business' });
    }
  });

  app.post('/api/whatsapp-business/test', async (_req, res) => {
    try {
      const result = await whatsappBusiness.getPhoneNumberInfo();
      
      if (result.success) {
        whatsappBusinessConnected = true;
        console.log('WhatsApp Business API testada com sucesso');
        res.json({ success: true, data: result.data });
      } else {
        whatsappBusinessConnected = false;
        res.status(400).json({ success: false, error: result.error });
      }
    } catch (error) {
      res.status(500).json({ success: false, error: 'Erro ao testar conexão' });
    }
  });

  app.post('/api/whatsapp-business/send-test', async (req, res) => {
    try {
      const { to, message } = req.body;
      
      if (!to || !message) {
        return res.status(400).json({ 
          success: false, 
          error: 'Campos obrigatórios: to, message' 
        });
      }

      const result = await whatsappBusiness.sendTextMessage(to, message);
      
      if (result.success) {
        messageCount++;
        
        const messageData: WhatsAppMessage = {
          id: result.messageId || Date.now().toString(),
          to: to,
          message: message,
          timestamp: new Date().toISOString(),
          direction: 'sent'
        };
        
        whatsappMessages.push(messageData);
        
        console.log(`Mensagem enviada via WhatsApp Business para ${to}`);
        res.json({ success: true, messageId: result.messageId });
      } else {
        res.status(400).json({ success: false, error: result.error });
      }
    } catch (error) {
      res.status(500).json({ success: false, error: 'Erro ao enviar mensagem' });
    }
  });

  // ZAPI WhatsApp endpoints
  app.get('/api/zapi/status', async (_req, res) => {
    const instanceId = process.env.ZAPI_INSTANCE_ID || '';
    const token = process.env.ZAPI_TOKEN || '';
    const configured = !!(instanceId && token);
    
    if (!configured) {
      return res.json({
        connected: false,
        configured: false,
        messageCount: messageCount,
        timestamp: new Date().toISOString()
      });
    }

    try {
      const url = `https://api.z-api.io/instances/${instanceId}/token/${token}/status`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Client-Token': token
        }
      });
      const data = await response.json();

      res.json({
        connected: data.connected || false,
        configured: true,
        instanceId: instanceId,
        messageCount: messageCount,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.json({
        connected: false,
        configured: true,
        instanceId: instanceId,
        messageCount: messageCount,
        timestamp: new Date().toISOString()
      });
    }
  });

  app.post('/api/zapi/connect', async (_req, res) => {
    const instanceId = process.env.ZAPI_INSTANCE_ID || '';
    const token = process.env.ZAPI_TOKEN || '';
    
    if (!instanceId || !token) {
      return res.status(400).json({
        success: false,
        error: 'Credenciais ZAPI não configuradas'
      });
    }

    try {
      const url = `https://api.z-api.io/instances/${instanceId}/token/${token}/qr-code`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Client-Token': token,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();

      if (response.ok) {
        console.log('QR code ZAPI gerado');
        res.json({
          success: true,
          qrCode: data.qrcode || data.qr_code
        });
      } else {
        res.status(400).json({
          success: false,
          error: data.error || 'Erro ao obter QR code'
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Erro ao conectar via ZAPI'
      });
    }
  });

  app.post('/api/zapi/send-test', async (req, res) => {
    const instanceId = process.env.ZAPI_INSTANCE_ID || '';
    const token = process.env.ZAPI_TOKEN || '';
    const { phone, message } = req.body;
    
    if (!phone || !message) {
      return res.status(400).json({
        success: false,
        error: 'Campos obrigatórios: phone, message'
      });
    }

    if (!instanceId || !token) {
      return res.status(400).json({
        success: false,
        error: 'Credenciais ZAPI não configuradas'
      });
    }

    try {
      const url = `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`;
      const cleanPhone = phone.replace(/\D/g, '');
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': token
        },
        body: JSON.stringify({
          phone: cleanPhone,
          message: message
        })
      });

      const data = await response.json();

      if (response.ok && !data.error) {
        messageCount++;
        
        const messageData: WhatsAppMessage = {
          id: data.messageId || data.id || Date.now().toString(),
          to: phone,
          message: message,
          timestamp: new Date().toISOString(),
          direction: 'sent'
        };
        
        whatsappMessages.push(messageData);
        
        console.log(`Mensagem enviada via ZAPI para ${phone}`);
        res.json({
          success: true,
          messageId: data.messageId || data.id
        });
      } else {
        res.status(400).json({
          success: false,
          error: data.error || data.message || 'Erro ao enviar mensagem'
        });
      }
    } catch (error) {
      console.error('Erro no envio ZAPI:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao enviar mensagem via ZAPI'
      });
    }
  });

  app.post('/api/zapi/restart', async (_req, res) => {
    const instanceId = process.env.ZAPI_INSTANCE_ID || '';
    const token = process.env.ZAPI_TOKEN || '';
    
    if (!instanceId || !token) {
      return res.status(400).json({
        success: false,
        error: 'Credenciais ZAPI não configuradas'
      });
    }

    try {
      const url = `https://api.z-api.io/instances/${instanceId}/token/${token}/restart`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Client-Token': token
        }
      });
      const data = await response.json();

      if (response.ok) {
        console.log('Instância ZAPI reiniciada');
        res.json({ success: true });
      } else {
        res.status(400).json({
          success: false,
          error: data.error || 'Erro ao reiniciar instância'
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Erro ao reiniciar instância ZAPI'
      });
    }
  });

  // WhatsApp Info endpoint
  app.get('/api/whatsapp/info', async (_req, res) => {
    const instanceId = process.env.ZAPI_INSTANCE_ID || '';
    const token = process.env.ZAPI_TOKEN || '';
    
    if (!instanceId || !token) {
      return res.json({
        phoneNumber: '',
        connected: false
      });
    }

    try {
      const url = `https://api.z-api.io/instances/${instanceId}/token/${token}/status`;
      const response = await fetch(url);
      const data = await response.json();

      // Obter número do WhatsApp da instância
      const infoUrl = `https://api.z-api.io/instances/${instanceId}/token/${token}/me`;
      const infoResponse = await fetch(infoUrl);
      const infoData = await infoResponse.json();

      res.json({
        phoneNumber: infoData.phone || '5511999887766', // número demo funcional
        connected: data.connected || false
      });
    } catch (error) {
      res.json({
        phoneNumber: '5511999887766', // número demo para funcionar mesmo sem ZAPI conectada
        connected: false
      });
    }
  });

  // Configurar webhook da ZAPI
  app.post('/api/zapi/setup-webhook', async (_req, res) => {
    const instanceId = process.env.ZAPI_INSTANCE_ID || '';
    const token = process.env.ZAPI_TOKEN || '';
    
    if (!instanceId || !token) {
      return res.status(400).json({
        success: false,
        error: 'Credenciais ZAPI não configuradas'
      });
    }

    try {
      const webhookUrl = `https://${process.env.REPLIT_DEV_DOMAIN || 'localhost:5000'}/api/zapi/webhook`;
      
      const url = `https://api.z-api.io/instances/${instanceId}/token/${token}/webhook`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Client-Token': token
        },
        body: JSON.stringify({
          url: webhookUrl,
          enabled: true,
          webhookByEvents: false
        })
      });

      const data = await response.json();

      if (response.ok) {
        console.log(`🔗 Webhook configurado: ${webhookUrl}`);
        res.json({
          success: true,
          webhookUrl: webhookUrl
        });
      } else {
        res.status(400).json({
          success: false,
          error: data.error || 'Erro ao configurar webhook'
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Erro ao configurar webhook ZAPI'
      });
    }
  });

  // Webhook ZAPI para receber mensagens e responder automaticamente
  app.post('/api/zapi/webhook', async (req, res) => {
    try {
      console.log('📱 Webhook ZAPI recebido:', JSON.stringify(req.body, null, 2));
      
      const { phone, message, senderName, messageType } = req.body;
      
      // Só processar mensagens de texto
      if (messageType !== 'textMessage' || !message || !phone) {
        return res.status(200).json({ success: true });
      }

      const instanceId = process.env.ZAPI_INSTANCE_ID || '';
      const token = process.env.ZAPI_TOKEN || '';
      
      if (!instanceId || !token) {
        return res.status(200).json({ success: true });
      }

      // Usar a mesma lógica do bot Telegram
      const { parseEventWithClaude } = await import('./utils/claudeParser');
      const { DateTime } = await import('luxon');
      
      const userTimezone = 'America/Sao_Paulo';
      const claudeResult = await parseEventWithClaude(message.body || message, userTimezone);
      
      let responseMessage = '';
      
      if (claudeResult.isValid) {
        // Criar evento usando Claude
        const eventDate = DateTime.fromObject({
          year: parseInt(claudeResult.date.split('-')[0]),
          month: parseInt(claudeResult.date.split('-')[1]),
          day: parseInt(claudeResult.date.split('-')[2]),
          hour: claudeResult.hour,
          minute: claudeResult.minute
        }, { zone: userTimezone });
        
        const displayDate = eventDate.toFormat('EEEE, dd \'de\' MMMM \'às\' HH:mm', { locale: 'pt-BR' });
        
        // Gerar links para calendário
        const startUTC = eventDate.toUTC();
        const endUTC = startUTC.plus({ hours: 1 });
        const startFormatted = startUTC.toFormat('yyyyMMdd\'T\'HHmmss\'Z\'');
        const endFormatted = endUTC.toFormat('yyyyMMdd\'T\'HHmmss\'Z\'');
        const googleLink = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(claudeResult.title)}&dates=${startFormatted}/${endFormatted}`;
        
        responseMessage = `✅ *Evento agendado!*\n\n` +
          `📝 *Título:* ${claudeResult.title}\n` +
          `📅 *Data/Hora:* ${displayDate}\n\n` +
          `🔗 *Adicionar ao Google Calendar:*\n${googleLink}\n\n` +
          `🤖 _Zelar - Seu assistente inteligente_`;
      } else {
        responseMessage = `❌ *Não consegui entender sua solicitação*\n\n` +
          `📝 *Você disse:* "${message.body || message}"\n\n` +
          `💡 *Tente algo como:*\n` +
          `• "jantar hoje às 19h"\n` +
          `• "reunião sexta às 15h30"\n` +
          `• "consulta terça que vem às 9h"\n\n` +
          `🤖 _Zelar - Seu assistente inteligente_`;
      }
      
      // Enviar resposta via ZAPI
      const sendUrl = `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`;
      await fetch(sendUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Client-Token': token
        },
        body: JSON.stringify({
          phone: phone,
          message: responseMessage
        })
      });
      
      console.log(`📤 Resposta enviada para ${phone}: ${claudeResult.isValid ? 'Evento criado' : 'Não entendeu'}`);
      
      res.status(200).json({ success: true });
    } catch (error) {
      console.error('❌ Erro no webhook ZAPI:', error);
      res.status(200).json({ success: true });
    }
  });

  // Início do servidor HTTP
  const server = createServer(app);
  return server;
}