/**
 * Assistente inteligente de agenda usando o modelo Llama
 * 
 * Este módulo usa o OpenRouter para acessar o modelo Llama
 * e processar linguagem natural para extrair informações de eventos
 */

import { Telegraf } from 'telegraf';
import { format, addHours, addDays, addMinutes, setHours, setMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { log } from '../vite';
import axios from 'axios';

// Verificar token do Telegram
if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error('TELEGRAM_BOT_TOKEN não está definido no ambiente');
  process.exit(1);
}

// Verificar chave de API do OpenRouter
if (!process.env.OPENROUTER_API_KEY) {
  console.error('OPENROUTER_API_KEY não está definido no ambiente');
  process.exit(1);
}

// Inicializar bot
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Estado dos usuários
const users = new Map();

// Função para processar texto natural com Llama via OpenRouter
async function processNaturalLanguage(text: string): Promise<{
  success: boolean;
  event?: {
    title: string;
    startDate: Date;
    endDate?: Date;
    location?: string;
    description?: string;
  };
  message?: string;
}> {
  try {
    // Sistema de prompt para extrair informações de evento de texto em português
    const systemPrompt = `
    Você é um assistente especializado em extrair informações de eventos de mensagens em português.
    Sua tarefa é analisar o texto e identificar detalhes como título do evento, data, hora, duração, local e descrição.
    Responda em formato JSON com os seguintes campos: 
    {
      "isEvent": true/false (se é ou não um evento),
      "title": "título do evento",
      "date": "YYYY-MM-DD",
      "time": "HH:MM",
      "duration": número de minutos (padrão 60 se não especificado),
      "location": "local do evento" (ou null se não especificado),
      "description": "descrição do evento" (ou null se não especificado)
    }
    
    Hoje é ${format(new Date(), 'yyyy-MM-dd')}.
    Interprete referências como "amanhã", "próxima segunda", "semana que vem", etc.
    `;

    // Solicitação para a API OpenRouter (Llama)
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: "anthropic/claude-3-opus:beta", // Modelo avançado da Anthropic via OpenRouter
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1, // Baixa temperatura para resultados mais determinísticos
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://replit.com', // Referência ao Replit
          'X-Title': 'Assistente de Agenda Telegram' // Nome do aplicativo
        }
      }
    );

    // Extrair e processar a resposta
    const content = response.data.choices[0].message.content;
    const parsedContent = JSON.parse(content);
    
    // Verificar se o texto é sobre um evento
    if (!parsedContent.isEvent) {
      return { 
        success: false, 
        message: "Não consegui identificar um evento na sua mensagem. Tente ser mais específico, por exemplo: 'Agendar reunião com João amanhã às 15h'"
      };
    }
    
    // Construir data e hora do evento
    let eventDate = new Date();
    
    if (parsedContent.date) {
      const [year, month, day] = parsedContent.date.split('-').map(Number);
      eventDate.setFullYear(year);
      eventDate.setMonth(month - 1); // Meses em JS são 0-indexados
      eventDate.setDate(day);
    }
    
    if (parsedContent.time) {
      const [hour, minute] = parsedContent.time.split(':').map(Number);
      eventDate.setHours(hour);
      eventDate.setMinutes(minute);
      eventDate.setSeconds(0);
      eventDate.setMilliseconds(0);
    }
    
    // Calcular data de término com base na duração (padrão: 1 hora)
    const duration = parsedContent.duration || 60;
    const endDate = new Date(eventDate.getTime() + duration * 60000);
    
    // Retornar evento extraído
    return {
      success: true,
      event: {
        title: parsedContent.title,
        startDate: eventDate,
        endDate: endDate,
        location: parsedContent.location || undefined,
        description: parsedContent.description || undefined
      }
    };
  } catch (error) {
    console.error('Erro ao processar linguagem natural:', error);
    return { 
      success: false, 
      message: "Desculpe, houve um erro ao processar sua mensagem. Por favor, tente novamente."
    };
  }
}

