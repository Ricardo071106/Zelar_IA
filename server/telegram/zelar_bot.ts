/**
 * Bot Zelar - Versão avançada com interpretação inteligente de datas
 * Processamento avançado de eventos em português usando Luxon
 */

import { Telegraf } from 'telegraf';
import { parseUserDateTime, setUserTimezone, getUserTimezone, COMMON_TIMEZONES } from './utils/parseDate';
import { DateTime, IANAZone } from 'luxon';

let bot: Telegraf | null = null;

// =================== INÍCIO: FUNCIONALIDADE DE HORÁRIOS LOCAIS ===================
// Map para armazenar o fuso horário de cada usuário (ID do usuário -> fuso horário)
const userTimezones = new Map<number, string>();

// Regex para detectar padrões de horário em português
const TIME_PATTERNS = [
  { pattern: /às\s+(\d{1,2})\s*da\s+noite/gi, type: 'noite' },        // "às 7 da noite"
  { pattern: /às\s+(\d{1,2})\s*da\s+tarde/gi, type: 'tarde' },        // "às 3 da tarde" 
  { pattern: /às\s+(\d{1,2})\s*da\s+manhã/gi, type: 'manha' },        // "às 8 da manhã"
  { pattern: /às\s+(\d{1,2})\s*horas?/gi, type: 'neutral' },          // "às 19 horas"
  { pattern: /às\s+(\d{1,2})h/gi, type: 'neutral' },                  // "às 9h"
  { pattern: /às\s+(\d{1,2})\s*pm/gi, type: 'pm' },                   // "às 7pm"
  { pattern: /às\s+(\d{1,2})\s*am/gi, type: 'am' },                   // "às 9am"
];

/**
 * Interpreta horário local conforme o fuso do usuário
 */
function parseLocalTime(text: string, userId: number): { hour: number; minute: number; timezone: string } | null {
  const userTimezone = userTimezones.get(userId);
  
  if (!userTimezone) {
    return null; // Usuário precisa definir fuso primeiro
  }

  for (const { pattern, type } of TIME_PATTERNS) {
    pattern.lastIndex = 0; // Reset regex
    const match = pattern.exec(text);
    if (match) {
      let hour = parseInt(match[1]);
      const minute = 0; // Por simplicidade, assumindo minutos = 0
      
      // Ajustar horário baseado no contexto
      if (type === 'noite' && hour < 12) {
        hour += 12; // "7 da noite" = 19h
      } else if (type === 'tarde' && hour < 12) {
        hour += 12; // "3 da tarde" = 15h
      } else if (type === 'pm' && hour < 12) {
        hour += 12; // "7pm" = 19h
      }
      // "am" e "manhã" mantém o horário como está (0-11)
      
      return { hour, minute, timezone: userTimezone };
    }
  }
  
  return null;
}

/**
 * Formata horário no fuso do usuário
 */
function formatLocalTime(hour: number, minute: number, timezone: string): string {
  const now = DateTime.now().setZone(timezone);
  const targetTime = now.set({ hour, minute, second: 0, millisecond: 0 });
  const locationName = timezone.split('/')[1]?.replace('_', ' ') || timezone;
  
  return `${targetTime.toFormat('HH:mm')} no horário de ${locationName}`;
}
// =================== FIM: FUNCIONALIDADE DE HORÁRIOS LOCAIS ===================

interface Event {
  title: string;
  startDate: string; // ISO string for Google Calendar
  description: string;
  displayDate: string; // Formatted date for display
}

/**
 * Extrai título inteligente do evento focando na ação principal
 * CORREÇÃO: Agora extrai apenas o núcleo da tarefa, não a frase completa
 */
