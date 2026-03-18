import axios from 'axios';
import FormData from 'form-data';

function getFileExtensionFromMime(mimeType?: string): string {
  if (!mimeType) return 'ogg';
  if (mimeType.includes('ogg')) return 'ogg';
  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return 'mp3';
  if (mimeType.includes('wav')) return 'wav';
  if (mimeType.includes('mp4')) return 'mp4';
  if (mimeType.includes('webm')) return 'webm';
  return 'ogg';
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

  const model = process.env.OPENROUTER_AUDIO_MODEL || 'openai/whisper-1';
  const extension = getFileExtensionFromMime(mimeType);
  const filename = `audio_input.${extension}`;

  try {
    const form = new FormData();
    form.append('file', audioBuffer, {
      filename,
      contentType: mimeType || 'audio/ogg',
    });
    form.append('model', model);
    form.append('language', 'pt');
    form.append('response_format', 'json');

    const response = await axios.post(
      'https://openrouter.ai/api/v1/audio/transcriptions',
      form,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://zelar-bot.replit.app',
          'X-Title': 'Zelar Audio Transcription',
          ...form.getHeaders(),
        },
        timeout: 60000,
        maxBodyLength: Infinity,
      },
    );

    const text = String(response.data?.text || '').trim();
    return text || null;
  } catch (error) {
    console.error('❌ Erro ao transcrever áudio via OpenRouter:', error);
    return null;
  }
}
