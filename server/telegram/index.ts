/**
 * Bot do Telegram com solução universal para calendários
 * 
 * Esta abordagem não depende de senhas de aplicativo do Gmail que expiram
 */
import { Telegraf } from 'telegraf';
import nodemailer from 'nodemailer';
import ical from 'ical-generator';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { log } from "../vite";

// Manter o estado dos usuários
const userStates = new Map();

// Função para enviar convite de calendário universal
async function sendUniversalCalendarInvite(event: any, email: string, isCancellation = false) {
  try {
    // Criar conta temporária para testes
    const testAccount = await nodemailer.createTestAccount();
    log(`Conta de email temporária criada: ${testAccount.user}`, 'email');
    
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
    calendar.createEvent({
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
    const formattedDate = format(
      new Date(event.startDate),
      "dd/MM/yyyy 'às' HH:mm",
      { locale: ptBR }
    );
    
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
      log(`Prévia do email: ${previewUrl}`, 'email');
    }
    
    log(`${actionType} de calendário enviado para ${email}`, 'email');
    
    return {
      success: true,
      message: `${actionType} de calendário enviado para ${email}`,
      previewUrl
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Erro ao enviar convite de calendário: ${errorMessage}`, 'email');
    
    return {
      success: false,
      message: `Erro ao enviar email: ${errorMessage}`
    };
  }
}

// Função para validar formato de email
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Inicializar e configurar o bot
export async function initializeTelegramBot() {
  try {
    // Verificar token do bot
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      log('TELEGRAM_BOT_TOKEN não está definido no ambiente', 'telegram');
      return false;
    }
    
    // Inicializar o bot do Telegram
    const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
    
    // Comando /start - Inicia o bot
    bot.start(async (ctx) => {
      try {
        if (!ctx.from) return;
        
        const telegramId = ctx.from.id.toString();
        const username = ctx.from.username || ctx.from.first_name || `user_${telegramId}`;
        
        // Inicializar estado do usuário
        userStates.set(telegramId, { telegramId, email: null });
        
        await ctx.reply(
          `Olá, ${username}! Sou seu assistente de agenda com suporte universal para calendários!\n\n` +
          `Esta versão não depende de senhas de aplicativo do Gmail que expiram.\n\n` +
          `Para configurar seu email, use /email\n` +
          `Para testar a solução universal, use /testar`
        );
      } catch (error) {
        log(`Erro no comando start: ${error}`, 'telegram');
        await ctx.reply('Ocorreu um erro ao iniciar o bot. Por favor, tente novamente mais tarde.');
      }
    });
    
    // Comando para configurar email
    bot.command(['email', 'configurar_email'], async (ctx) => {
      try {
        if (!ctx.from) return;
        
        const telegramId = ctx.from.id.toString();
        
        // Atualizar estado para aguardar email
        userStates.set(telegramId, { 
          ...userStates.get(telegramId) || { telegramId },
          awaitingEmail: true 
        });
        
        await ctx.reply('Por favor, envie seu endereço de email para receber convites de calendário.');
      } catch (error) {
        log(`Erro ao configurar email: ${error}`, 'telegram');
        await ctx.reply('Ocorreu um erro ao processar seu comando. Por favor, tente novamente.');
      }
    });
    
    // Comando para testar convite
    bot.command('testar', async (ctx) => {
      try {
        if (!ctx.from) return;
        
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
        log(`Erro ao testar convite: ${error}`, 'telegram');
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
          
          // Validar email
          if (!isValidEmail(email)) {
            await ctx.reply('O email informado não parece válido. Por favor, tente novamente com um formato correto, como exemplo@dominio.com');
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
        log(`Erro ao processar mensagem: ${error}`, 'telegram');
        await ctx.reply('Ocorreu um erro ao processar sua mensagem. Por favor, tente novamente mais tarde.');
      }
    });
    
    // Definir comandos disponíveis
    await bot.telegram.setMyCommands([
      { command: 'start', description: 'Iniciar o bot' },
      { command: 'email', description: 'Configurar seu email' },
      { command: 'testar', description: 'Testar convite universal de calendário' }
    ]);
    
    // Iniciar o bot
    await bot.launch();
    log('Bot iniciado com solução universal de calendário!', 'telegram');
    
    // Encerramento correto do bot
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
    
    return true;
  } catch (error) {
    log(`Erro ao iniciar bot: ${error}`, 'telegram');
    return false;
  }
}