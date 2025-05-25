import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import nodemailer from 'nodemailer';
import ical from 'ical-generator';
import { storage } from './storage';
import { log } from './vite';
import { sendGmailCalendarInvite, setupEmailCredentials, emailConfig } from './email/directGmailInvite';

// Verificar token do bot
if (!process.env.TELEGRAM_BOT_TOKEN) {
  throw new Error('TELEGRAM_BOT_TOKEN não está definido no ambiente');
}

// Cria uma instância do bot
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Log de inicialização do bot
bot.use((ctx, next) => {
  log(`Recebida atualização do tipo: ${ctx.updateType}`, 'telegram');
  if (ctx.updateType === 'message' && ctx.message.text) {
    log(`Mensagem recebida: "${ctx.message.text}" de ${ctx.from.id}`, 'telegram');
  }
  return next();
});

// Estados de usuário para rastrear conversas
interface UserState {
  awaitingEmail?: boolean;
  telegramId: string;
  userId?: number;
}

const userStates = new Map<string, UserState>();

// Mensagem de boas-vindas
bot.start(async (ctx) => {
  try {
    const telegramId = ctx.from.id.toString();
    
    // Cria o usuário se não existir
    const user = await findOrCreateUser(ctx.from);
    log(`Usuário iniciou o bot: ${telegramId}`, 'telegram');
    
    // Verifica se o usuário já tem e-mail configurado
    if (user.email) {
      await ctx.reply(
        `👋 Olá ${ctx.from.first_name}! Bem-vindo ao Assistente de Agenda!\n\n` +
        `Você já tem seu e-mail ${user.email} configurado para integração com calendário.\n\n` +
        `Para criar um evento, simplesmente me envie uma mensagem como:\n` +
        `"Agendar reunião com João na próxima sexta às 10h"`
      );
    } else {
      // Solicita e-mail do usuário
      await ctx.reply(
        `👋 Olá ${ctx.from.first_name}! Bem-vindo ao Assistente de Agenda!\n\n` +
        `Para começar, por favor, me envie seu e-mail para que possamos integrar seus eventos ao seu calendário.\n\n` +
        `Exemplo: seunome@exemplo.com.br`
      );
      
      // Define estado para aguardar e-mail
      userStates.set(telegramId, {
        awaitingEmail: true,
        telegramId,
        userId: user.id
      });
    }
  } catch (error) {
    log(`Erro ao processar comando start: ${error}`, 'telegram');
    await ctx.reply('Ocorreu um erro ao iniciar o bot. Por favor, tente novamente mais tarde.');
  }
});

// Comando de ajuda
bot.help(async (ctx) => {
  await ctx.reply(
    `🤖 Comandos Disponíveis\n\n` +
    `• Envie mensagens descrevendo seus compromissos\n` +
    `• /email - Configurar seu e-mail\n` +
    `• /configurar_email - (Admin) Configurar email remetente\n` +
    `• /apagar - Apagar um evento do calendário\n` +
    `• /ajuda - Mostrar esta mensagem\n\n` +
    `Para adicionar um evento, simplesmente me diga o que você quer agendar, quando e onde.`
  );
});

// Comando de ajuda em português
bot.command('ajuda', async (ctx) => {
  await ctx.reply(
    `🤖 Comandos Disponíveis\n\n` +
    `• Envie mensagens descrevendo seus compromissos\n` +
    `• /email - Configurar seu e-mail\n` +
    `• /configurar_email - (Admin) Configurar email remetente\n` +
    `• /apagar - Apagar um evento do calendário\n` +
    `• /ajuda - Mostrar esta mensagem\n\n` +
    `Para adicionar um evento, simplesmente me diga o que você quer agendar, quando e onde.`
  );
});

