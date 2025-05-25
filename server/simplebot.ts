/**
 * Bot extremamente simples para processamento de eventos
 * 
 * Esta versão é minimalista para garantir funcionamento
 */

import { Telegraf } from 'telegraf';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { log } from './vite';

// Verificar token do Telegram
if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error('TELEGRAM_BOT_TOKEN não está definido no ambiente');
  process.exit(1);
}

// Inicializar bot com polling
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Estado global
const userStates = new Map();

// Comandos básicos
bot.start((ctx) => {
  const name = ctx.from?.first_name || 'usuário';
  ctx.reply(
    `Olá, ${name}! 👋\n\n` +
    `Sou seu assistente de agenda simplificado.\n\n` +
    `Use o comando /criar para gerar um evento de teste.`
  );
});

bot.help((ctx) => {
  ctx.reply(
    `Comandos disponíveis:\n\n` +
    `/start - Iniciar o bot\n` +
    `/criar - Criar evento de teste\n` +
    `/help - Mostrar ajuda`
  );
});

// Criar evento de teste com links diretos
bot.command('criar', (ctx) => {
  // Evento simples para amanhã
  const tomorrow = addDays(new Date(), 1);
  tomorrow.setHours(15, 0, 0, 0);
  
  // Formato para Google Calendar
  const startTime = tomorrow.toISOString().replace(/-|:|\.\d\d\d/g,'').slice(0,15);
  const endTime = addDays(tomorrow, 0).setHours(16, 0, 0, 0);
  const endTimeFormatted = new Date(endTime).toISOString().replace(/-|:|\.\d\d\d/g,'').slice(0,15);
  
  // Link do Google Calendar
  const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent('Reunião de Teste')}&dates=${startTime}/${endTimeFormatted}&details=${encodeURIComponent('Descrição do evento de teste')}&location=${encodeURIComponent('Local do evento')}`;
  
  // Link do Outlook
  const outlookUrl = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent('Reunião de Teste')}&startdt=${tomorrow.toISOString()}&enddt=${new Date(endTime).toISOString()}&body=${encodeURIComponent('Descrição do evento de teste')}&location=${encodeURIComponent('Local do evento')}`;
  
  // Data formatada em português
  const formattedDate = format(tomorrow, "EEEE, dd 'de' MMMM 'às' HH:mm", { locale: ptBR });
  
  // Enviar mensagem com links
  ctx.reply(
    `✅ Evento criado: Reunião de Teste\n📅 ${formattedDate}\n📍 Local do evento\n\nAdicione ao seu calendário:`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Adicionar ao Google Calendar', url: googleUrl }],
          [{ text: 'Adicionar ao Outlook', url: outlookUrl }]
        ]
      }
    }
  );
});

// Processar qualquer mensagem de texto
bot.on('text', (ctx) => {
  if (!ctx.message || typeof ctx.message.text !== 'string') return;
  
  const text = ctx.message.text.toLowerCase();
  
  // Verificar se é um comando para criar evento
  if (text.includes('agendar') || text.includes('marcar') || text.includes('lembrar')) {
    // Extrair informações básicas (uma solução simples)
    let title = 'Evento';
    
    // Tentar extrair o título
    const titleMatch = text.match(/(agendar|marcar|lembrar de?)\s+(.+?)(?:\s+(?:para|em|no dia|na|às|amanhã|hoje))/i);
    if (titleMatch && titleMatch[2]) {
      title = titleMatch[2].trim();
    }
    
    // Data padrão (amanhã)
    const eventDate = addDays(new Date(), 1);
    eventDate.setHours(15, 0, 0, 0);
    
    // Verificar se é "amanhã"
    if (text.includes('amanhã')) {
      // Já definimos como amanhã
    } else if (text.includes('hoje')) {
      // Hoje
      eventDate.setDate(new Date().getDate());
    }
    
    // Formato para Google Calendar
    const startTime = eventDate.toISOString().replace(/-|:|\.\d\d\d/g,'').slice(0,15);
    const endTime = new Date(eventDate).setHours(eventDate.getHours() + 1);
    const endTimeFormatted = new Date(endTime).toISOString().replace(/-|:|\.\d\d\d/g,'').slice(0,15);
    
    // Link do Google Calendar
    const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${startTime}/${endTimeFormatted}`;
    
    // Link do Outlook
    const outlookUrl = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(title)}&startdt=${eventDate.toISOString()}&enddt=${new Date(endTime).toISOString()}`;
    
    // Data formatada em português
    const formattedDate = format(eventDate, "EEEE, dd 'de' MMMM 'às' HH:mm", { locale: ptBR });
    
    // Enviar mensagem com links
    ctx.reply(
      `✅ Evento criado: ${title}\n📅 ${formattedDate}\n\nAdicione ao seu calendário:`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Adicionar ao Google Calendar', url: googleUrl }],
            [{ text: 'Adicionar ao Outlook', url: outlookUrl }]
          ]
        }
      }
    );
    
    return;
  }
  
  // Resposta padrão
  ctx.reply(
    `Não entendi o que você quer. Use o comando /criar para gerar um evento de teste, ou diga algo como "agendar reunião amanhã".`
  );
});

// Função para iniciar o bot
export async function startSimpleBot() {
  try {
    await bot.telegram.setMyCommands([
      { command: 'start', description: 'Iniciar o bot' },
      { command: 'criar', description: 'Criar evento de teste' },
      { command: 'help', description: 'Mostrar ajuda' }
    ]);
    
    // Iniciar bot com configuração padrão
    await bot.launch();
    
    log('Bot simplificado iniciado! Agora vai funcionar.', 'bot');
    
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
    
    return true;
  } catch (error) {
    log(`Erro ao iniciar bot simplificado: ${error}`, 'bot');
    return false;
  }
}

// Função para parar o bot
export function stopSimpleBot() {
  bot.stop('SIGTERM');
  log('Bot simplificado parado', 'bot');
  return true;
}