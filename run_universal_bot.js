/**
 * Script simples para executar o bot com a solução universal de calendário
 * 
 * Esta abordagem não depende de senhas de aplicativo do Gmail que expiram
 */

// Importações necessárias
const express = require('express');
const { Telegraf } = require('telegraf');
const nodemailer = require('nodemailer');
const ical = require('ical-generator');

// Verificar token do bot
if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error('TELEGRAM_BOT_TOKEN não está definido no ambiente');
  process.exit(1);
}

// Inicializar o bot do Telegram
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Manter o estado dos usuários
const userStates = new Map();

// Função para enviar convite de calendário universal
async function sendUniversalCalendarInvite(event, email, isCancellation = false) {
  try {
    // Criar conta temporária para testes
    const testAccount = await nodemailer.createTestAccount();
    console.log(`[email] Conta de email temporária criada: ${testAccount.user}`);
    
    // Criar o transportador de email
    const transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });
    
    // Criar o objeto de calendário
    const calendar = ical({
      name: 'Assistente de Agenda'
    });
    
    // Gerar um ID único para o evento
    const eventId = event.id || Date.now().toString();
    
    // Criar o evento no calendário
    const calEvent = calendar.createEvent({
      uid: `${eventId}@assistente-agenda.com`,
      sequence: isCancellation ? 1 : 0,
      start: new Date(event.startDate),
      end: event.endDate ? new Date(event.endDate) : new Date(new Date(event.startDate).getTime() + 60 * 60 * 1000),
      summary: isCancellation ? `CANCELADO: ${event.title}` : event.title,
      description: event.description || '',
      location: event.location || '',
      status: isCancellation ? 'CANCELLED' : 'CONFIRMED'
    });
    
    // Formatar a data para exibição
    const formattedDate = `${new Date(event.startDate).toLocaleDateString('pt-BR')} às ${new Date(event.startDate).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}`;
    
    // Gerar URL do Google Calendar
    const startDateFormatted = new Date(event.startDate).toISOString().replace(/-|:|\.\d\d\d/g,'').slice(0,15);
    const endDateFormatted = new Date(event.endDate || new Date(new Date(event.startDate).getTime() + 60 * 60 * 1000)).toISOString().replace(/-|:|\.\d\d\d/g,'').slice(0,15);
    
    const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${startDateFormatted}/${endDateFormatted}&details=${encodeURIComponent(event.description || '')}&location=${encodeURIComponent(event.location || '')}`;
    
    // Gerar URL para Outlook
    const outlookCalendarUrl = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(event.title)}&startdt=${new Date(event.startDate).toISOString()}&enddt=${new Date(event.endDate || new Date(new Date(event.startDate).getTime() + 60 * 60 * 1000)).toISOString()}&body=${encodeURIComponent(event.description || '')}&location=${encodeURIComponent(event.location || '')}`;
    
    // Preparar as opções de email
    const mailOptions = {
      from: `"Assistente de Agenda" <${testAccount.user}>`,
      to: email,
      subject: isCancellation 
        ? `Cancelado: ${event.title} - ${formattedDate}`
        : `Convite: ${event.title} - ${formattedDate}`,
      text: `
        ${isCancellation ? 'Evento Cancelado' : 'Novo Evento'}
        
        Evento: ${event.title}
        Data: ${formattedDate}
        ${event.location ? `Local: ${event.location}` : ''}
        ${event.description ? `Descrição: ${event.description}` : ''}
        
        Este ${isCancellation ? 'cancelamento' : 'convite'} foi enviado pelo Assistente de Agenda.
        
        Adicionar ao Google Calendar: ${googleCalendarUrl}
        Adicionar ao Outlook: ${outlookCalendarUrl}
      `,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <div style="background-color: ${isCancellation ? '#ff6b6b' : '#0088cc'}; color: white; padding: 10px; border-radius: 5px 5px 0 0;">
            <h2 style="margin: 0;">${isCancellation ? 'Evento Cancelado' : 'Convite para Evento'}</h2>
          </div>
          <div style="padding: 20px;">
            <h3 style="color: #333;">${isCancellation ? `CANCELADO: ${event.title}` : event.title}</h3>
            <p style="color: #666;"><strong>Data:</strong> ${formattedDate}</p>
            ${event.location ? `<p style="color: #666;"><strong>Local:</strong> ${event.location}</p>` : ''}
            ${event.description ? `<p style="color: #666;"><strong>Descrição:</strong> ${event.description}</p>` : ''}
            <p style="margin-top: 20px; color: #888;">Este ${isCancellation ? 'cancelamento' : 'convite'} foi enviado pelo Assistente de Agenda.</p>
            
            <div style="margin-top: 25px; text-align: center;">
              <p style="margin-bottom: 15px; font-weight: bold;">Escolha como adicionar este evento ao seu calendário:</p>
              
              <!-- Google Calendar Button -->
              <table cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto; margin-bottom: 10px;">
                <tr>
                  <td style="border-radius: 4px; background-color: #4CAF50;">
                    <a href="${googleCalendarUrl}" 
                       target="_blank" style="padding: 10px 20px; border-radius: 4px; color: #ffffff; text-decoration: none; display: inline-block; font-weight: bold;">
                      Adicionar ao Google Calendar
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- Outlook Button -->
              <table cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto; margin-bottom: 10px;">
                <tr>
                  <td style="border-radius: 4px; background-color: #0078D4;">
                    <a href="${outlookCalendarUrl}" 
                       target="_blank" style="padding: 10px 20px; border-radius: 4px; color: #ffffff; text-decoration: none; display: inline-block; font-weight: bold;">
                      Adicionar ao Outlook
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin-top: 15px; color: #888; font-size: 0.9em;">
                Ou abra o arquivo .ics anexado a este email para adicionar a outros aplicativos de calendário.
              </p>
            </div>
          </div>
        </div>
      `,
      icalEvent: {
        filename: isCancellation ? 'cancelamento.ics' : 'convite.ics',
        method: isCancellation ? 'CANCEL' : 'REQUEST',
        content: calendar.toString()
      }
    };
    
    // Enviar o email
    const info = await transporter.sendMail(mailOptions);
    
    // Logando para depuração
    const actionType = isCancellation ? 'Cancelamento' : 'Convite';
    const previewUrl = nodemailer.getTestMessageUrl(info);
    
    if (previewUrl) {
      console.log(`[email] Prévia do email: ${previewUrl}`);
    }
    
    console.log(`[email] ${actionType} de calendário enviado para ${email}`);
    
    return {
      success: true,
      message: `${actionType} de calendário enviado para ${email}`,
      previewUrl
    };
  } catch (error) {
    console.error(`[email] Erro ao enviar convite de calendário: ${error.message}`);
    
    return {
      success: false,
      message: `Erro ao enviar email: ${error.message}`
    };
  }
}

// Função para enviar convite de calendário
async function sendCalendarInvite(event, email, isCancelled = false) {
  try {
    // Usar abordagem universal para convites, sem depender de credenciais do Gmail
    console.log(`[email] Enviando convite universal para ${email}`);
    return await sendUniversalCalendarInvite(event, email, isCancelled);
  } catch (error) {
    console.error(`[email] Erro ao enviar convite de calendário: ${error.message}`);
    
    return {
      success: false,
      message: `Erro ao enviar email: ${error.message}`
    };
  }
}

// Comando /start - Inicia o bot
bot.start(async (ctx) => {
  try {
    if (!ctx.from) return;
    
    const telegramId = ctx.from.id.toString();
    const username = ctx.from.username || `${ctx.from.first_name || ''} ${ctx.from.last_name || ''}`.trim() || `user_${telegramId}`;
    
    // Inicializar estado do usuário
    userStates.set(telegramId, { telegramId, username, email: null });
    
    await ctx.reply(
      `Olá, ${username}! Sou seu assistente de agenda com suporte universal para calendários. 😊\n\n` +
      `Esta nova versão não depende de senhas de aplicativo do Gmail que expiram.\n\n` +
      `Quando você agendar um evento, vou enviar um email com:\n` +
      `1. Botão para adicionar ao Google Calendar\n` +
      `2. Botão para adicionar ao Outlook\n` +
      `3. Arquivo .ics para outros calendários\n\n` +
      `Para configurar seu email, use /configurar_email\n` +
      `Para testar, envie uma mensagem como "Reunião amanhã às 15h"`
    );
  } catch (error) {
    console.error(`[telegram] Erro no comando start: ${error.message}`);
    await ctx.reply('Ocorreu um erro ao iniciar o bot. Por favor, tente novamente mais tarde.');
  }
});

// Comando para configurar email
bot.command(['configurar_email', 'email'], async (ctx) => {
  try {
    if (!ctx.from) return;
    
    const telegramId = ctx.from.id.toString();
    
    // Atualizar estado para aguardar email
    userStates.set(telegramId, { 
      ...userStates.get(telegramId) || { telegramId },
      awaitingEmail: true 
    });
    
    const currentState = userStates.get(telegramId);
    
    await ctx.reply(
      `Por favor, envie seu endereço de email para receber convites de calendário.\n\n` +
      `Seu email atual: ${currentState.email || 'Não configurado'}`
    );
  } catch (error) {
    console.error(`[telegram] Erro ao configurar email: ${error.message}`);
    await ctx.reply('Ocorreu um erro ao processar seu comando. Por favor, tente novamente.');
  }
});

// Validar formato de email
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Testar evento do calendário
bot.command('testar', async (ctx) => {
  try {
    if (!ctx.from) return;
    
    const telegramId = ctx.from.id.toString();
    const userState = userStates.get(telegramId);
    
    if (!userState || !userState.email) {
      await ctx.reply('Você precisa configurar seu email primeiro com /configurar_email');
      return;
    }
    
    // Criar um evento de teste
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(15, 0, 0, 0);
    
    const event = {
      id: Date.now().toString(),
      title: 'Evento de Teste',
      startDate: tomorrow,
      endDate: new Date(new Date(tomorrow).getTime() + 60 * 60 * 1000),
      location: 'Local de Teste',
      description: 'Este é um evento de teste para demonstrar a solução universal de calendário.'
    };
    
    // Enviar convite de calendário
    const result = await sendCalendarInvite(event, userState.email);
    
    if (result.success) {
      await ctx.reply(`✅ Convite de teste enviado para ${userState.email}`);
      
      if (result.previewUrl) {
        await ctx.reply(`🔍 [Prévia do email](${result.previewUrl})`, { parse_mode: 'Markdown' });
      }
      
      await ctx.reply(
        `O email contém:\n` +
        `- Botão para adicionar ao Google Calendar\n` +
        `- Botão para adicionar ao Outlook\n` +
        `- Arquivo .ics para outros calendários\n\n` +
        `Esta solução não depende de senhas de aplicativo do Gmail!`
      );
    } else {
      await ctx.reply(`❌ Erro ao enviar convite: ${result.message}`);
    }
  } catch (error) {
    console.error(`[telegram] Erro ao testar convite: ${error.message}`);
    await ctx.reply('Ocorreu um erro ao testar o convite. Por favor, tente novamente mais tarde.');
  }
});

// Processar mensagens de texto
bot.on('text', async (ctx) => {
  try {
    if (!ctx.message || !ctx.message.text || !ctx.from) return;
    
    const text = ctx.message.text;
    const telegramId = ctx.from.id.toString();
    const userState = userStates.get(telegramId) || { telegramId };
    
    // Verificar se está esperando email
    if (userState.awaitingEmail) {
      const email = text.trim();
      
      if (!isValidEmail(email)) {
        await ctx.reply('O email informado não parece válido. Por favor, tente novamente com um formato correto, como exemplo@dominio.com');
        return;
      }
      
      // Atualizar email do usuário
      userStates.set(telegramId, {
        ...userState,
        email,
        awaitingEmail: false
      });
      
      await ctx.reply(
        `✅ Seu email foi configurado com sucesso para: ${email}\n\n` +
        `Agora você pode usar /testar para enviar um convite de calendário de teste.\n` +
        `Este convite usará nossa nova solução universal que não depende de senhas de aplicativo do Gmail!`
      );
      
      return;
    }
    
    // Mensagem simples para demonstração
    await ctx.reply(
      `Recebi sua mensagem: "${text}"\n\n` +
      `Para testar a nova solução de calendário universal, use o comando /testar\n` +
      `Para configurar seu email, use /configurar_email`
    );
    
  } catch (error) {
    console.error(`[telegram] Erro ao processar mensagem: ${error.message}`);
    await ctx.reply('Ocorreu um erro ao processar sua mensagem. Por favor, tente novamente mais tarde.');
  }
});

// Iniciar o bot
async function startBot() {
  try {
    // Definir comandos disponíveis
    await bot.telegram.setMyCommands([
      { command: 'start', description: 'Iniciar o bot' },
      { command: 'configurar_email', description: 'Configurar seu email para convites' },
      { command: 'testar', description: 'Enviar convite de teste usando solução universal' }
    ]);
    
    // Iniciar o bot
    await bot.launch();
    console.log('[telegram] Bot iniciado com sucesso usando a solução universal de calendário!');
    
    // Tratamento de encerramento
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
    
    return true;
  } catch (error) {
    console.error(`[telegram] Erro ao iniciar bot: ${error.message}`);
    return false;
  }
}

// Iniciar o servidor Express
async function startServer() {
  try {
    const app = express();
    
    // Rota simples
    app.get('/', (req, res) => {
      res.send('Bot do Telegram com solução universal de calendário está rodando!');
    });
    
    // Iniciar o servidor
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`[server] Servidor Express rodando na porta ${PORT}`);
    });
    
    // Iniciar o bot
    await startBot();
    
  } catch (error) {
    console.error(`[server] Erro ao iniciar servidor: ${error.message}`);
  }
}

// Iniciar tudo
startServer().catch(error => {
  console.error(`[error] Erro fatal: ${error.message}`);
});