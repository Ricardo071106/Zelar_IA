import { execFile } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import axios from 'axios';
import FormData from 'form-data';

function extFromMime(mimeType: string): string {
  const m = mimeType.toLowerCase();
  if (m.includes('png')) return '.png';
  if (m.includes('webp')) return '.webp';
  if (m.includes('gif')) return '.gif';
  return '.jpg';
}

function execFileWithTimeout(
  file: string,
  args: string[],
  timeoutMs: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const child = execFile(
      file,
      args,
      { maxBuffer: 10 * 1024 * 1024 },
      (err, stdout) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (err) reject(err);
        else resolve(stdout.toString().trim());
      },
    );
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGTERM');
      const killTimer = setTimeout(() => child.kill('SIGKILL'), 2000);
      killTimer.unref();
      reject(new Error(`tesseract timeout after ${timeoutMs}ms`));
    }, timeoutMs);
  });
}

async function extractWithTesseract(imageBuffer: Buffer, mimeType: string): Promise<string | null> {
  const bin = process.env.TESSERACT_PATH || 'tesseract';
  const lang = process.env.TESSERACT_LANG || 'por+eng';
  const timeoutMs = Math.max(
    3000,
    Number.parseInt(process.env.OCR_TIMEOUT_MS || '60000', 10) || 60000,
  );

  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'zelar-ocr-'));
  const ext = extFromMime(mimeType);
  const imgPath = path.join(tmpRoot, `in${ext}`);

  try {
    await fs.writeFile(imgPath, imageBuffer);
    const text = await execFileWithTimeout(bin, [imgPath, 'stdout', '-l', lang], timeoutMs);
    return text || null;
  } catch (error) {
    console.error('❌ imageOCR (tesseract):', error);
    return null;
  } finally {
    await fs.rm(tmpRoot, { recursive: true, force: true }).catch(() => undefined);
  }
}

function parseOcrResponse(data: unknown): string | null {
  if (data == null) return null;
  if (typeof data === 'string') {
    const t = data.trim();
    return t || null;
  }
  if (typeof data !== 'object') return null;
  const o = data as Record<string, unknown>;
  const candidates = [o.text, o.ocr, o.result, o.data];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return null;
}

async function extractWithRemoteService(
  imageBuffer: Buffer,
  mimeType: string,
  url: string,
  timeoutMs: number,
): Promise<string | null> {
  const form = new FormData();
  const field = process.env.OCR_FORM_FIELD || 'image';
  form.append(field, imageBuffer, {
    filename: 'upload.jpg',
    contentType: mimeType,
  });

  const res = await axios.post(url, form, {
    headers: form.getHeaders(),
    timeout: timeoutMs,
    maxBodyLength: 20 * 1024 * 1024,
    maxContentLength: 20 * 1024 * 1024,
  });

  return parseOcrResponse(res.data);
}

export async function extractTextFromImage(
  imageBuffer: Buffer,
  mimeType = 'image/jpeg',
): Promise<string | null> {
  const timeoutMs = Math.max(
    3000,
    Number.parseInt(process.env.OCR_TIMEOUT_MS || '60000', 10) || 60000,
  );

  if (!imageBuffer?.length) return null;

  const remoteUrl = process.env.OCR_SERVICE_URL?.trim();

  try {
    if (remoteUrl) {
      return await extractWithRemoteService(imageBuffer, mimeType, remoteUrl, timeoutMs);
    }
    return await extractWithTesseract(imageBuffer, mimeType);
  } catch (error) {
    console.error('❌ imageOCR:', error);
    return null;
  }
}