// Abordagem simples para validar email
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Função para gerar links de calendário para qualquer evento
function generateCalendarLinks(event: any) {
  // Formatar datas para URL do Google Calendar
  const startDateFormatted = new Date(event.startDate).toISOString().replace(/-|:|\.\d\d\d/g,'').slice(0,15);
  const endDateFormatted = new Date(event.endDate || new Date(new Date(event.startDate).getTime() + 60 * 60 * 1000))
    .toISOString().replace(/-|:|\.\d\d\d/g,'').slice(0,15);
  
  // Link direto para o Google Calendar
  const googleLink = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${startDateFormatted}/${endDateFormatted}&details=${encodeURIComponent(event.description || '')}&location=${encodeURIComponent(event.location || '')}`;
  
  // Link direto para o Outlook
  const outlookLink = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(event.title)}&startdt=${new Date(event.startDate).toISOString()}&enddt=${new Date(event.endDate || new Date(new Date(event.startDate).getTime() + 60 * 60 * 1000)).toISOString()}&body=${encodeURIComponent(event.description || '')}&location=${encodeURIComponent(event.location || '')}`;
  
  // Link para gerar arquivo ICS
  const icsLink = `https://ics.ecal.com/event?data=${encodeURIComponent(JSON.stringify({
    summary: event.title,
    description: event.description || '',
    location: event.location || '',
    start: new Date(event.startDate).toISOString(),
    end: new Date(event.endDate || new Date(new Date(event.startDate).getTime() + 60 * 60 * 1000)).toISOString()
  }))}`;
  
  return {
    google: googleLink,
    outlook: outlookLink,
    ics: icsLink
  };
}

// Formatar data para exibição em português
function formatDate(date: Date): string {
  return format(date, "EEEE, dd 'de' MMMM 'às' HH:mm", { locale: ptBR });
}

// Comando /start - inicia o bot
bot.start(async (ctx) => {
  if (!ctx.from) return;
  
  const userId = ctx.from.id.toString();
  const name = ctx.from.first_name || ctx.from.username || 'usuário';
  
  users.set(userId, { 
    id: userId,
    name,
    email: null
  });
  
  await ctx.reply(
    `Olá, ${name}! 👋\n\n` +
    `Sou seu assistente inteligente de agenda. Você pode me dizer coisas como:\n\n` +
    `• "Agendar reunião com João amanhã às 15h"\n` +
    `• "Marcar dentista na próxima terça às 9h"\n` +
    `• "Lembrar de ligar para Maria na sexta às 14h"\n\n` +
    `Use /ajuda para ver todos os comandos disponíveis.`
  );
});

// Comando /ajuda - mostra ajuda
bot.command(['ajuda', 'help'], async (ctx) => {
  await ctx.reply(
    `📋 Como usar o assistente de agenda:\n\n` +
    `1️⃣ Fale naturalmente sobre seus eventos:\n` +
    `   "Reunião com equipe amanhã às 10h"\n\n` +
    `2️⃣ Eu vou processar sua mensagem com IA e criar o evento\n\n` +
    `3️⃣ Você receberá links para adicionar ao seu calendário\n\n` +
    `📌 Comandos disponíveis:\n` +
    `/start - Iniciar o bot\n` +
    `/email - Configurar seu email (opcional)\n` +
    `/criar - Criar um evento de teste\n` +
    `/ajuda - Mostrar esta ajuda`
  );
});

// Comando /email - configura email
bot.command('email', async (ctx) => {
  if (!ctx.from) return;
  
  const userId = ctx.from.id.toString();
  
  users.set(userId, {
    ...users.get(userId) || { id: userId, name: ctx.from.first_name || 'usuário' },
    awaitingEmail: true
  });
  
  await ctx.reply(
    `Por favor, envie seu endereço de email.\n\n` +
    `Nota: O email é opcional na nossa solução, pois geramos links diretos para adicionar eventos ao calendário!`
  );
});

// Comando /criar - cria evento de teste
bot.command('criar', async (ctx) => {
  if (!ctx.from) return;
  
  const userId = ctx.from.id.toString();
  
  // Criar evento de teste
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(15, 0, 0, 0);
  
  const event = {
    id: Date.now().toString(),
    title: 'Reunião de Teste',
    startDate: tomorrow,
    endDate: new Date(tomorrow.getTime() + 60 * 60 * 1000),
    location: 'Local de Teste',
    description: 'Este é um evento de teste criado pelo Assistente de Agenda'
  };
  
  // Formatar data para exibição
  const formattedDate = formatDate(tomorrow);
  
  // Gerar links de calendário
  const links = generateCalendarLinks(event);
  
  await ctx.reply(
    `✅ Evento criado com sucesso!\n\n` +
    `📅 ${event.title}\n` +
    `📆 ${formattedDate}\n` +
    `📍 ${event.location}\n\n` +
    `Adicione ao seu calendário com apenas um clique:\n\n`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📅 Adicionar ao Google Calendar', url: links.google }],
          [{ text: '📅 Adicionar ao Outlook', url: links.outlook }],
          [{ text: '📅 Baixar arquivo .ICS', url: links.ics }]
        ]
      }
    }
  );
  
  // Se tiver email configurado, mencionar que está pronto para uso
  const user = users.get(userId);
  if (user && user.email) {
    await ctx.reply(
      `📧 Nota: Você tem o email ${user.email} configurado.\n\n` +
      `Esta solução funciona independentemente de email, pois os links diretos não precisam de credenciais do Gmail!`
    );
  }
});

