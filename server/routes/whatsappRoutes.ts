/**
 * Rotas API para WhatsApp Bot
 */
import express from 'express';
import { getWhatsAppBot, initializeWhatsAppBot, destroyWhatsAppBot } from '../whatsapp/whatsappBot';

const router = express.Router();

// Status do WhatsApp Bot
router.get('/status', async (req, res) => {
  try {
    const bot = getWhatsAppBot();
    const status = bot.getStatus();
    
    res.json({
      success: true,
      connected: status.isConnected,
      ready: status.isReady,
      qrCode: status.qrCode,
      qrCodeImage: status.qrCodeImage
    });
  } catch (error) {
    res.json({
      success: false,
      connected: false,
      ready: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// Inicializar WhatsApp Bot
router.post('/initialize', async (req, res) => {
  try {
    await initializeWhatsAppBot();
    res.json({
      success: true,
      message: 'WhatsApp Bot inicializado com sucesso'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao inicializar bot'
    });
  }
});

// Parar WhatsApp Bot
router.post('/destroy', async (req, res) => {
  try {
    await destroyWhatsAppBot();
    res.json({
      success: true,
      message: 'WhatsApp Bot desconectado com sucesso'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao desconectar bot'
    });
  }
});

// Enviar mensagem
router.post('/send', async (req, res) => {
  try {
    const { number, message } = req.body;
    
    if (!number || !message) {
      return res.status(400).json({
        success: false,
        error: 'Número e mensagem são obrigatórios'
      });
    }

    // Formatar número (adicionar @c.us se não tiver)
    const formattedNumber = number.includes('@c.us') ? number : `${number}@c.us`;
    
    const bot = getWhatsAppBot();
    const success = await bot.sendMessage(formattedNumber, message);
    
    if (success) {
      res.json({
        success: true,
        message: 'Mensagem enviada com sucesso'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Falha ao enviar mensagem'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao enviar mensagem'
    });
  }
});

// Endpoint para receber QR code via SSE (Server-Sent Events)
router.get('/qr-stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const bot = getWhatsAppBot();
  
  // Callback para QR code
  const qrCallback = (qr: string) => {
    res.write(`data: ${JSON.stringify({ type: 'qr', qr })}\n\n`);
  };

  // Callback para mudanças de status
  const statusCallback = (status: any) => {
    res.write(`data: ${JSON.stringify({ type: 'status', status })}\n\n`);
  };

  // Registrar callbacks
  bot.onQRCode(qrCallback);
  bot.onStatusChange(statusCallback);

  // Enviar status inicial
  res.write(`data: ${JSON.stringify({ type: 'status', status: bot.getStatus() })}\n\n`);

  // Cleanup quando cliente desconectar
  req.on('close', () => {
    bot.removeQRCodeCallback(qrCallback);
    bot.removeStatusCallback(statusCallback);
  });
});

export default router;