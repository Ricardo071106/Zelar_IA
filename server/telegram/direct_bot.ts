/**
 * Bot Telegram usando API direta sem polling
 * Abordagem manual para evitar conflitos
 */

import { parseEventWithClaude } from '../utils/claudeParser';
import { DateTime } from 'luxon';
import { getUserTimezone, extractEventTitle } from './utils/parseDate';
import { storage } from '../storage';
import type { InsertEvent } from '@shared/schema';
import { addEventToGoogleCalendar, setTokens, cancelGoogleCalendarEvent } from './googleCalendarIntegration';
import { reminderService } from '../services/reminderService';

const TELEGRAM_API = 'https://api.telegram.org/bot';

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: { id: number; username?: string };
    text: string;
    chat: { id: number };
  };
  callback_query?: {
    id: string;
    from: { id: number; username?: string };
    message: {
      message_id: number;
      chat: { id: number };
    };
    data: string;
  };
}

interface Event {
  title: string;
  startDate: string;
  description: string;
  displayDate: string;
  conferenceLink?: string;
}

let lastUpdateId = 0;

function generateCalendarLinks(event: Event) {
  const startDate = new Date(event.startDate);
  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

  const formatDate = (date: Date) => date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${formatDate(startDate)}/${formatDate(endDate)}`;

  const outlookUrl = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(event.title)}&startdt=${startDate.toISOString()}&enddt=${endDate.toISOString()}`;

  return { google: googleUrl, outlook: outlookUrl };
}

function parseReminderOffset(token: string): number | null {
  const match = token.match(/^(\d+)(h|m)$/i);
  if (!match) return null;
  const value = parseInt(match[1], 10);
  if (Number.isNaN(value)) return null;
  return match[2].toLowerCase() === 'm' ? value / 60 : value;
}

async function sendMessage(chatId: number, text: string, replyMarkup?: any): Promise<boolean> {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      console.error('❌ TELEGRAM_BOT_TOKEN não configurado');
      return false;
    }

    const payload = {
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
      reply_markup: replyMarkup
    };

    console.log('📤 Enviando para Telegram API:', JSON.stringify(payload).substring(0, 200));

    const response = await fetch(`${TELEGRAM_API}${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`❌ Erro Telegram API (${response.status}):`, errorData);
      return false;
    }

    const responseData = await response.json();
    console.log('✅ Resposta Telegram API:', JSON.stringify(responseData).substring(0, 200));
    return true;
  } catch (error) {
    console.error('❌ Erro ao enviar mensagem:', error);
    return false;
  }
}

export async function sendTelegramNotification(chatId: number, text: string): Promise<boolean> {
  return sendMessage(chatId, text);
}

async function answerCallbackQuery(callbackId: string, text?: string): Promise<boolean> {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return false;

    const response = await fetch(`${TELEGRAM_API}${token}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackId,
        text: text || '',
        show_alert: false
      })
    });

    return response.ok;
  } catch (error) {
    console.error('❌ Erro ao responder callback:', error);
    return false;
  }
}

