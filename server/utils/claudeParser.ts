/**
 * Parser inteligente usando Claude Haiku via OpenRouter
 * Para interpretar datas, horários e extrair títulos limpos
 */

import axios from 'axios';

interface ParsedEvent {
  title: string;
  date: string; // ISO string
  hour: number;
  minute: number;
  isValid: boolean;
  error?: string;
}

export async function parseEventWithClaude(
  userMessage: string,
  userTimezone: string = 'America/Sao_Paulo'
): Promise<ParsedEvent> {
  try {
    const systemPrompt = `Você é um assistente especializado em interpretar compromissos em português brasileiro.

INSTRUÇÕES:
1. Extraia o TÍTULO do evento removendo todas as expressões temporais
2. Identifique a DATA (considere fuso horário ${userTimezone})
3. Identifique o HORÁRIO (formato 24h)

REGRAS CRÍTICAS PARA TÍTULO:
- Remova TODOS os comandos: "marque", "agende", "coloque", "lembre", "me lembre de", "anote", "criar", "fazer"
- Remova TODAS as expressões temporais: "amanhã", "hoje", "às 15", "às 19", "sexta", "segunda", etc.
- Remova TODOS os horários: "às X", "às XX:XX", qualquer menção de hora
- Remova TODOS os dias da semana: "segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"
- Mantenha APENAS o objeto/ação principal
- Exemplos CORRETOS:
  * "marque entrega da semana sexta às 15" → "Entrega da semana"
  * "me lembre de cancelar o amex às 19" → "Cancelar amex"
  * "desbloquear o cartão amanhã às 15" → "Desbloquear cartão"
- NUNCA inclua horários, dias da semana ou comandos no título final

REGRAS PARA DATA/HORA:
- SEMPRE calcule datas baseado no fuso ${userTimezone}
- Hoje é ${new Date().toLocaleDateString('pt-BR', { timeZone: userTimezone })} no fuso ${userTimezone}
- "segunda" = próxima segunda-feira a partir de hoje
- "amanhã" = próximo dia a partir de hoje
- "às 15" = 15:00 no fuso ${userTimezone}
- Se não especificar hora, use 09:00
- SEMPRE use ano 2025 ou posterior
- Considere que hoje é ${new Date().toLocaleDateString('pt-BR', { timeZone: userTimezone, weekday: 'long' })}

Responda APENAS em JSON:
{
  "title": "título limpo",
  "date": "YYYY-MM-DD",
  "hour": 15,
  "minute": 0,
  "isValid": true
}`;

    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'anthropic/claude-3-haiku',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Analise: "${userMessage}"` }
        ],
        response_format: { type: 'json_object' }
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://zelar-bot.replit.app',
          'X-Title': 'Zelar Calendar Bot'
        }
      }
    );

    const result = JSON.parse(response.data.choices[0].message.content);
    
    console.log(`🤖 Claude interpretou: "${userMessage}" → ${JSON.stringify(result)}`);
    
    // CORREÇÃO: Garantir que a data seja sempre 2025 ou posterior
    let correctedDate = result.date;
    if (correctedDate && correctedDate.startsWith('2023') || correctedDate.startsWith('2024')) {
      const currentYear = new Date().getFullYear();
      correctedDate = correctedDate.replace(/^\d{4}/, currentYear.toString());
      console.log(`📅 Data corrigida de ${result.date} para ${correctedDate}`);
    }
    
    return {
      title: result.title || 'Evento',
      date: correctedDate || new Date().toISOString().split('T')[0],
      hour: result.hour || 9,
      minute: result.minute || 0,
      isValid: result.isValid !== false
    };

  } catch (error) {
    console.error('Erro ao usar Claude:', error);
    
    // Fallback para parsing manual se Claude falhar
    return {
      title: userMessage.split(' ').slice(0, 3).join(' '), // primeiras 3 palavras
      date: new Date().toISOString().split('T')[0],
      hour: 9,
      minute: 0,
      isValid: false,
      error: 'Falha na interpretação IA'
    };
  }
}