import { z } from 'zod';
import { extractComGuestNameFromText } from '../whatsapp/extractComGuestName';
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

const DELETE_VERB_RE =
  /\b(cancele|cancelar|apague|apagar|deletar|delete|remova|remover|exclua|excluir)\b/i;

function hasDeleteVerbInText(message: string): boolean {
  return DELETE_VERB_RE.test(
    message
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, ''),
  );
}

function refineDeleteTargetTitle(raw: string): string {
  let t = raw
    .replace(/^(as\s+)?(todas?\s+)?(os\s+)?(as\s+)?aulas?\s+(com|de|do|da|dos|das)\s+/i, '')
    .replace(/^(com|de|do|da|dos|das)\s+/i, '')
    .replace(/\b(aula|aulas|evento|compromisso|reuniao|reunião|pacote)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (t.length >= 2) return t;
  return raw.trim();
}

/** Parser síncrono — fonte de verdade quando há verbo de apagar/cancelar. */
export function parseDeleteCommandLocal(message: string): DeleteCommandIntent {
  if (!hasDeleteVerbInText(message)) {
    return {
      isDeleteIntent: false,
      targetTitle: '',
      targetDateISO: null,
      confidence: 0.1,
    };
  }

  const fromCom = extractComGuestNameFromText(message);
  let targetTitle = fromCom?.trim() || '';

  if (!targetTitle || targetTitle.length < 2) {
    const afterVerb = message
      .replace(DELETE_VERB_RE, ' ')
      .replace(/\b(todas?|todos?|as|os)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const rel = afterVerb.match(/\b(?:com|de|do|da|dos|das)\s+(.+)$/i);
    if (rel?.[1]?.trim()) {
      targetTitle = rel[1].trim();
    } else {
      targetTitle = afterVerb
        .replace(/\b(a|o|os|as|um|uma|meu|minha|evento|compromisso|aula|reuniao|reunião|pacote)\b/gi, ' ')
        .replace(/\b(amanha|amanhã|hoje|ontem|segunda|terca|terça|quarta|quinta|sexta|sabado|sábado|domingo)(-feira)?\b/gi, ' ')
        .replace(/\bde\s+aulas?\b/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\bauals\b/gi, 'aulas');
    }
  }

  targetTitle = refineDeleteTargetTitle(targetTitle);
  const norm = normalizeBasicText(targetTitle);
  if (norm === 'aula' || norm === 'aulas' || targetTitle.length < 2) {
    return {
      isDeleteIntent: true,
      targetTitle: '',
      targetDateISO: null,
      confidence: 0.5,
    };
  }

  const parsed = DeleteCommandSchema.safeParse({
    isDeleteIntent: true,
    targetTitle,
    targetDateISO: null,
    confidence: 0.85,
  });
  return parsed.success ? parsed.data : { isDeleteIntent: true, targetTitle, targetDateISO: null, confidence: 0.85 };
}

/**
 * Verbo de exclusão manda no fluxo (parser local). Ollama só enriquece nome/data;
 * nunca pode transformar "apague aulas com X" em agendamento.
 */
export async function parseDeleteCommand(
  message: string,
  userTimezone: string = 'America/Sao_Paulo',
): Promise<DeleteCommandIntent> {
  const local = parseDeleteCommandLocal(message);
  if (!local.isDeleteIntent) {
    const llm = await parseDeleteWithOllama(message, userTimezone);
    if (llm?.isDeleteIntent && llm.targetTitle.trim().length >= 2) {
      return llm;
    }
    return local;
  }

  const llm = await parseDeleteWithOllama(message, userTimezone);
  if (llm?.targetTitle && llm.targetTitle.trim().length >= 2) {
    return {
      isDeleteIntent: true,
      targetTitle: refineDeleteTargetTitle(llm.targetTitle.trim()),
      targetDateISO: llm.targetDateISO ?? local.targetDateISO ?? null,
      confidence: Math.max(local.confidence ?? 0.85, llm.confidence ?? 0),
    };
  }

  return local;
}

export function parseYesNo(message: string): YesNoIntent {
  const normalized = normalizeBasicText(message);
  if (['s', 'sim', 'yes', 'y'].includes(normalized)) return 'yes';
  if (['n', 'nao', 'não', 'no'].includes(normalized)) return 'no';
  return 'unknown';
}