async function setupBotCommands(token: string): Promise<void> {
  try {
    const commands = [
      {
        command: 'start',
        description: 'Iniciar o assistente e ver instruções'
      },
      {
        command: 'help',
        description: 'Mostrar ajuda completa e exemplos'
      },
      {
        command: 'eventos',
        description: 'Ver próximos eventos agendados'
      },
      {
        command: 'editar',
        description: 'Editar um evento existente'
      },
      {
        command: 'deletar',
        description: 'Deletar um evento'
      },
      {
        command: 'conectar',
        description: 'Conectar Google Calendar'
      },
      {
        command: 'desconectar',
        description: 'Desconectar Google Calendar'
      },
      {
        command: 'status',
        description: 'Ver status da conexão com calendário'
      },
      {
        command: 'timezone',
        description: 'Alterar fuso horário'
      }
    ];

    const response = await fetch(`${TELEGRAM_API}${token}/setMyCommands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commands })
    });

    if (response.ok) {
      console.log('✅ Comandos configurados no menu do bot');
    } else {
      console.log('⚠️ Falha ao configurar comandos');
    }
  } catch (error) {
    console.error('❌ Erro ao configurar comandos:', error);
  }
}

async function getUpdates(): Promise<TelegramUpdate[]> {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return [];

    const response = await fetch(`${TELEGRAM_API}${token}/getUpdates?offset=${lastUpdateId + 1}&timeout=1`);
    if (!response.ok) return [];

    const data = await response.json();
    if (!data.ok || !data.result) return [];

    return data.result;
  } catch (error) {
    console.error('❌ Erro ao buscar updates:', error);
    return [];
  }
}

async function processUpdate(update: TelegramUpdate): Promise<void> {
  // Processar callback queries (botões inline)
  if (update.callback_query) {
    const callbackData = update.callback_query.data;
    const chatId = update.callback_query.message.chat.id;
    const callbackId = update.callback_query.id;

    console.log(`🔘 Callback: "${callbackData}" do chat ${chatId}`);

    // Processar deletar evento
    if (callbackData?.startsWith('delete_')) {
      const eventId = parseInt(callbackData.replace('delete_', ''));

      try {
        const telegramUserId = update.callback_query?.from?.id?.toString();
        if (!telegramUserId) {
          await answerCallbackQuery(callbackId, '❌ Erro ao identificar usuário');
          return;
        }

        const dbUser = await storage.getUserByTelegramId(telegramUserId);
        if (!dbUser) {
          await answerCallbackQuery(callbackId, '❌ Usuário não encontrado');
          return;
        }

        // Buscar evento
        const event = await storage.getEvent(eventId);

        if (!event) {
          await sendMessage(chatId, '❌ Evento não encontrado.');
          await answerCallbackQuery(callbackId);
          return;
        }

        // Verificar se o evento pertence ao usuário
        if (event.userId !== dbUser.id) {
          await sendMessage(chatId, '❌ Você não tem permissão para deletar este evento.');
          await answerCallbackQuery(callbackId);
          return;
        }

        // Deletar do Google Calendar se estiver conectado
        if (event.calendarId) {
          const settings = await storage.getUserSettings(dbUser.id);
          if (settings?.googleTokens) {
            const tokens = JSON.parse(settings.googleTokens);
            setTokens(dbUser.id, tokens);

            const googleResult = await cancelGoogleCalendarEvent(event.calendarId, dbUser.id);
            if (googleResult.success) {
              console.log('✅ Evento deletado do Google Calendar');
            } else {
              console.log('⚠️ Não foi possível deletar do Google Calendar:', googleResult.message);
            }
          }
        }

        // Deletar do banco
        await reminderService.deleteEventReminders(eventId);
        await storage.deleteEvent(eventId);

        await sendMessage(chatId,
          `✅ *Evento deletado com sucesso!*\n\n` +
          `🗑️ ${event.title}\n` +
          `📅 ${DateTime.fromJSDate(event.startDate).setZone('America/Sao_Paulo').toFormat('dd/MM/yyyy HH:mm')}`
        );

        await answerCallbackQuery(callbackId, 'Evento deletado!');

      } catch (error) {
        console.error('❌ Erro ao deletar evento:', error);
        await sendMessage(chatId, '❌ Erro ao deletar evento. Tente novamente.');
        await answerCallbackQuery(callbackId, 'Erro ao deletar');
      }
      return;
    }

    // Processar editar evento
    if (callbackData?.startsWith('edit_')) {
      const eventId = parseInt(callbackData.replace('edit_', ''));

      try {
        const telegramUserId = update.callback_query?.from?.id?.toString();
        if (!telegramUserId) {
          await answerCallbackQuery(callbackId, '❌ Erro ao identificar usuário');
          return;
        }

        const dbUser = await storage.getUserByTelegramId(telegramUserId);
        if (!dbUser) {
          await answerCallbackQuery(callbackId, '❌ Usuário não encontrado');
          return;
        }

        // Buscar evento
        const event = await storage.getEvent(eventId);

        if (!event) {
          await sendMessage(chatId, '❌ Evento não encontrado.');
          await answerCallbackQuery(callbackId);
          return;
        }

        // Verificar se o evento pertence ao usuário
        if (event.userId !== dbUser.id) {
          await sendMessage(chatId, '❌ Você não tem permissão para editar este evento.');
          await answerCallbackQuery(callbackId);
          return;
        }

        const date = DateTime.fromJSDate(event.startDate).setZone('America/Sao_Paulo');

        await sendMessage(chatId,
          `✏️ *Editar Evento*\n\n` +
          `📋 *Evento atual:*\n` +
          `🎯 ${event.title}\n` +
          `📅 ${date.toFormat('dd/MM/yyyy HH:mm')}\n\n` +
          `💡 *Como editar:*\n` +
          `Envie uma mensagem no formato:\n` +
          `\`editar ${eventId} novo título amanhã às 15h\`\n\n` +
          `Ou apenas o novo horário:\n` +
          `\`editar ${eventId} amanhã às 15h\``
        );

        await answerCallbackQuery(callbackId, 'Envie o novo conteúdo');

      } catch (error) {
        console.error('❌ Erro ao buscar evento para editar:', error);
        await sendMessage(chatId, '❌ Erro ao buscar evento. Tente novamente.');
        await answerCallbackQuery(callbackId, 'Erro');
      }
      return;
    }

    // Processar seleção de fuso horário
    if (callbackData?.startsWith('tz_')) {
      const timezoneMap: { [key: string]: string } = {
        'tz_brazil': 'America/Sao_Paulo',
        'tz_us_east': 'America/New_York',
        'tz_us_central': 'America/Chicago',
        'tz_us_west': 'America/Los_Angeles',
        'tz_london': 'Europe/London',
        'tz_europe': 'Europe/Berlin',
        'tz_moscow': 'Europe/Moscow',
        'tz_india': 'Asia/Kolkata',
        'tz_china': 'Asia/Shanghai',
        'tz_japan': 'Asia/Tokyo',
        'tz_sydney': 'Australia/Sydney',
        'tz_newzealand': 'Pacific/Auckland'
      };

      const timezoneNames: { [key: string]: string } = {
        'tz_brazil': 'Brasil/Argentina (UTC-3)',
        'tz_us_east': 'EUA Leste/Canadá (UTC-5)',
        'tz_us_central': 'EUA Central/México (UTC-6)',
        'tz_us_west': 'EUA Oeste (UTC-8)',
        'tz_london': 'Londres/Dublin (UTC+0)',
        'tz_europe': 'Europa Central (UTC+1)',
        'tz_moscow': 'Moscou/Turquia (UTC+3)',
        'tz_india': 'Índia (UTC+5:30)',
        'tz_china': 'China/Singapura (UTC+8)',
        'tz_japan': 'Japão/Coreia (UTC+9)',
        'tz_sydney': 'Austrália Leste (UTC+10)',
        'tz_newzealand': 'Nova Zelândia (UTC+12)'
      };

      const selectedTimezone = timezoneMap[callbackData];
      const timezoneName = timezoneNames[callbackData];

      if (selectedTimezone) {
        await sendMessage(chatId,
          `✅ *Fuso horário atualizado!*\n\n` +
          `🌍 Região: ${timezoneName}\n` +
          `⏰ Agora todos os eventos serão criados neste fuso horário.\n\n` +
          `💡 Envie uma mensagem como "reunião amanhã às 14h" para testar!`
        );

        await answerCallbackQuery(callbackId, `Fuso horário definido: ${timezoneName}`);
      }
    }

    return;
  }

  if (!update.message || !update.message.text) return;

  const message = update.message.text;
  const chatId = update.message.chat.id;

  console.log(`📩 Mensagem: "${message}" do chat ${chatId}`);

  // Comando /start
  if (message === '/start') {
    // Buscar ou criar usuário
    const userId = update.message?.from?.id;
    const username = update.message?.from?.username || `telegram_${userId}`;

    if (userId) {
      try {
        let user = await storage.getUserByTelegramId(userId.toString());

        if (!user) {
          // Criar novo usuário
          user = await storage.createUser({
            username: username,
            password: `telegram_${userId}`, // Senha placeholder para usuários do Telegram
            telegramId: userId.toString(),
            name: username,
          });

          // Criar configurações padrão
          await storage.createUserSettings({
            userId: user.id,
            notificationsEnabled: true,
            reminderTimes: [12], // 12 horas antes
            language: 'pt-BR',
            timeZone: 'America/Sao_Paulo',
          });

          console.log(`✅ Novo usuário criado: ${username} (ID: ${user.id})`);
        } else {
          console.log(`✅ Usuário existente: ${username} (ID: ${user.id})`);
        }
      } catch (error) {
        console.error('❌ Erro ao buscar/criar usuário:', error);
      }
    }

    await sendMessage(chatId,
      '🤖 *Zelar - Assistente de Agendamento*\n\n' +
      '💡 *Como usar:*\n' +
      '• "jantar hoje às 19h"\n' +
      '• "reunião amanhã às 15h"\n' +
      '• "consulta sexta às 10h"\n\n' +
      '🌍 *Fuso horário:* Brasil (UTC-3)\n' +
      'Use /timezone para alterar\n\n' +
      '📝 *Comandos:*\n' +
      '/timezone - Alterar fuso horário\n' +
      '/help - Ajuda completa\n\n' +
      'Envie qualquer mensagem com data e horário!'
    );
    return;
  }

  // Verificar assinatura para outros comandos
  const telegramUserId = update.message?.from?.id?.toString();
  if (telegramUserId) {
    try {
      const dbUser = await storage.getUserByTelegramId(telegramUserId);
      if (dbUser && dbUser.subscriptionStatus !== 'active') { // Se usuário existe mas não é assinante
        const paymentLink = process.env.STRIPE_PAYMENT_LINK || 'https://zelar.ai/pricing';
        const finalUrl = paymentLink.includes('stripe.com')
          ? `${paymentLink}?client_reference_id=${dbUser.id}`
          : paymentLink;

        await sendMessage(chatId,
          '🔒 *Recurso exclusivo para assinantes*\n\n' +
          'Para continuar usando a Zelar IA e ter acesso a todas as funcionalidades de agendamento, ' +
          'você precisa ter uma assinatura ativa.\n\n' +
          '🚀 *Faça um upgrade agora:*\n' +
          `🔗 [Clique aqui para Assinar](${finalUrl})`
        );
        return;
      }
    } catch (error) {
      console.error('Erro ao verificar assinatura:', error);
    }
  }

  // Comando /help
  if (message === '/help') {
    const helpText = `
Assistente Zelar - Ajuda

Como usar:
Envie mensagens naturais como:
- "reunião com cliente amanhã às 14h"
- "jantar com família sexta às 19h30"
- "consulta médica terça-feira às 10h"
- "call de projeto quinta às 15h"

Comandos:
/eventos - Ver seus próximos eventos
/editar - Editar um evento existente
/deletar - Deletar um evento
/lembretes - Ver lembretes pendentes
/lembrete ID 2h - Criar lembrete (horas antes)
/editarlembrete ID 1h - Editar lembrete
/deletarlembrete ID - Remover lembrete
/conectar - Conectar Google Calendar
/desconectar - Desconectar Google Calendar
/status - Ver status da conex?o
/timezone - Alterar fuso hor?rio
/start - Mensagem inicial

Para editar:
\`editar ID novo título amanhã às 15h\`

Fuso atual: Brasil (UTC-3)
`;
    await sendMessage(chatId, helpText.trim());
    return;
  }

  // Comando /conectar - Conectar Google Calendar
  if (message === '/conectar') {
    console.log('🔗 Comando /conectar detectado!');
    const telegramUserId = update.message?.from?.id?.toString();

    if (!telegramUserId) {
      console.log('❌ Telegram userId não encontrado');
      await sendMessage(chatId, '❌ Não foi possível identificar seu usuário.');
      return;
    }

    console.log(`✅ Telegram userId: ${telegramUserId}`);

    try {
      // Verificar se já está conectado
      console.log('🔍 Buscando usuário no banco...');
      const dbUser = await storage.getUserByTelegramId(telegramUserId);

      if (!dbUser) {
        console.log('❌ Usuário não encontrado no banco');
        await sendMessage(chatId,
          '❌ *Usuário não encontrado*\n\n' +
          'Por favor, envie /start primeiro para criar sua conta.'
        );
        return;
      }

      console.log(`✅ Usuário encontrado: ${dbUser.username} (ID: ${dbUser.id})`);

      const settings = await storage.getUserSettings(dbUser.id);
      console.log(`🔍 Settings: ${settings ? 'Encontrado' : 'Não encontrado'}`);

      if (settings?.googleTokens) {
        console.log('✅ Já está conectado ao Google Calendar');
        await sendMessage(chatId,
          '✅ *Você já está conectado!*\n\n' +
          'Seu Google Calendar já está integrado.\n' +
          'Use /desconectar se quiser remover a conexão.'
        );
        return;
      }

      // Gerar URL de autorização
      console.log('🔗 Gerando URL de autorização...');
      const baseUrl = process.env.BASE_URL || 'http://localhost:8080';
      const authUrl = `${baseUrl}/api/auth/google/authorize?userId=${telegramUserId}&platform=telegram`;
      console.log(`📎 URL gerada: ${authUrl}`);

      console.log('📤 Enviando mensagem com botão...');

      // Se for localhost, enviar sem botão (Telegram não aceita localhost em botões)
      if (authUrl.includes('localhost')) {
        await sendMessage(chatId,
          '🔐 *Conectar Google Calendar*\n\n' +
          'Para criar eventos automaticamente no seu Google Calendar, ' +
          'você precisa autorizar o acesso.\n\n' +
          '🔗 Copie e cole este link no navegador:\n' +
          `\`${authUrl}\`\n\n` +
          '⚠️ *Nota:* Como você está usando localhost, não posso criar um botão. ' +
          'Use ngrok (https://ngrok.com) para ter uma URL pública e botões funcionais.\n\n' +
          '✨ Após autorizar, seus eventos serão criados automaticamente!'
        );
      } else {
        // URL pública, pode usar botão
        await sendMessage(chatId,
          '🔐 *Conectar Google Calendar*\n\n' +
          'Para criar eventos automaticamente no seu Google Calendar, ' +
          'você precisa autorizar o acesso.\n\n' +
          '🔗 Clique no botão abaixo:\n\n' +
          '✨ Após autorizar, seus eventos serão criados automaticamente!',
          {
            inline_keyboard: [[
              { text: '🔗 Conectar Google Calendar', url: authUrl }
            ]]
          }
        );
      }
      console.log('✅ Mensagem enviada com sucesso!');
    } catch (error) {
      console.error('❌ Erro ao gerar URL de autorização:', error);
      await sendMessage(chatId,
        '❌ *Erro ao conectar*\n\n' +
        'Ocorreu um erro ao gerar o link de autorização.\n' +
        'Por favor, tente novamente mais tarde.'
      );
    }
    return;
  }

  // Comando /desconectar - Desconectar Google Calendar
  if (message === '/desconectar') {
    const telegramUserId = update.message?.from?.id?.toString();

    if (!telegramUserId) {
      await sendMessage(chatId, '❌ Não foi possível identificar seu usuário.');
      return;
    }

    try {
      const dbUser = await storage.getUserByTelegramId(telegramUserId);

      if (!dbUser) {
        await sendMessage(chatId, '❌ Usuário não encontrado.');
        return;
      }

      const settings = await storage.getUserSettings(dbUser.id);

      if (!settings?.googleTokens) {
        await sendMessage(chatId,
          '📭 *Não conectado*\n\n' +
          'Você não está conectado ao Google Calendar.\n' +
          'Use /conectar para fazer a conexão.'
        );
        return;
      }

      // Desconectar
      await storage.updateUserSettings(dbUser.id, {
        googleTokens: null,
        calendarProvider: null,
      });

      await sendMessage(chatId,
        '✅ *Desconectado com sucesso!*\n\n' +
        'Seu Google Calendar foi desconectado.\n' +
        'Use /conectar quando quiser conectar novamente.'
      );
    } catch (error) {
      console.error('❌ Erro ao desconectar:', error);
      await sendMessage(chatId, '❌ Erro ao desconectar. Tente novamente.');
    }
    return;
  }

  // Comando /status - Ver status da conexão
  if (message === '/status') {
    const telegramUserId = update.message?.from?.id?.toString();

    if (!telegramUserId) {
      await sendMessage(chatId, '❌ Não foi possível identificar seu usuário.');
      return;
    }

    try {
      const dbUser = await storage.getUserByTelegramId(telegramUserId);

      if (!dbUser) {
        await sendMessage(chatId, '❌ Usuário não encontrado. Use /start primeiro.');
        return;
      }

      const settings = await storage.getUserSettings(dbUser.id);
      const isConnected = !!(settings?.googleTokens);

      if (isConnected) {
        await sendMessage(chatId,
          '✅ *Google Calendar Conectado*\n\n' +
          '🔗 Seu Google Calendar está integrado\n' +
          '✨ Eventos são criados automaticamente\n\n' +
          'Use /desconectar para remover a conexão.'
        );
      } else {
        await sendMessage(chatId,
          '📭 *Google Calendar não conectado*\n\n' +
          '🔗 Use /conectar para integrar seu calendário\n' +
          '✨ Eventos serão criados automaticamente após conectar!'
        );
      }
    } catch (error) {
      console.error('❌ Erro ao verificar status:', error);
      await sendMessage(chatId, '❌ Erro ao verificar status.');
    }
    return;
  }

  // Comando /eventos - Listar eventos do usuário
  if (message === '/eventos' || message === '/events') {
    const telegramUserId = update.message?.from?.id?.toString();

    if (!telegramUserId) {
      await sendMessage(chatId, '❌ Não foi possível identificar seu usuário.');
      return;
    }

    try {
      const dbUser = await storage.getUserByTelegramId(telegramUserId);

      if (!dbUser) {
        await sendMessage(chatId,
          '📭 *Nenhum evento encontrado*\n\n' +
          'Você ainda não criou nenhum evento.\n' +
          'Envie uma mensagem como "reunião amanhã às 14h" para criar seu primeiro evento!'
        );
        return;
      }

      const events = await storage.getUpcomingEvents(dbUser.id, 5);

      if (events.length === 0) {
        await sendMessage(chatId,
          '📭 *Nenhum evento próximo*\n\n' +
          'Você não tem eventos futuros agendados.\n' +
          'Envie uma mensagem como "consulta médica sexta às 10h" para criar um evento!'
        );
        return;
      }

      let response = '📅 *Seus próximos eventos:*\n\n';

      events.forEach((event, index) => {
        const date = DateTime.fromJSDate(event.startDate).setZone('America/Sao_Paulo');
        const formattedDate = date.toFormat('dd/MM/yyyy HH:mm', { locale: 'pt-BR' });
        const dayOfWeek = date.toFormat('EEEE', { locale: 'pt-BR' });

        response += `${index + 1}. 🎯 *${event.title}*\n`;
        response += `   📅 ${dayOfWeek}, ${formattedDate}\n`;
        if (event.description && event.description !== event.title) {
          response += `   📝 ${event.description}\n`;
        }
        response += '\n';
      });

      await sendMessage(chatId, response);
    } catch (error) {
      console.error('❌ Erro ao buscar eventos:', error);
      await sendMessage(chatId, '❌ Erro ao buscar seus eventos. Tente novamente mais tarde.');
    }
    return;
  }


  // Comando /lembretes - Listar lembretes pendentes
  if (message === '/lembretes') {
    const telegramUserId = update.message?.from?.id?.toString();

    if (!telegramUserId) {
      await sendMessage(chatId, '❌ Não foi possível identificar seu usuário.');
      return;
    }

    try {
      const dbUser = await storage.getUserByTelegramId(telegramUserId);
      if (!dbUser) {
        await sendMessage(chatId, '❌ Usuário não encontrado. Use /start primeiro.');
        return;
      }

      const settings = await storage.getUserSettings(dbUser.id);
      const timezone = settings?.timeZone || 'America/Sao_Paulo';
      const reminders = await storage.getUserPendingReminders(dbUser.id);

      if (reminders.length === 0) {
        await sendMessage(chatId, '📭 *Nenhum lembrete pendente*\n\
Use o comando \`lembrete ID 2h\` para criar um.');
        return;
      }

      let response = '📅 *Seus lembretes pendentes:*\
\
';
      for (const reminder of reminders) {
        const event = await storage.getEvent(reminder.eventId);
        if (!event) continue;
        const sendTime = DateTime.fromJSDate(reminder.sendAt).setZone(timezone).toFormat('dd/MM/yyyy HH:mm');
        response += `#${reminder.id} - ${event.title}\n`;
        response += `   ?? Envio: ${sendTime} (${reminder.channel})\n`;
        response += `   ??? Evento: ${event.id}\n\n`;
      }

      response += '💡 Para criar: `/lembrete EVENTO_ID 2h`\n';
      response += '✏️ Para editar: `/editarlembrete LEMBRETE_ID 1h`\n';
      response += '🗑️ Para deletar: `/deletarlembrete LEMBRETE_ID`';

      await sendMessage(chatId, response);
    } catch (error) {
      console.error('❌ Erro ao listar lembretes:', error);
      await sendMessage(chatId, '❌ Não foi possível listar seus lembretes agora.');
    }
    return;
  }

  // Comando /deletar - Deletar evento
  if (message === '/deletar' || message === '/delete') {
    const telegramUserId = update.message?.from?.id?.toString();

    if (!telegramUserId) {
      await sendMessage(chatId, '❌ Não foi possível identificar seu usuário.');
      return;
    }

    try {
      const dbUser = await storage.getUserByTelegramId(telegramUserId);

      if (!dbUser) {
        await sendMessage(chatId, '❌ Usuário não encontrado. Use /start primeiro.');
        return;
      }

      const events = await storage.getUpcomingEvents(dbUser.id, 10);

      if (events.length === 0) {
        await sendMessage(chatId,
          '📭 *Nenhum evento para deletar*\n\n' +
          'Você não tem eventos futuros agendados.'
        );
        return;
      }

      // Criar botões inline para cada evento
      const buttons = events.map((event, index) => {
        const date = DateTime.fromJSDate(event.startDate).setZone('America/Sao_Paulo');
        const formattedDate = date.toFormat('dd/MM HH:mm');
        return [{
          text: `${index + 1}. ${event.title} - ${formattedDate}`,
          callback_data: `delete_${event.id}`
        }];
      });

      await sendMessage(chatId,
        '🗑️ *Deletar Evento*\n\n' +
        'Selecione o evento que deseja deletar:',
        { inline_keyboard: buttons }
      );

    } catch (error) {
      console.error('❌ Erro ao listar eventos para deletar:', error);
      await sendMessage(chatId, '❌ Erro ao buscar eventos. Tente novamente.');
    }
    return;
  }


  // Criar lembrete manual para um evento
  if (message.toLowerCase().startsWith('/lembrete ')) {
    const parts = message.split(' ');
    const eventId = parseInt(parts[1]);
    const offset = parseReminderOffset(parts[2] || '');
    const customMessage = parts.slice(3).join(' ').trim() || undefined;

    if (Number.isNaN(eventId) || offset === null) {
      await sendMessage(chatId, '❌ Formato inválido. Use: `/lembrete ID 2h` ou `/lembrete ID 30m`.');
      return;
    }

    const telegramUserId = update.message?.from?.id?.toString();
    if (!telegramUserId) {
      await sendMessage(chatId, '❌ Não foi possível identificar seu usuário.');
      return;
    }

    try {
      const dbUser = await storage.getUserByTelegramId(telegramUserId);
      if (!dbUser) {
        await sendMessage(chatId, '❌ Usuário não encontrado. Use /start primeiro.');
        return;
      }

      const event = await storage.getEvent(eventId);
      if (!event || event.userId !== dbUser.id) {
        await sendMessage(chatId, '❌ Evento não encontrado ou sem permissão.');
        return;
      }

      const reminder = await reminderService.createReminderWithOffset(event, 'telegram', offset, customMessage);
      const settings = await storage.getUserSettings(dbUser.id);
      const timezone = settings?.timeZone || 'America/Sao_Paulo';
      const sendTime = DateTime.fromJSDate(reminder.sendAt).setZone(timezone).toFormat('dd/MM/yyyy HH:mm');

      await sendMessage(chatId,
        `✅ Lembrete criado!
` +
        `?? Lembrete: ${reminder.id}
` +
        `??? Evento: ${event.title}
` +
        `?? Envio: ${sendTime}`
      );
    } catch (error) {
      console.error('❌ Erro ao criar lembrete:', error);
      await sendMessage(chatId, '❌ Erro ao criar lembrete.');
    }
    return;
  }

  // Editar lembrete existente
  if (message.toLowerCase().startsWith('/editarlembrete ')) {
    const parts = message.split(' ');
    const reminderId = parseInt(parts[1]);
    const offset = parseReminderOffset(parts[2] || '');
    const customMessage = parts.slice(3).join(' ').trim() || undefined;

    if (Number.isNaN(reminderId) || offset === null) {
      await sendMessage(chatId, '❌ Formato inválido. Use: `/editarlembrete ID 1h` ou `/editarlembrete ID 30m`.');
      return;
    }

    try {
      const reminder = await storage.getReminder(reminderId);
      if (!reminder) {
        await sendMessage(chatId, '❌ Lembrete não encontrado.');
        return;
      }

      const telegramUserId = update.message?.from?.id?.toString();
      const dbUser = telegramUserId ? await storage.getUserByTelegramId(telegramUserId) : undefined;
      if (!dbUser || reminder.userId !== dbUser.id) {
        await sendMessage(chatId, '❌ Você não tem permissão para editar este lembrete.');
        return;
      }

      const event = await storage.getEvent(reminder.eventId);
      if (!event) {
        await sendMessage(chatId, '❌ Evento associado não encontrado.');
        return;
      }

      const updated = await reminderService.updateReminderWithOffset(reminderId, event, offset, customMessage);
      if (!updated) {
        await sendMessage(chatId, '❌ Não foi possível atualizar o lembrete.');
        return;
      }

      const settings = await storage.getUserSettings(dbUser.id);
      const timezone = settings?.timeZone || 'America/Sao_Paulo';
      const sendTime = DateTime.fromJSDate(updated.sendAt).setZone(timezone).toFormat('dd/MM/yyyy HH:mm');

      await sendMessage(chatId,
        `✅ Lembrete atualizado!
` +
        `?? Lembrete: ${updated.id}
` +
        `?? Envio: ${sendTime}`
      );
    } catch (error) {
      console.error('❌ Erro ao editar lembrete:', error);
      await sendMessage(chatId, '❌ Erro ao editar lembrete.');
    }
    return;
  }

  // Deletar lembrete
  if (message.toLowerCase().startsWith('/deletarlembrete ')) {
    const parts = message.split(' ');
    const reminderId = parseInt(parts[1]);
    if (Number.isNaN(reminderId)) {
      await sendMessage(chatId, '❌ ID do lembrete inválido. Use: `deletarlembrete ID`.');
      return;
    }

    try {
      const reminder = await storage.getReminder(reminderId);
      if (!reminder) {
        await sendMessage(chatId, '❌ Lembrete não encontrado.');
        return;
      }

      const telegramUserId = update.message?.from?.id?.toString();
      const dbUser = telegramUserId ? await storage.getUserByTelegramId(telegramUserId) : undefined;
      if (!dbUser || reminder.userId !== dbUser.id) {
        await sendMessage(chatId, '❌ Você não tem permissão para deletar este lembrete.');
        return;
      }

      await reminderService.deleteReminder(reminderId);
      await sendMessage(chatId, `✅ Lembrete #${reminderId} deletado.`);
    } catch (error) {
      console.error('❌ Erro ao deletar lembrete:', error);
      await sendMessage(chatId, '❌ Erro ao deletar lembrete.');
    }
    return;
  }

  // Comando /editar - Editar evento
  if (message === '/editar' || message === '/edit') {
    const telegramUserId = update.message?.from?.id?.toString();

    if (!telegramUserId) {
      await sendMessage(chatId, '❌ Não foi possível identificar seu usuário.');
      return;
    }

    try {
      const dbUser = await storage.getUserByTelegramId(telegramUserId);

      if (!dbUser) {
        await sendMessage(chatId, '❌ Usuário não encontrado. Use /start primeiro.');
        return;
      }

      const events = await storage.getUpcomingEvents(dbUser.id, 10);

      if (events.length === 0) {
        await sendMessage(chatId,
          '📭 *Nenhum evento para editar*\n\n' +
          'Você não tem eventos futuros agendados.'
        );
        return;
      }

      // Criar botões inline para cada evento
      const buttons = events.map((event, index) => {
        const date = DateTime.fromJSDate(event.startDate).setZone('America/Sao_Paulo');
        const formattedDate = date.toFormat('dd/MM HH:mm');
        return [{
          text: `${index + 1}. ${event.title} - ${formattedDate}`,
          callback_data: `edit_${event.id}`
        }];
      });

      await sendMessage(chatId,
        '✏️ *Editar Evento*\n\n' +
        'Selecione o evento que deseja editar:',
        { inline_keyboard: buttons }
      );

    } catch (error) {
      console.error('❌ Erro ao listar eventos para editar:', error);
      await sendMessage(chatId, '❌ Erro ao buscar eventos. Tente novamente.');
    }
    return;
  }

  // Comando /timezone
  if (message === '/timezone') {
    const replyMarkup = {
      inline_keyboard: [
        [
          { text: '🇧🇷 Brasil/Argentina (UTC-3)', callback_data: 'tz_brazil' },
          { text: '🇺🇸 EUA Leste/Canadá (UTC-5)', callback_data: 'tz_us_east' }
        ],
        [
          { text: '🇺🇸 EUA Central/México (UTC-6)', callback_data: 'tz_us_central' },
          { text: '🇺🇸 EUA Oeste (UTC-8)', callback_data: 'tz_us_west' }
        ],
        [
          { text: '🇬🇧 Londres/Dublin (UTC+0)', callback_data: 'tz_london' },
          { text: '🇪🇺 Europa Central (UTC+1)', callback_data: 'tz_europe' }
        ],
        [
          { text: '🇷🇺 Moscou/Turquia (UTC+3)', callback_data: 'tz_moscow' },
          { text: '🇮🇳 Índia (UTC+5:30)', callback_data: 'tz_india' }
        ],
        [
          { text: '🇨🇳 China/Singapura (UTC+8)', callback_data: 'tz_china' },
          { text: '🇯🇵 Japão/Coreia (UTC+9)', callback_data: 'tz_japan' }
        ],
        [
          { text: '🇦🇺 Austrália Leste (UTC+10)', callback_data: 'tz_sydney' },
          { text: '🇳🇿 Nova Zelândia (UTC+12)', callback_data: 'tz_newzealand' }
        ]
      ]
    };

    await sendMessage(chatId,
      '🌍 *Selecione seu fuso horário:*\n\n' +
      '🇧🇷 Brasil/Argentina: UTC-3\n' +
      '🇺🇸 EUA Leste/Canadá: UTC-5\n' +
      '🇺🇸 EUA Central/México: UTC-6\n' +
      '🇺🇸 EUA Oeste: UTC-8\n' +
      '🇬🇧 Londres/Dublin: UTC+0\n' +
      '🇪🇺 Europa Central (Alemanha, França, Itália, Espanha): UTC+1\n' +
      '🇷🇺 Moscou/Turquia: UTC+3\n' +
      '🇮🇳 Índia: UTC+5:30\n' +
      '🇨🇳 China/Singapura: UTC+8\n' +
      '🇯🇵 Japão/Coreia: UTC+9\n' +
      '🇦🇺 Austrália Leste: UTC+10\n' +
      '🇳🇿 Nova Zelândia: UTC+12',
      replyMarkup
    );
    return;
  }

  // Processar comando de edição "editar ID ..."
  if (message.toLowerCase().startsWith('editar ')) {
    try {
      const parts = message.split(' ');
      const eventId = parseInt(parts[1]);

      if (isNaN(eventId)) {
        await sendMessage(chatId, '❌ ID do evento inválido. Use: `editar ID texto`');
        return;
      }

      const telegramUserId = update.message?.from?.id?.toString();
      if (!telegramUserId) {
        await sendMessage(chatId, '❌ Não foi possível identificar seu usuário.');
        return;
      }

      const dbUser = await storage.getUserByTelegramId(telegramUserId);
      if (!dbUser) {
        await sendMessage(chatId, '❌ Usuário não encontrado.');
        return;
      }

      // Buscar evento
      const event = await storage.getEvent(eventId);

      if (!event) {
        await sendMessage(chatId, '❌ Evento não encontrado.');
        return;
      }

      // Verificar permissão
      if (event.userId !== dbUser.id) {
        await sendMessage(chatId, '❌ Você não tem permissão para editar este evento.');
        return;
      }

      // Pegar o texto após o ID
      const newContent = parts.slice(2).join(' ');

      if (!newContent) {
        await sendMessage(chatId, '❌ Forneça o novo conteúdo. Exemplo: `editar ${eventId} reunião amanhã às 15h`');
        return;
      }

      // Interpretar novo conteúdo com Claude
      const userTimezone = getUserTimezone(telegramUserId);
      const claudeResult = await parseEventWithClaude(newContent, userTimezone);

      if (!claudeResult.isValid) {
        await sendMessage(chatId, '❌ Não consegui entender a nova data/hora. Tente novamente.');
        return;
      }

      // Criar nova data
      const newDate = DateTime.fromFormat(claudeResult.date, 'yyyy-MM-dd', { zone: userTimezone })
        .set({ hour: claudeResult.hour, minute: claudeResult.minute });

      // Atualizar no banco
      const updateData: any = {
        title: claudeResult.title,
        startDate: newDate.toJSDate(),
        updatedAt: new Date()
      };

      const updatedEventRecord = await storage.updateEvent(eventId, updateData);
      if (updatedEventRecord) {
        await reminderService.ensureDefaultReminder(updatedEventRecord, 'telegram');
      }

      // Atualizar no Google Calendar se conectado
      if (event.calendarId) {
        const settings = await storage.getUserSettings(dbUser.id);
        if (settings?.googleTokens) {
          try {
            const tokens = JSON.parse(settings.googleTokens);
            setTokens(dbUser.id, tokens);

            // Deletar evento antigo e criar novo (Google Calendar não tem update direto via nossa API)
            await cancelGoogleCalendarEvent(event.calendarId, dbUser.id);

            const updatedEvent = await storage.getEvent(eventId);
            if (updatedEvent) {
              const googleResult = await addEventToGoogleCalendar(updatedEvent, dbUser.id);

              if (googleResult.success && googleResult.calendarEventId) {
                await storage.updateEvent(eventId, {
                  calendarId: googleResult.calendarEventId
                });
              }
            }

            console.log('✅ Evento atualizado no Google Calendar');
          } catch (error) {
            console.error('⚠️ Erro ao atualizar no Google Calendar:', error);
          }
        }
      }

      await sendMessage(chatId,
        `✅ *Evento atualizado com sucesso!*\n\n` +
        `🎯 ${claudeResult.title}\n` +
        `📅 ${newDate.toFormat('dd/MM/yyyy HH:mm', { locale: 'pt-BR' })}`
      );

    } catch (error) {
      console.error('❌ Erro ao editar evento:', error);
      await sendMessage(chatId, '❌ Erro ao editar evento. Tente novamente.');
    }
    return;
  }

  if (message.startsWith('/')) return;

  try {
    // Usar Claude para interpretar
    const telegramUserId = update.message?.from?.id?.toString() || 'unknown';
    const username = update.message?.from?.username || `telegram_${telegramUserId}`;
    const userTimezone = getUserTimezone(telegramUserId);
    const claudeResult = await parseEventWithClaude(message, userTimezone);

    if (!claudeResult.isValid) {
      await sendMessage(chatId,
        '❌ *Não consegui entender a data/hora*\n\n' +
        '💡 *Tente algo como:*\n' +
        '• "jantar hoje às 19h"\n' +
        '• "reunião quarta às 15h"'
      );
      return;
    }

    // Buscar ou criar usuário no banco
    let dbUser;
    try {
      dbUser = await storage.getUserByTelegramId(telegramUserId);

      if (!dbUser) {
        // Criar novo usuário se não existir
        dbUser = await storage.createUser({
          username: username,
          password: `telegram_${telegramUserId}`,
          telegramId: telegramUserId,
          name: username,
        });

        // Criar configurações padrão
        await storage.createUserSettings({
          userId: dbUser.id,
          notificationsEnabled: true,
          reminderTimes: [12],
          language: 'pt-BR',
          timeZone: userTimezone,
        });

        console.log(`✅ Novo usuário criado ao criar evento: ${username} (ID: ${dbUser.id})`);
      }
    } catch (error) {
      console.error('❌ Erro ao buscar/criar usuário:', error);
      // Continuar sem salvar no banco se houver erro
    }

    // Criar evento
    const eventDate = DateTime.fromObject({
      year: parseInt(claudeResult.date.split('-')[0]),
      month: parseInt(claudeResult.date.split('-')[1]),
      day: parseInt(claudeResult.date.split('-')[2]),
      hour: claudeResult.hour,
      minute: claudeResult.minute
    }, { zone: userTimezone });

    // NOVO: Limpar nome do evento se necessário
    let eventTitle = claudeResult.title && claudeResult.title.length > 2 ? claudeResult.title : extractEventTitle(message);
    const event: Event = {
      title: eventTitle,
      startDate: eventDate.toISO() || eventDate.toString(),
      description: eventTitle,
      displayDate: eventDate.toFormat('EEEE, dd \'de\' MMMM \'às\' HH:mm', { locale: 'pt-BR' })
    };

    // Salvar evento no banco de dados
    if (dbUser) {
      try {
        const endDate = eventDate.plus({ hours: 1 }); // Evento padrão de 1 hora

        const insertEvent: InsertEvent = {
          userId: dbUser.id,
          title: eventTitle,
          description: eventTitle, // Usar título como descrição por enquanto
          startDate: eventDate.toJSDate(),
          endDate: endDate.toJSDate(),
          location: undefined, // Claude não retorna location ainda
          isAllDay: false,
          rawData: {
            originalMessage: message,
            claudeResult: claudeResult,
            userTimezone: userTimezone
          }
        };

        const savedEvent = await storage.createEvent(insertEvent);
        console.log(`✅ Evento salvo no banco: ${eventTitle} (ID: ${savedEvent.id})`);
        await reminderService.ensureDefaultReminder(savedEvent, 'telegram');

        // =================== INTEGRAÇÃO GOOGLE CALENDAR ===================
        // Verificar se usuário tem Google Calendar conectado
        try {
          const telegramUserId = update.message?.from?.id?.toString();
          if (telegramUserId) {
            const dbUser = await storage.getUserByTelegramId(telegramUserId);
            if (dbUser) {
              const settings = await storage.getUserSettings(dbUser.id);

              if (settings?.googleTokens) {
                console.log('🔗 Usuário tem Google Calendar conectado, criando evento...');

                // Configurar tokens do Google
                const tokens = JSON.parse(settings.googleTokens);
                setTokens(dbUser.id, tokens);

                // Criar evento no Google Calendar
                const googleResult = await addEventToGoogleCalendar(savedEvent, dbUser.id);

                if (googleResult.success) {
                  console.log('✅ Evento criado no Google Calendar!');

                  // Atualizar evento com ID do Google Calendar
                  if (googleResult.calendarEventId) {
                    await storage.updateEvent(savedEvent.id, {
                      calendarId: googleResult.calendarEventId,
                      conferenceLink: googleResult.conferenceLink || null
                    });
                  }

                  // Adicionar info de Google Calendar na resposta
                  event.conferenceLink = googleResult.conferenceLink;
                } else {
                  console.log('⚠️ Não foi possível criar no Google Calendar:', googleResult.message);
                }
              } else {
                console.log('ℹ️ Usuário não tem Google Calendar conectado');
              }
            }
          }
        } catch (error) {
          console.error('❌ Erro ao criar evento no Google Calendar:', error);
          // Continuar mesmo se falhar
        }
        // =================== FIM INTEGRAÇÃO ===================

      } catch (error) {
        console.error('❌ Erro ao salvar evento no banco:', error);
        // Continuar mesmo se falhar ao salvar
      }
    }

    const links = generateCalendarLinks(event);

    const replyMarkup = {
      inline_keyboard: [
        [
          { text: '📅 Google Calendar', url: links.google },
          { text: '📅 Outlook', url: links.outlook }
        ]
      ]
    };

    // Mensagem com informação de Google Calendar se aplicável
    let messageText = '✅ *Evento criado!*\n\n' +
      `🎯 *${event.title}*\n` +
      `📅 ${event.displayDate}`;

    if (event.conferenceLink) {
      messageText += `\n\n📹 *Google Meet:*\n${event.conferenceLink}\n\n✨ *Evento adicionado automaticamente ao seu Google Calendar!*`;
    } else {
      // Verificar se usuário tem Google Calendar conectado
      try {
        const telegramUserId = update.message?.from?.id?.toString();
        if (telegramUserId) {
          const dbUser = await storage.getUserByTelegramId(telegramUserId);
          if (dbUser) {
            const settings = await storage.getUserSettings(dbUser.id);
            if (settings?.googleTokens) {
              messageText += '\n\n✨ *Evento adicionado ao seu Google Calendar!*';
            }
          }
        }
      } catch (error) {
        // Ignorar erro
      }
    }

    await sendMessage(chatId, messageText, replyMarkup);

    console.log(`✅ Evento criado: ${event.title}`);

  } catch (error) {
    console.error('❌ Erro ao processar:', error);
    await sendMessage(chatId, '❌ Erro interno. Tente novamente.');
  }
}

