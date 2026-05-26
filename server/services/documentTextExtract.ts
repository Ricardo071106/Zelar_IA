import { extractTextFromImage } from "./imageOCR";

const MAX_PDF_BYTES = 12 * 1024 * 1024;

function isPdfMime(mimeType: string, originalName?: string): boolean {
  const m = mimeType.toLowerCase();
  if (m.includes("pdf")) return true;
  const n = (originalName || "").toLowerCase();
  return n.endsWith(".pdf");
}

function isImageMime(mimeType: string): boolean {
  return /^image\//i.test(mimeType);
}

async function ensurePdfJsNodePolyfills(): Promise<void> {
  const g = globalThis as typeof globalThis & { DOMMatrix?: unknown };
  if (g.DOMMatrix) return;
  try {
    const mod = await import("dommatrix");
    const DM = (mod as { DOMMatrix?: unknown; default?: unknown }).DOMMatrix ?? mod.default;
    if (DM) g.DOMMatrix = DM;
  } catch {
    /* Node 20+ pode expor DOMMatrix nativamente */
  }
}

async function extractTextFromPdfBuffer(buffer: Buffer): Promise<string | null> {
  if (buffer.length > MAX_PDF_BYTES) {
    console.warn("[pdf] Arquivo grande demais para extrair texto:", buffer.length);
    return null;
  }
  try {
    await ensurePdfJsNodePolyfills();
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true,
      disableFontFace: true,
    });
    const doc = await loadingTask.promise;
    const parts: string[] = [];
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page = await doc.getPage(pageNum);
      const content = await page.getTextContent();
      const line = content.items
        .map((item) => ("str" in item && typeof item.str === "string" ? item.str : ""))
        .join(" ")
        .trim();
      if (line) parts.push(line);
    }
    await doc.destroy().catch(() => undefined);
    const text = parts.join("\n").trim();
    return text || null;
  } catch (e) {
    console.error("[pdf] Falha ao extrair texto:", e);
    return null;
  }
}

/**
 * Texto de comprovante: imagem (OCR) ou PDF com camada de texto.
 * PDFs só-imagem (scan) precisam de foto/print — sem conversão raster no servidor.
 */
export async function extractTextFromReceiptDocument(
  buffer: Buffer,
  mimeType: string,
  originalName?: string,
): Promise<string | null> {
  if (!buffer?.length) return null;

  if (isPdfMime(mimeType, originalName)) {
    return extractTextFromPdfBuffer(buffer);
  }
  if (isImageMime(mimeType)) {
    return extractTextFromImage(buffer, mimeType);
  }
  return null;
}

export function receiptDocumentMimeSupported(mimeType: string, originalName?: string): boolean {
  return isImageMime(mimeType) || isPdfMime(mimeType, originalName);
}
