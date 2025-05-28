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

REGRAS PARA TÍTULO:
- Remova: "amanhã", "hoje", "às X", "sexta", "segunda", etc.
- Remova: "marque", "agende", "coloque", "lembre"
- Mantenha apenas o núcleo da atividade
- Exemplos:
  * "desbloquear o cartão amanhã às 15" → "Desbloquear o cartão"
  * "agende reunião sexta às 9" → "Reunião"

REGRAS PARA DATA/HORA:
- "amanhã" = próximo dia
- "sexta" = próxima sexta-feira
- "às 15" = 15:00
- Se não especificar hora, use 09:00

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
    
    return {
      title: result.title || 'Evento',
      date: result.date || new Date().toISOString().split('T')[0],
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