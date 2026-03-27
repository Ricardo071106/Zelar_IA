export type DetectedMessageType = 'text' | 'audio' | 'image';

function getInnerMessage(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (r.message && typeof r.message === 'object') {
    return r.message as Record<string, unknown>;
  }
  const data = r.data as Record<string, unknown> | undefined;
  if (data?.message && typeof data.message === 'object') {
    return data.message as Record<string, unknown>;
  }
  return null;
}

function documentMime(inner: Record<string, unknown>): string | undefined {
  const doc = inner.documentMessage as { mimetype?: string } | undefined;
  return doc?.mimetype?.toLowerCase();
}

export function detectMessageType(message: unknown): DetectedMessageType {
  const inner = getInnerMessage(message);
  if (!inner) return 'text';

  if (inner.audioMessage) return 'audio';

  const docMime = documentMime(inner);
  if (docMime?.startsWith('audio/')) return 'audio';

  if (inner.imageMessage) return 'image';
  if (inner.stickerMessage) return 'image';
  if (docMime?.startsWith('image/')) return 'image';

  return 'text';
}
