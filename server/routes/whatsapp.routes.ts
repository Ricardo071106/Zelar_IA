import { Router, Request, Response } from 'express';
import { z } from 'zod';
import qrcode from 'qrcode';
import { asyncHandler, NotFoundError, ValidationError } from '../middleware/errorHandler';
import { validateRequest } from '../middleware/validateRequest';
import { getWhatsAppBot } from '../whatsapp/whatsappBot';

const router = Router();

/**
 * Schema de validação para envio de mensagem
 */
const sendMessageSchema = z.object({
  body: z.object({
    to: z.string().min(10, 'Número de telefone inválido'),
    message: z.string().min(1, 'Mensagem não pode estar vazia'),
  }),
});

/**
 * GET /api/whatsapp/qr
 * Obter QR code para autenticação do WhatsApp
 */
router.get('/qr', asyncHandler(async (req: Request, res: Response) => {
  const whatsappBot = getWhatsAppBot();
  
  if (!whatsappBot) {
    throw new NotFoundError('Bot do WhatsApp');
  }

  const status = whatsappBot.getStatus();

  // Já conectado
  if (status.isConnected) {
    return res.json({
      success: true,
      data: {
        status: 'connected',
        message: 'WhatsApp já está conectado',
        clientInfo: status.clientInfo,
      },
    });
  }

  // QR code disponível
  if (status.qrCode) {
    const qrImage = await qrcode.toDataURL(status.qrCode);
    
    return res.json({
      success: true,
      data: {
        status: 'qr_ready',
        message: 'Escaneie o QR code com seu WhatsApp',
        qrCode: status.qrCode,
        qrImage: qrImage,
      },
    });
  }

  // Aguardando QR code
  return res.json({
    success: true,
    data: {
      status: 'waiting',
      message: 'Aguardando QR code... Tente novamente em alguns segundos',
    },
  });
}));

/**
 * GET /api/whatsapp/status
 * Obter status da conexão do WhatsApp
 */
router.get('/status', asyncHandler(async (req: Request, res: Response) => {
  const whatsappBot = getWhatsAppBot();
  
  if (!whatsappBot) {
    throw new NotFoundError('Bot do WhatsApp');
  }

  const status = whatsappBot.getStatus();

  res.json({
    success: true,
    data: {
      isConnected: status.isConnected,
      hasQrCode: !!status.qrCode,
      clientInfo: status.clientInfo,
      timestamp: new Date().toISOString(),
    },
  });
}));

/**
 * POST /api/whatsapp/send
 * Enviar mensagem via WhatsApp
 */
router.post(
  '/send',
  validateRequest(sendMessageSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { to, message } = req.body;

    const whatsappBot = getWhatsAppBot();
    
    if (!whatsappBot) {
      throw new NotFoundError('Bot do WhatsApp');
    }

    const status = whatsappBot.getStatus();
    
    if (!status.isConnected) {
      throw new ValidationError('WhatsApp não está conectado', {
        hasQrCode: !!status.qrCode,
      });
    }

    const success = await whatsappBot.sendMessage(to, message);

    if (!success) {
      throw new Error('Falha ao enviar mensagem');
    }

    res.json({
      success: true,
      data: {
        message: 'Mensagem enviada com sucesso',
        to,
        sentAt: new Date().toISOString(),
      },
    });
  })
);

export default router;