// Comando para registrar e-mail
bot.command('email', async (ctx) => {
  try {
    log(`Comando /email recebido de ${ctx.from.id}`, 'telegram');
    const message = ctx.message.text.trim();
    const parts = message.split(' ');
    
    if (parts.length < 2) {
      log('Comando /email sem parâmetros - enviando instruções', 'telegram');
      await ctx.reply(
        '📧 Configuração de Email\n\n' +
        'Para alterar seu email, envie o comando:\n' +
        '/email seu@email.com\n\n' +
        'Este email será usado para receber convites de calendário.'
      );
      return;
    }
    
    const email = parts[1].trim();
    log(`Email recebido para configuração: ${email}`, 'telegram');
    
    // Validação simples de email
    if (!isValidEmail(email)) {
      log(`Email inválido: ${email}`, 'telegram');
      await ctx.reply('❌ Email inválido. Por favor, forneça um email válido.');
      return;
    }
    
    // Obter o ID do usuário no Telegram
    const telegramId = ctx.from.id.toString();
    log(`Processando atualização de email para telegramId: ${telegramId}`, 'telegram');
    
    // Atualizar o email do usuário no banco de dados
    const user = await findOrCreateUser(ctx.from);
    log(`Usuário encontrado: ${user.id} (${user.username})`, 'telegram');
    
    // Atualizar o email do usuário
    await storage.updateUser(user.id, { email });
    log(`Email atualizado para usuário ${user.id}`, 'telegram');
    
    await ctx.reply(
      `✅ Email atualizado com sucesso!\n\n` +
      `Seu email foi configurado como: ${email}\n\n` +
      `Você receberá os convites de calendário neste email.`
    );
    
  } catch (error) {
    log(`Erro ao atualizar email do usuário: ${error}`, 'telegram');
    await ctx.reply('❌ Ocorreu um erro ao atualizar seu email. Por favor, tente novamente mais tarde.');
  }
});

// Comando para configurar email remetente
bot.command('configurar_email', async (ctx) => {
  try {
    log(`Comando /configurar_email recebido de ${ctx.from.id}`, 'telegram');
    
    // Verificar se é o admin do bot (você pode definir o ID do administrador)
    const adminId = process.env.ADMIN_TELEGRAM_ID || ctx.from.id.toString(); // Para testes, considerar admin quem chamou
    const fromId = ctx.from.id.toString();
    
    log(`Verificação de admin: fromId=${fromId}, adminId=${adminId}`, 'telegram');
    
    if (fromId !== adminId) {
      log(`Acesso negado: usuário ${fromId} não é admin`, 'telegram');
      await ctx.reply('⚠️ Este comando é restrito ao administrador do bot.');
      return;
    }
    
    // Extrair credenciais do comando
    // Formato esperado: /configurar_email email@exemplo.com senha
    const parts = ctx.message.text.split(' ');
    log(`Comando recebido com ${parts.length} partes`, 'telegram');
    
    if (parts.length < 3) {
      log('Comando com formato inválido - enviando instruções', 'telegram');
      await ctx.reply(
        '❌ Formato inválido\n\n' +
        'Use: /configurar_email email@exemplo.com senha\n\n' +
        'Este comando configura o email que será usado para enviar convites de calendário.\n' +
        'Para Gmail, use uma senha de aplicativo.'
      );
      return;
    }
    
    const email = parts[1];
    const senha = parts.slice(2).join(' '); // Caso a senha tenha espaços
    log(`Configurando email remetente: ${email}`, 'telegram');
    
    // Configurar as credenciais para o método direto do Gmail
    if (setupEmailCredentials(email, senha)) {
      log('Credenciais de email configuradas com sucesso via método Gmail', 'telegram');
    } else {
      // Configurar as credenciais do método original como backup
      emailConfig.user = email;
      emailConfig.pass = senha;
      log('Credenciais de email configuradas com sucesso via método padrão', 'telegram');
    }
    
    await ctx.reply(
      '✅ Configuração concluída\n\n' +
      `Email configurado: ${email}\n\n` +
      'Agora o bot pode enviar convites de calendário por email.'
    );
    
    // Apagar a mensagem que contém a senha para segurança
    try {
      log('Tentando apagar mensagem com senha por segurança', 'telegram');
      await ctx.deleteMessage();
      log('Mensagem com senha apagada com sucesso', 'telegram');
    } catch (deleteError) {
      log(`Não foi possível apagar a mensagem: ${deleteError}`, 'telegram');
      // Ignora erro se não conseguir deletar a mensagem
    }
  } catch (error) {
    log(`Erro ao configurar email remetente: ${error}`, 'telegram');
    await ctx.reply('Ocorreu um erro ao processar seu pedido. Por favor, tente novamente mais tarde.');
  }
});

