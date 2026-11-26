import { HttpException, HttpStatus, Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Player } from './player.entity';
import { PlayerRun } from './player-run.entity';
import { hashToken, newGuestToken } from './auth';
import { parseAndVerifyInitData } from './telegram';
import {
  ITEM_PRICES, MAP_IDS, MIGRATE_COINS_MAX, RUN_HEIGHT_MAX,
  awardForRun, clamp, emptyCampaign, mergeCampaign, mergePurchases,
  sanitizeMapBest, sanitizePurchases, sanitizeRunId, Campaign,
} from './limits';

export type PublicProfile = {
  id: string;
  coins: number;
  best: number;
  purchases: Record<string, number>;
  campaign: Campaign;
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
      campaign: mergeCampaign(p.campaign, emptyCampaign()),
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
      campaign: emptyCampaign(),
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

  /**
   * Upload local map records and map opens. Idempotent max-merge.
   * Does not change coins: the server balance is the only wallet.
   */
  async syncCampaign(p: Player, mapBestRaw: unknown, openRaw: unknown): Promise<PublicProfile> {
    const repo = this.requireDb();
    const execute = async (playerRepo: Repository<Player>): Promise<PublicProfile> => {
      const fresh = (await playerRepo.findOne({
        where: { id: p.id },
        ...(repo.manager ? { lock: { mode: 'pessimistic_write' } } : {}),
      })) || p;
      fresh.campaign = mergeCampaign(fresh.campaign, { best: sanitizeMapBest(mapBestRaw) });
      const opens = sanitizePurchases(openRaw);
      const mapOpens: Record<string, number> = {};
      for (const key of Object.keys(opens)) {
        if (key.indexOf('map:') === 0 && Object.prototype.hasOwnProperty.call(ITEM_PRICES, key)) mapOpens[key] = 1;
      }
      fresh.purchases = mergePurchases(fresh.purchases || {}, mapOpens);
      let top = fresh.best || 0;
      for (const id of Object.keys(fresh.campaign.best || {})) top = Math.max(top, fresh.campaign.best[id] || 0);
      fresh.best = top;
      await playerRepo.save(fresh);
      return this.toPublic(fresh);
    };
    if (repo.manager && typeof repo.manager.transaction === 'function') {
      return repo.manager.transaction(async (em) => execute(em.getRepository(Player)));
    }
    return execute(repo);
  }

  async finishRun(
    p: Player,
    height: unknown,
    runCoins: unknown,
    bonusCoins: unknown,
    rawRunId?: unknown,
    rawMap?: unknown,
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
          return { awarded: dup.awarded, duplicate: true, limited: 'DUPLICATE', profile: this.toPublic(fresh) };
        }
      }

      const grant = awardForRun(Number(height) || 0, Number(runCoins) || 0, Number(bonusCoins) || 0);
      const awarded = grant.awarded;
      const h = clamp(Math.floor(Number(height) || 0), 0, RUN_HEIGHT_MAX);

      if (runId && runRepo) {
        const rec = runRepo.create({ playerId: fresh.id, runId, awarded });
        try {
          await runRepo.insert(rec);
        } catch (err: any) {
          if (err && (err.code === '23505' || err.code === 'SQLITE_CONSTRAINT')) {
            const dup = await runRepo.findOne({ where: { playerId: fresh.id, runId } });
            return { awarded: dup ? dup.awarded : 0, duplicate: true, limited: 'DUPLICATE', profile: this.toPublic(fresh) };
          }
          throw err;
        }
      }

      fresh.coins = (fresh.coins || 0) + awarded;
      fresh.best = Math.max(fresh.best || 0, h);
      const mapId = typeof rawMap === 'string' && (MAP_IDS as readonly string[]).indexOf(rawMap) >= 0 ? rawMap : '';
      if (mapId && h > 0) {
        fresh.campaign = mergeCampaign(fresh.campaign, { best: { [mapId]: h } });
      }
      await playerRepo.save(fresh);
      return {
        awarded,
        profile: this.toPublic(fresh),
        limited: grant.limited,
      };
    };

    if (repo.manager && typeof repo.manager.transaction === 'function') {
      return repo.manager.transaction(async (em) =>
        execute(em.getRepository(Player), this.runs ? em.getRepository(PlayerRun) : undefined),
      );
    }
    return execute(repo, this.runs);
  }

  /** Guest server wallet folded into an existing Telegram player. Local caches are not part of this number. */
  private guestCoinPart(guest: Player): number {
    return clamp(Math.floor(Number(guest.coins) || 0), 0, MIGRATE_COINS_MAX);
  }

  private applyMerge(target: Player, guest: Player): number {
    const incoming = this.guestCoinPart(guest);
    target.coins = (target.coins || 0) + incoming;
    target.best = Math.max(target.best || 0, clamp(Math.floor(Number(guest.best) || 0), 0, RUN_HEIGHT_MAX));
    target.purchases = mergePurchases(target.purchases || {}, sanitizePurchases(guest.purchases));
    target.campaign = mergeCampaign(target.campaign, guest.campaign);
    let top = target.best || 0;
    const best = (target.campaign && target.campaign.best) || {};
    for (const id of Object.keys(best)) top = Math.max(top, best[id] || 0);
    target.best = top;
    return incoming;
  }

  /** Revoke the guest token and mark the row closed so a retry cannot add coins again. */
  private closeGuest(guest: Player, targetId: string) {
    guest.mergedInto = targetId;
    guest.mergedAt = guest.mergedAt || new Date();
    guest.guestTokenHash = hashToken(newGuestToken());
    guest.coins = 0;
  }

  private async lockByIds(repo: Repository<Player>, ids: string[]): Promise<Map<string, Player>> {
    const unique = Array.from(new Set(ids.filter(Boolean))).sort();
    const out = new Map<string, Player>();
    const canLock = !!(repo.manager && typeof repo.manager.transaction === 'function');
    for (const id of unique) {
      const row = await repo.findOne({
        where: { id },
        ...(canLock ? { lock: { mode: 'pessimistic_write' as const } } : {}),
      });
      if (row) out.set(id, row);
    }
    return out;
  }

  async authTelegram(
    guestToken: string | null,
    initData: unknown,
  ): Promise<{ token: string; profile: PublicProfile; linked: boolean; merged?: boolean; mergedCoins?: number }> {
    const repo = this.requireDb();
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      throw new HttpException({ ok: false, error: 'TELEGRAM_AUTH_UNAVAILABLE' }, HttpStatus.SERVICE_UNAVAILABLE);
    }
    const { telegramId } = parseAndVerifyInitData(initData, botToken);

    const execute = async (playerRepo: Repository<Player>) => {
      const foundTg = await playerRepo.findOne({ where: { telegramId } });
      const foundGuest = guestToken
        ? await playerRepo.findOne({ where: { guestTokenHash: hashToken(guestToken) } })
        : null;
      const locked = await this.lockByIds(
        playerRepo,
        [foundTg && foundTg.id, foundGuest && foundGuest.id].filter(Boolean) as string[],
      );
      const existingByTg = (foundTg && locked.get(foundTg.id)) || foundTg || null;
      const guest = (foundGuest && locked.get(foundGuest.id)) || foundGuest || null;

      if (guest && guest.telegramId && String(guest.telegramId) !== String(telegramId)) {
        throw new HttpException({ ok: false, error: 'GUEST_ALREADY_LINKED' }, HttpStatus.CONFLICT);
      }

      if (existingByTg) {
        if (guest && guest.id === existingByTg.id && guestToken) {
          return { token: guestToken, profile: this.toPublic(existingByTg), linked: false };
        }
        if (guest && guest.id !== existingByTg.id && !guest.telegramId && !guest.mergedInto) {
          const mergedCoins = this.applyMerge(existingByTg, guest);
          this.closeGuest(guest, existingByTg.id);
          const nextToken = newGuestToken();
          existingByTg.guestTokenHash = hashToken(nextToken);
          await playerRepo.save(guest);
          await playerRepo.save(existingByTg);
          return {
            token: nextToken,
            profile: this.toPublic(existingByTg),
            linked: false,
            merged: true,
            mergedCoins,
          };
        }
        const nextToken = newGuestToken();
        existingByTg.guestTokenHash = hashToken(nextToken);
        await playerRepo.save(existingByTg);
        return { token: nextToken, profile: this.toPublic(existingByTg), linked: false };
      }

      if (guest) {
        if (guest.mergedInto) {
          throw new HttpException({ ok: false, error: 'UNAUTHORIZED' }, HttpStatus.UNAUTHORIZED);
        }
        guest.telegramId = telegramId;
        guest.telegramLinkedAt = new Date();
        await playerRepo.save(guest);
        return { token: guestToken!, profile: this.toPublic(guest), linked: true };
      }

      const token = newGuestToken();
      const created = playerRepo.create({
        guestTokenHash: hashToken(token),
        coins: 0,
        best: 0,
        purchases: {},
        telegramId,
        telegramLinkedAt: new Date(),
      });
      await playerRepo.save(created);
      return { token, profile: this.toPublic(created), linked: true };
    };

    if (repo.manager && typeof repo.manager.transaction === 'function') {
      return repo.manager.transaction(async (em) => execute(em.getRepository(Player)));
    }
    return execute(repo);
  }
}
