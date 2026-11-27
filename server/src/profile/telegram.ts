import { HttpException, HttpStatus } from '@nestjs/common';
import { createHash, createHmac, timingSafeEqual } from 'crypto';

export const TELEGRAM_AUTH_MAX_AGE_SEC = 24 * 60 * 60;
const CLOCK_SKEW_SEC = 300;

export type VerifiedTelegramInitData = {
  telegramId: string;
  authDate: number;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  languageCode: string | null;
  isPremium: boolean | null;
};

const USERNAME_MAX = 64;
const NAME_MAX = 128;
const LANGUAGE_MAX = 16;

/** Fields the Login Widget may send. Only these go into the data-check-string. */
const WIDGET_FIELD_KEYS = ['auth_date', 'first_name', 'id', 'last_name', 'photo_url', 'username'] as const;

/** Clip a Telegram string field. Never log the raw value. */
export function clipTelegramField(value: unknown, max: number): string | null {
  if (typeof value !== 'string' || value.length === 0) return null;
  return value.length > max ? value.slice(0, max) : value;
}

function invalidInit(): never {
  throw new HttpException({ ok: false, error: 'INVALID_INIT_DATA' }, HttpStatus.UNAUTHORIZED);
}

function invalidWidget(): never {
  throw new HttpException({ ok: false, error: 'INVALID_WIDGET_DATA' }, HttpStatus.UNAUTHORIZED);
}

function hmacEqual(hash: string, expected: Buffer): boolean {
  const got = Buffer.from(hash, 'hex');
  return got.length === expected.length && timingSafeEqual(got, expected);
}

function parseAuthDate(authDateRaw: string, nowMs: number, staleError: string, invalid: () => never): number {
  if (!/^\d+$/.test(authDateRaw)) invalid();
  const authDate = Number(authDateRaw);
  const nowSec = Math.floor(nowMs / 1000);
  if (!Number.isFinite(authDate) || authDate <= 0 || authDate > nowSec + CLOCK_SKEW_SEC) invalid();
  if (nowSec - authDate > TELEGRAM_AUTH_MAX_AGE_SEC) {
    throw new HttpException({ ok: false, error: staleError }, HttpStatus.UNAUTHORIZED);
  }
  return authDate;
}

function parseTelegramId(raw: unknown, invalid: () => never): string {
  const tgId = raw != null ? String(raw) : '';
  if (!/^[1-9]\d{0,19}$/.test(tgId)) invalid();
  return tgId;
}

export function parseAndVerifyInitData(
  initData: unknown,
  botToken: string,
  nowMs = Date.now(),
): VerifiedTelegramInitData {
  if (typeof initData !== 'string' || !initData || initData.length > 8192) invalidInit();
  const params = new URLSearchParams(initData);
  const hash = params.get('hash') || '';
  if (!/^[0-9a-f]{64}$/i.test(hash)) invalidInit();

  const pairs: Array<[string, string]> = [];
  for (const [k, v] of params.entries()) {
    if (k === 'hash') continue;
    pairs.push([k, v]);
  }
  pairs.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const dataCheckString = pairs.map(([k, v]) => `${k}=${v}`).join('\n');

  const secret = createHmac('sha256', 'WebAppData').update(botToken, 'utf8').digest();
  const expected = createHmac('sha256', secret).update(dataCheckString, 'utf8').digest();
  if (!hmacEqual(hash, expected)) invalidInit();

  const authDate = parseAuthDate(params.get('auth_date') || '', nowMs, 'EXPIRED_INIT_DATA', invalidInit);

  const userRaw = params.get('user');
  if (!userRaw) invalidInit();
  let user: any;
  try {
    user = JSON.parse(userRaw);
  } catch {
    invalidInit();
  }
  const tgId = parseTelegramId(user && user.id, invalidInit);

  return {
    telegramId: tgId,
    authDate,
    username: clipTelegramField(user.username, USERNAME_MAX),
    firstName: clipTelegramField(user.first_name, NAME_MAX),
    lastName: clipTelegramField(user.last_name, NAME_MAX),
    languageCode: clipTelegramField(user.language_code, LANGUAGE_MAX),
    isPremium: typeof user.is_premium === 'boolean' ? user.is_premium : null,
  };
}

function widgetFieldValue(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string') return value;
  return null;
}

/**
 * Telegram Login Widget (legacy): hash = HMAC_SHA256(data_check_string, key=SHA256(bot_token)).
 * Never log the body, the hash, or the bot token.
 */
export function parseAndVerifyWidgetData(
  body: unknown,
  botToken: string,
  nowMs = Date.now(),
): VerifiedTelegramInitData {
  if (!body || typeof body !== 'object' || Array.isArray(body)) invalidWidget();
  const data = body as Record<string, unknown>;
  const hash = typeof data.hash === 'string' ? data.hash : '';
  if (!/^[0-9a-f]{64}$/i.test(hash)) invalidWidget();

  const pairs: Array<[string, string]> = [];
  for (const key of WIDGET_FIELD_KEYS) {
    const value = widgetFieldValue(data[key]);
    if (value == null) continue;
    pairs.push([key, value]);
  }
  pairs.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  if (!pairs.length) invalidWidget();
  const dataCheckString = pairs.map(([k, v]) => `${k}=${v}`).join('\n');

  const secret = createHash('sha256').update(botToken, 'utf8').digest();
  const expected = createHmac('sha256', secret).update(dataCheckString, 'utf8').digest();
  if (!hmacEqual(hash, expected)) invalidWidget();

  const authDate = parseAuthDate(
    widgetFieldValue(data.auth_date) || '',
    nowMs,
    'EXPIRED_WIDGET_DATA',
    invalidWidget,
  );
  const tgId = parseTelegramId(widgetFieldValue(data.id), invalidWidget);

  return {
    telegramId: tgId,
    authDate,
    username: clipTelegramField(widgetFieldValue(data.username), USERNAME_MAX),
    firstName: clipTelegramField(widgetFieldValue(data.first_name), NAME_MAX),
    lastName: clipTelegramField(widgetFieldValue(data.last_name), NAME_MAX),
    languageCode: null,
    isPremium: null,
  };
}

/**
 * Numeric bot id from TELEGRAM_BOT_TOKEN (`id:secret`). The secret half is never returned.
 * Returns null when the env value is not in that shape (e.g. unit-test placeholders).
 */
export function publicBotId(botToken: string): number | null {
  const m = /^([1-9]\d{0,19}):/.exec(botToken || '');
  if (!m) return null;
  const id = Number(m[1]);
  return Number.isSafeInteger(id) ? id : null;
}
