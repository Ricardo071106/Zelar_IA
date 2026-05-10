import axios from 'axios';
import { z } from 'zod';
import { DateTime } from 'luxon';

const DeleteCommandSchema = z.object({
  isDeleteIntent: z.boolean(),
  targetTitle: z.string(),
  targetDateISO: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

const YesNoSchema = z.object({
  answer: z.enum(['yes', 'no', 'unknown']),
  confidence: z.number().min(0).max(1).optional(),
});

export type DeleteCommandIntent = z.infer<typeof DeleteCommandSchema>;
export type YesNoIntent = z.infer<typeof YesNoSchema>['answer'];

function stripMarkdownFence(text: string): string {
  return text.replace(/```json/gi, '').replace(/```/g, '').trim();
}

function normalizeBasicText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function fallbackDeleteIntent(message: string): DeleteCommandIntent {
  const normalized = normalizeBasicText(message);
  const hasDeleteVerb = /\b(cancele|cancelar|cancelar|apague|apagar|deletar|delete|remova|remover|exclua|excluir)\b/i.test(normalized);

  if (!hasDeleteVerb) {
    return {
      isDeleteIntent: false,
      targetTitle: '',
      targetDateISO: null,
      confidence: 0.1,
    };
  }

  const guessedTitle = message
    .replace(/\b(cancele|cancelar|apague|apagar|deletar|delete|remova|remover|exclua|excluir)\b/gi, '')
    .replace(/\b(a|o|os|as|um|uma|meu|minha|evento|compromisso|aula|reuniao|reunião)\b/gi, ' ')
    .replace(/\b(amanha|amanhã|hoje|ontem|segunda|terca|terça|quarta|quinta|sexta|sabado|sábado|domingo)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    isDeleteIntent: true,
    targetTitle: guessedTitle,
    targetDateISO: null,
    confidence: 0.55,
  };
}

function fallbackYesNoIntent(message: string): YesNoIntent {
  const normalized = normalizeBasicText(message);
  if (['s', 'sim', 'yes', 'y'].includes(normalized)) return 'yes';
  if (['n', 'nao', 'não', 'no'].includes(normalized)) return 'no';
  return 'unknown';
}

export async function parseDeleteCommandWithOpenRouter(
  message: string,
  userTimezone: string = 'America/Sao_Paulo',
): Promise<DeleteCommandIntent> {
  if (!process.env.OPENROUTER_API_KEY) {
    return fallbackDeleteIntent(message);
  }

  const now = DateTime.now().setZone(userTimezone);
  const today = now.toFormat('dd/MM/yyyy');
  const tomorrow = now.plus({ days: 1 }).toISODate();

  const systemPrompt = `You are an assistant that classifies deletion intents in Portuguese for calendar events.
Current context:
- Timezone: ${userTimezone}
- Today: ${today}
- Tomorrow: ${tomorrow}

Rules:
1) Return JSON only.
2) If user clearly wants to delete/cancel an existing event, set isDeleteIntent=true.
3) Extract targetTitle as the event name without temporal words.
4) If user mentioned a date (e.g. amanhã, hoje, terça), convert to YYYY-MM-DD in targetDateISO. Else null.
5) If user is not requesting deletion, return:
   {"isDeleteIntent": false, "targetTitle": "", "targetDateISO": null, "confidence": 0}
6) Keep confidence between 0 and 1.`;

  try {
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'anthropic/claude-3-haiku',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message },
        ],
        response_format: { type: 'json_object' },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://zelar-bot.replit.app',
          'X-Title': 'Zelar Calendar Bot',
        },
      },
    );

    const content = stripMarkdownFence(response.data.choices?.[0]?.message?.content || '');
    const parsed = DeleteCommandSchema.safeParse(JSON.parse(content));
    if (!parsed.success) return fallbackDeleteIntent(message);
    return parsed.data;
  } catch (error) {
    console.warn('⚠️ Falha no parse de deleção via OpenRouter:', error);
    return fallbackDeleteIntent(message);
  }
}

export async function parseYesNoWithOpenRouter(message: string): Promise<YesNoIntent> {
  if (!process.env.OPENROUTER_API_KEY) {
    return fallbackYesNoIntent(message);
  }

  const systemPrompt = `You classify if a short Portuguese answer means YES or NO.
Return JSON only with:
{"answer":"yes|no|unknown","confidence":0..1}

Consider equivalents:
- yes: sim, s, claro, pode, pode sim, ok
- no: nao, não, n, negativo, deixa
- otherwise unknown`;

  try {
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'anthropic/claude-3-haiku',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message },
        ],
        response_format: { type: 'json_object' },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://zelar-bot.replit.app',
          'X-Title': 'Zelar Calendar Bot',
        },
      },
    );

    const content = stripMarkdownFence(response.data.choices?.[0]?.message?.content || '');
    const parsed = YesNoSchema.safeParse(JSON.parse(content));
    if (!parsed.success) return fallbackYesNoIntent(message);
    return parsed.data.answer;
  } catch (error) {
    console.warn('⚠️ Falha no parse sim/não via OpenRouter:', error);
    return fallbackYesNoIntent(message);
  }
}
