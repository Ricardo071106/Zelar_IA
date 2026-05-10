/**
 * Extrai apenas texto digitado (conversation / extendedTextMessage).
 * Não usa legenda de mídia (caption).
 */
export function extractPlainTextFromWhatsAppMessage(message: unknown): string | null {
  if (!message || typeof message !== "object") return null;
  const m = message as Record<string, unknown>;
  const inner =
    m.message && typeof m.message === "object"
      ? (m.message as Record<string, unknown>)
      : (m as any).data?.message && typeof (m as any).data.message === "object"
        ? ((m as any).data.message as Record<string, unknown>)
        : null;
  if (!inner) return null;

  const conv = inner.conversation;
  if (typeof conv === "string" && conv.length) return conv;

  const ext = inner.extendedTextMessage as { text?: string } | undefined;
  if (ext && typeof ext.text === "string" && ext.text.length) return ext.text;

  return null;
}
