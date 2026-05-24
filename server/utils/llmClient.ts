import axios from 'axios';

export function isLlmConfigured(): boolean {
  return Boolean(process.env.LLM_BASE_URL?.trim() && process.env.LLM_MODEL?.trim());
}

function llmBaseUrl(): string {
  return (process.env.LLM_BASE_URL || 'http://127.0.0.1:11434/v1').replace(/\/+$/, '');
}

function llmModel(): string {
  return process.env.LLM_MODEL || 'qwen2.5:1.5b-instruct';
}

function llmNumCtx(): number {
  const n = Number.parseInt(process.env.LLM_NUM_CTX || '2048', 10);
  return Number.isFinite(n) && n >= 512 ? n : 2048;
}

function llmNumPredict(): number {
  const n = Number.parseInt(process.env.LLM_NUM_PREDICT || '512', 10);
  return Number.isFinite(n) && n >= 64 ? n : 512;
}

function llmTimeoutMs(): number {
  const n = Number.parseInt(process.env.LLM_TIMEOUT_MS || '90000', 10);
  return Number.isFinite(n) && n > 0 ? n : 90000;
}

function stripMarkdownFence(text: string): string {
  return text.replace(/```json/gi, '').replace(/```/g, '').trim();
}

/**
 * Chat completion compatível com Ollama (/v1/chat/completions).
 * Retorna JSON parseado ou null se falhar.
 */
export async function chatJsonCompletion<T extends Record<string, unknown>>(
  systemPrompt: string,
  userMessage: string,
): Promise<T | null> {
  if (!isLlmConfigured()) return null;

  try {
    const response = await axios.post(
      `${llmBaseUrl()}/chat/completions`,
      {
        model: llmModel(),
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0,
        response_format: { type: 'json_object' },
        options: {
          num_ctx: llmNumCtx(),
          num_predict: llmNumPredict(),
        },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.LLM_API_KEY || 'ollama'}`,
          'Content-Type': 'application/json',
        },
        timeout: llmTimeoutMs(),
      },
    );

    let content = response.data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) return null;

    content = stripMarkdownFence(content);
    const parsed = JSON.parse(content) as T;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn('[LLM] Falha na completion:', msg);
    return null;
  }
}
