import { HttpException, HttpStatus, Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Player } from './player.entity';
import { PlayerRun } from './player-run.entity';
import { hashToken, newGuestToken } from './auth';
import { parseAndVerifyInitData } from './telegram';
import {
  FINISH_INTERVAL_MS, HOUR_AWARD_MAX, ITEM_PRICES, MIGRATE_COINS_MAX, RUN_HEIGHT_MAX,
  awardForRun, clamp, mergePurchases, sanitizePurchases, sanitizeRunId,
} from './limits';

export type PublicProfile = {
  id: string;
  coins: number;
  best: number;
  purchases: Record<string, number>;
  migratedAt: string | null;
  createdAt: string;
  telegramId: string | null;
};

@Injectable()
export class ProfileService {
  constructor(
    @Optional() @InjectRepository(Player) private readonly players?: Repository<Player>,
    @Optional() @InjectRepository(PlayerRun) private readonly runs?: Repository<PlayerRun>,
  ) {}

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
      best: p.best || 0,
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
      best: 0,
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

  async migrate(p: Player, coins: unknown, purchases: unknown, best?: unknown): Promise<PublicProfile> {
    const repo = this.requireDb();
    if (p.migratedAt) return this.toPublic(p); /* idempotent */
    const incoming = clamp(Math.floor(Number(coins) || 0), 0, MIGRATE_COINS_MAX);
    const incomingBest = clamp(Math.floor(Number(best) || 0), 0, RUN_HEIGHT_MAX);
    p.coins = clamp(p.coins + incoming, 0, MIGRATE_COINS_MAX);
    p.best = Math.max(p.best || 0, incomingBest);
    p.purchases = mergePurchases(p.purchases || {}, sanitizePurchases(purchases));
    p.migratedAt = new Date();
    await repo.save(p);
    return this.toPublic(p);
  }

  async buy(p: Player, rawKey: unknown): Promise<{ profile: PublicProfile; alreadyOwned?: boolean }> {
    const repo = this.requireDb();
    const key = typeof rawKey === 'string' ? rawKey.trim() : '';
    if (!Object.prototype.hasOwnProperty.call(ITEM_PRICES, key)) {
      throw new HttpException({ ok: false, error: 'INVALID_ITEM' }, HttpStatus.BAD_REQUEST);
    }
    const price = ITEM_PRICES[key];
    const runBuy = async (playerRepo: Repository<Player>): Promise<{ profile: PublicProfile; alreadyOwned?: boolean }> => {
      const fresh = (await playerRepo.findOne({
        where: { id: p.id },
        ...(repo.manager ? { lock: { mode: 'pessimistic_write' } } : {}),
      })) || p;
      const owned = fresh.purchases || {};
      if (owned[key]) {
        return { alreadyOwned: true, profile: this.toPublic(fresh) };
      }
      if ((fresh.coins || 0) < price) {
        throw new HttpException(
          { ok: false, error: 'INSUFFICIENT_COINS', needed: price, coins: fresh.coins || 0 },
          HttpStatus.BAD_REQUEST,
        );
      }
      fresh.coins = (fresh.coins || 0) - price;
      fresh.purchases = { ...owned, [key]: 1 };
      await playerRepo.save(fresh);
      return { profile: this.toPublic(fresh) };
    };
    if (repo.manager && typeof repo.manager.transaction === 'function') {
      return repo.manager.transaction(async (em) => runBuy(em.getRepository(Player)));
    }
    return runBuy(repo);
  }

  async finishRun(
    p: Player,
    height: unknown,
    runCoins: unknown,
    bonusCoins: unknown,
    rawRunId?: unknown,
  ): Promise<{ awarded: number; profile: PublicProfile; limited?: string; duplicate?: boolean }> {
    const repo = this.requireDb();
    const runId = sanitizeRunId(rawRunId);
    if (rawRunId !== undefined && rawRunId !== null && rawRunId !== '' && !runId) {
      throw new HttpException({ ok: false, error: 'INVALID_RUN_ID' }, HttpStatus.BAD_REQUEST);
    }

    const execute = async (
      playerRepo: Repository<Player>,
      runRepo?: Repository<PlayerRun>,
    ): Promise<{ awarded: number; profile: PublicProfile; limited?: string; duplicate?: boolean }> => {
      const fresh = (await playerRepo.findOne({
        where: { id: p.id },
        ...(repo.manager ? { lock: { mode: 'pessimistic_write' } } : {}),
      })) || p;
      if (runId && runRepo) {
        const dup = await runRepo.findOne({ where: { playerId: fresh.id, runId } });
        if (dup) {
          return { awarded: dup.awarded, duplicate: true, profile: this.toPublic(fresh) };
        }
      }

      const now = new Date();
      if (fresh.lastFinishAt && now.getTime() - fresh.lastFinishAt.getTime() < FINISH_INTERVAL_MS) {
        throw new HttpException({ ok: false, error: 'RATE_LIMIT' }, HttpStatus.TOO_MANY_REQUESTS);
      }
      const hourAgo = now.getTime() - 60 * 60 * 1000;
      if (!fresh.windowStartedAt || fresh.windowStartedAt.getTime() < hourAgo) {
        fresh.windowStartedAt = now;
        fresh.awardedInWindow = 0;
      }

      const h = clamp(Math.floor(Number(height) || 0), 0, RUN_HEIGHT_MAX);
      const want = awardForRun(h, Number(runCoins) || 0, Number(bonusCoins) || 0);
      const room = Math.max(0, HOUR_AWARD_MAX - (fresh.awardedInWindow || 0));
      const awarded = Math.min(want, room);
      fresh.coins = (fresh.coins || 0) + awarded;
      fresh.best = Math.max(fresh.best || 0, h);
      fresh.awardedInWindow = (fresh.awardedInWindow || 0) + awarded;
      fresh.lastFinishAt = now;

      if (runId && runRepo) {
        const rec = runRepo.create({ playerId: fresh.id, runId, awarded });
        try {
          await runRepo.insert(rec);
        } catch (err: any) {
          if (err && (err.code === '23505' || err.code === 'SQLITE_CONSTRAINT')) {
            const dup = await runRepo.findOne({ where: { playerId: fresh.id, runId } });
            return { awarded: dup ? dup.awarded : 0, duplicate: true, profile: this.toPublic(fresh) };
          }
          throw err;
        }
      }

      await playerRepo.save(fresh);
      return {
        awarded,
        profile: this.toPublic(fresh),
        limited: awarded < want ? 'HOUR_CAP' : undefined,
      };
    };

    if (repo.manager && typeof repo.manager.transaction === 'function') {
      return repo.manager.transaction(async (em) =>
        execute(em.getRepository(Player), this.runs ? em.getRepository(PlayerRun) : undefined),
      );
    }
    return execute(repo, this.runs);
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
      best: 0,
      purchases: {},
      telegramId,
      telegramLinkedAt: new Date(),
    });
    await repo.save(created);
    return { token, profile: this.toPublic(created), linked: true };
  }
}
