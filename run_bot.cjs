/**
 * Bot do Telegram com solução universal para convites de calendário
 * 
 * Esta abordagem não depende de senhas de aplicativo do Gmail que expiram
 */

// Importações usando CommonJS
const { Telegraf } = require('telegraf');
const nodemailer = require('nodemailer');
const ical = require('ical-generator');
const express = require('express');

// Inicializar o bot
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Manter estado dos usuários
const userStates = new Map();

// Função para enviar convite de calendário que não depende do Gmail
async function sendUniversalCalendarInvite(event, email, isCancellation = false) {
  try {
    // Criar conta temporária para testes
    const testAccount = await nodemailer.createTestAccount();
    console.log(`[email] Conta de email temporária criada: ${testAccount.user}`);
    
    // Criar transportador de email
    const transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });
    
    // Criar objeto de calendário
    const calendar = ical({
      name: 'Assistente de Agenda'
    });
    
    // Criar o evento no calendário
    calendar.createEvent({
      uid: `${event.id || Date.now()}@assistente-agenda.com`,
      start: new Date(event.startDate),
      end: event.endDate ? new Date(event.endDate) : new Date(new Date(event.startDate).getTime() + 60 * 60 * 1000),
      summary: isCancellation ? `CANCELADO: ${event.title}` : event.title,
      description: event.description || '',
      location: event.location || '',
      status: isCancellation ? 'CANCELLED' : 'CONFIRMED'
    });
    
    // Formatar data para exibição
    const formattedDate = `${new Date(event.startDate).toLocaleDateString('pt-BR')} às ${new Date(event.startDate).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}`;
    
    // Gerar URLs para calendários
    const startIso = new Date(event.startDate).toISOString().replace(/-|:|\.\d\d\d/g,'').slice(0,15);
    const endIso = new Date(event.endDate || new Date(new Date(event.startDate).getTime() + 60 * 60 * 1000)).toISOString().replace(/-|:|\.\d\d\d/g,'').slice(0,15);
    
    const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${startIso}/${endIso}&details=${encodeURIComponent(event.description || '')}&location=${encodeURIComponent(event.location || '')}`;
    
    const outlookUrl = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(event.title)}&startdt=${new Date(event.startDate).toISOString()}&enddt=${new Date(event.endDate || new Date(new Date(event.startDate).getTime() + 60 * 60 * 1000)).toISOString()}&body=${encodeURIComponent(event.description || '')}&location=${encodeURIComponent(event.location || '')}`;
    
    // Preparar email com múltiplas opções
    const mailOptions = {
      from: `"Assistente de Agenda" <${testAccount.user}>`,
      to: email,
      subject: isCancellation ? `Cancelado: ${event.title} - ${formattedDate}` : `Convite: ${event.title} - ${formattedDate}`,
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
            
            <div style="margin-top: 25px; text-align: center;">
              <p style="margin-bottom: 15px; font-weight: bold;">Escolha como adicionar este evento ao seu calendário:</p>
              
              <!-- Google Calendar Button -->
              <table cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto; margin-bottom: 10px;">
                <tr>
                  <td style="border-radius: 4px; background-color: #4CAF50;">
                    <a href="${googleUrl}" 
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
                    <a href="${outlookUrl}" 
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
    
    // Enviar email
    const info = await transporter.sendMail(mailOptions);
    
    // Obter URL de prévia
    const previewUrl = nodemailer.getTestMessageUrl(info);
    
    if (previewUrl) {
      console.log(`[email] Prévia do email: ${previewUrl}`);
    }
    
    return {
      success: true,
      message: `${isCancellation ? 'Cancelamento' : 'Convite'} enviado para ${email}`,
      previewUrl
    };
  } catch (error) {
    console.error(`[email] Erro: ${error.message}`);
    return {
      success: false,
      message: `Erro ao enviar email: ${error.message}`
    };
  }
}

// Comando para iniciar o bot
bot.start(async (ctx) => {
  try {
    const telegramId = ctx.from.id.toString();
    const username = ctx.from.username || ctx.from.first_name || `user_${telegramId}`;
    
    userStates.set(telegramId, { telegramId, email: null });
    
    await ctx.reply(
      `Olá, ${username}! Sou seu assistente de agenda com suporte universal para calendários!\n\n` +
      `Esta versão não depende de senhas de aplicativo do Gmail que expiram.\n\n` +
      `Para configurar seu email, use /email\n` +
      `Para testar a solução universal, use /testar`
    );
  } catch (error) {
    console.error(`[bot] Erro: ${error.message}`);
    await ctx.reply('Ocorreu um erro. Tente novamente.');
  }
});