// Comando para apagar eventos
bot.command('apagar', async (ctx) => {
  try {
    const telegramId = ctx.from.id.toString();
    const user = await findOrCreateUser(ctx.from);
    
    // Busca eventos futuros do usuário
    const events = await storage.getFutureEvents(user.id);
    
    if (events.length === 0) {
      await ctx.reply('Você não tem eventos futuros para apagar.');
      return;
    }
    
    // Cria botões para cada evento
    const keyboard = {
      inline_keyboard: events.map(event => {
        const date = new Date(event.startDate);
        const dateStr = format(date, "dd/MM 'às' HH:mm", { locale: ptBR });
        return [{
          text: `${event.title} - ${dateStr}`,
          callback_data: `delete_event:${event.id}`
        }];
      })
    };
    
    await ctx.reply('Selecione o evento que deseja apagar:', { reply_markup: keyboard });
  } catch (error) {
    log(`Erro ao listar eventos para apagar: ${error}`, 'telegram');
    await ctx.reply('Ocorreu um erro ao listar seus eventos. Por favor, tente novamente mais tarde.');
  }
});

// Callback para confirmar exclusão
bot.action(/delete_event:(\d+)/, async (ctx) => {
  try {
    const eventId = parseInt(ctx.match[1]);
    
    // Pede confirmação
    await ctx.reply(`Tem certeza que deseja apagar este evento?`, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Sim, apagar', callback_data: `confirm_delete:${eventId}` },
            { text: '❌ Não, cancelar', callback_data: 'cancel_delete' }
          ]
        ]
      }
    });
    
    await ctx.answerCbQuery();
  } catch (error) {
    log(`Erro ao processar exclusão: ${error}`, 'telegram');
    await ctx.reply('Ocorreu um erro ao processar sua solicitação.');
    await ctx.answerCbQuery();
  }
});

// Confirma exclusão
bot.action(/confirm_delete:(\d+)/, async (ctx) => {
  try {
    const eventId = parseInt(ctx.match[1]);
    
    // Busca o evento para enviar convite de cancelamento
    const event = await storage.getEvent(eventId);
    if (!event) {
      await ctx.reply('Evento não encontrado.');
      await ctx.answerCbQuery();
      return;
    }
    
    // Busca o usuário para obter o email
    const user = await storage.getUser(event.userId);
    if (!user || !user.email) {
      await ctx.reply('Não foi possível encontrar seu email para enviar cancelamento.');
    } else {
      // Tenta enviar convite de cancelamento
      try {
        // Cria uma cópia do evento com status cancelado
        const canceledEvent = {
          ...event,
          title: `CANCELADO: ${event.title}`,
          status: 'CANCELLED'
        };
        
        // Envia convite de cancelamento
        await sendCalendarInvite(canceledEvent, user.email, true);
        log(`Email de cancelamento enviado para ${user.email}`, 'email');
      } catch (emailError) {
        log(`Erro ao enviar email de cancelamento: ${emailError}`, 'email');
      }
    }
    
    // Apaga o evento do banco de dados
    const deleted = await storage.deleteEvent(eventId);
    
    if (deleted) {
      await ctx.reply('✅ Evento apagado com sucesso!');
    } else {
      await ctx.reply('❌ Não foi possível apagar o evento.');
    }
    
    await ctx.answerCbQuery();
  } catch (error) {
    log(`Erro ao confirmar exclusão: ${error}`, 'telegram');
    await ctx.reply('Ocorreu um erro ao apagar o evento.');
    await ctx.answerCbQuery();
  }
});

// Cancela exclusão
bot.action('cancel_delete', async (ctx) => {
  await ctx.reply('Exclusão cancelada.');
  await ctx.answerCbQuery();
});

