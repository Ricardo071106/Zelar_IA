import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { systemHealth } from '../utils/healthCheck';
import { isTelegramBotEnabled } from '../telegram/telegramEnabled';

const router = Router();

/**
 * GET /health
 * Health check básico
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const uptime = process.uptime();
  
  res.json({
    success: true,
    data: {
      status: 'ok',
      uptime: Math.floor(uptime),
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      services: {
        telegram: isTelegramBotEnabled() && !!process.env.TELEGRAM_BOT_TOKEN,
        whatsapp: true,
        database: !!process.env.DATABASE_URL,
        ai: !!process.env.OPENROUTER_API_KEY || !!process.env.ANTHROPIC_API_KEY,
      },
    },
  });
}));

/**
 * GET /health/detailed
 * Health check detalhado com status de todos os serviços
 */
router.get('/detailed', asyncHandler(async (req: Request, res: Response) => {
  const [telegramCheck, whatsappCheck, databaseCheck, aiCheck] = await Promise.all([
    systemHealth.checkTelegramBot(),
    systemHealth.checkWhatsAppBot(),
    systemHealth.checkDatabase(),
    systemHealth.checkAI(),
  ]);

  const allHealthy = [telegramCheck, whatsappCheck, databaseCheck, aiCheck]
    .every(check => check.status === 'healthy');

  res.status(allHealthy ? 200 : 503).json({
    success: allHealthy,
    data: {
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        telegram: {
          status: telegramCheck.status,
          details: telegramCheck.details,
          botUsername: '@zelar_assistente_bot',
          responseTime: telegramCheck.responseTime,
        },
        whatsapp: {
          status: whatsappCheck.status,
          details: whatsappCheck.details,
          provider: 'Baileys',
          responseTime: whatsappCheck.responseTime,
        },
        database: {
          status: databaseCheck.status,
          details: databaseCheck.details,
          provider: 'PostgreSQL (Neon)',
          responseTime: databaseCheck.responseTime,
        },
        ai: {
          status: aiCheck.status,
          details: aiCheck.details,
          provider: 'Claude Haiku / OpenRouter',
          responseTime: aiCheck.responseTime,
        },
      },
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        platform: process.platform,
        nodeVersion: process.version,
      },
    },
  });
}));

/**
 * POST /health/restart
 * Reinício controlado do processo (uso com cron externo).
 */
router.post('/restart', asyncHandler(async (req: Request, res: Response) => {
  const expectedToken = process.env.RESTART_WEBHOOK_TOKEN;
  if (!expectedToken) {
    return res.status(503).json({
      success: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Reinício remoto desabilitado',
      }
    });
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (token !== expectedToken) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Token inválido',
      }
    });
  }

  res.json({
    success: true,
    data: {
      message: 'Reinício agendado',
      timestamp: new Date().toISOString(),
    }
  });

  // Aguarda resposta HTTP ser enviada antes de finalizar o processo.
  setTimeout(() => {
    process.exit(0);
  }, 1000);
}));

export default router;
