import { createHash, randomBytes } from 'crypto';

export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function newGuestToken(): string {
  return randomBytes(32).toString('hex');
}

export function bearerToken(header?: string): string | null {
  if (!header) return null;
  const m = /^Bearer\s+(\S+)/i.exec(header);
  return m ? m[1] : null;
}