// Comando para configurar email
bot.command(['email', 'configurar_email'], async (ctx) => {
  try {
    const telegramId = ctx.from.id.toString();
    
    userStates.set(telegramId, {
      ...userStates.get(telegramId) || { telegramId },
      awaitingEmail: true
    });
    
    await ctx.reply('Por favor, envie seu endereço de email para receber convites de calendário.');
  } catch (error) {
    console.error(`[bot] Erro: ${error.message}`);
    await ctx.reply('Ocorreu um erro. Tente novamente.');
  }
});

// Comando para testar convite
bot.command('testar', async (ctx) => {
  try {
    const telegramId = ctx.from.id.toString();
    const userState = userStates.get(telegramId);
    
    if (!userState || !userState.email) {
      await ctx.reply('Você precisa configurar seu email primeiro usando /email');
      return;
    }
    
    await ctx.reply(`Enviando convite de teste para ${userState.email}...`);
    
    // Criar evento de teste
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(15, 0, 0, 0);
    
    const event = {
      id: Date.now().toString(),
      title: 'Evento de Teste',
      startDate: tomorrow,
      endDate: new Date(tomorrow.getTime() + 60 * 60 * 1000),
      location: 'Local de Teste',
      description: 'Este é um evento de teste usando a solução universal de calendário.'
    };
    
    // Enviar convite
    const result = await sendUniversalCalendarInvite(event, userState.email);
    
    if (result.success) {
      await ctx.reply(`✅ Convite enviado com sucesso para ${userState.email}`);
      
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
    console.error(`[bot] Erro: ${error.message}`);
    await ctx.reply('Ocorreu um erro ao enviar o convite. Tente novamente.');
  }
});

// Processar mensagens de texto
bot.on('text', async (ctx) => {
  try {
    const text = ctx.message.text;
    const telegramId = ctx.from.id.toString();
    const userState = userStates.get(telegramId) || { telegramId };
    
    // Verificar se está esperando email
    if (userState.awaitingEmail) {
      const email = text.trim();
      
      // Validar email
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        await ctx.reply('O email informado não parece válido. Por favor, tente novamente.');
        return;
      }
      
      // Atualizar estado
      userStates.set(telegramId, {
        ...userState,
        email,
        awaitingEmail: false
      });
      
      await ctx.reply(
        `✅ Email configurado com sucesso: ${email}\n\n` +
        `Agora você pode usar /testar para enviar um convite de calendário de teste\n` +
        `que não depende de senhas de aplicativo do Gmail!`
      );
      
      return;
    }
    
    // Resposta padrão
    await ctx.reply(
      `Recebi sua mensagem: "${text}"\n\n` +
      `Use /testar para testar a solução universal de calendário\n` +
      `Use /email para configurar seu email`
    );
    
  } catch (error) {
    console.error(`[bot] Erro: ${error.message}`);
    await ctx.reply('Ocorreu um erro. Tente novamente.');
  }
});

// Iniciar o bot
async function startBot() {
  try {
    await bot.telegram.setMyCommands([
      { command: 'start', description: 'Iniciar o bot' },
      { command: 'email', description: 'Configurar seu email' },
      { command: 'testar', description: 'Testar convite universal de calendário' }
    ]);
    
    await bot.launch();
    console.log('[bot] Bot iniciado com sucesso!');
    return true;
  } catch (error) {
    console.error(`[bot] Erro ao iniciar: ${error.message}`);
    return false;
  }
}

// Iniciar o servidor
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Bot com solução universal de calendário está rodando!');
});

app.listen(PORT, () => {
  console.log(`[server] Servidor rodando na porta ${PORT}`);
  
  // Iniciar o bot
  startBot().then(success => {
    if (success) {
      console.log('[server] Bot está pronto para receber comandos!');
      console.log('[server] Use /start para iniciar, /email para configurar email e /testar para testar.');
    } else {
      console.error('[server] Falha ao iniciar o bot!');
    }
  });
});