// Processar mensagens de texto - O CORAÇÃO DO BOT COM IA
bot.on('text', async (ctx) => {
  if (!ctx.from || !ctx.message || !ctx.message.text) return;
  
  const userId = ctx.from.id.toString();
  const user = users.get(userId);
  const text = ctx.message.text;
  
  // Se estiver esperando email
  if (user && user.awaitingEmail) {
    if (!isValidEmail(text)) {
      await ctx.reply('Este email não parece válido. Por favor, tente novamente ou use /cancelar para cancelar.');
      return;
    }
    
    // Atualizar email do usuário
    users.set(userId, {
      ...user,
      email: text,
      awaitingEmail: false
    });
    
    await ctx.reply(
      `✅ Email configurado: ${text}\n\n` +
      `Lembre-se: Nossa solução não depende de email para funcionar, pois usa links diretos para os calendários!\n\n` +
      `Agora você pode me dizer coisas como "Agendar reunião amanhã às 15h" e eu vou entender.`
    );
    return;
  }
  
  // Processar texto para identificar evento usando IA
  const loadingMessage = await ctx.reply('🧠 Processando sua mensagem...');
  
  try {
    // Processar texto natural com Llama
    const result = await processNaturalLanguage(text);
    
    // Se não foi possível identificar um evento
    if (!result.success || !result.event) {
      await ctx.telegram.editMessageText(
        ctx.chat.id, 
        loadingMessage.message_id, 
        undefined,
        result.message || "Não consegui identificar um evento na sua mensagem. Tente ser mais específico."
      );
      return;
    }
    
    // Evento extraído com sucesso
    const event = result.event;
    
    // Formatar data para exibição
    const formattedDate = formatDate(event.startDate);
    
    // Gerar links de calendário
    const links = generateCalendarLinks(event);
    
    // Atualizar mensagem de carregamento com o evento criado
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      loadingMessage.message_id,
      undefined,
      `✅ Evento criado com sucesso!\n\n` +
      `📅 ${event.title}\n` +
      `📆 ${formattedDate}\n` +
      (event.location ? `📍 ${event.location}\n` : '') +
      (event.description ? `📝 ${event.description}\n` : '') +
      `\nAdicione ao seu calendário com apenas um clique:`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '📅 Adicionar ao Google Calendar', url: links.google }],
            [{ text: '📅 Adicionar ao Outlook', url: links.outlook }],
            [{ text: '📅 Baixar arquivo .ICS', url: links.ics }]
          ]
        }
      }
    );
  } catch (error) {
    console.error('Erro ao processar mensagem:', error);
    
    // Em caso de erro, atualizar mensagem de carregamento
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      loadingMessage.message_id,
      undefined,
      'Desculpe, houve um erro ao processar sua mensagem. Por favor, tente novamente.'
    );
  }
});

// Iniciar o bot
export async function startLlamaBot() {
  try {
    // Configurar comandos
    await bot.telegram.setMyCommands([
      { command: 'start', description: 'Iniciar o bot' },
      { command: 'ajuda', description: 'Mostrar ajuda' },
      { command: 'email', description: 'Configurar email (opcional)' },
      { command: 'criar', description: 'Criar evento de teste' }
    ]);
    
    // Iniciar bot
    await bot.launch();
    log('Bot com IA Llama iniciado! Pronto para processar linguagem natural.', 'bot');
    
    // Tratamento de encerramento
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
    
    return true;
  } catch (error) {
    log(`Erro ao iniciar bot com IA: ${error}`, 'bot');
    return false;
  }
}

// Parar o bot
export function stopLlamaBot() {
  try {
    bot.stop('SIGTERM');
    return true;
  } catch (error) {
    console.error('Erro ao parar bot:', error);
    return false;
  }
}