import { HttpException, HttpStatus } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';

export const TELEGRAM_AUTH_MAX_AGE_SEC = 24 * 60 * 60;
const CLOCK_SKEW_SEC = 300;

export type VerifiedTelegramInitData = {
  telegramId: string;
  authDate: number;
};

export function parseAndVerifyInitData(
  initData: unknown,
  botToken: string,
  nowMs = Date.now(),
): VerifiedTelegramInitData {
  if (typeof initData !== 'string' || !initData || initData.length > 8192) {
    throw new HttpException({ ok: false, error: 'INVALID_INIT_DATA' }, HttpStatus.UNAUTHORIZED);
  }
  const params = new URLSearchParams(initData);
  const hash = params.get('hash') || '';
  if (!/^[0-9a-f]{64}$/i.test(hash)) {
    throw new HttpException({ ok: false, error: 'INVALID_INIT_DATA' }, HttpStatus.UNAUTHORIZED);
  }

  const pairs: Array<[string, string]> = [];
  for (const [k, v] of params.entries()) {
    if (k === 'hash') continue;
    pairs.push([k, v]);
  }
  pairs.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const dataCheckString = pairs.map(([k, v]) => `${k}=${v}`).join('\n');

  const secret = createHmac('sha256', 'WebAppData').update(botToken, 'utf8').digest();
  const expected = createHmac('sha256', secret).update(dataCheckString, 'utf8').digest();
  const got = Buffer.from(hash, 'hex');
  if (got.length !== expected.length || !timingSafeEqual(got, expected)) {
    throw new HttpException({ ok: false, error: 'INVALID_INIT_DATA' }, HttpStatus.UNAUTHORIZED);
  }

  const authDateRaw = params.get('auth_date') || '';
  if (!/^\d+$/.test(authDateRaw)) {
    throw new HttpException({ ok: false, error: 'INVALID_INIT_DATA' }, HttpStatus.UNAUTHORIZED);
  }
  const authDate = Number(authDateRaw);
  const nowSec = Math.floor(nowMs / 1000);
  if (!Number.isFinite(authDate) || authDate <= 0 || authDate > nowSec + CLOCK_SKEW_SEC) {
    throw new HttpException({ ok: false, error: 'INVALID_INIT_DATA' }, HttpStatus.UNAUTHORIZED);
  }
  if (nowSec - authDate > TELEGRAM_AUTH_MAX_AGE_SEC) {
    throw new HttpException({ ok: false, error: 'EXPIRED_INIT_DATA' }, HttpStatus.UNAUTHORIZED);
  }

  const userRaw = params.get('user');
  if (!userRaw) {
    throw new HttpException({ ok: false, error: 'INVALID_INIT_DATA' }, HttpStatus.UNAUTHORIZED);
  }
  let user: any;
  try {
    user = JSON.parse(userRaw);
  } catch {
    throw new HttpException({ ok: false, error: 'INVALID_INIT_DATA' }, HttpStatus.UNAUTHORIZED);
  }
  const tgId = user && user.id != null ? String(user.id) : '';
  if (!/^[1-9]\d{0,19}$/.test(tgId)) {
    throw new HttpException({ ok: false, error: 'INVALID_INIT_DATA' }, HttpStatus.UNAUTHORIZED);
  }

  return { telegramId: tgId, authDate };
}
