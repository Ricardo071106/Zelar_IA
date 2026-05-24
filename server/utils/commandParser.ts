import { z } from 'zod';
import { parseDeleteWithOllama } from './ollamaIntentParser';

const DeleteCommandSchema = z.object({
  isDeleteIntent: z.boolean(),
  targetTitle: z.string(),
  targetDateISO: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export type DeleteCommandIntent = z.infer<typeof DeleteCommandSchema>;
export type YesNoIntent = 'yes' | 'no' | 'unknown';

function normalizeBasicText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseDeleteCommandLocal(message: string): DeleteCommandIntent {
  const normalized = normalizeBasicText(message);
  const hasDeleteVerb = /\b(cancele|cancelar|apague|apagar|deletar|delete|remova|remover|exclua|excluir)\b/i.test(
    normalized,
  );

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
    .replace(/\b(a|o|os|as|um|uma|meu|minha|evento|compromisso|aula|reuniao|reunião|pacote)\b/gi, ' ')
    .replace(/\b(amanha|amanhã|hoje|ontem|segunda|terca|terça|quarta|quinta|sexta|sabado|sábado|domingo)\b/gi, ' ')
    .replace(/\bde\s+aulas?\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\bauals\b/gi, 'aulas');

  const parsed = DeleteCommandSchema.safeParse({
    isDeleteIntent: true,
    targetTitle: guessedTitle,
    targetDateISO: null,
    confidence: 0.55,
  });
  return parsed.success ? parsed.data : { isDeleteIntent: true, targetTitle: guessedTitle, targetDateISO: null };
}

/** Ollama quando disponível; fallback regex local. */
export async function parseDeleteCommand(
  message: string,
  userTimezone: string = 'America/Sao_Paulo',
): Promise<DeleteCommandIntent> {
  const llm = await parseDeleteWithOllama(message, userTimezone);
  if (llm?.isDeleteIntent && llm.targetTitle.trim().length >= 2) {
    return llm;
  }
  if (llm && !llm.isDeleteIntent) {
    return llm;
  }
  return parseDeleteCommandLocal(message);
}

export function parseYesNo(message: string): YesNoIntent {
  const normalized = normalizeBasicText(message);
  if (['s', 'sim', 'yes', 'y'].includes(normalized)) return 'yes';
  if (['n', 'nao', 'não', 'no'].includes(normalized)) return 'no';
  return 'unknown';
}
