/**
 * Bot Telegram usando API direta sem polling
 * Abordagem manual para evitar conflitos
 */

import { parseEventWithClaude } from '../utils/claudeParser';
import { DateTime } from 'luxon';
import { getUserTimezone, extractEventTitle } from './utils/parseDate';

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

async function sendMessage(chatId: number, text: string, replyMarkup?: any): Promise<boolean> {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return false;

    const response = await fetch(`${TELEGRAM_API}${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
        reply_markup: replyMarkup
      })
    });

    return response.ok;
  } catch (error) {
    console.error('❌ Erro ao enviar mensagem:', error);
    return false;
  }
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

  // Comando /help
  if (message === '/help') {
    await sendMessage(chatId,
      '🤖 *Assistente Zelar - Ajuda*\n\n' +
      '📅 *Como usar:*\n' +
      'Envie mensagens naturais como:\n' +
      '• "reunião com cliente amanhã às 14h"\n' +
      '• "jantar com família sexta às 19h30"\n' +
      '• "consulta médica terça-feira às 10h"\n' +
      '• "call de projeto quinta às 15h"\n\n' +
      '⚙️ *Comandos:*\n' +
      '/timezone - Alterar fuso horário\n' +
      '/start - Mensagem inicial\n\n' +
      '🌍 *Fuso atual:* Brasil (UTC-3)\n\n' +
      '✨ Processamento com IA Claude!'
    );
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

  if (message.startsWith('/')) return;

  try {
    // Usar Claude para interpretar
    const userId = update.message?.from?.id?.toString() || 'unknown';
    // Não há language_code disponível nesse tipo de update
    const userTimezone = getUserTimezone(userId);
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

    const links = generateCalendarLinks(event);

    const replyMarkup = {
      inline_keyboard: [
        [
          { text: '📅 Google Calendar', url: links.google },
          { text: '📅 Outlook', url: links.outlook }
        ]
      ]
    };

    await sendMessage(chatId,
      '✅ *Evento criado!*\n\n' +
      `🎯 *${event.title}*\n` +
      `📅 ${event.displayDate}`,
      replyMarkup
    );

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