import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { db } from '../db';
import { getPublicOverviewStats } from '../services/publicStats';

const router = Router();

/**
 * GET /api/system/status
 * Painel interno /system — alinhado ao que o frontend espera (sem Telegram).
 */
router.get(
  '/status',
  asyncHandler(async (_req: Request, res: Response) => {
    const stats = await getPublicOverviewStats();
    const whatsappOn = process.env.ENABLE_WHATSAPP_BOT !== 'false';
    const aiOn = !!(process.env.OPENROUTER_API_KEY || process.env.ANTHROPIC_API_KEY);

    res.json({
      whatsapp: {
        status: whatsappOn ? 'online' : 'offline',
        botLabel: 'WhatsApp (Baileys)',
        messagesProcessed: stats.totals.eventsCreated,
        uptime: '—',
        lastActivity: stats.updatedAt,
      },
      database: {
        status: db ? 'connected' : 'disconnected',
        totalUsers: stats.totals.users,
        totalEvents: stats.totals.eventsCreated,
        uptime: '—',
      },
      ai: {
        status: aiOn ? 'active' : 'inactive',
        provider: process.env.OPENROUTER_API_KEY ? 'OpenRouter' : 'Claude / OpenRouter',
        requestsProcessed: stats.totals.eventsCreated,
        averageResponseTime: '—',
      },
    });
  }),
);

export default router;
