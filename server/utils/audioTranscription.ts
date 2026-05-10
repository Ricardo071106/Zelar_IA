import axios from 'axios';

function getAudioFormatFromMime(mimeType?: string): 'wav' | 'mp3' | 'ogg' | 'webm' {
  if (!mimeType) return 'ogg';
  if (mimeType.includes('wav')) return 'wav';
  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return 'mp3';
  if (mimeType.includes('webm')) return 'webm';
  return 'ogg';
}

function summarizeAxiosError(error: any): string {
  if (error?.response) {
    const status = error.response.status;
    const data = typeof error.response.data === 'string'
      ? error.response.data.slice(0, 220).replace(/\s+/g, ' ')
      : JSON.stringify(error.response.data || {}).slice(0, 220);
    return `status=${status} data=${data}`;
  }

  if (error?.request) {
    return `network_error code=${error.code || 'unknown'} message=${error.message || 'no_message'}`;
  }

  return error?.message || String(error);
}

function extractTextFromChatResponse(responseData: any): string | null {
  const choice = responseData?.choices?.[0]?.message;
  if (!choice) return null;

  if (typeof choice.content === 'string') {
    const text = choice.content.trim();
    return text || null;
  }

  if (Array.isArray(choice.content)) {
    const textParts = choice.content
      .map((part: any) => {
        if (typeof part === 'string') return part;
        if (part?.type === 'text' && typeof part?.text === 'string') return part.text;
        return '';
      })
      .join(' ')
      .trim();
    return textParts || null;
  }

  return null;
}

async function transcribeWithOpenRouterChatAudio(
  apiKey: string,
  model: string,
  audioBuffer: Buffer,
  mimeType?: string,
): Promise<string | null> {
  const format = getAudioFormatFromMime(mimeType);
  const base64 = audioBuffer.toString('base64');

  const response = await axios.post(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      model,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Transcreva este audio para texto em portugues do Brasil. Retorne somente o texto transcrito.',
            },
            { type: 'input_audio', input_audio: { data: base64, format } },
          ],
        },
      ],
      temperature: 0,
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://zelar-bot.replit.app',
        'X-Title': 'Zelar Audio Transcription',
      },
      timeout: 90000,
      maxBodyLength: Infinity,
    },
  );

  return extractTextFromChatResponse(response.data);
}

/**
 * Transcreve áudio em PT-BR usando endpoint OpenAI-compatível do OpenRouter.
 * Retorna null em caso de falha para permitir fallback gracioso.
 */
export async function transcribeAudioWithOpenRouter(
  audioBuffer: Buffer,
  mimeType?: string,
): Promise<string | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey || !audioBuffer || audioBuffer.length === 0) return null;

  // Usa somente OpenRouter em rota gratuita por padrão.
  const primaryModel = process.env.OPENROUTER_AUDIO_MODEL || 'openrouter/free';
  const fallbackModel = process.env.OPENROUTER_AUDIO_FALLBACK_MODEL || 'openrouter/free';

  try {
    // 1) Chat completions com input_audio (endpoint recomendado para áudio no OpenRouter)
    const chatTranscription = await transcribeWithOpenRouterChatAudio(apiKey, primaryModel, audioBuffer, mimeType);
    if (chatTranscription) return chatTranscription;
  } catch (error) {
    console.warn(`⚠️ Falha no chat completions com modelo primário: ${summarizeAxiosError(error)}`);
  }

  try {
    // 2) Fallback para um segundo modelo de áudio
    const fallbackTranscription = await transcribeWithOpenRouterChatAudio(apiKey, fallbackModel, audioBuffer, mimeType);
    if (fallbackTranscription) return fallbackTranscription;
  } catch (error) {
    console.error(`❌ Falha no fallback de transcrição: ${summarizeAxiosError(error)}`);
  }

  return null;
}
