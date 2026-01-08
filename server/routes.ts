import express, { Express } from 'express';
import { Server } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import healthRoutes from './routes/health.routes';
import whatsappRoutes from './routes/whatsapp.routes';
import analyticsRoutes from './routes/analytics.routes';
import googleAuthRoutes from './routes/google-auth.routes';
import paymentRoutes from './routes/payment.routes';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

  // Payment routes
  app.use('/api/payments', paymentRoutes);


  // =================== STATIC FILES & FRONTEND ===================

  // Servir arquivos estáticos do frontend (React/Vite build)
  // Ajuste o caminho '../dist/public' conforme onde a pasta 'dist' é gerada em relação a este arquivo
  const frontendPath = path.join(__dirname, '../dist/public');

  app.use(express.static(frontendPath));

  // Rota API fallback (evita que rotas API não encontradas caiam no index.html)
  app.use('/api/*', notFoundHandler);

  // SPA Fallback: Qualquer outra rota retorna o index.html
  // IMPORTANTE: Deve vir DEPOIS de todas as rotas de API
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });

  // =================== ERROR HANDLING ===================

  // 404 - Rota não encontrada (deve vir antes do errorHandler)
  // (Nota: Com o catch-all '*' acima, isso aqui tecnicamente só será atingido por '/api/*' não tratado)
  app.use(notFoundHandler);

  // Error handler global (deve ser o último middleware)
  app.use(errorHandler);

  return null;
}