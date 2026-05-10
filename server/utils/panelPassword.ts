import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const PREFIX = 'scrypt14$';
const KEYLEN = 64;

/** Parâmetros compatíveis com recomendações OWASP (Node scrypt). */
const SCRYPT_OPTS = {
  N: 16384,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024,
} as const;

export function hashPanelPassword(plain: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(plain, salt, KEYLEN, SCRYPT_OPTS);
  return `${PREFIX}${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyPanelPassword(plain: string, stored: string | null | undefined): boolean {
  if (!stored || typeof stored !== 'string' || !stored.startsWith(PREFIX)) return false;
  const rest = stored.slice(PREFIX.length);
  const dollar = rest.indexOf('$');
  if (dollar < 0) return false;
  const saltB64 = rest.slice(0, dollar);
  const hashB64 = rest.slice(dollar + 1);
  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(saltB64, 'base64');
    expected = Buffer.from(hashB64, 'base64');
  } catch {
    return false;
  }
  if (expected.length !== KEYLEN) return false;
  const hash = scryptSync(plain, salt, KEYLEN, SCRYPT_OPTS);
  return timingSafeEqual(hash, expected);
}

export function validateNewPanelPassword(plain: string): string | null {
  const t = plain.trim();
  if (t.length < 8) return 'A senha deve ter pelo menos 8 caracteres.';
  if (t.length > 128) return 'Senha muito longa.';
  return null;
}
