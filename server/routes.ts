import type { Express } from "express";
import { createServer, type Server } from "http";

// WhatsApp integration
import QRCode from 'qrcode';

interface WhatsAppMessage {
  id: string;
  from?: string;
  to?: string;
  message: string;
  timestamp: string;
  direction: 'sent' | 'received';
}

let whatsappConnected = false;
let whatsappQRCode: string | null = null;
let whatsappMessages: WhatsAppMessage[] = [];

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

  // Início do servidor HTTP
  const server = createServer(app);
  return server;
}