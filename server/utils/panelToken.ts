import { createHmac, timingSafeEqual } from 'node:crypto';

const PANEL_TTL_SEC = 90 * 24 * 60 * 60; // 90 dias

/**
 * Pluggy OAuth às vezes redireciona com `?itemId=` colado ao valor de `t` em vez de `&itemId=`,
 * quebrando o token do painel. Remove esse sufixo (e variante URL-encoded).
 */
export function sanitizePanelTokenQueryParam(raw: string | undefined): string | undefined {
  if (typeof raw !== 'string' || !raw.trim()) return undefined;
  let s = raw.trim();
  try {
    s = decodeURIComponent(s);
  } catch {
    /* manter */
  }
  let cut = s.split(/[?&]itemId=/i)[0]?.trim() ?? s;
  cut = cut.split(/%3[Ff]item[Ii]d%3[Dd]/i)[0]?.trim() ?? cut;
  return cut || undefined;
}

function getSecret(): string {
  const s = process.env.PANEL_TOKEN_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'dev-panel-token-secret');
  return s;
}

function b64url(buf: Buffer): string {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function b64urlDecode(s: string): Buffer {
  const pad = 4 - (s.length % 4 || 4);
  const b64 = (s + '='.repeat(pad === 4 ? 0 : pad)).replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(b64, 'base64');
}

export type PanelTokenPayload = {
  u: number;
  w: string;
  e: number;
};

export function signPanelToken(userId: number, whatsappDigits: string): string {
  const secret = getSecret();
  if (!secret) {
    throw new Error('PANEL_TOKEN_SECRET não configurado');
  }
  const payload: PanelTokenPayload = {
    u: userId,
    w: whatsappDigits,
    e: Math.floor(Date.now() / 1000) + PANEL_TTL_SEC,
  };
  const body = b64url(Buffer.from(JSON.stringify(payload), 'utf8'));
  const sig = createHmac('sha256', secret).update(body).digest();
  const sigStr = b64url(sig);
  return `${body}.${sigStr}`;
}

export function verifyPanelToken(token: string | undefined): PanelTokenPayload | null {
  const cleaned = sanitizePanelTokenQueryParam(typeof token === 'string' ? token : undefined);
  if (!cleaned) return null;
  const secret = getSecret();
  if (!secret) return null;
  const parts = cleaned.split('.');
  if (parts.length !== 2) return null;
  const [body, sigStr] = parts;
  let sig: Buffer;
  try {
    sig = b64urlDecode(sigStr);
  } catch {
    return null;
  }
  const expected = createHmac('sha256', secret).update(body).digest();
  if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) {
    return null;
  }
  let parsed: PanelTokenPayload;
  try {
    parsed = JSON.parse(b64urlDecode(body).toString('utf8')) as PanelTokenPayload;
  } catch {
    return null;
  }
  if (!parsed || typeof parsed.u !== 'number' || typeof parsed.w !== 'string' || typeof parsed.e !== 'number') {
    return null;
  }
  if (parsed.e < Math.floor(Date.now() / 1000)) return null;
  return parsed;
}

export function buildPanelUrl(token: string): string {
  const base = (process.env.BASE_URL || 'http://localhost:8080').replace(/\/+$/, '');
  const q = new URLSearchParams({ t: token }).toString();
  return `${base}/painel?${q}`;
}

export function isSafePanelOAuthReturn(next: string | undefined): next is string {
  if (!next || typeof next !== 'string') return false;
  if (!next.startsWith('/') || next.startsWith('//')) return false;
  if (!next.startsWith('/painel')) return false;
  return true;
}
