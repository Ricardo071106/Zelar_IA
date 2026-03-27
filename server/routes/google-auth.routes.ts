/**
 * Rotas de autenticação Google Calendar OAuth 2.0
 */

import { Router, Request, Response } from 'express';
import { google } from 'googleapis';
import { asyncHandler } from '../middleware/errorHandler';
import { storage } from '../storage';
import { getWhatsAppBot } from 'server/whatsapp/whatsappBot';

const router = Router();

// Configuração OAuth
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:8080/api/auth/google/callback';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.warn('⚠️  Google Calendar OAuth não configurado (falta GOOGLE_CLIENT_ID ou GOOGLE_CLIENT_SECRET)');
}

if (REDIRECT_URI.includes('localhost') && process.env.NODE_ENV === 'production') {
  console.warn('⚠️  GOOGLE_REDIRECT_URI está configurado para localhost em produção. A autenticação Google falhará.');
}

const oauth2Client = CLIENT_ID && CLIENT_SECRET ? new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
) : null;

const SCOPES = ['https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/userinfo.email'];

/**
 * GET /api/auth/google/authorize
 * Gera URL de autorização do Google
 */
router.get('/authorize', asyncHandler(async (req: Request, res: Response) => {
  if (!oauth2Client) {
    return res.status(503).json({
      success: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Google Calendar OAuth não configurado',
        details: 'Configure GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no .env'
      }
    });
  }

  const userId = req.query.userId as string;
  const platform = req.query.platform as string; // telegram ou whatsapp

  if (!userId) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'userId é obrigatório',
      }
    });
  }

  // Gerar URL de autorização
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    state: JSON.stringify({ userId, platform }), // Para identificar o usuário no callback
    prompt: 'consent', // Força exibir tela de consentimento para obter refresh token
  });

  const shouldRedirect = req.query.redirect === '1' || req.query.redirect === 'true';
  if (shouldRedirect) {
    return res.redirect(authUrl);
  }

  res.json({
    success: true,
    data: {
      authUrl,
      message: 'Clique no link para autorizar o acesso ao Google Calendar',
    }
  });
}));

/**
 * GET /api/auth/google/callback
 * Callback do Google OAuth (usuário autoriza e é redirecionado aqui)
 */
router.get('/callback', asyncHandler(async (req: Request, res: Response) => {
  if (!oauth2Client) {
    return res.status(503).send('Google Calendar OAuth não configurado');
  }

  const code = req.query.code as string;
  const state = req.query.state as string;

  if (!code) {
    return res.status(400).send('Código de autorização não fornecido');
  }

  try {
    // Trocar código por tokens
    const { tokens } = await oauth2Client.getToken(code);

    // Extrair informações do state
    const { userId, platform } = JSON.parse(state);

    // Buscar usuário no banco
    let user;
    if (platform === 'telegram') {
      user = await storage.getUserByTelegramId(userId);
    } else if (platform === 'whatsapp') {
      // WhatsApp usa o ID interno do usuário (number)
      // Se userId for numérico, busca pelo ID interno
      if (!isNaN(Number(userId))) {
        user = await storage.getUser(Number(userId));
      } else {
        // Fallback: busca pelo username (whatsappId) se for string
        user = await storage.getUserByWhatsApp(userId);
      }
    }

    if (!user) {
      console.error(`❌ Usuário não encontrado no callback. Platform: ${platform}, UserId: ${userId} (${typeof userId})`);
      return res.status(404).send('Usuário não encontrado');
    }

    // Tentar obter o email do usuário do Google
    try {
      if (CLIENT_ID && CLIENT_SECRET && REDIRECT_URI) {
        const userInfoClient = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
        userInfoClient.setCredentials(tokens);

        const oauth2 = google.oauth2({
          auth: userInfoClient,
          version: 'v2'
        });

        const { data: userInfo } = await oauth2.userinfo.get();

        if (userInfo.email) {
          // Atualiza o email do usuário
          // Importante: Apenas se não tiver um email ou quiser sobrescrever (aqui vou atualizar sempre que vier do Google)
          const updatedUser = await storage.updateUser(user.id, { email: userInfo.email });
          if (updatedUser) {
            user = updatedUser;
            console.log(`📧 Email do usuário atualizado: ${userInfo.email}`);
          }
        }
      }
    } catch (emailError) {
      console.error('⚠️ Falha ao obter email do Google:', emailError);
      // Continua o fluxo normalmente mesmo se falhar ao pegar email
    }

    // Buscar ou criar configurações do usuário
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

    // Salvar tokens no banco
    await storage.updateUserSettings(user.id, {
      googleTokens: JSON.stringify(tokens),
      microsoftTokens: null,
      calendarProvider: 'google',
    });

    console.log(`✅ Google Calendar conectado para usuário ${user.username} (ID: ${user.id})`);

    if (user) {
      if (/^\d+$/.test(user.username)) {
        const whatsappBot = getWhatsAppBot();
        const jid = `${user.username}@s.whatsapp.net`;

        let confirmMsg =
          '✅ *Google Calendar conectado!*\n\n' +
          'Agora todos os eventos serão adicionados automaticamente na sua agenda 🚀';

        if (user.email) {
          confirmMsg += `\n\n📧 *Email registrado:*\n${user.email}`;
        }

        await whatsappBot.sendMessage(jid, confirmMsg);
      }
    }

    // Página de sucesso
    res.send(`
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
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
            Seu Google Calendar foi conectado com sucesso ao Zelar.<br>
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
    console.error('❌ Erro ao processar callback OAuth:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Erro - Zelar</title>
        <style>
          body {
            font-family: sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background: #f7fafc;
          }
          .error {
            background: white;
            padding: 2rem;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            text-align: center;
          }
          h1 { color: #e53e3e; }
        </style>
      </head>
      <body>
        <div class="error">
          <h1>❌ Erro</h1>
          <p>Ocorreu um erro ao conectar o Google Calendar.</p>
          <p>Por favor, tente novamente.</p>
        </div>
      </body>
      </html>
    `);
  }
}));

/**
 * POST /api/auth/google/disconnect
 * Desconectar Google Calendar
 */
router.post('/disconnect', asyncHandler(async (req: Request, res: Response) => {
  const { userId, platform } = req.body;

  if (!userId || !platform) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'userId e platform são obrigatórios',
      }
    });
  }

  // Buscar usuário
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
      }
    });
  }

  // Remover tokens
  const settings = await storage.getUserSettings(user.id);
  await storage.updateUserSettings(user.id, {
    googleTokens: null,
    calendarProvider: settings?.calendarProvider === 'google' ? null : settings?.calendarProvider || null,
  });

  console.log(`🔓 Google Calendar desconectado para usuário ${user.username}`);

  res.json({
    success: true,
    data: {
      message: 'Google Calendar desconectado com sucesso',
    }
  });
}));

/**
 * GET /api/auth/google/status
 * Verificar status da conexão
 */
router.get('/status', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.query.userId as string;
  const platform = req.query.platform as string;

  if (!userId || !platform) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'userId e platform são obrigatórios',
      }
    });
  }

  // Buscar usuário
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
      }
    });
  }

  const settings = await storage.getUserSettings(user.id);
  const isConnected = !!(settings?.googleTokens);

  res.json({
    success: true,
    data: {
      isConnected,
      provider: settings?.calendarProvider || null,
    }
  });
}));

export default router;
