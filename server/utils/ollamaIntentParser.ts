import { z } from 'zod';
import { DateTime } from 'luxon';
import { chatJsonCompletion, isLlmConfigured } from './llmClient';

export type LessonPackageHint = {
  id: string;
  label: string;
  lessons: number;
  priceCents: number;
};

export type ScheduleParseContext = {
  userTimezone: string;
  lessonPackages?: LessonPackageHint[];
  guestNames?: string[];
  defaultLessonPriceCents?: number | null;
};

const ScheduleIntentSchema = z.object({
  isScheduleIntent: z.boolean(),
  isValid: z.boolean(),
  title: z.string(),
  date: z.string(),
  hour: z.number().int().min(0).max(23),
  minute: z.number().int().min(0).max(59),
  studentName: z.string().nullable().optional(),
  packageSlug: z.string().nullable().optional(),
});

export type ScheduleIntent = z.infer<typeof ScheduleIntentSchema>;

const DeleteIntentSchema = z.object({
  isDeleteIntent: z.boolean(),
  targetTitle: z.string(),
  targetDateISO: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export type DeleteIntent = z.infer<typeof DeleteIntentSchema>;

function formatPackageList(packages: LessonPackageHint[]): string {
  if (!packages.length) return '(nenhum pacote cadastrado)';
  return packages
    .map((p) => {
      const brl = (p.priceCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      return `- id="${p.id}" label="${p.label}" aulas=${p.lessons} preço_total=${brl}`;
    })
    .join('\n');
}

function buildScheduleSystemPrompt(ctx: ScheduleParseContext): string {
  const now = DateTime.now().setZone(ctx.userTimezone);
  const today = now.toFormat('dd/MM/yyyy');
  const dayOfWeek = now.setLocale('pt-BR').toFormat('EEEE');
  const defaultPrice =
    typeof ctx.defaultLessonPriceCents === 'number' && ctx.defaultLessonPriceCents > 0
      ? (ctx.defaultLessonPriceCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      : 'não definido';

  return `Você extrai agendamentos de calendário a partir de mensagens em português do Brasil (WhatsApp).

Contexto:
- Fuso: ${ctx.userTimezone}
- Hoje: ${today} (${dayOfWeek})
- Ano atual: ${now.year}
- Preço padrão por aula (referência): ${defaultPrice}

Pacotes nomeados do organizador (use packageSlug = id exato quando o usuário mencionar um pacote):
${formatPackageList(ctx.lessonPackages ?? [])}

Alunos/convidados conhecidos (priorize estes nomes em studentName):
${(ctx.guestNames ?? []).slice(0, 80).join(', ') || '(lista vazia)'}

Regras:
1) Retorne JSON apenas.
2) isScheduleIntent=true quando o usuário pede marcar/agendar/criar aula, consulta, reunião ou compromisso com data/hora.
3) isValid=true somente se conseguir data (YYYY-MM-DD) e hora plausíveis.
4) title: nome curto do evento SEM data, hora, "marque", "agende". Para pacote, use ex.: "Pacote cirurgia" ou "Aula de violão", não inclua o nome do aluno no title.
5) studentName: nome da pessoa após "com" (ex.: "com Ricardo Abrahão" → "Ricardo Abrahão"). Null se não houver.
6) packageSlug: id do pacote da lista acima se o usuário mencionar pacote (ex.: "pacote de cirurgia", "pacote cirurgia", "pacote básico de aulas"). Null se não for pacote.
7) "Amanhã" = ${now.plus({ days: 1 }).toISODate()}. "Segunda" = próxima segunda-feira futura.
8) "8 da manhã" = hour 8 minute 0. "15h" = 15:00. Tarde sem hora explícita → 15:00.
9) Se for só saudação/pergunta sem pedido de agenda: isScheduleIntent=false, isValid=false.
10) attendees/emails: não invente.

Formato:
{
  "isScheduleIntent": true,
  "isValid": true,
  "title": "Pacote cirurgia",
  "date": "2026-05-25",
  "hour": 8,
  "minute": 0,
  "studentName": "Ricardo Abrahão",
  "packageSlug": "cirurgia"
}`;
}

export async function parseScheduleWithOllama(
  message: string,
  ctx: ScheduleParseContext,
): Promise<ScheduleIntent | null> {
  if (!isLlmConfigured()) return null;

  const raw = await chatJsonCompletion<Record<string, unknown>>(
    buildScheduleSystemPrompt(ctx),
    message,
  );
  if (!raw) return null;

  const parsed = ScheduleIntentSchema.safeParse(raw);
  if (!parsed.success) {
    console.warn('[LLM] JSON de agendamento inválido:', parsed.error.message);
    return null;
  }

  if (!parsed.data.isScheduleIntent || !parsed.data.isValid) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(parsed.data.date)) return null;

  console.log('[LLM] Agendamento interpretado:', JSON.stringify(parsed.data));
  return parsed.data;
}

function buildDeleteSystemPrompt(userTimezone: string): string {
  const now = DateTime.now().setZone(userTimezone);
  return `Classifique intenção de APAGAR/CANCELAR eventos no calendário (português BR).

Contexto:
- Fuso: ${userTimezone}
- Hoje: ${now.toFormat('dd/MM/yyyy')}

Regras:
1) JSON apenas.
2) isDeleteIntent=true se pedir cancelar/apagar/deletar/remover evento ou aula.
3) targetTitle: nome do aluno ou do evento SEM verbos temporais. Para aulas, preferir o NOME DO ALUNO (ex.: "Ricardo Abrahão"), nunca só "aulas".
4) targetDateISO: YYYY-MM-DD se mencionar data relativa; senão null.
5) Se não for exclusão: isDeleteIntent=false, targetTitle="", targetDateISO=null.

Formato:
{"isDeleteIntent":true,"targetTitle":"Ricardo Abrahão","targetDateISO":null,"confidence":0.9}`;
}

export async function parseDeleteWithOllama(
  message: string,
  userTimezone: string,
): Promise<DeleteIntent | null> {
  if (!isLlmConfigured()) return null;

  const raw = await chatJsonCompletion<Record<string, unknown>>(
    buildDeleteSystemPrompt(userTimezone),
    message,
  );
  if (!raw) return null;

  const parsed = DeleteIntentSchema.safeParse(raw);
  if (!parsed.success) {
    console.warn('[LLM] JSON de exclusão inválido:', parsed.error.message);
    return null;
  }

  console.log('[LLM] Exclusão interpretada:', JSON.stringify(parsed.data));
  return parsed.data;
}
