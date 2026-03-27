import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { storage } from '../storage';
import { getWhatsAppBot } from '../whatsapp/whatsappBot';
import {
  exchangeMicrosoftCodeForTokens,
  generateMicrosoftAuthUrl,
} from '../telegram/microsoftCalendarIntegration';

const router = Router();

const MICROSOFT_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID;
const MICROSOFT_CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET;
const MICROSOFT_REDIRECT_URI = process.env.MICROSOFT_REDIRECT_URI || 'http://localhost:8080/api/auth/microsoft/callback';

if (!MICROSOFT_CLIENT_ID || !MICROSOFT_CLIENT_SECRET) {
  console.warn('⚠️  Microsoft Calendar OAuth não configurado (falta MICROSOFT_CLIENT_ID ou MICROSOFT_CLIENT_SECRET)');
}

if (MICROSOFT_REDIRECT_URI.includes('localhost') && process.env.NODE_ENV === 'production') {
  console.warn('⚠️  MICROSOFT_REDIRECT_URI está configurado para localhost em produção. A autenticação Microsoft falhará.');
}

router.get('/authorize', asyncHandler(async (req: Request, res: Response) => {
  if (!MICROSOFT_CLIENT_ID || !MICROSOFT_CLIENT_SECRET) {
    return res.status(503).json({
      success: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Microsoft Calendar OAuth não configurado',
        details: 'Configure MICROSOFT_CLIENT_ID e MICROSOFT_CLIENT_SECRET no .env',
      },
    });
  }

  const userId = req.query.userId as string;
  const platform = (req.query.platform as string) || 'telegram';

  if (!userId) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'userId é obrigatório',
      },
    });
  }

  const authUrl = generateMicrosoftAuthUrl(userId, platform);
  const shouldRedirect = req.query.redirect === '1' || req.query.redirect === 'true';
  if (shouldRedirect) {
    return res.redirect(authUrl);
  }

  return res.json({
    success: true,
    data: {
      authUrl,
      message: 'Clique no link para autorizar o acesso ao Microsoft Calendar',
    },
  });
}));