// Processamento de mensagens de texto
bot.on(message('text'), async (ctx) => {
  try {
    const telegramId = ctx.from.id.toString();
    const user = await findOrCreateUser(ctx.from);
    
    // Verifica se estamos esperando um e-mail
    const userState = userStates.get(telegramId);
    if (userState && userState.awaitingEmail) {
      const email = ctx.message.text.trim();
      
      // Valida o email
      if (!isValidEmail(email)) {
        await ctx.reply('❌ Por favor, forneça um endereço de e-mail válido no formato usuario@dominio.com');
        return;
      }
      
      // Atualiza o email do usuário
      await storage.updateUser(user.id, { email });
      
      // Atualiza o estado
      userStates.set(telegramId, {
        ...userState,
        awaitingEmail: false
      });
      
      await ctx.reply(
        `✅ Obrigado! Seu e-mail ${email} foi registrado com sucesso.\n\n` +
        `Agora você pode começar a usar o bot! Experimente enviar uma mensagem como:\n` +
        `"Agendar reunião com João na próxima segunda às 10h" ou\n` +
        `"Lembrar de buscar as crianças na escola amanhã às 17h"`
      );
      
      return;
    }
    
    // Processar mensagem como possível evento
    const texto = ctx.message.text;
    log(`Processando mensagem: ${texto}`, 'telegram');
    
    // Verifica se o texto parece ser um evento
    if (isEventMessage(texto)) {
      // Enviar mensagem de processamento
      const processingMessage = await ctx.reply('🧠 Processando sua mensagem...');
      
      // Extrair informações do evento
      const eventInfo = extractEventInfo(texto);
      
      // Criar evento no banco de dados
      const event = await storage.createEvent({
        userId: user.id,
        title: eventInfo.title,
        startDate: eventInfo.startDate,
        endDate: eventInfo.endDate,
        location: eventInfo.location || '',
        description: eventInfo.description || ''
      });
      
      // Remover mensagem de processamento
      await ctx.telegram.deleteMessage(ctx.chat.id, processingMessage.message_id);
      
      // Enviar convite de calendário
      let emailResult: { success: boolean; message: string; previewUrl?: string } = { success: false, message: '' };
      if (user.email) {
        emailResult = await sendCalendarInvite(event, user.email);
      }
      
      // Formatar data para exibição
      const dataFormatada = format(
        new Date(event.startDate),
        "EEEE, dd 'de' MMMM 'às' HH:mm",
        { locale: ptBR }
      );
      
      // Informar sucesso
      await ctx.reply(
        `✅ Evento adicionado ao seu calendário!\n\n` +
        `${event.title}\n` +
        `📅 ${dataFormatada}\n` +
        (event.location ? `📍 ${event.location}\n` : '') +
        (event.description ? `📝 ${event.description}\n` : '') +
        `\n` +
        (emailResult.success 
          ? `📧 Um convite oficial de calendário foi enviado para ${user.email}!` 
          : `⚠️ Não foi possível enviar o convite de calendário para seu email. ${emailResult.message}`)
      );
      
      // Enviar prévia do email se disponível
      if (emailResult.previewUrl) {
        await ctx.reply(`🔍 Prévia do convite: ${emailResult.previewUrl}`);
      }
    } else {
      // Não é um evento, responder genericamente
      await ctx.reply(
        'Desculpe, não consegui identificar um evento na sua mensagem.\n\n' +
        'Para agendar um evento, tente algo como:\n' +
        '"Agendar reunião com João na próxima segunda às 10h" ou\n' +
        '"Lembrar de buscar as crianças na escola amanhã às 17h"'
      );
    }
  } catch (error) {
    log(`Erro ao processar mensagem: ${error}`, 'telegram');
    await ctx.reply('Ocorreu um erro ao processar sua mensagem. Por favor, tente novamente mais tarde.');
  }
});

