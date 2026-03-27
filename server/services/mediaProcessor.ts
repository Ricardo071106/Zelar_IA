import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import type { DetectedMessageType } from '../utils/detectMessageType';
import { transcribeAudio } from './audioTranscriber';
import { extractTextFromImage } from './imageOCR';

async function streamToBuffer(stream: AsyncIterable<Buffer | Uint8Array>): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function getBaileysEnvelope(message: any): { key?: unknown; message: any } | null {
  if (!message || typeof message !== 'object') return null;
  if ('message' in message && message.message) {
    return message as { key?: unknown; message: any };
  }
  const data = (message as any).data;
  if (data?.message) {
    return { key: data.key, message: data.message };
  }
  return null;
}

function extractDirectText(message: any): string | null {
  const env = getBaileysEnvelope(message);
  const m = env?.message;
  if (!m) return null;
  const direct =
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    '';
  const t = typeof direct === 'string' ? direct.trim() : '';
  return t || null;
}

export async function mediaProcessor(
  message: any,
  type: DetectedMessageType,
): Promise<string | null> {
  const env = getBaileysEnvelope(message);
  const m = env?.message;
  if (!m) return extractDirectText(message);

  if (type === 'text') {
    return extractDirectText(message);
  }

  if (type === 'audio') {
    try {
      const audioMessage = m.audioMessage || (m.documentMessage?.mimetype?.startsWith('audio/') ? m.documentMessage : null);
      if (!audioMessage) return extractDirectText(message);

      const stream = await downloadContentFromMessage(
        audioMessage,
        m.audioMessage ? 'audio' : 'document',
      );
      const audioBuffer = await streamToBuffer(stream as AsyncIterable<Buffer | Uint8Array>);
      const mime = audioMessage.mimetype as string | undefined;
      const text = await transcribeAudio({ buffer: audioBuffer, mimeType: mime });
      return text?.trim() || null;
    } catch (error) {
      console.error('❌ mediaProcessor audio:', error);
      return null;
    }
  }

  const caption = extractDirectText(message) || '';
  try {
    const imageMessage = m.imageMessage || m.stickerMessage
      || (m.documentMessage?.mimetype?.startsWith('image/') ? m.documentMessage : null);
    if (!imageMessage) {
      return caption.trim() || null;
    }

    const mediaType = m.imageMessage ? 'image' : m.stickerMessage ? 'sticker' : 'document';
    const stream = await downloadContentFromMessage(imageMessage, mediaType);
    const imageBuffer = await streamToBuffer(stream as AsyncIterable<Buffer | Uint8Array>);
    const mime = (imageMessage.mimetype as string | undefined) || 'image/jpeg';

    let ocrText = '';
    try {
      const ocr = await extractTextFromImage(imageBuffer, mime);
      if (ocr) ocrText = ocr.trim();
    } catch (error) {
      console.error('❌ mediaProcessor OCR:', error);
    }

    const merged = [caption, ocrText].filter(Boolean).join('\n').trim();
    return merged || null;
  } catch (error) {
    console.error('❌ mediaProcessor image:', error);
    return caption.trim() || null;
  }
}
