/**
 * Parser inteligente usando Claude Haiku via OpenRouter
 * Refatorado para eficiência e simplicidade
 */

import axios from 'axios';
import { z } from 'zod';
import { DateTime } from 'luxon';

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
    // Usando Luxon para garantir que "Hoje" seja "Hoje" no fuso do usuário, não em UTC
    const now = DateTime.now().setZone(userTimezone);
    const today = now.toFormat('dd/MM/yyyy');
    const dayOfWeek = now.setLocale('pt-BR').toFormat('EEEE'); // segunda-feira, terça-feira...
    const currentYear = now.year;
    const currentMonth = now.month;

    // Calculando "Amanhã" no fuso correto para o exemplo
    const tomorrowExample = now.plus({ days: 1 }).toISODate(); // YYYY-MM-DD

    const systemPrompt = `You are a helper that extracts event details from Portuguese text.

Current Context:
- Date: ${today} (${dayOfWeek})
- Timezone: ${userTimezone}
- Current Year: ${currentYear}
- Current Month: ${currentMonth}
- Assume current year unless specified otherwise (or if the date has already passed this year).

Instructions:
1. Extract event title (remove time/date references).
2. Extract date (YYYY-MM-DD). "Amanhã" = next day. "Segunda" = next Monday.
3. Extract time (0-23 hour, 0-59 minute). Default 09:00 if not specified.
4. Extract phone numbers mentioned as 'target_phones'. FORMAT RULES:
     - Remove all non-digit characters.
     - Users may dictate digits in Portuguese (um, dois, três, quatro, cinco, seis, meia, sete, oito, nove, dez, onze, doze...) or as comma-separated digit groups after "para/pra" (e.g. "pra 11, 9, 8, 5, 4, 4, 4, 4, 4"). Concatenate all digit groups in order to form the full national number before normalizing.
     - DDI Default: If the number starts with DDD (2 digits from 11-99) but NO DDI, prepend '55'.
     - Example: "11999998888" becomes "5511999998888".
     - DDI Check: If it already starts with "55", keep it.
     - 9th Digit: For Brazilian mobile numbers (DDD 11-99), ensure the number part has 9 digits (total 11 digits without DDI, or 13 with DDI).
     - If a mobile number has only 8 digits (old format), insert '9' after the DDD.
     - FINAL FORMAT MUST BE: DDI (2 digits) + DDD (2 digits) + NUMBER (9 digits) = 13 digits total (e.g. 5511999998888).
     - Valid numbers only. Never invent digits not implied by the user message.
5. Extract emails mentioned as 'attendees' only if the exact email string appears in the user message (transcription may garble emails; omit if unsure).
6. Return JSON only. DO NOT output conversational text.
7. If the user text DOES NOT contain a clear event or appointment request (e.g., just "oi", "bom dia", questions), return exactly:
   { "isValid": false, "title": "", "date": "", "hour": 0, "minute": 0 }

IMPORTANT: The example below is just for JSON structure reference. DO NOT COPY THE DATE OR VALUES. CALCULATE BASED ON USER INPUT.

Example Input: "Reunião de orçamento amanhã às 15h com 11999887766"
Example Output (Reference only):
{
  "title": "Reunião de orçamento",
  "date": "${tomorrowExample}",
  "hour": 15,
  "minute": 0,
  "target_phones": ["55119999887766"],
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

    let content = response.data.choices[0].message.content;

    // Tentativa de limpeza caso venha com markdown
    content = content.replace(/```json/g, '').replace(/```/g, '').trim();

    let json;
    try {
      json = JSON.parse(content);

      // Limpeza programática de números de telefone para evitar alucinações de formato
      if (json.target_phones && Array.isArray(json.target_phones)) {
        json.target_phones = json.target_phones.map((p: string) => p.replace(/\D/g, ''));
      }
    } catch (e) {
      console.warn('⚠️ Falha ao fazer parse do JSON do Claude. Conteúdo bruto:', content);
      return {
        title: "",
        date: "",
        hour: 0,
        minute: 0,
        isValid: false
      };
    }

    // Validate with Zod
    const result = ClaudeEventSchema.safeParse(json);

    if (!result.success) {
      console.warn('⚠️ JSON do Claude inválido pelo schema:', result.error);
      return {
        title: "",
        date: "",
        hour: 0,
        minute: 0,
        isValid: false
      };
    }

    console.log(`🤖 Claude Output:`, JSON.stringify(result.data));

    return result.data;

  } catch (error) {
    console.error('Claude Parse Error:', error);
    return {
      title: "",
      date: "",
      hour: 0,
      minute: 0,
      isValid: false
    };
  }
}