function extractEventTitle(text: string): string {
  const textLower = text.toLowerCase();
  
  // =================== CORREÇÃO: USAR CHRONO-NODE PARA DETECTAR DATA/HORA ===================
  
  // 1. CORREÇÃO: Remover completamente todas as expressões temporais da frase
  let cleanTitle = text;
  
  // =================== CORREÇÃO: LIMPEZA AVANÇADA DE TÍTULOS ===================
  
  // 1. Remover verbos de ação e comandos
  const actionWords = [
    /\b(marque|marcar|agende|agendar|coloque|colocar|lembre|lembrar|crie|criar|faça|fazer|vou|ir)\b/gi,
    /\b(me\s+lembre|preciso|tenho\s+que|devo|vou\s+ter)\b/gi,
    /\b(dia|data|evento|compromisso|horário|horario)\b/gi
  ];
  
  for (const pattern of actionWords) {
    cleanTitle = cleanTitle.replace(pattern, ' ');
  }
  
  // 2. Remover expressões temporais completas
  const temporalPatterns = [
    // Datas específicas (dd/mm, dd/mm/yyyy)
    /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/gi,
    // Dias relativos
    /\b(amanhã|amanha|hoje|ontem|depois\s+de\s+amanha|depois\s+de\s+amanhã)\b/gi,
    // Dias da semana com modificadores
    /\b(próxima|proxima|que\s+vem|na)?\s*(segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo)(-feira)?\b/gi,
    // Horários completos
    /\b(às|as)\s+\d{1,2}(:\d{2})?\s*(h|horas?)?\b/gi,
    /\b\d{1,2}(:\d{2})?\s*(h|horas?)\b/gi,
    /\b\d{1,2}\s*(am|pm)\b/gi,
    // Períodos do dia
    /\b(da|de)\s+(manhã|tarde|noite|madrugada)\b/gi
  ];
  
  // Aplicar cada padrão sequencialmente
  for (const pattern of temporalPatterns) {
    const beforeClean = cleanTitle;
    cleanTitle = cleanTitle.replace(pattern, ' ');
    if (beforeClean !== cleanTitle) {
      console.log(`🧹 Removido "${beforeClean}" → "${cleanTitle}"`);
    }
  }
  
  // Limpar espaços extras e preposições soltas
  cleanTitle = cleanTitle
    .replace(/\s+/g, ' ') // múltiplos espaços → um espaço
    .replace(/^\s*(no|na|em|de|da|do|às|as|para|pra)\s+/i, '') // preposições no início
    .replace(/\s+(no|na|em|de|da|do|às|as|para|pra)\s*$/i, '') // preposições no final
    .trim();
  
  if (cleanTitle.length > 2) {
    console.log(`📝 Título limpo extraído: "${cleanTitle}" de "${text}"`);
    return capitalizeFirst(cleanTitle);
  }
  
  // 2. FALLBACK: Padrões específicos com contexto (ex: "reunião com João")
  const specificPatterns = [
    { regex: /reunião\s+com\s+([^,\s]+(?:\s+[^,\s]+)*)/i, format: (match: string) => `Reunião com ${match}` },
    { regex: /consulta\s+(?:com\s+)?(?:dr\.?\s+|dra\.?\s+)?([^,\s]+(?:\s+[^,\s]+)*)/i, format: (match: string) => `Consulta Dr. ${match}` },
    { regex: /dentista\s+(?:com\s+)?(?:dr\.?\s+|dra\.?\s+)?([^,\s]+(?:\s+[^,\s]+)*)/i, format: (match: string) => `Dentista Dr. ${match}` },
    { regex: /médico\s+(?:com\s+)?(?:dr\.?\s+|dra\.?\s+)?([^,\s]+(?:\s+[^,\s]+)*)/i, format: (match: string) => `Médico Dr. ${match}` },
    { regex: /aniversário\s+(?:do\s+|da\s+)?([^,\s]+(?:\s+[^,\s]+)*)/i, format: (match: string) => `Aniversário ${match}` },
    { regex: /festa\s+(?:do\s+|da\s+|de\s+)?([^,\s]+(?:\s+[^,\s]+)*)/i, format: (match: string) => `Festa ${match}` }
  ];
  
  for (const pattern of specificPatterns) {
    const match = textLower.match(pattern.regex);
    if (match && match[1]) {
      const result = pattern.format(match[1].trim());
      console.log(`📝 Título específico extraído: "${result}" de "${text}"`);
      return capitalizeFirst(result);
    }
  }
  
  // 2. Extrair após verbos de ação (removendo o verbo)
  const actionVerbs = [
    /(?:me\s+)?lembre?\s+de\s+(.+?)(?:\s+(?:hoje|amanhã|segunda|terça|quarta|quinta|sexta|sábado|domingo|às|na|no)|\s*$)/i,
    /(?:vou\s+|ir\s+)?fazer\s+(.+?)(?:\s+(?:hoje|amanhã|segunda|terça|quarta|quinta|sexta|sábado|domingo|às|na|no)|\s*$)/i,
    /agende?\s+(.+?)(?:\s+(?:hoje|amanhã|segunda|terça|quarta|quinta|sexta|sábado|domingo|às|na|no)|\s*$)/i,
    /marque?\s+(.+?)(?:\s+(?:hoje|amanhã|segunda|terça|quarta|quinta|sexta|sábado|domingo|às|na|no)|\s*$)/i,
    /criar?\s+(?:um\s+|uma\s+)?(.+?)(?:\s+(?:hoje|amanhã|segunda|terça|quarta|quinta|sexta|sábado|domingo|às|na|no)|\s*$)/i
  ];
  
  for (const verb of actionVerbs) {
    const match = text.match(verb);
    if (match && match[1]) {
      let extracted = match[1].trim();
      // Remover artigos desnecessários
      extracted = extracted.replace(/^(um|uma|o|a|os|as)\s+/i, '');
      console.log(`📝 Título extraído após verbo: "${extracted}" de "${text}"`);
      return capitalizeFirst(extracted);
    }
  }
  
  // 3. Palavras-chave diretas (como antes, mas mais refinado)
  const directKeywords = [
    'jantar', 'almoço', 'almoco', 'academia', 'trabalho', 'escola', 'aula',
    'compromisso', 'consulta', 'exame', 'reunião', 'reuniao', 'compras'
  ];
  
  for (const keyword of directKeywords) {
    if (textLower.includes(keyword)) {
      console.log(`📝 Palavra-chave direta encontrada: "${keyword}" de "${text}"`);
      return capitalizeFirst(keyword);
    }
  }
  
  // 4. Fallback: limpar e extrair núcleo da frase
  let cleaned = text
    // Remover verbos de ação no início
    .replace(/^(me\s+lembre\s+de\s+|agende\s+|marque\s+|criar?\s+|vou\s+|ir\s+)/i, '')
    // Remover artigos
    .replace(/^(um|uma|o|a|os|as)\s+/i, '')
    // Remover tempos
    .replace(/\b(amanhã|amanha|hoje|ontem)\b/gi, '')
    .replace(/\b(segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo)(-feira)?\b/gi, '')
    .replace(/\b(próxima|proxima|que vem|na|no)\b/gi, '')
    // Remover horários
    .replace(/\bàs?\s+\d{1,2}(:\d{2})?h?\b/gi, '')
    .replace(/\b\d{1,2}(am|pm)\b/gi, '')
    .replace(/\b(da manhã|da manha|da tarde|da noite)\b/gi, '')
    // Limpar espaços
    .replace(/\s+/g, ' ')
    .trim();
  
  console.log(`📝 Título limpo extraído: "${cleaned}" de "${text}"`);
  return capitalizeFirst(cleaned) || 'Evento';
}

