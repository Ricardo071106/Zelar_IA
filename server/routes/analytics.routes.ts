import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// Dados mockados de analytics (temporário)
const analyticsBase = {
  totals: {
    users: 128,
    netNewUsers30d: 38,
    activeChats: 71,
    eventsCreated: 312,
  },
  businessMetrics: [
    { label: 'Reuniões agendadas', value: 142 },
    { label: 'Follow-ups ativos', value: 68 },
    { label: 'Demonstrações de produto', value: 41 },
    { label: 'Onboardings concluídos', value: 26 },
  ],
  funnel: [
    { stage: 'Mensagens recebidas', value: 1040 },
    { stage: 'Mensagens compreendidas', value: 872 },
    { stage: 'Eventos criados', value: 320 },
    { stage: 'Eventos confirmados', value: 288 },
  ],
  automation: {
    smartParserSuccess: 0.82,
    aiFallbackUsage: 0.31,
    calendarLinkClicks: 0.74,
    averageAiLatencyMs: 860,
  },
  timezoneMix: [
    { label: 'Brasil (UTC-3)', value: 62 },
    { label: 'EUA Leste (UTC-5)', value: 18 },
    { label: 'Europa Central (UTC+1)', value: 11 },
    { label: 'Outros fusos', value: 9 },
  ],
  topIntents: [
    { intent: 'Reuniões com clientes', percentage: 0.38 },
    { intent: 'Follow-up comercial', percentage: 0.22 },
    { intent: 'Onboarding e suporte', percentage: 0.17 },
    { intent: 'Eventos pessoais', percentage: 0.12 },
  ],
};

const sampleMessages = [
  {
    text: 'agendar call de onboarding com Maria na terça 10h',
    detectedIntent: 'Onboarding',
    channels: ['Telegram'],
    timestamp: '2025-09-25T13:40:00Z',
  },
  {
    text: 'lembra equipe do follow up com cliente XP amanhã 16h',
    detectedIntent: 'Follow-up comercial',
    channels: ['Telegram'],
    timestamp: '2025-09-25T12:15:00Z',
  },
  {
    text: 'jantar com investidores às 20h sexta',
    detectedIntent: 'Relacionamento',
    channels: ['Telegram', 'WhatsApp'],
    timestamp: '2025-09-24T23:05:00Z',
  },
  {
    text: 'cancelar reunião interna de hoje 17h',
    detectedIntent: 'Cancelamento',
    channels: ['Telegram'],
    timestamp: '2025-09-24T18:32:00Z',
  },
];

/**
 * GET /api/analytics/overview
 * Visão geral das métricas de analytics
 */
router.get('/overview', asyncHandler(async (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      ...analyticsBase,
      updatedAt: new Date().toISOString(),
    },
  });
}));

/**
 * GET /api/analytics/messages
 * Exemplos de mensagens processadas
 */
router.get('/messages', asyncHandler(async (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      messages: sampleMessages,
      total: sampleMessages.length,
    },
  });
}));

export default router;
