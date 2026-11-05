import { randomBytes, randomUUID, scrypt as nodeScrypt, timingSafeEqual, createHmac } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(nodeScrypt);
export async function hashPassword(password: string): Promise<string> { const salt = randomBytes(16); const key = await scrypt(password, salt, 64) as Buffer; return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`; }
export async function verifyPassword(password: string, encoded: string): Promise<boolean> { const [, saltText, keyText] = encoded.split('$'); if (!saltText || !keyText) return false; const key = await scrypt(password, Buffer.from(saltText, 'base64'), 64) as Buffer; const expected = Buffer.from(keyText, 'base64'); return expected.length === key.length && timingSafeEqual(expected, key); }
const persistentMarker = 32503680000000;
export function sessionToken(userId: string, secret: string, sessionId = randomUUID(), persistent = false): string { const body = `${userId}.${persistent ? persistentMarker : Date.now() + 1000 * 60 * 60 * 12}.${sessionId}`; return `${body}.${createHmac('sha256', secret).update(body).digest('hex')}`; }
export function parseSession(token: string | undefined, secret: string): {userId:string;sessionId:string;legacy:boolean} | null {
  if (!token || token.length > 512) return null;
  const parts = token.split('.');
  if (parts.length !== 4 || !parts[0] || !/^[0-9a-f-]{36}$/i.test(parts[2]) || !/^[0-9a-f]{64}$/i.test(parts[3]) || !/^\d+$/.test(parts[1])) return null;
  const expiry = Number(parts[1]);
  if (!Number.isSafeInteger(expiry) || expiry < Date.now()) return null;
  const signature = createHmac('sha256', secret).update(parts.slice(0, 3).join('.')).digest();
  const supplied = Buffer.from(parts[3], 'hex');
  if (supplied.length !== signature.length || !timingSafeEqual(signature, supplied)) return null;
  return { userId: parts[0], sessionId: parts[2], legacy: expiry !== persistentMarker };
}
