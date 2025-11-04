import { Express } from 'express';
import { Server } from 'http';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import healthRoutes from './routes/health.routes';
import whatsappRoutes from './routes/whatsapp.routes';
import analyticsRoutes from './routes/analytics.routes';
import googleAuthRoutes from './routes/google-auth.routes';

/**
 * Registra todas as rotas da aplicação de forma modular e padronizada
 */
export async function registerRoutes(app: Express): Promise<Server | null> {
  // =================== API ROUTES ===================
  
  // Health check routes
  app.use('/health', healthRoutes);
  app.use('/api/health', healthRoutes);
  
  // Analytics routes
  app.use('/api/analytics', analyticsRoutes);
  
  // WhatsApp routes
  app.use('/api/whatsapp', whatsappRoutes);
  
  // Google Calendar OAuth routes
  app.use('/api/auth/google', googleAuthRoutes);

  // =================== LEGACY COMPATIBILITY ===================
  
  // Manter rota raiz para compatibilidade com AWS/Railway
  app.get('/', (req, res) => {
    res.json({
      success: true,
      data: {
        message: 'Zelar AI API está online!',
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        endpoints: {
          health: '/health',
          healthDetailed: '/health/detailed',
          analytics: '/api/analytics/overview',
          whatsapp: '/api/whatsapp/status',
        },
      },
    });
  });

  // Rota de status do sistema (mantida para compatibilidade)
  app.get('/api/system/status', (req, res) => {
    res.redirect(301, '/health/detailed');
  });

  // =================== ERROR HANDLING ===================
  
  // 404 - Rota não encontrada (deve vir antes do errorHandler)
  app.use(notFoundHandler);
  
  // Error handler global (deve ser o último middleware)
  app.use(errorHandler);

  return null;
}