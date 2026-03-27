import { execFile } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import axios from 'axios';

function extensionFromMime(mimeType?: string): string {
  if (!mimeType) return '.bin';
  const base = mimeType.toLowerCase().split(';')[0].trim();
  if (base.includes('ogg') || base.includes('opus')) return '.ogg';
  if (base.includes('mpeg') || base.includes('mp3')) return '.mp3';
  if (base.includes('mp4') || base.includes('m4a') || base.includes('aac')) return '.m4a';
  if (base.includes('wav')) return '.wav';
  if (base.includes('webm')) return '.webm';
  if (base.includes('amr')) return '.amr';
  return '.bin';
}

function execFileWithTimeout(
  file: string,
  args: string[],
  timeoutMs: number,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const child = execFile(
      file,
      args,
      { maxBuffer: 32 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (err) {
          reject(err);
        } else {
          resolve({ stdout: stdout.toString(), stderr: stderr.toString() });
        }
      },
    );
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGTERM');
      const killTimer = setTimeout(() => child.kill('SIGKILL'), 2000);
      killTimer.unref();
      reject(new Error(`timeout after ${timeoutMs}ms`));
    }, timeoutMs);
  });
}

async function ensureDirCleanup(dir: string) {
  await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
}

export type TranscribeAudioInput =
  | { url: string; mimeType?: string }
  | { buffer: Buffer; mimeType?: string };

export async function transcribeAudio(input: TranscribeAudioInput): Promise<string | null> {
  const whisperBin = process.env.WHISPER_CLI_PATH || 'whisper-cli';
  const modelPath = process.env.WHISPER_MODEL_PATH;
  const ffmpegBin = process.env.FFMPEG_PATH || 'ffmpeg';
  const timeoutMs = Math.max(
    5000,
    Number.parseInt(process.env.AUDIO_TRANSCRIBE_TIMEOUT_MS || '120000', 10) || 120000,
  );

  if (!modelPath) {
    console.warn('⚠️ WHISPER_MODEL_PATH não definido; transcrição local ignorada.');
    return null;
  }

  let buffer: Buffer;
  let mimeType: string | undefined;

  if ('buffer' in input) {
    buffer = input.buffer;
    mimeType = input.mimeType;
  } else {
    const res = await axios.get<ArrayBuffer>(input.url, {
      responseType: 'arraybuffer',
      timeout: Math.min(timeoutMs, 60000),
      maxContentLength: 25 * 1024 * 1024,
      maxBodyLength: 25 * 1024 * 1024,
    });
    buffer = Buffer.from(res.data);
    mimeType = input.mimeType || (typeof res.headers['content-type'] === 'string' ? res.headers['content-type'] : undefined);
  }

  if (!buffer?.length) return null;

  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'zelar-audio-'));
  const ext = extensionFromMime(mimeType);
  const rawPath = path.join(tmpRoot, `input${ext}`);
  const wavPath = path.join(tmpRoot, 'input.wav');

  try {
    await fs.writeFile(rawPath, buffer);

    await execFileWithTimeout(
      ffmpegBin,
      ['-y', '-i', rawPath, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', wavPath],
      Math.min(timeoutMs, 180000),
    );

    const whisperArgs = [
      '-m',
      modelPath,
      '-f',
      wavPath,
      '-l',
      process.env.WHISPER_LANGUAGE || 'pt',
      '-nt',
    ];

    let text: string | null = null;
    try {
      const { stdout } = await execFileWithTimeout(whisperBin, whisperArgs, timeoutMs);
      text = stdout.trim() || null;
    } catch (e) {
      console.warn('⚠️ whisper-cli falhou (stdout); tentando arquivo .txt:', e);
    }

    if (!text) {
      const txtCandidate = `${wavPath}.txt`;
      try {
        const fileText = await fs.readFile(txtCandidate, 'utf8');
        text = fileText.trim() || null;
      } catch {
        const baseTxt = path.join(tmpRoot, 'input.wav.txt');
        try {
          const fileText = await fs.readFile(baseTxt, 'utf8');
          text = fileText.trim() || null;
        } catch {
          text = null;
        }
      }
    }

    return text;
  } catch (error) {
    console.error('❌ transcribeAudio:', error);
    return null;
  } finally {
    await ensureDirCleanup(tmpRoot);
  }
}