router.get('/callback', asyncHandler(async (req: Request, res: Response) => {
  if (!MICROSOFT_CLIENT_ID || !MICROSOFT_CLIENT_SECRET) {
    return res.status(503).send('Microsoft Calendar OAuth não configurado');
  }

  const code = req.query.code as string;
  const state = req.query.state as string;

  if (!code) {
    return res.status(400).send('Código de autorização não fornecido');
  }

  if (!state) {
    return res.status(400).send('State de autenticação não fornecido');
  }

  try {
    const tokens = await exchangeMicrosoftCodeForTokens(code);
    const parsedState = JSON.parse(state) as { userId?: string; platform?: string };
    const userId = parsedState.userId;
    const platform = parsedState.platform || 'telegram';

    if (!userId) {
      return res.status(400).send('userId não informado no state');
    }

    let user;
    if (platform === 'telegram') {
      user = await storage.getUserByTelegramId(userId);
    } else if (platform === 'whatsapp') {
      if (!Number.isNaN(Number(userId))) {
        user = await storage.getUser(Number(userId));
      } else {
        user = await storage.getUserByWhatsApp(userId);
      }
    }

    if (!user) {
      return res.status(404).send('Usuário não encontrado');
    }

    let settings = await storage.getUserSettings(user.id);
    if (!settings) {
      settings = await storage.createUserSettings({
        userId: user.id,
        notificationsEnabled: true,
        reminderTimes: [12],
        language: 'pt-BR',
        timeZone: 'America/Sao_Paulo',
      });
    }

    await storage.updateUserSettings(user.id, {
      microsoftTokens: JSON.stringify(tokens),
      googleTokens: null,
      calendarProvider: 'microsoft',
    });

    console.log(`✅ Microsoft Calendar conectado para usuário ${user.username} (ID: ${user.id})`);

    if (/^\d+$/.test(user.username)) {
      const whatsappBot = getWhatsAppBot();
      const jid = `${user.username}@s.whatsapp.net`;
      await whatsappBot.sendMessage(
        jid,
        '✅ *Microsoft Calendar conectado!*\n\nAgora os eventos serão sincronizados automaticamente com seu Outlook.'
      );
    }

    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Autorização Concluída - Zelar</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #0078d4 0%, #005a9e 100%);
          }
          .container {
            background: white;
            padding: 3rem;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            text-align: center;
            max-width: 500px;
          }
          .success-icon {
            font-size: 4rem;
            margin-bottom: 1rem;
          }
          h1 {
            color: #2d3748;
            margin-bottom: 1rem;
            font-size: 2rem;
          }
          p {
            color: #4a5568;
            line-height: 1.6;
            margin-bottom: 2rem;
          }
          .close-btn {
            background: linear-gradient(135deg, #0078d4 0%, #005a9e 100%);
            color: white;
            border: none;
            padding: 1rem 2rem;
            border-radius: 10px;
            font-size: 1rem;
            cursor: pointer;
            transition: transform 0.2s;
          }
          .close-btn:hover {
            transform: scale(1.05);
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="success-icon">✅</div>
          <h1>Autorização Concluída!</h1>
          <p>
            Seu Microsoft Calendar foi conectado com sucesso ao Zelar.<br>
            Agora os eventos serão criados automaticamente no seu calendário!
          </p>
          <button class="close-btn" onclick="window.close()">Fechar esta janela</button>
          <p style="font-size: 0.875rem; color: #718096; margin-top: 2rem;">
            Você pode voltar para o ${platform === 'telegram' ? 'Telegram' : 'WhatsApp'} e começar a criar eventos.
          </p>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('❌ Erro ao processar callback Microsoft OAuth:', error);
    return res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Erro - Zelar</title>
      </head>
      <body style="font-family: sans-serif; background: #f7fafc; display: flex; justify-content: center; align-items: center; min-height: 100vh;">
        <div style="background: white; padding: 2rem; border-radius: 10px; text-align: center;">
          <h1 style="color: #e53e3e;">❌ Erro</h1>
          <p>Ocorreu um erro ao conectar o Microsoft Calendar.</p>
          <p>Por favor, tente novamente.</p>
        </div>
      </body>
      </html>
    `);
  }
}));

router.post('/disconnect', asyncHandler(async (req: Request, res: Response) => {
  const { userId, platform } = req.body;

  if (!userId || !platform) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'userId e platform são obrigatórios',
      },
    });
  }

  let user;
  if (platform === 'telegram') {
    user = await storage.getUserByTelegramId(userId);
  } else if (platform === 'whatsapp') {
    user = await storage.getUserByWhatsApp(userId);
  }

  if (!user) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'RESOURCE_NOT_FOUND',
        message: 'Usuário não encontrado',
      },
    });
  }

  const settings = await storage.getUserSettings(user.id);
  await storage.updateUserSettings(user.id, {
    microsoftTokens: null,
    calendarProvider: settings?.calendarProvider === 'microsoft' ? null : settings?.calendarProvider || null,
  });

  return res.json({
    success: true,
    data: {
      message: 'Microsoft Calendar desconectado com sucesso',
    },
  });
}));

router.get('/status', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.query.userId as string;
  const platform = req.query.platform as string;

  if (!userId || !platform) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'userId e platform são obrigatórios',
      },
    });
  }

  let user;
  if (platform === 'telegram') {
    user = await storage.getUserByTelegramId(userId);
  } else if (platform === 'whatsapp') {
    user = await storage.getUserByWhatsApp(userId);
  }

  if (!user) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'RESOURCE_NOT_FOUND',
        message: 'Usuário não encontrado',
      },
    });
  }

  const settings = await storage.getUserSettings(user.id);
  const isConnected = Boolean(settings?.microsoftTokens);

  return res.json({
    success: true,
    data: {
      isConnected,
      provider: settings?.calendarProvider || null,
    },
  });
}));

export default router;
