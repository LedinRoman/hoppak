import { HttpException, HttpStatus } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'crypto';
import { bearerToken } from '../profile/auth';

export function requireAdmin(authorization?: string): void {
  const configured = process.env.ADMIN_TOKEN;
  const supplied = bearerToken(authorization);
  if (configured && supplied) {
    const digest = (value: string) => createHash('sha256').update(value).digest();
    if (timingSafeEqual(digest(configured), digest(supplied))) return;
  }
  throw new HttpException({ ok: false, error: 'UNAUTHORIZED' }, HttpStatus.UNAUTHORIZED);
}