let isRunning = false;

export async function startDirectBot(): Promise<boolean> {
  try {
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      console.error('❌ Token não configurado');
      return false;
    }

    if (isRunning) {
      console.log('⚠️ Bot já está rodando');
      return true;
    }

    console.log('🚀 Iniciando bot direto...');

    // Testar conexão
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const response = await fetch(`${TELEGRAM_API}${token}/getMe`);
    if (!response.ok) {
      console.error('❌ Falha na conexão com Telegram');
      return false;
    }

    const botInfo = await response.json();
    console.log(`✅ Bot @${botInfo.result.username} conectado!`);

    // Configurar comandos no menu do bot
    await setupBotCommands(token);

    isRunning = true;

    // Loop principal - verificar mensagens a cada 2 segundos
    const pollInterval = setInterval(async () => {
      if (!isRunning) {
        clearInterval(pollInterval);
        return;
      }

      try {
        const updates = await getUpdates();

        for (const update of updates) {
          if (update.update_id > lastUpdateId) {
            lastUpdateId = update.update_id;
            await processUpdate(update);
          }
        }
      } catch (error) {
        console.error('❌ Erro no polling:', error);
      }
    }, 2000);

    console.log('🔍 Bot aguardando mensagens...');
    return true;

  } catch (error) {
    console.error('❌ Erro ao iniciar bot direto:', error);
    return false;
  }
}

export function stopDirectBot(): void {
  isRunning = false;
  console.log('🛑 Bot direto parado');
}