// Função para enviar convite de calendário
async function sendCalendarInvite(
  event: any, 
  email: string, 
  isCancelled = false
): Promise<{
  success: boolean;
  message: string;
  previewUrl?: string;
}> {
  try {
    // Tentar primeiro o método direto do Gmail se tivermos credenciais configuradas
    if (emailConfig.user && emailConfig.pass) {
      try {
        log(`Tentando enviar convite via método direto do Gmail para ${email}`, 'email');
        const result = await sendGmailCalendarInvite(event, email, isCancelled);
        if (result.success) {
          return {
            success: true,
            message: result.message
          };
        }
        log(`Método Gmail falhou, tentando método alternativo`, 'email');
      } catch (gmailError) {
        log(`Erro no método Gmail: ${gmailError}`, 'email');
        // Continua para o método alternativo se o Gmail falhar
      }
    }
    
    // Verificar se temos credenciais configuradas para o método alternativo
    let transporter;
    let previewUrl;
    
    if (emailConfig.user && emailConfig.pass) {
      // Usa credenciais configuradas
      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: emailConfig.user,
          pass: emailConfig.pass
        }
      });
    } else {
      // Cria conta temporária para testes
      const testAccount = await nodemailer.createTestAccount();
      log(`Conta de email temporária criada: ${testAccount.user}`, 'email');
      
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });
    }
    
    // Cria um calendário
    const calendar = ical({
      name: 'Assistente de Agenda'
    });
    
    // Adiciona o evento ao calendário com configurações aprimoradas
    const calEvent = calendar.createEvent({
      start: new Date(event.startDate),
      end: event.endDate ? new Date(event.endDate) : new Date(new Date(event.startDate).getTime() + 60 * 60 * 1000),
      summary: isCancelled ? `CANCELADO: ${event.title}` : event.title,
      description: event.description || '',
      location: event.location || '',
      organizer: {
        name: 'Assistente de Agenda',
        email: emailConfig.user || 'noreply@assistenteagenda.com'
      },
      attendees: [
        {
          name: 'Você',
          email: email,
          rsvp: true
        }
      ]
    });
    
    // Define o método correto para o calendário
    calendar.method(isCancelled ? 'CANCEL' : 'REQUEST');
    
    // Formata a data para exibição
    const formattedDate = format(
      new Date(event.startDate),
      "dd/MM/yyyy 'às' HH:mm",
      { locale: ptBR }
    );
    
    // Determina o remetente
    const sender = emailConfig.user 
      ? `"Assistente de Agenda" <${emailConfig.user}>`
      : `"Assistente de Agenda" <no-reply@assistente-agenda.com>`;
    
    // Configura o email com melhor compatibilidade para calendários
    const mailOptions = {
      from: sender,
      to: email,
      subject: isCancelled 
        ? `Cancelado: ${event.title} - ${formattedDate}`
        : `Convite: ${event.title} - ${formattedDate}`,
      text: `
        ${isCancelled ? 'Evento Cancelado' : 'Novo Evento'}
        
        Evento: ${event.title}
        Data: ${formattedDate}
        ${event.location ? `Local: ${event.location}` : ''}
        ${event.description ? `Descrição: ${event.description}` : ''}
        
        Este ${isCancelled ? 'cancelamento' : 'convite'} foi enviado pelo Assistente de Agenda.
      `,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <div style="background-color: ${isCancelled ? '#ff6b6b' : '#0088cc'}; color: white; padding: 10px; border-radius: 5px 5px 0 0;">
            <h2 style="margin: 0;">${isCancelled ? 'Evento Cancelado' : 'Convite para Evento'}</h2>
          </div>
          <div style="padding: 20px;">
            <h3 style="color: #333;">${isCancelled ? `CANCELADO: ${event.title}` : event.title}</h3>
            <p style="color: #666;"><strong>Data:</strong> ${formattedDate}</p>
            ${event.location ? `<p style="color: #666;"><strong>Local:</strong> ${event.location}</p>` : ''}
            ${event.description ? `<p style="color: #666;"><strong>Descrição:</strong> ${event.description}</p>` : ''}
            <p style="margin-top: 30px; color: #888;">Este ${isCancelled ? 'cancelamento' : 'convite'} foi enviado pelo Assistente de Agenda.</p>
            <p style="margin-top: 10px; color: #888;">Veja o anexo .ics para adicionar ao seu calendário ou clique no botão "Adicionar ao calendário" no seu aplicativo de email.</p>
          </div>
        </div>
      `,
      icalEvent: {
        filename: isCancelled ? 'cancelamento.ics' : 'convite.ics',
        method: isCancelled ? 'CANCEL' : 'REQUEST',
        content: calendar.toString()
      },
      headers: {
        'Content-Type': 'text/calendar; charset=UTF-8; method=' + (isCancelled ? 'CANCEL' : 'REQUEST'),
        'Content-Transfer-Encoding': '7bit',
        'X-Mailer': 'Assistente de Agenda'
      },
      alternatives: [
        {
          contentType: 'text/calendar; charset=UTF-8; method=' + (isCancelled ? 'CANCEL' : 'REQUEST'),
          content: calendar.toString()
        }
      ]
    };
    
    // Envia o email
    const info = await transporter.sendMail(mailOptions);
    
    const actionType = isCancelled ? 'Cancelamento' : 'Convite';
    log(`${actionType} de calendário enviado para ${email}`, 'email');
    
    // Se for uma conta de teste, obtém a URL de visualização
    if (info.messageId && !emailConfig.user) {
      const testMessageUrl = nodemailer.getTestMessageUrl(info);
      if (typeof testMessageUrl === 'string') {
        previewUrl = testMessageUrl;
        log(`Prévia do email: ${previewUrl}`, 'email');
      }
    }
    
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

// Verifica se uma mensagem parece descrever um evento
function isEventMessage(text: string): boolean {
  const keywords = [
    'agendar', 'marcar', 'criar evento', 'criar compromisso', 'reunião', 
    'reuniao', 'lembrar', 'encontro', 'consulta', 'compromisso'
  ];
  
  const lowerText = text.toLowerCase();
  return keywords.some(keyword => lowerText.includes(keyword));
}

// Extrai informações de evento de uma mensagem
function extractEventInfo(text: string): {
  title: string;
  startDate: Date;
  endDate?: Date;
  location?: string;
  description?: string;
} {
  // Padrões para extrair informações
  const today = new Date();
  let startDate = new Date();
  let title = '';
  let location = '';
  let description = '';
  
  // Converter para minúsculas para facilitar as comparações
  const textoLower = text.toLowerCase();
  
  // Extrai o título
  if (textoLower.includes('reunião com') || textoLower.includes('reuniao com')) {
    const match = text.match(/reuni[ãa]o com\s+([^,.\n]+)/i);
    if (match) {
      title = `Reunião com ${match[1].trim()}`;
    } else {
      title = 'Reunião';
    }
  } else if (textoLower.includes('lembrar de')) {
    const match = text.match(/lembrar de\s+([^,.\n]+)/i);
    if (match) {
      title = match[1].trim();
    } else {
      title = 'Lembrete';
    }
  } else {
    // Título genérico baseado nas primeiras palavras
    const words = text.split(' ').slice(0, 5).join(' ');
    title = words.length > 30 ? words.substring(0, 27) + '...' : words;
  }
  
  // Próximos dias da semana
  if (textoLower.includes("próxima segunda") || textoLower.includes("proxima segunda")) {
    // Encontra a próxima segunda-feira
    startDate.setDate(today.getDate() + ((1 + 7 - today.getDay()) % 7));
  } else if (textoLower.includes("próxima terça") || textoLower.includes("proxima terca")) {
    // Encontra a próxima terça-feira
    startDate.setDate(today.getDate() + ((2 + 7 - today.getDay()) % 7));
  } else if (textoLower.includes("próxima quarta") || textoLower.includes("proxima quarta")) {
    // Encontra a próxima quarta-feira
    startDate.setDate(today.getDate() + ((3 + 7 - today.getDay()) % 7));
  } else if (textoLower.includes("próxima quinta") || textoLower.includes("proxima quinta")) {
    // Encontra a próxima quinta-feira
    startDate.setDate(today.getDate() + ((4 + 7 - today.getDay()) % 7));
  } else if (textoLower.includes("próxima sexta") || textoLower.includes("proxima sexta")) {
    // Encontra a próxima sexta-feira
    startDate.setDate(today.getDate() + ((5 + 7 - today.getDay()) % 7));
  } else if (textoLower.includes("próximo sábado") || textoLower.includes("proximo sabado")) {
    // Encontra o próximo sábado
    startDate.setDate(today.getDate() + ((6 + 7 - today.getDay()) % 7));
  } else if (textoLower.includes("próximo domingo") || textoLower.includes("proximo domingo")) {
    // Encontra o próximo domingo
    startDate.setDate(today.getDate() + ((0 + 7 - today.getDay()) % 7));
  } else if (textoLower.includes("amanhã") || textoLower.includes("amanha")) {
    // Define para amanhã
    startDate.setDate(today.getDate() + 1);
  } else if (textoLower.includes("hoje")) {
    // Mantém a data de hoje
  } else {
    // Se não houver menção específica à data, assume que é amanhã
    startDate.setDate(today.getDate() + 1);
  }
  
  // Define a hora mencionada ou padrão
  if (textoLower.includes("10h") || textoLower.includes("10:00") || 
      textoLower.includes("às 10") || textoLower.includes("as 10")) {
    startDate.setHours(10, 0, 0, 0);
  } else if (textoLower.includes("11h") || textoLower.includes("11:00") || 
             textoLower.includes("às 11") || textoLower.includes("as 11")) {
    startDate.setHours(11, 0, 0, 0);
  } else if (textoLower.includes("12h") || textoLower.includes("12:00") || 
             textoLower.includes("às 12") || textoLower.includes("as 12") || 
             textoLower.includes("meio dia")) {
    startDate.setHours(12, 0, 0, 0);
  } else if (textoLower.includes("13h") || textoLower.includes("13:00") || 
             textoLower.includes("às 13") || textoLower.includes("as 13") || 
             textoLower.includes("1 da tarde")) {
    startDate.setHours(13, 0, 0, 0);
  } else if (textoLower.includes("14h") || textoLower.includes("14:00") || 
             textoLower.includes("às 14") || textoLower.includes("as 14") || 
             textoLower.includes("2 da tarde")) {
    startDate.setHours(14, 0, 0, 0);
  } else if (textoLower.includes("15h") || textoLower.includes("15:00") || 
             textoLower.includes("às 15") || textoLower.includes("as 15") || 
             textoLower.includes("3 da tarde")) {
    startDate.setHours(15, 0, 0, 0);
  } else {
    // Hora padrão para compromissos
    startDate.setHours(10, 0, 0, 0);
  }
  
  // Extrai local se mencionado
  if (textoLower.includes('em ') || textoLower.includes('no ') || textoLower.includes('na ')) {
    const locationMatch = text.match(/(em|no|na)\s+([^,.\n]+)/i);
    if (locationMatch) {
      location = locationMatch[2].trim();
    }
  }
  
  // Calcula a data de término (1 hora após o início por padrão)
  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
  
  // O texto original serve como descrição
  description = text;
  
  log(`Evento extraído: ${title} em ${startDate.toISOString()}`, 'telegram');
  
  return {
    title,
    startDate,
    endDate,
    location,
    description
  };
}

// Encontra ou cria um usuário a partir dos dados do Telegram
async function findOrCreateUser(telegramUser: any) {
  try {
    const telegramId = telegramUser.id.toString();
    
    // Tenta encontrar o usuário pelo ID do Telegram
    let user = await storage.getUserByTelegramId(telegramId);
    
    if (!user) {
      // Se não existir, cria um novo usuário
      user = await storage.createUser({
        username: telegramUser.username || `user_${telegramId}`,
        password: `telegram_${telegramId}`, // Senha temporária para satisfazer o schema
        telegramId,
        email: null,
        name: `${telegramUser.first_name || ''} ${telegramUser.last_name || ''}`.trim() || null
      });
      
      log(`Novo usuário criado: ${user.username}`, 'telegram');
    }
    
    return user;
  } catch (error) {
    log(`Erro ao encontrar/criar usuário: ${error}`, 'telegram');
    throw error;
  }
}

// Função para validar e-mail
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

// Tratamento de erros global
bot.catch((err: any, ctx: any) => {
  log(`Erro no bot do Telegram: ${err}`, 'telegram');
  ctx.reply('Ocorreu um erro inesperado. Por favor, tente novamente mais tarde.');
});

// Inicia o bot
export async function startSimpleBot() {
  try {
    // Define os comandos disponíveis
    await bot.telegram.setMyCommands([
      { command: 'start', description: 'Iniciar o bot' },
      { command: 'help', description: 'Mostrar ajuda' },
      { command: 'ajuda', description: 'Exibir comandos disponíveis' },
      { command: 'email', description: 'Configurar seu e-mail para receber convites' },
      { command: 'configurar_email', description: 'Configurar e-mail remetente (admin)' },
      { command: 'apagar', description: 'Apagar um evento do calendário' }
    ]);
    
    await bot.launch();
    log('Bot do Telegram iniciado com sucesso!', 'telegram');
    
    // Encerramento correto do bot
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
    
    return true;
  } catch (error) {
    log(`Erro ao iniciar bot do Telegram: ${error}`, 'telegram');
    return false;
  }
}

export default bot;