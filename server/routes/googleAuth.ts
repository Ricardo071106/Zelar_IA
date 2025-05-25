import { Request, Response, Router } from 'express';
import { generateAuthUrl, handleAuthCode } from '../telegram/googleCalendarIntegration';
import { storage } from '../storage';
import { log } from '../vite';

const router = Router();

// Rota para redirecionar o usuário para a página de autenticação do Google
router.get('/google', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.query.userId as string);
    
    if (isNaN(userId)) {
      return res.status(400).send('ID de usuário inválido');
    }
    
    // Verifica se o usuário existe
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).send('Usuário não encontrado');
    }
    
    // Gera a URL de autenticação
    const authUrl = generateAuthUrl(userId);
    
    // Redireciona o usuário para a página de autenticação do Google
    res.redirect(authUrl);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Erro ao gerar URL de autenticação: ${errorMessage}`, 'google');
    res.status(500).send(`Erro ao gerar URL de autenticação: ${errorMessage}`);
  }
});

// Callback para processar o código de autorização do Google
router.get('/google/callback', async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query;
    
    if (!code || !state) {
      return res.status(400).send('Parâmetros inválidos');
    }
    
    const userId = parseInt(state as string);
    
    if (isNaN(userId)) {
      return res.status(400).send('ID de usuário inválido');
    }
    
    // Processa o código de autorização
    const result = await handleAuthCode(code as string, userId);
    
    if (!result.success) {
      return res.status(500).send(`Erro ao processar código de autorização: ${result.message}`);
    }
    
    // Salva os tokens no banco de dados
    const userSettings = await storage.getUserSettings(userId);
    
    if (userSettings) {
      // Atualiza as configurações existentes
      await storage.updateUserSettings(userId, {
        googleTokens: JSON.stringify(result.tokens),
        calendarProvider: 'google'
      });
    } else {
      // Cria novas configurações
      await storage.createUserSettings({
        userId,
        googleTokens: JSON.stringify(result.tokens),
        calendarProvider: 'google',
        notificationsEnabled: true,
        reminderTimes: [24, 1], // 24h e 1h antes
        language: 'pt-BR',
        timeZone: 'America/Sao_Paulo'
      });
    }
    
    // Página de sucesso
    res.send(`
      <html>
        <head>
          <title>Autorização do Google Calendar</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              text-align: center;
              margin-top: 50px;
            }
            .success {
              color: green;
              font-size: 18px;
              margin-bottom: 20px;
            }
            .info {
              margin-bottom: 30px;
            }
            .telegram-button {
              background-color: #0088cc;
              color: white;
              padding: 10px 20px;
              border-radius: 5px;
              text-decoration: none;
              font-weight: bold;
            }
          </style>
        </head>
        <body>
          <h1>Zelar - Assistente de Agenda</h1>
          <div class="success">✅ Autorização concluída com sucesso!</div>
          <div class="info">
            Sua conta do Google Calendar foi conectada ao Zelar.
            <br>
            Agora você pode voltar ao Telegram e continuar usando o bot.
          </div>
          <a class="telegram-button" href="https://t.me/zelar_assistente_bot">Voltar ao Telegram</a>
        </body>
      </html>
    `);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Erro ao processar callback de autenticação: ${errorMessage}`, 'google');
    res.status(500).send(`Erro ao processar callback de autenticação: ${errorMessage}`);
  }
});

export default router;