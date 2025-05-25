import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertEventSchema, insertReminderSchema, insertUserSchema, insertUserSettingsSchema } from "@shared/schema";
import { z } from "zod";
import * as fs from 'fs';
import * as path from 'path';
import googleAuthRoutes from './routes/googleAuth';

// Middleware para validação com Zod
function validateBody(schema: z.ZodType<any, any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: "Dados inválidos",
          details: error.errors,
        });
      }
      next(error);
    }
  };
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Rota de autenticação do Google Calendar
  app.use('/api/auth', googleAuthRoutes);
  // Rota para gerar arquivo ICS para Apple Calendar
  app.get('/calendar/:eventId.ics', async (req, res) => {
    try {
      const { eventId } = req.params;
      
      // Buscar evento no banco de dados
      const event = await storage.getEvent(parseInt(eventId));
      
      if (!event) {
        return res.status(404).send('Evento não encontrado');
      }
      
      // Gerar conteúdo ICS
      const formatDateForICS = (date: Date): string => {
        return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
      };

      const startDate = formatDateForICS(event.startDate);
      const endDate = formatDateForICS(event.endDate || new Date(event.startDate.getTime() + 60 * 60 * 1000));
      const now = formatDateForICS(new Date());
      
      const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Zelar//Zelar Bot//PT
BEGIN:VEVENT
UID:${event.id}@zelar.bot
DTSTART:${startDate}
DTEND:${endDate}
DTSTAMP:${now}
SUMMARY:${event.title}
DESCRIPTION:${event.description || ''}
LOCATION:${event.location || ''}
STATUS:CONFIRMED
SEQUENCE:0
END:VEVENT
END:VCALENDAR`;
      
      res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${event.title.replace(/[^a-zA-Z0-9]/g, '_')}.ics"`);
      res.send(icsContent);
    } catch (error) {
      console.error('Erro ao gerar arquivo ICS:', error);
      res.status(500).send('Erro ao processar sua solicitação');
    }
  });

  // Rota para download de arquivos de calendário (mantida para compatibilidade)
  app.get('/download/calendar_files/:filename', async (req, res) => {
    try {
      const { filename } = req.params;
      const filePath = path.join(process.cwd(), 'calendar_files', filename);
      
      if (!fs.existsSync(filePath)) {
        return res.status(404).send('Arquivo não encontrado');
      }
      
      res.setHeader('Content-Type', 'text/calendar');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
      
      fs.createReadStream(filePath).pipe(res);
    } catch (error) {
      console.error('Erro ao fornecer arquivo de calendário:', error);
      res.status(500).send('Erro ao processar sua solicitação');
    }
  });
  
  // Rotas de autenticação com Google Calendar
  app.get('/api/auth/google', async (req, res) => {
    try {
      const userId = parseInt(req.query.userId as string);
      
      if (isNaN(userId)) {
        return res.status(400).json({ error: 'ID de usuário inválido' });
      }
      
      // Verifica se o usuário existe
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }
      
      // Gera a URL de autorização
      const authUrl = generateAuthUrl(userId);
      
      res.redirect(authUrl);
    } catch (error) {
      console.error('Erro ao iniciar autenticação com Google:', error);
      res.status(500).json({ error: 'Erro ao iniciar autenticação com Google Calendar' });
    }
  });
  
  app.get('/api/auth/google/callback', async (req, res) => {
    try {
      const { code, state } = req.query;
      
      if (!code || !state) {
        return res.status(400).json({ error: 'Parâmetros inválidos' });
      }
      
      const userId = parseInt(state as string);
      
      if (isNaN(userId)) {
        return res.status(400).json({ error: 'ID de usuário inválido' });
      }
      
      // Processa o código de autorização
      const authResult = await handleAuthCode(code as string, userId);
      
      if (!authResult.success) {
        return res.status(500).json({ error: authResult.message });
      }
      
      // Salva os tokens no banco de dados
      if (authResult.tokens) {
        // Atualiza as configurações do usuário com os tokens do Google
        const userSettings = await storage.getUserSettings(userId);
        
        if (userSettings) {
          // Atualiza as configurações existentes
          await storage.updateUserSettings(userId, {
            googleTokens: JSON.stringify(authResult.tokens)
          });
        } else {
          // Cria novas configurações
          await storage.createUserSettings({
            userId,
            notificationsEnabled: true,
            reminderTimes: [24, 1], // Lembretes 24h e 1h antes
            calendarProvider: 'google',
            googleTokens: JSON.stringify(authResult.tokens)
          });
        }
      }
      
      // Redireciona para uma página de sucesso
      res.send(`
        <html>
          <head>
            <title>Autenticação concluída</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                text-align: center;
                margin-top: 50px;
              }
              .success {
                color: green;
                font-size: 24px;
                margin-bottom: 20px;
              }
              .message {
                font-size: 18px;
                margin-bottom: 30px;
              }
              .close {
                background-color: #4CAF50;
                color: white;
                padding: 10px 20px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 16px;
              }
            </style>
          </head>
          <body>
            <div class="success">✓ Autenticação concluída com sucesso!</div>
            <div class="message">Você pode agora fechar esta janela e voltar ao bot do Telegram.</div>
            <button class="close" onclick="window.close()">Fechar</button>
          </body>
        </html>
      `);
    } catch (error) {
      console.error('Erro no callback de autenticação:', error);
      res.status(500).json({ error: 'Erro no processo de autenticação' });
    }
  });
  
  // Rotas de usuários
  app.get('/api/users/:id', async (req, res, next) => {
    try {
      const userId = parseInt(req.params.id);
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }
      
      // Não envie a senha na resposta
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/users', validateBody(insertUserSchema), async (req, res, next) => {
    try {
      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        return res.status(400).json({ error: "Nome de usuário já existe" });
      }
      
      const user = await storage.createUser(req.body);
      
      // Não envie a senha na resposta
      const { password, ...userWithoutPassword } = user;
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      next(error);
    }
  });

  // Rotas de eventos
  app.get('/api/events', async (req, res, next) => {
    try {
      const userId = parseInt(req.query.userId as string);
      
      if (isNaN(userId)) {
        return res.status(400).json({ error: "ID de usuário inválido" });
      }
      
      const events = await storage.getEventsByUserId(userId);
      res.json(events);
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/events/:id', async (req, res, next) => {
    try {
      const eventId = parseInt(req.params.id);
      const event = await storage.getEvent(eventId);
      
      if (!event) {
        return res.status(404).json({ error: "Evento não encontrado" });
      }
      
      res.json(event);
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/events', validateBody(insertEventSchema), async (req, res, next) => {
    try {
      const event = await storage.createEvent(req.body);
      res.status(201).json(event);
    } catch (error) {
      next(error);
    }
  });

  app.put('/api/events/:id', async (req, res, next) => {
    try {
      const eventId = parseInt(req.params.id);
      const event = await storage.getEvent(eventId);
      
      if (!event) {
        return res.status(404).json({ error: "Evento não encontrado" });
      }
      
      const updatedEvent = await storage.updateEvent(eventId, req.body);
      res.json(updatedEvent);
    } catch (error) {
      next(error);
    }
  });

  app.delete('/api/events/:id', async (req, res, next) => {
    try {
      const eventId = parseInt(req.params.id);
      const event = await storage.getEvent(eventId);
      
      if (!event) {
        return res.status(404).json({ error: "Evento não encontrado" });
      }
      
      const success = await storage.deleteEvent(eventId);
      
      if (success) {
        res.status(204).end();
      } else {
        res.status(500).json({ error: "Falha ao excluir evento" });
      }
    } catch (error) {
      next(error);
    }
  });

  // Rotas de lembretes
  app.get('/api/events/:eventId/reminders', async (req, res, next) => {
    try {
      const eventId = parseInt(req.params.eventId);
      const reminders = await storage.getRemindersByEventId(eventId);
      res.json(reminders);
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/reminders', validateBody(insertReminderSchema), async (req, res, next) => {
    try {
      const reminder = await storage.createReminder(req.body);
      res.status(201).json(reminder);
    } catch (error) {
      next(error);
    }
  });

  app.put('/api/reminders/:id/status', async (req, res, next) => {
    try {
      const reminderId = parseInt(req.params.id);
      const { status } = req.body;
      
      if (!status || !['pending', 'sent', 'failed'].includes(status)) {
        return res.status(400).json({ error: "Status inválido" });
      }
      
      const updatedReminder = await storage.updateReminderStatus(reminderId, status);
      
      if (!updatedReminder) {
        return res.status(404).json({ error: "Lembrete não encontrado" });
      }
      
      res.json(updatedReminder);
    } catch (error) {
      next(error);
    }
  });

  // Rotas de configurações de usuário
  app.get('/api/users/:userId/settings', async (req, res, next) => {
    try {
      const userId = parseInt(req.params.userId);
      const settings = await storage.getUserSettings(userId);
      
      if (!settings) {
        return res.status(404).json({ error: "Configurações não encontradas" });
      }
      
      res.json(settings);
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/users/:userId/settings', validateBody(insertUserSettingsSchema), async (req, res, next) => {
    try {
      const userId = parseInt(req.params.userId);
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }
      
      // Verifique se já existem configurações para este usuário
      const existingSettings = await storage.getUserSettings(userId);
      
      if (existingSettings) {
        return res.status(400).json({ 
          error: "Configurações já existem para este usuário",
          message: "Use PUT para atualizar configurações existentes"
        });
      }
      
      const settings = await storage.createUserSettings({ ...req.body, userId });
      res.status(201).json(settings);
    } catch (error) {
      next(error);
    }
  });

  app.put('/api/users/:userId/settings', async (req, res, next) => {
    try {
      const userId = parseInt(req.params.userId);
      const settings = await storage.getUserSettings(userId);
      
      if (!settings) {
        return res.status(404).json({ error: "Configurações não encontradas" });
      }
      
      const updatedSettings = await storage.updateUserSettings(userId, req.body);
      res.json(updatedSettings);
    } catch (error) {
      next(error);
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
