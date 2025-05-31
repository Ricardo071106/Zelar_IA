import type { Express } from "express";
import { createServer, type Server } from "http";
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
  // Rota para página de download do Apple Calendar
  app.get('/apple/:eventId', async (req, res) => {
    try {
      const { eventId } = req.params;
      
      // Buscar evento no banco de dados
      const event = await storage.getEvent(parseInt(eventId));
      
      if (!event) {
        return res.status(404).send('Evento não encontrado');
      }
      
      // Página HTML que força o download
      const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Adicionar ao Apple Calendar</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; 
            text-align: center; 
            padding: 40px 20px; 
            background: #f5f5f7;
            margin: 0;
        }
        .container { 
            max-width: 400px; 
            margin: 0 auto; 
            background: white; 
            padding: 30px; 
            border-radius: 12px; 
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .icon { font-size: 48px; margin-bottom: 20px; }
        h1 { color: #1d1d1f; margin-bottom: 10px; font-size: 24px; }
        p { color: #6e6e73; margin-bottom: 20px; }
        .btn { 
            background: #007aff; 
            color: white; 
            padding: 12px 24px; 
            border: none; 
            border-radius: 8px; 
            font-size: 16px; 
            cursor: pointer; 
            text-decoration: none; 
            display: inline-block;
            margin: 10px;
        }
        .btn:hover { background: #0056cc; }
        .event-info { 
            background: #f2f2f7; 
            padding: 15px; 
            border-radius: 8px; 
            margin: 20px 0; 
            text-align: left;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">📅</div>
        <h1>Adicionar ao Apple Calendar</h1>
        <div class="event-info">
            <strong>${event.title}</strong><br>
            📅 ${new Date(event.startDate).toLocaleDateString('pt-BR', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            })}<br>
            ${event.location ? `📍 ${event.location}<br>` : ''}
            ${event.description ? `📝 ${event.description}` : ''}
        </div>
        <p>Clique no botão abaixo para baixar o arquivo de calendário:</p>
        <a href="/calendar/${eventId}.ics" class="btn" download="${event.title.replace(/[^a-zA-Z0-9]/g, '_')}.ics">
            📥 Baixar Arquivo ICS
        </a>
        <br>
        <p style="font-size: 14px; color: #86868b; margin-top: 20px;">
            Após baixar, abra o arquivo em seu dispositivo para adicionar ao Apple Calendar.
        </p>
    </div>
    <script>
        // Auto download no mobile
        if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
            setTimeout(() => {
                const link = document.querySelector('a[download]');
                if (link) link.click();
            }, 1000);
        }
    </script>
</body>
</html>`;
      
      res.send(html);
    } catch (error) {
      console.error('Erro ao gerar página do Apple Calendar:', error);
      res.status(500).send('Erro ao processar sua solicitação');
    }
  });

  // Rota para gerar arquivo ICS para Apple Calendar
  app.get('/calendar/:eventId.ics', async (req, res) => {
    try {
      const { eventId } = req.params;
      
      // Buscar evento no banco de dados
      const event = await storage.getEvent(parseInt(eventId));
      
      if (!event) {
        return res.status(404).send('Evento não encontrado');
      }
      
      // Gerar conteúdo ICS com fuso horário brasileiro explícito
      const formatDateForICS = (date: Date): string => {
        // Formatar como horário local brasileiro sem UTC
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        
        return `${year}${month}${day}T${hours}${minutes}${seconds}`;
      };

      const startDate = formatDateForICS(event.startDate);
      const endDate = formatDateForICS(event.endDate || new Date(event.startDate.getTime() + 60 * 60 * 1000));
      const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
      
      const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Zelar//Zelar Bot//PT
BEGIN:VTIMEZONE
TZID:America/Sao_Paulo
BEGIN:STANDARD
DTSTART:20070401T000000
RRULE:FREQ=YEARLY;BYMONTH=4;BYDAY=1SU
TZOFFSETFROM:-0200
TZOFFSETTO:-0300
TZNAME:BRT
END:STANDARD
BEGIN:DAYLIGHT
DTSTART:20071021T000000
RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=3SU
TZOFFSETFROM:-0300
TZOFFSETTO:-0200
TZNAME:BRST
END:DAYLIGHT
END:VTIMEZONE
BEGIN:VEVENT
UID:${event.id}@zelar.bot
DTSTART;TZID=America/Sao_Paulo:${startDate}
DTEND;TZID=America/Sao_Paulo:${endDate}
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
