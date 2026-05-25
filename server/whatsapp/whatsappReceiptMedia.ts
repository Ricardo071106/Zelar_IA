import { downloadMediaMessage } from "@whiskeysockets/baileys";
import pino from "pino";

function getInnerMessage(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (r.message && typeof r.message === "object") {
    return r.message as Record<string, unknown>;
  }
  return null;
}

export type ReceiptMediaKind = "image" | "document";

/** Imagem ou documento com MIME de imagem (comprovante). Ignora figurinha, vídeo, PDF. */
export function getReceiptMediaKind(message: unknown): ReceiptMediaKind | null {
  const inner = getInnerMessage(message);
  if (!inner) return null;
  if (inner.stickerMessage) return null;

  if (inner.imageMessage) return "image";

  const doc = inner.documentMessage as { mimetype?: string; fileName?: string } | undefined;
  const mime = doc?.mimetype?.toLowerCase() ?? "";
  if (mime.startsWith("image/")) return "document";

  return null;
}

function resolveMimeAndName(message: unknown, kind: ReceiptMediaKind): { mimeType: string; originalName: string } {
  const inner = getInnerMessage(message);
  if (kind === "image") {
    const img = inner?.imageMessage as { mimetype?: string } | undefined;
    const mime = img?.mimetype?.toLowerCase() || "image/jpeg";
    return { mimeType: mime, originalName: "comprovante-whatsapp.jpg" };
  }
  const doc = inner?.documentMessage as { mimetype?: string; fileName?: string } | undefined;
  const mime = doc?.mimetype?.toLowerCase() || "image/jpeg";
  const name = (doc?.fileName?.trim() || "comprovante-whatsapp").slice(0, 200);
  return { mimeType: mime, originalName: name };
}

const silentLogger = pino({ level: "silent" });

export async function downloadWhatsAppReceiptBuffer(
  sock: { updateMediaMessage?: (message: unknown) => Promise<unknown> },
  message: unknown,
): Promise<{ buffer: Buffer; mimeType: string; originalName: string } | null> {
  const kind = getReceiptMediaKind(message);
  if (!kind) return null;
  if (!sock.updateMediaMessage) {
    console.warn("[WhatsApp/comprovante] Socket sem updateMediaMessage");
    return null;
  }

  try {
    const raw = await downloadMediaMessage(
      message as Parameters<typeof downloadMediaMessage>[0],
      "buffer",
      {},
      {
        logger: silentLogger,
        reuploadRequest: sock.updateMediaMessage,
      } as Parameters<typeof downloadMediaMessage>[3],
    );
    const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as Uint8Array);
    if (!buffer.length) return null;
    const { mimeType, originalName } = resolveMimeAndName(message, kind);
    return { buffer, mimeType, originalName };
  } catch (e) {
    console.error("[WhatsApp/comprovante] Falha ao baixar mídia:", e);
    return null;
  }
}
