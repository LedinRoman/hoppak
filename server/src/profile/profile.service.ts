import { HttpException, HttpStatus, Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Player } from './player.entity';
import { hashToken, newGuestToken } from './auth';
import { parseAndVerifyInitData } from './telegram';
import {
  FINISH_INTERVAL_MS, HOUR_AWARD_MAX, MIGRATE_COINS_MAX,
  awardForRun, clamp, mergePurchases, sanitizePurchases,
} from './limits';

export type PublicProfile = {
  id: string;
  coins: number;
  purchases: Record<string, number>;
  migratedAt: string | null;
  createdAt: string;
  telegramId: string | null;
};

@Injectable()
export class ProfileService {
  constructor(@Optional() @InjectRepository(Player) private readonly players?: Repository<Player>) {}

  enabled(): boolean {
    return !!this.players;
  }

  private requireDb() {
    if (!this.players) {
      throw new HttpException({ ok: false, error: 'PROFILE_UNAVAILABLE' }, HttpStatus.SERVICE_UNAVAILABLE);
    }
    return this.players;
  }

  toPublic(p: Player): PublicProfile {
    return {
      id: p.id,
      coins: p.coins,
      purchases: p.purchases || {},
      migratedAt: p.migratedAt ? p.migratedAt.toISOString() : null,
      createdAt: p.createdAt ? p.createdAt.toISOString() : new Date().toISOString(),
      telegramId: p.telegramId ? String(p.telegramId) : null,
    };
  }

  async createGuest(): Promise<{ token: string; profile: PublicProfile }> {
    const repo = this.requireDb();
    const token = newGuestToken();
    const p = repo.create({
      guestTokenHash: hashToken(token),
      coins: 0,
      purchases: {},
    });
    await repo.save(p);
    return { token, profile: this.toPublic(p) };
  }

  async findByToken(token: string): Promise<Player | null> {
    const repo = this.requireDb();
    return repo.findOne({ where: { guestTokenHash: hashToken(token) } });
  }

  async requireByToken(token: string | null): Promise<Player> {
    if (!token) throw new HttpException({ ok: false, error: 'UNAUTHORIZED' }, HttpStatus.UNAUTHORIZED);
    const p = await this.findByToken(token);
    if (!p) throw new HttpException({ ok: false, error: 'UNAUTHORIZED' }, HttpStatus.UNAUTHORIZED);
    return p;
  }

  async migrate(p: Player, coins: unknown, purchases: unknown): Promise<PublicProfile> {
    const repo = this.requireDb();
    if (p.migratedAt) return this.toPublic(p); /* idempotent */
    const incoming = clamp(Math.floor(Number(coins) || 0), 0, MIGRATE_COINS_MAX);
    p.coins = clamp(p.coins + incoming, 0, MIGRATE_COINS_MAX);
    p.purchases = mergePurchases(p.purchases || {}, sanitizePurchases(purchases));
    p.migratedAt = new Date();
    await repo.save(p);
    return this.toPublic(p);
  }

  async finishRun(p: Player, height: unknown, runCoins: unknown, bonusCoins: unknown): Promise<{ awarded: number; profile: PublicProfile; limited?: string }> {
    const repo = this.requireDb();
    const now = new Date();
    if (p.lastFinishAt && now.getTime() - p.lastFinishAt.getTime() < FINISH_INTERVAL_MS) {
      throw new HttpException({ ok: false, error: 'RATE_LIMIT' }, HttpStatus.TOO_MANY_REQUESTS);
    }
    const hourAgo = now.getTime() - 60 * 60 * 1000;
    if (!p.windowStartedAt || p.windowStartedAt.getTime() < hourAgo) {
      p.windowStartedAt = now;
      p.awardedInWindow = 0;
    }
    const want = awardForRun(Number(height) || 0, Number(runCoins) || 0, Number(bonusCoins) || 0);
    const room = Math.max(0, HOUR_AWARD_MAX - (p.awardedInWindow || 0));
    const awarded = Math.min(want, room);
    p.coins = (p.coins || 0) + awarded;
    p.awardedInWindow = (p.awardedInWindow || 0) + awarded;
    p.lastFinishAt = now;
    await repo.save(p);
    return {
      awarded,
      profile: this.toPublic(p),
      limited: awarded < want ? 'HOUR_CAP' : undefined,
    };
  }

  async authTelegram(
    guestToken: string | null,
    initData: unknown,
  ): Promise<{ token: string; profile: PublicProfile; linked: boolean }> {
    const repo = this.requireDb();
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      throw new HttpException({ ok: false, error: 'TELEGRAM_AUTH_UNAVAILABLE' }, HttpStatus.SERVICE_UNAVAILABLE);
    }
    const { telegramId } = parseAndVerifyInitData(initData, botToken);

    const existingByTg = await repo.findOne({ where: { telegramId } });
    const guest = guestToken ? await this.findByToken(guestToken) : null;

    if (existingByTg) {
      if (guest && guest.id === existingByTg.id && guestToken) {
        return { token: guestToken, profile: this.toPublic(existingByTg), linked: false };
      }
      const nextToken = newGuestToken();
      existingByTg.guestTokenHash = hashToken(nextToken);
      await repo.save(existingByTg);
      return { token: nextToken, profile: this.toPublic(existingByTg), linked: false };
    }

    if (guest) {
      if (guest.telegramId && guest.telegramId !== telegramId) {
        throw new HttpException({ ok: false, error: 'GUEST_ALREADY_LINKED' }, HttpStatus.CONFLICT);
      }
      guest.telegramId = telegramId;
      guest.telegramLinkedAt = new Date();
      await repo.save(guest);
      return { token: guestToken!, profile: this.toPublic(guest), linked: true };
    }

    const token = newGuestToken();
    const created = repo.create({
      guestTokenHash: hashToken(token),
      coins: 0,
      purchases: {},
      telegramId,
      telegramLinkedAt: new Date(),
    });
    await repo.save(created);
    return { token, profile: this.toPublic(created), linked: true };
  }
}