/**
 * Capitaliza primeira letra de uma string
 */
function capitalizeFirst(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Processa mensagem usando interpretação avançada de datas com detecção de fuso horário
 */
function processMessage(text: string, userId: string, languageCode?: string): Event | null {
  console.log(`🔍 Processando com detecção de fuso: "${text}"`);
  
  // Usar nossa função avançada de interpretação de datas com fuso do usuário
  const result = parseUserDateTime(text, userId, languageCode);
  
  if (!result) {
    console.log('❌ Não foi possível interpretar data/hora');
    return null;
  }
  
  const title = extractEventTitle(text);
  
  console.log(`📝 Título extraído: "${title}"`);
  console.log(`📅 Data interpretada: ${result.readable}`);
  
  return {
    title,
    startDate: result.iso,
    description: text,
    displayDate: result.readable
  };
}

/**
 * Gera links para calendários usando data ISO com fuso correto
 */
function generateLinks(event: Event) {
  // =================== CORREÇÃO 2: FORMATO GOOGLE CALENDAR CORRIGIDO ===================
  // Converter de volta para DateTime mantendo o fuso original
  const eventDateTime = DateTime.fromISO(event.startDate);
  const endDateTime = eventDateTime.plus({ hours: 1 });
  
  // Para Google Calendar: converter para UTC porque Google espera UTC no formato sem Z
  const startUTC = eventDateTime.toUTC();
  const endUTC = endDateTime.toUTC();
  
  const startFormatted = startUTC.toFormat('yyyyMMdd\'T\'HHmmss\'Z\'');
  const endFormatted = endUTC.toFormat('yyyyMMdd\'T\'HHmmss\'Z\'');
  
  // Para Outlook: usar ISO com fuso horário original
  const startISO = eventDateTime.toISO();
  const endISO = endDateTime.toISO();
  
  console.log(`🔗 Links gerados:`);
  console.log(`📅 Google UTC: ${startFormatted}/${endFormatted}`);
  console.log(`📅 Outlook: ${startISO} → ${endISO}`);
  
  const google = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${startFormatted}/${endFormatted}`;
  const outlook = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(event.title)}&startdt=${startISO}&enddt=${endISO}`;
  
  return { google, outlook };
}

/**
 * Iniciar bot
 */
export async function startZelarBot(): Promise<boolean> {
  try {
    // =================== CORREÇÃO: PREVENÇÃO DE MÚLTIPLAS INSTÂNCIAS ===================
    if (bot) {
      console.log('🔄 Parando instância anterior do bot...');
      try {
        await bot.stop();
        bot = null;
        // Aguardar mais tempo para garantir que a instância anterior termine completamente
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (e) {
        console.log('⚠️ Bot já estava parado');
      }
    }

    if (!process.env.TELEGRAM_BOT_TOKEN) {
      throw new Error('TELEGRAM_BOT_TOKEN não encontrado');
    }

    console.log('🚀 Iniciando nova instância do bot...');
    bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

    // Comando inicial
    bot.start((ctx) => {
      const userId = ctx.from?.id.toString() || 'unknown';
      const currentTimezone = getUserTimezone(userId, ctx.from?.language_code);
      
      ctx.reply(
        '🤖 *Zelar - Assistente Inteligente de Agendamentos*\n\n' +
        'Olá! Sou seu assistente para criar eventos com detecção automática de fuso horário!\n\n' +
        '📝 *Exemplos que entendo:*\n' +
        '• "jantar hoje às 19h"\n' +
        '• "reunião quarta às sete da noite"\n' +
        '• "19", "7 da noite"\n' +
        '• "consulta sexta que vem às 15h30"\n\n' +
        `🌍 *Seu fuso atual:* \`${currentTimezone}\`\n` +
        '⚙️ *Comandos úteis:*\n' +
        '• `/fuso` - configurar fuso horário\n' +
        '• `/interpretar` - testar datas\n\n' +
        '🧠 Digite seu compromisso! 🚀',
        { parse_mode: 'Markdown' }
      );
    });

    // Comando /fuso - configurar fuso horário
    bot.command('fuso', async (ctx) => {
      const message = ctx.message.text.replace('/fuso', '').trim();
      const userId = ctx.from?.id.toString() || 'unknown';
      
      if (!message) {
        const currentTimezone = getUserTimezone(userId, ctx.from?.language_code);
        const timezoneList = COMMON_TIMEZONES.slice(0, 6).map(tz => `• \`${tz}\``).join('\n');
        
        await ctx.reply(
          `🌍 *Configuração de Fuso Horário*\n\n` +
          `📍 *Seu fuso atual:* \`${currentTimezone}\`\n\n` +
          `💡 *Para alterar:* \`/fuso America/Sao_Paulo\`\n\n` +
          `📋 *Fusos comuns:*\n${timezoneList}`,
          { parse_mode: 'Markdown' }
        );
        return;
      }
      
      // =================== CORREÇÃO: TRATAMENTO ROBUSTO DE ERRO ===================
      try {
        const success = setUserTimezone(userId, message);
        
        if (success) {
          // Sincronizar com horários locais
          const numericUserId = ctx.from?.id || 0;
          userTimezones.set(numericUserId, message);
          
          const locationName = message.split('/')[1]?.replace('_', ' ') || message;
          await ctx.reply(
            `✅ *Fuso horário configurado!*\n\n` +
            `🌍 *Novo fuso:* ${locationName}\n` +
            `📍 *Código:* \`${message}\`\n\n` +
            `Agora quando você disser:\n` +
            `• "às 7 da noite" → será 19:00 no seu horário local\n` +
            `• "às 3 da tarde" → será 15:00 no seu horário local\n` +
            `• Todos os eventos usarão este fuso horário`,
            { parse_mode: 'Markdown' }
          );
        } else {
          await ctx.reply(
            `❌ *Fuso horário inválido*\n\n` +
            `💡 *Exemplos válidos:*\n` +
            `• \`America/Sao_Paulo\` (Brasil)\n` +
            `• \`America/Buenos_Aires\` (Argentina)\n` +
            `• \`Europe/Lisbon\` (Portugal)\n` +
            `• \`America/New_York\` (EUA)`,
            { parse_mode: 'Markdown' }
          );
        }
      } catch (error) {
        console.error('Erro ao configurar fuso horário:', error);
        await ctx.reply(
          `❌ *Erro interno*\n\n` +
          `Tente novamente ou use um fuso horário válido como \`America/Sao_Paulo\``
        );
      }
    });



    // Comando de teste para interpretação de datas
    bot.command('interpretar', async (ctx) => {
      const message = ctx.message.text.replace('/interpretar', '').trim();
      
      if (!message) {
        await ctx.reply(
          '💡 *Como usar:*\n\n' +
          '`/interpretar quarta às sete da noite`\n' +
          '`/interpretar sexta que vem às 19h`\n' +
          '`/interpretar 19` ou `/interpretar 7 da noite`\n\n' +
          'Digite qualquer data/hora!',
          { parse_mode: 'Markdown' }
        );
        return;
      }

      // =================== INÍCIO: INTEGRAÇÃO HORÁRIOS LOCAIS ===================
      const userId = ctx.from?.id || 0;
      
      // Primeiro tentar interpretar como horário local puro
      const localTime = parseLocalTime(message, userId);
      if (localTime) {
        const formattedTime = formatLocalTime(localTime.hour, localTime.minute, localTime.timezone);
        await ctx.reply(
          `✅ *Horário local interpretado!*\n\n` +
          `📝 *Você disse:* "${message}"\n\n` +
          `🕐 *Interpretei como:* ${formattedTime}\n\n` +
          `💡 *Para agendar:* Digite algo como "reunião sexta às 7 da noite"`
        );
        return;
      }
      
      // Se não conseguiu interpretar como horário local, verificar se precisa configurar fuso
      if (!userTimezones.has(userId) && (message.includes('às') || message.includes('da noite') || message.includes('da tarde'))) {
        await ctx.reply(
          `⚠️ *Configure seu fuso horário primeiro!*\n\n` +
          `💡 *Use:* \`/fuso America/Sao_Paulo\`\n\n` +
          `Depois você poderá usar horários como "às 7 da noite" que serão interpretados no seu fuso local.`,
          { parse_mode: 'Markdown' }
        );
        return;
      }
      // =================== FIM: INTEGRAÇÃO HORÁRIOS LOCAIS ===================

      const result = parseUserDateTime(message, userId.toString(), ctx.from?.language_code);
      
      if (result) {
        const currentTimezone = getUserTimezone(userId.toString(), ctx.from?.language_code);
        await ctx.reply(
          `✅ *Entendi perfeitamente!*\n\n` +
          `📝 *Você disse:* "${message}"\n\n` +
          `📅 *Interpretei como:*\n${result.readable}\n\n` +
          `🌍 *Fuso usado:* \`${currentTimezone}\``,
          { parse_mode: 'Markdown' }
        );
      } else {
        await ctx.reply(
          `❌ *Não consegui entender essa data/hora*\n\n` +
          `📝 *Você disse:* "${message}"\n\n` +
          `💡 *Tente algo como:*\n` +
          `• "hoje às 15h"\n` +
          `• "19" ou "7 da noite"\n` +
          `• "sexta às sete da noite"`
        );
      }
    });

    // Processar mensagens
    bot.on('text', async (ctx) => {
      try {
        const message = ctx.message.text;
        
        if (message.startsWith('/')) return;
        
        const userId = ctx.from?.id || 0;
        const userIdString = userId.toString();
        
        // =================== INÍCIO: VERIFICAÇÃO HORÁRIOS LOCAIS ===================
        // Verificar se a mensagem contém padrões que requerem fuso horário configurado
        const hasTimePattern = TIME_PATTERNS.some(({ pattern }) => {
          pattern.lastIndex = 0;
          return pattern.test(message);
        });
        
        // Se contém padrão de horário mas não tem fuso configurado, pedir configuração
        if (hasTimePattern && !userTimezones.has(userId)) {
          await ctx.reply(
            `⚠️ *Configure seu fuso horário primeiro!*\n\n` +
            `💡 *Use:* \`/fuso America/Sao_Paulo\`\n\n` +
            `Depois você poderá usar expressões como:\n` +
            `• "às 7 da noite" → 19:00 no seu horário local\n` +
            `• "às 3 da tarde" → 15:00 no seu horário local\n` +
            `• "às 9am" → 09:00 no seu horário local\n\n` +
            `📋 *Fusos comuns:*\n` +
            `• \`America/Sao_Paulo\` (Brasil)\n` +
            `• \`America/Buenos_Aires\` (Argentina)\n` +
            `• \`Europe/Lisbon\` (Portugal)`,
            { parse_mode: 'Markdown' }
          );
          return;
        }
        // =================== FIM: VERIFICAÇÃO HORÁRIOS LOCAIS ===================
        
        const event = processMessage(message, userIdString, ctx.from?.language_code);
        
        if (!event) {
          await ctx.reply(
            '❌ *Não consegui entender a data/hora*\n\n' +
            '💡 *Tente algo como:*\n' +
            '• "jantar hoje às 19h"\n' +
            '• "reunião quarta às 15h"\n' +
            '• "consulta sexta que vem às 10 da manhã"\n\n' +
            '🔍 Use `/interpretar sua frase` para testar!\n' +
            '🌍 Use `/fuso` para configurar horários locais!',
            { parse_mode: 'Markdown' }
          );
          return;
        }
        
        const links = generateLinks(event);

        await ctx.reply(
          '✅ *Evento criado com sucesso!*\n\n' +
          `🎯 *${event.title}*\n` +
          `📅 ${event.displayDate}\n\n` +
          '📅 *Adicionar ao calendário:*',
          { 
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '📅 Google Calendar', url: links.google },
                  { text: '📅 Outlook', url: links.outlook }
                ]
              ]
            }
          }
        );

      } catch (error) {
        console.error('Erro:', error);
        await ctx.reply(
          '❌ *Erro ao processar sua mensagem*\n\n' +
          '💡 *Tente novamente com:*\n' +
          '• "jantar hoje às 19h"\n' +
          '• "reunião amanhã às 15h"\n\n' +
          'Ou use `/interpretar sua frase` para testar!'
        );
      }
    });

    // =================== CORREÇÃO: HANDLER PARA CALLBACK QUERY (BOTÕES INLINE) ===================
    bot.on('callback_query', async (ctx) => {
      try {
        if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) {
          await ctx.answerCbQuery('Dados inválidos');
          return;
        }

        const selectedTimezone = ctx.callbackQuery.data;
        const userId = ctx.from?.id.toString() || 'unknown';

        console.log(`🌍 Fuso selecionado: ${selectedTimezone} para usuário ${userId}`);

        // Validar fuso horário usando lista de fusos válidos
        const validTimezones = COMMON_TIMEZONES;
        if (!validTimezones.includes(selectedTimezone)) {
          await ctx.answerCbQuery('Fuso horário inválido');
          await ctx.reply('❌ Fuso horário inválido. Tente novamente.');
          return;
        }

        // Salvar fuso horário
        const success = setUserTimezone(userId, selectedTimezone);
        
        if (success) {
          // Sincronizar com Map local
          const numericUserId = ctx.from?.id || 0;
          userTimezones.set(numericUserId, selectedTimezone);
          
          const locationName = selectedTimezone.split('/')[1]?.replace('_', ' ') || selectedTimezone;
          
          await ctx.answerCbQuery(`Fuso configurado: ${locationName}`);
          await ctx.reply(
            `✅ *Fuso horário configurado!*\n\n` +
            `🌍 *Novo fuso:* ${locationName}\n` +
            `📍 *Código:* \`${selectedTimezone}\`\n\n` +
            `Agora quando você disser:\n` +
            `• "às 7 da noite" → será 19:00 no seu horário local\n` +
            `• "às 3 da tarde" → será 15:00 no seu horário local\n` +
            `• Todos os eventos usarão este fuso horário`,
            { parse_mode: 'Markdown' }
          );
        } else {
          await ctx.answerCbQuery('Erro ao salvar fuso');
          await ctx.reply('❌ Erro ao salvar fuso horário. Tente novamente.');
        }

      } catch (error) {
        console.error('Erro ao processar callback query:', error);
        await ctx.answerCbQuery('Erro interno');
        await ctx.reply('❌ Erro interno. Tente novamente.');
      }
    });

    // =================== DEFINIR COMANDOS OFICIAIS ===================
    // Limpar comandos desnecessários e definir apenas os úteis
    await bot.telegram.setMyCommands([
      { command: 'start', description: 'Iniciar o assistente' },
      { command: 'fuso', description: 'Configurar fuso horário' },
      { command: 'interpretar', description: 'Testar interpretação de datas' }
    ]);
    
    await bot.launch();
    console.log('✅ Bot Zelar ativo com comandos limpos!');
    return true;

  } catch (error) {
    console.error('❌ Erro ao iniciar bot:', error);
    return false;
  }
}

export function stopZelarBot(): void {
  if (bot) {
    bot.stop();
    bot = null;
  }
}