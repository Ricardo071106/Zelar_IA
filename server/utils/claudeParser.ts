/**
 * Parser inteligente usando Claude Haiku via OpenRouter
 * Refatorado para eficiência e simplicidade
 */

import axios from 'axios';
import { z } from 'zod';

// =================== DTOs & Validation ===================

const ClaudeEventSchema = z.object({
  title: z.string(),
  date: z.string().describe("ISO Date YYYY-MM-DD"),
  hour: z.number().int().min(0).max(23),
  minute: z.number().int().min(0).max(59),
  target_phones: z.array(z.string()).optional().describe("List of phone numbers/contacts to remind"),
  attendees: z.array(z.string()).optional().describe("List of email addresses"),
  isValid: z.boolean()
});

export type ClaudeEventResponse = z.infer<typeof ClaudeEventSchema>;

// =================== Main Function ===================

export async function parseEventWithClaude(
  userMessage: string,
  userTimezone: string = 'America/Sao_Paulo'
): Promise<ClaudeEventResponse> {
  try {
    const today = new Date().toLocaleDateString('pt-BR', { timeZone: userTimezone });
    const dayOfWeek = new Date().toLocaleDateString('pt-BR', { timeZone: userTimezone, weekday: 'long' });

    const systemPrompt = `You are a helper that extracts event details from Portuguese text.
    
Current Context:
- Date: ${today} (${dayOfWeek})
- Timezone: ${userTimezone}
- Year must be 2025+

Instructions:
1. Extract event title (remove time/date references).
2. Extract date (YYYY-MM-DD). "Amanhã" = next day. "Segunda" = next Monday.
3. Extract time (0-23 hour, 0-59 minute). Default 09:00 if not specified.
4. Extract phone numbers mentioned as 'target_phones'.
5. Extract emails mentioned as 'attendees'.
6. Return JSON only.

Example Input: "Reunião de orçamento amanhã às 15h com 11999887766"
Example Output:
{
  "title": "Reunião de orçamento",
  "date": "2025-05-30",
  "hour": 15,
  "minute": 0,
  "target_phones": ["11999887766"],
  "attendees": [],
  "isValid": true
}`;

    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'anthropic/claude-3-haiku',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
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

    const content = response.data.choices[0].message.content;
    const json = JSON.parse(content);

    // Validate with Zod
    const result = ClaudeEventSchema.parse(json);

    console.log(`🤖 Claude Output:`, JSON.stringify(result));

    return result;

  } catch (error) {
    console.error('Claue Parse Error:', error);
    return {
      title: "",
      date: "",
      hour: 0,
      minute: 0,
      isValid: false
    };
  }
}