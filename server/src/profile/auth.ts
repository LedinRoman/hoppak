import { createHash, randomBytes } from 'crypto';
import type { Request, Response } from 'express';

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

/** Browser widget session. Mini App keeps using the Bearer in localStorage and never gets this cookie. */
export const SESSION_COOKIE = 'hoppak_session';
/** 30 days. */
export const SESSION_MAX_AGE_SEC = 30 * 24 * 60 * 60;

export function cookieToken(cookieHeader?: string | string[]): string | null {
  const raw = Array.isArray(cookieHeader) ? cookieHeader.join('; ') : cookieHeader;
  if (!raw) return null;
  const parts = raw.split(';');
  for (const part of parts) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    if (trimmed.slice(0, eq) !== SESSION_COOKIE) continue;
    const value = trimmed.slice(eq + 1).trim();
    if (/^[0-9a-f]{64}$/i.test(value)) return value;
    return null;
  }
  return null;
}

/** Bearer wins, otherwise the HttpOnly session cookie. */
export function accessToken(req: Request, authHeader?: string): string | null {
  return bearerToken(authHeader) || cookieToken(req && req.headers ? req.headers.cookie : undefined);
}

export function accessViaCookie(req: Request, authHeader?: string): boolean {
  return !bearerToken(authHeader) && !!cookieToken(req && req.headers ? req.headers.cookie : undefined);
}

function sessionCookieLine(value: string, maxAgeSec: number): string {
  return `${SESSION_COOKIE}=${value}; Max-Age=${maxAgeSec}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

export function setSessionCookie(res: Response, token: string) {
  if (!token || !/^[0-9a-f]{64}$/i.test(token)) return;
  res.append('Set-Cookie', sessionCookieLine(token, SESSION_MAX_AGE_SEC));
}

export function clearSessionCookie(res: Response) {
  res.append('Set-Cookie', sessionCookieLine('', 0));
}
