import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { getPublicOverviewStats } from '../services/publicStats';

const router = Router();

const sampleMessages = [
  {
    text: 'agendar call de onboarding com Maria na terça 10h',
    detectedIntent: 'Onboarding',
    channels: ['WhatsApp'],
    timestamp: '2025-09-25T13:40:00Z',
  },
  {
    text: 'lembra equipe do follow up com cliente XP amanhã 16h',
    detectedIntent: 'Follow-up comercial',
    channels: ['WhatsApp'],
    timestamp: '2025-09-25T12:15:00Z',
  },
  {
    text: 'jantar com investidores às 20h sexta',
    detectedIntent: 'Relacionamento',
    channels: ['WhatsApp'],
    timestamp: '2025-09-24T23:05:00Z',
  },
  {
    text: 'cancelar reunião interna de hoje 17h',
    detectedIntent: 'Cancelamento',
    channels: ['WhatsApp'],
    timestamp: '2025-09-24T18:32:00Z',
  },
];

/**
 * GET /api/analytics/overview
 */
router.get('/overview', asyncHandler(async (_req: Request, res: Response) => {
  const data = await getPublicOverviewStats();
  res.json({
    success: true,
    data,
  });
}));

/**
 * GET /api/analytics/messages
 */
router.get('/messages', asyncHandler(async (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      messages: sampleMessages,
      total: sampleMessages.length,
    },
  });
}));

export default router;
