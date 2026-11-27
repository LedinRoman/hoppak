import { HttpException, HttpStatus, Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Player } from './player.entity';
import { PlayerRun } from './player-run.entity';
import { PlayerGeo } from './player-geo.entity';
import { RunStart } from './run-start.entity';
import { RulesPlausibility } from './rules-plausibility.entity';
import { SuspiciousRun } from './suspicious-run.entity';
import { hashToken, newGuestToken } from './auth';
import { parseAndVerifyInitData, parseAndVerifyWidgetData, VerifiedTelegramInitData } from './telegram';
import { bucketFor, plausBuckets, PlausRule } from './plausibility';
import { displayName } from './display-name';
import { countryOfIp, originLanguage } from './geo';
import { kickAccount } from '../session-kick';
import { publishAccountKick } from '../account-kick-bus';
import { randomUUID } from 'crypto';
import { parseRunMode } from './run-mode';
import {
  ITEM_PRICES, MAP_IDS, RUN_HEIGHT_MAX, WALLET_COINS_MAX,
  awardForRun, clamp, emptyCampaign, mapPurchaseBlock, mergeCampaign, mergePurchases,
  purchasesWithoutMaps, sanitizeMapBest, sanitizePurchases, sanitizeRunId, Campaign,
} from './limits';

export type PublicProfile = {
  id: string;
  coins: number;
  best: number;
  purchases: Record<string, number>;
  campaign: Campaign;
  /** Server campaign-reset epoch. Client overwrites local mapBest when this is newer. */
  campaignEpoch: number;
  migratedAt: string | null;
  createdAt: string;
  telegramId: string | null;
  displayName: string;
  /** How this profile is signed in. Client must use this, not Telegram.WebApp. */
  auth: 'telegram' | 'guest';
};

export type TelegramLoginKind = 'merged' | 'linked' | 'existing' | 'created';

export type TelegramAuthResult = {
  token: string;
  profile: PublicProfile;
  linked: boolean;
  merged?: boolean;
  mergedCoins?: number;
  /** Explicit login case: merged into an existing TG account, or the guest was bound (linked), etc. */
  login: TelegramLoginKind;
};

@Injectable()
export class ProfileService {
  private ruleCache: { at: number; rows: PlausRule[] } | null = null;
  private fallbackLogged = false;

  constructor(
    @Optional() @InjectRepository(Player) private readonly players?: Repository<Player>,
    @Optional() @InjectRepository(PlayerRun) private readonly runs?: Repository<PlayerRun>,
    @Optional() @InjectRepository(PlayerGeo) private readonly geos?: Repository<PlayerGeo>,
    @Optional() @InjectRepository(RunStart) private readonly starts?: Repository<RunStart>,
    @Optional() @InjectRepository(RulesPlausibility) private readonly rules?: Repository<RulesPlausibility>,
    @Optional() @InjectRepository(SuspiciousRun) private readonly suspicious?: Repository<SuspiciousRun>,
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
      campaignEpoch: Math.max(0, Math.floor(Number(p.campaignEpoch) || 0)),
      migratedAt: p.migratedAt ? p.migratedAt.toISOString() : null,
      createdAt: p.createdAt ? p.createdAt.toISOString() : new Date().toISOString(),
      telegramId: p.telegramId ? String(p.telegramId) : null,
      displayName: displayName(p.tg?.firstName ?? null, p.tg?.username ?? null, p.id),
      auth: p.telegramId ? 'telegram' : 'guest',
    };
  }

  /** If a lock/reload dropped the 1:1 telegram row, keep the already-loaded one so the client still sees the name. */
  private publicOf(p: Player, fallback?: Player | null): PublicProfile {
    if (p && !p.tg && fallback && fallback.tg) p.tg = fallback.tg;
    return this.toPublic(p);
  }

  async createGuest(): Promise<{ token: string; profile: PublicProfile }> {
    const repo = this.requireDb();
    const token = newGuestToken();
    const p = Player.make({ guestTokenHash: hashToken(token) });
    await repo.save(p);
    return { token, profile: this.toPublic(p) };
  }

  async findByToken(token: string): Promise<Player | null> {
    const repo = this.requireDb();
    return repo.findOne({ where: { auth: { tokenHash: hashToken(token) } } });
  }

  async requireByToken(token: string | null, opts?: { allowPrevious?: boolean }): Promise<Player> {
    if (!token) throw new HttpException({ ok: false, error: 'UNAUTHORIZED' }, HttpStatus.UNAUTHORIZED);
    const repo = this.requireDb();
    const hash = hashToken(token);
    const cur = await repo.findOne({ where: { auth: { tokenHash: hash } } });
    if (cur) return cur;
    const prev = await repo.findOne({ where: { auth: { previousTokenHash: hash } } });
    if (prev && opts?.allowPrevious) return prev;
    if (prev) {
      throw new HttpException(
        { ok: false, error: 'DEVICE_REPLACED', profile: this.toPublic(prev) },
        HttpStatus.CONFLICT,
      );
    }
    throw new HttpException({ ok: false, error: 'UNAUTHORIZED' }, HttpStatus.UNAUTHORIZED);
  }

  /**
   * Bearer wins when it is still valid. If it is expired or was the pre-merge guest,
   * fall back to the HttpOnly session cookie so the browser keeps the Telegram account.
   */
  async tryPlayerFromRequest(
    bearer: string | null,
    cookie: string | null,
    opts?: { allowPrevious?: boolean },
  ): Promise<{ player: Player; viaCookie: boolean } | null> {
    if (bearer) {
      try {
        return { player: await this.requireByToken(bearer, opts), viaCookie: false };
      } catch (err: any) {
        const status = err && typeof err.getStatus === 'function' ? err.getStatus() : 0;
        if (cookie && cookie !== bearer && (status === 401 || status === 409)) {
          try {
            return { player: await this.requireByToken(cookie, opts), viaCookie: true };
          } catch {
            throw err;
          }
        }
        throw err;
      }
    }
    if (cookie) return { player: await this.requireByToken(cookie, opts), viaCookie: true };
    return null;
  }

  async playerFromRequest(
    bearer: string | null,
    cookie: string | null,
    opts?: { allowPrevious?: boolean },
  ): Promise<{ player: Player; viaCookie: boolean }> {
    const resolved = await this.tryPlayerFromRequest(bearer, cookie, opts);
    if (!resolved) throw new HttpException({ ok: false, error: 'UNAUTHORIZED' }, HttpStatus.UNAUTHORIZED);
    return resolved;
  }

  async migrate(p: Player, purchases: unknown, best?: unknown): Promise<PublicProfile> {
    const repo = this.requireDb();
    const execute = async (playerRepo: Repository<Player>): Promise<PublicProfile> => {
      const fresh = (await this.loadLocked(playerRepo, p.id)) || p;
      if (fresh.migratedAt || fresh.mergedAt) return this.publicOf(fresh, p);
      const incomingBest = clamp(Math.floor(Number(best) || 0), 0, RUN_HEIGHT_MAX);
      fresh.best = Math.max(fresh.best || 0, incomingBest);
      /* Map opens arrive only through buy(). A localStorage blob cannot grant them. */
      fresh.purchases = mergePurchases(fresh.purchases || {}, purchasesWithoutMaps(sanitizePurchases(purchases)));
      fresh.migratedAt = new Date();
      await playerRepo.save(fresh);
      return this.publicOf(fresh, p);
    };
    if (repo.manager && typeof repo.manager.transaction === 'function') {
      return repo.manager.transaction(async (em) => execute(em.getRepository(Player)));
    }
    return execute(repo);
  }

  async buy(p: Player, rawKey: unknown): Promise<{ profile: PublicProfile; alreadyOwned?: boolean }> {
    const repo = this.requireDb();
    const key = typeof rawKey === 'string' ? rawKey.trim() : '';
    if (!Object.prototype.hasOwnProperty.call(ITEM_PRICES, key)) {
      throw new HttpException({ ok: false, error: 'INVALID_ITEM' }, HttpStatus.BAD_REQUEST);
    }
    const price = ITEM_PRICES[key];
    const runBuy = async (playerRepo: Repository<Player>): Promise<{ profile: PublicProfile; alreadyOwned?: boolean }> => {
      const fresh = (await this.loadLocked(playerRepo, p.id)) || p;
      const owned = fresh.purchases || {};
      if (owned[key]) {
        return { alreadyOwned: true, profile: this.toPublic(fresh) };
      }
      const blocked = mapPurchaseBlock(key, fresh.campaign);
      if (blocked) {
        throw new HttpException({ ok: false, ...blocked }, HttpStatus.BAD_REQUEST);
      }
      /* coins>=price is checked under the row lock, so two buys cannot both pass. */
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
   * Upload local map records only. Opens in the body are ignored:
   * a map is purchased, never unlocked by this endpoint.
   * Does not change coins or existing purchases.
   */
  async syncCampaign(p: Player, mapBestRaw: unknown, _openRaw?: unknown, clientEpochRaw?: unknown): Promise<PublicProfile> {
    void _openRaw;
    const repo = this.requireDb();
    const incomingEpoch = Number.isFinite(Number(clientEpochRaw)) ? Math.max(0, Math.floor(Number(clientEpochRaw))) : 0;
    const execute = async (playerRepo: Repository<Player>): Promise<PublicProfile> => {
      const fresh = (await this.loadLocked(playerRepo, p.id)) || p;
      const serverEpoch = Math.max(0, Math.floor(Number(fresh.campaignEpoch) || 0));
      if (serverEpoch > incomingEpoch) {
        throw new HttpException(
          { ok: false, error: 'CAMPAIGN_STALE', profile: this.publicOf(fresh, p) },
          HttpStatus.CONFLICT,
        );
      }
      fresh.campaign = mergeCampaign(fresh.campaign, { best: sanitizeMapBest(mapBestRaw) });
      let top = fresh.best || 0;
      for (const id of Object.keys(fresh.campaign.best || {})) top = Math.max(top, fresh.campaign.best[id] || 0);
      fresh.best = top;
      await playerRepo.save(fresh);
      return this.publicOf(fresh, p);
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
    rawHero?: unknown,
    rawVer?: unknown,
    rawCause?: unknown,
    rawMode?: unknown,
  ): Promise<{ awarded: number; profile: PublicProfile; limited?: string; duplicate?: boolean }> {
    const repo = this.requireDb();
    const runId = sanitizeRunId(rawRunId);
    if (rawRunId !== undefined && rawRunId !== null && rawRunId !== '' && !runId) {
      throw new HttpException({ ok: false, error: 'INVALID_RUN_ID' }, HttpStatus.BAD_REQUEST);
    }
    const runMode = parseRunMode(rawMode);
    if (!runMode) {
      throw new HttpException({ ok: false, error: 'INVALID_MODE' }, HttpStatus.BAD_REQUEST);
    }

    const execute = async (
      em: EntityManager | null,
    ): Promise<{ awarded: number; profile: PublicProfile; limited?: string; duplicate?: boolean }> => {
      const playerRepo = em ? em.getRepository(Player) : repo;
      const runRepo = em ? em.getRepository(PlayerRun) : this.runs;
      const startRepo = em ? em.getRepository(RunStart) : this.starts;
      const susRepo = em ? em.getRepository(SuspiciousRun) : this.suspicious;
      const fresh = (await this.loadLocked(playerRepo, p.id)) || p;
      if (runId && runRepo) {
        const dup = await runRepo.findOne({ where: { playerId: fresh.id, runId } });
        if (dup) {
          return { awarded: dup.awarded, duplicate: true, limited: 'DUPLICATE', profile: this.toPublic(fresh) };
        }
      }

      const claimedH = Math.max(0, Math.floor(Number(height) || 0));
      const claimedC = Math.max(0, Math.floor(Number(runCoins) || 0));
      const claimedB = Math.max(0, Math.floor(Number(bonusCoins) || 0));
      const mapIdEarly = typeof rawMap === 'string' && (MAP_IDS as readonly string[]).indexOf(rawMap) >= 0 ? rawMap : 'city';
      const finishedAt = new Date();
      const elapsed = await this.checkRunPlausibility(
        susRepo, startRepo, fresh.id, runId || '', mapIdEarly, claimedH, claimedC, claimedB, rawHero, rawVer, finishedAt,
      );
      if (elapsed === null) {
        if (runId && runRepo) {
          try { await runRepo.insert(runRepo.create({ playerId: fresh.id, runId, awarded: 0, mode: runMode })); }
          catch (err: any) {
            if (err && (err.code === '23505' || err.code === 'SQLITE_CONSTRAINT')) {
              const dup = await runRepo.findOne({ where: { playerId: fresh.id, runId } });
              return { awarded: dup ? dup.awarded : 0, duplicate: true, limited: 'DUPLICATE', profile: this.toPublic(fresh) };
            }
          }
        }
        return { awarded: 0, profile: this.toPublic(fresh), limited: 'REJECTED' };
      }

      const grant = awardForRun(claimedH, claimedC, claimedB);
      const awarded = Math.min(grant.awarded, Math.max(0, WALLET_COINS_MAX - (fresh.coins || 0)));
      const h = clamp(claimedH, 0, RUN_HEIGHT_MAX);

      if (runId && runRepo) {
        const rec = runRepo.create({
          playerId: fresh.id,
          runId,
          awarded,
          heightM: h,
          cause: typeof rawCause === 'string' && /^(?:fall|shot|hole|left|exit|mob:[a-z0-9_-]{1,28})$/.test(rawCause)
            ? rawCause : null,
          map: mapIdEarly,
          hero: clamp(Math.floor(Number(rawHero) || 0), 0, 5),
          mode: runMode,
          durationS: Math.floor(elapsed),
          clientVersion: typeof rawVer === 'string' ? Array.from(rawVer.replace(/\0/g, '')).slice(0, 16).join('') : null,
          finishedAt,
        });
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
      return repo.manager.transaction(async (em) => {
        await this.armFinishTx(em);
        return execute(em);
      });
    }
    return execute(null);
  }

  /**
   * Row lock on the core player row (all writers take it first), then a plain load with the 1:1 rows.
   * FOR UPDATE cannot sit on the nullable side of the eager LEFT JOINs, so the lock is a separate statement.
   */
  private async loadLocked(playerRepo: Repository<Player>, id: string): Promise<Player | null> {
    const mgr: any = playerRepo.manager;
    if (mgr && typeof mgr.transaction === 'function' && typeof mgr.query === 'function') {
      await mgr.query(`SELECT 1 FROM "player" WHERE "id" = $1 FOR UPDATE`, [id]);
    }
    return playerRepo.findOne({ where: { id }, relations: { tg: true, auth: true, stats: true } });
  }

  /** A stuck lock must release the pool connection instead of waiting forever. */
  private async armFinishTx(em: EntityManager) {
    if (!em || typeof em.query !== 'function') return;
    try {
      await em.query(`SET LOCAL statement_timeout = '3000'`);
      await em.query(`SET LOCAL lock_timeout = '1000'`);
    } catch {
      /* Engines without these settings still finish the transaction. */
    }
  }

  private applyMerge(target: Player, guest: Player): number {
    const balance = target.coins || 0;
    const incoming = Math.min(Math.max(0, guest.coins || 0), Math.max(0, WALLET_COINS_MAX - balance));
    target.coins = balance + incoming;
    target.best = Math.max(target.best || 0, clamp(Math.floor(Number(guest.best) || 0), 0, RUN_HEIGHT_MAX));
    target.purchases = mergePurchases(sanitizePurchases(target.purchases), sanitizePurchases(guest.purchases));
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
      const row = canLock ? await this.loadLocked(repo, id) : await repo.findOne({ where: { id } });
      if (row) out.set(id, row);
    }
    return out;
  }

  /** Keep the previous bearer so an in-progress finish still counts. Kick the old socket. */
  private rotateSession(p: Player): string {
    const next = newGuestToken();
    p.previousTokenHash = p.guestTokenHash;
    p.previousTokenAt = new Date();
    p.guestTokenHash = hashToken(next);
    if (p.auth) p.auth.tokenIssuedAt = new Date();
    return next;
  }

  private updateTelegram(player: Player, tg: VerifiedTelegramInitData) {
    Object.assign(player.tg!, {
      username: tg.username,
      firstName: tg.firstName,
      lastName: tg.lastName,
      language: tg.languageCode,
      isPremium: tg.isPremium,
      updatedAt: new Date(),
    });
  }

  private requireBotToken(): string {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      throw new HttpException({ ok: false, error: 'TELEGRAM_AUTH_UNAVAILABLE' }, HttpStatus.SERVICE_UNAVAILABLE);
    }
    return botToken;
  }

  async authTelegram(guestToken: string | null, initData: unknown): Promise<TelegramAuthResult> {
    const verified = parseAndVerifyInitData(initData, this.requireBotToken());
    return this.completeTelegramAuth(guestToken, verified);
  }

  async authTelegramWidget(guestToken: string | null, body: unknown): Promise<TelegramAuthResult> {
    const verified = parseAndVerifyWidgetData(body, this.requireBotToken());
    return this.completeTelegramAuth(guestToken, verified);
  }

  /** Invalidate the current bearer/cookie value. Logout also drops previousTokenHash so the old value cannot finish a run. */
  async revokeSession(token: string): Promise<void> {
    if (!token) return;
    const repo = this.requireDb();
    const hash = hashToken(token);
    const found = await repo.findOne({ where: { auth: { tokenHash: hash } } })
      || await repo.findOne({ where: { auth: { previousTokenHash: hash } } });
    if (!found) return;
    this.rotateSession(found);
    found.previousTokenHash = null;
    found.previousTokenAt = null;
    await repo.save(found);
  }

  /**
   * Shared Mini App + widget path.
   * 1) Existing Telegram player: switch to that account, merge the browser/Mini App guest into it
   *    (coins summed, purchases union, best max), mark the guest merged.
   * 2) No Telegram player yet: bind telegram id to the current guest and keep its progress.
   *    Do not create an empty user when a guest session is present.
   */
  private async completeTelegramAuth(
    guestToken: string | null,
    verified: VerifiedTelegramInitData,
  ): Promise<TelegramAuthResult> {
    const repo = this.requireDb();
    const { telegramId } = verified;
    const tokenHash = guestToken ? hashToken(guestToken) : null;

    const execute = async (playerRepo: Repository<Player>) => {
      const foundTg = await playerRepo.findOne({ where: { tg: { telegramId } } });
      const foundGuest = tokenHash
        ? await playerRepo.findOne({ where: { auth: { tokenHash } } })
        : null;
      const locked = await this.lockByIds(
        playerRepo,
        [foundTg && foundTg.id, foundGuest && foundGuest.id].filter(Boolean) as string[],
      );
      const existingByTg = (foundTg && locked.get(foundTg.id)) || foundTg || null;
      const candidate = foundGuest && locked.get(foundGuest.id);
      const guest = candidate?.guestTokenHash === tokenHash ? candidate : null;

      if (guest && guest.telegramId && String(guest.telegramId) !== String(telegramId)) {
        throw new HttpException({ ok: false, error: 'GUEST_ALREADY_LINKED' }, HttpStatus.CONFLICT);
      }

      if (existingByTg) {
        this.updateTelegram(existingByTg, verified);
        if (guest && guest.id === existingByTg.id && guestToken) {
          await playerRepo.save(existingByTg);
          return { token: guestToken, profile: this.publicOf(existingByTg), linked: false, merged: false, login: 'existing' as const, playerId: existingByTg.id, replacedSession: null };
        }
        if (guest && guest.id !== existingByTg.id && !guest.telegramId && !guest.mergedInto) {
          const mergedCoins = this.applyMerge(existingByTg, guest);
          this.closeGuest(guest, existingByTg.id);
          const nextToken = this.rotateSession(existingByTg);
          await playerRepo.save(guest);
          await playerRepo.save(existingByTg);
          return {
            token: nextToken,
            profile: this.publicOf(existingByTg),
            linked: false,
            merged: true,
            mergedCoins,
            login: 'merged' as const,
            playerId: existingByTg.id,
            replacedSession: existingByTg.previousTokenHash,
          };
        }
        const nextToken = this.rotateSession(existingByTg);
        await playerRepo.save(existingByTg);
        return { token: nextToken, profile: this.publicOf(existingByTg), linked: false, merged: false, login: 'existing' as const, playerId: existingByTg.id, replacedSession: existingByTg.previousTokenHash };
      }

      if (guest) {
        if (guest.mergedInto) {
          throw new HttpException({ ok: false, error: 'UNAUTHORIZED' }, HttpStatus.UNAUTHORIZED);
        }
        guest.telegramId = telegramId;
        guest.telegramLinkedAt = new Date();
        this.updateTelegram(guest, verified);
        await playerRepo.save(guest);
        return { token: guestToken!, profile: this.publicOf(guest), linked: true, merged: false, login: 'linked' as const, playerId: guest.id, replacedSession: null };
      }

      const token = newGuestToken();
      const created = Player.make({ guestTokenHash: hashToken(token), telegramId });
      this.updateTelegram(created, verified);
      await playerRepo.save(created);
      return { token, profile: this.publicOf(created), linked: true, merged: false, login: 'created' as const, playerId: created.id, replacedSession: null };
    };

    const run = async () => {
      if (repo.manager && typeof repo.manager.transaction === 'function') {
        return repo.manager.transaction(async (em) => execute(em.getRepository(Player)));
      }
      return execute(repo);
    };
    const result = await run();
    if (result.replacedSession) {
      /* Visible in the logs: which account's older tokens were just invalidated (ids shortened, no tokens). */
      console.log(`tg login: account ${String(result.playerId).slice(0, 8)} took over by a new session${result.merged ? ' (guest merged)' : ''}; prior session replaced`);
      const sessionId = hashToken(result.token);
      kickAccount(result.playerId, sessionId, result.replacedSession);
      publishAccountKick(result.playerId, sessionId, result.replacedSession);
    }
    const { playerId: _id, replacedSession: _old, ...rest } = result;
    return rest;
  }

  async noteGeo(playerId: string, ip: string) {
    if (!playerId || !this.geos) return;
    try {
      const country = countryOfIp(ip);
      const lang = country ? originLanguage(country) : null;
      /* A private address must not wipe a country learned from a public one. */
      if (typeof this.geos.query === 'function') {
        await this.geos.query(
          `INSERT INTO "player_geo" ("player_id", "last_ip", "country", "origin_language", "first_seen")
           VALUES ($1, $2, $3, $4, now())
           ON CONFLICT ("player_id") DO UPDATE SET
             "last_ip" = COALESCE(NULLIF($2, ''), "player_geo"."last_ip"),
             "country" = COALESCE($3, "player_geo"."country"),
             "origin_language" = COALESCE($4, "player_geo"."origin_language")`,
          [playerId, ip || '', country, lang],
        );
        return;
      }
      const now = new Date();
      const existing = await this.geos.findOne({ where: { playerId } });
      const row = existing || this.geos.create({ playerId, firstSeen: now });
      if (ip) row.lastIp = ip;
      if (country) {
        row.country = country;
        row.originLanguage = lang;
      }
      if (!row.firstSeen) row.firstSeen = now;
      await this.geos.save(row);
    } catch (err) {
      console.error('geo write failed');
    }
  }

  /** null = unknown token (offline guest); { replaced: true } = a token that a newer login has rotated out. */
  async identityForToken(token: string | null): Promise<{ id: string; name: string; sessionId: string } | { replaced: true } | null> {
    if (!token || !this.players) return null;
    try {
      const p = await this.findByToken(token);
      if (!p) {
        const prev = await this.players.findOne({ where: { auth: { previousTokenHash: hashToken(token) } } });
        return prev ? { replaced: true } : null;
      }
      let first: string | null = null;
      let user: string | null = null;
      if (p.tg) { first = p.tg.firstName; user = p.tg.username; }
      return { id: p.id, name: displayName(first, user, p.id), sessionId: hashToken(token) };
    } catch (err) {
      console.error('identity lookup failed');
      return null;
    }
  }

  async beginRun(p: Player, rawRunId: unknown, rawMap: unknown, rawHero: unknown) {
    const runId = sanitizeRunId(rawRunId);
    if (!runId || !this.starts) return;
    const map = typeof rawMap === 'string' && (MAP_IDS as readonly string[]).indexOf(rawMap) >= 0 ? rawMap : 'city';
    const hero = Math.max(0, Math.min(5, Math.floor(Number(rawHero) || 0)));
    await this.starts.createQueryBuilder().insert().values({
      playerId: p.id, runId, map, hero, startedAt: new Date(),
    }).orIgnore().execute();
  }

  private async loadRules(): Promise<PlausRule[]> {
    const now = Date.now();
    if (this.ruleCache && now - this.ruleCache.at < 60_000) return this.ruleCache.rows;
    if (!this.rules) {
      if (!this.fallbackLogged) { this.fallbackLogged = true; console.error('rules_plausibility missing, conservative fallback'); }
      return plausBuckets();
    }
    try {
      const found = await this.rules.find();
      const rows: PlausRule[] = (found || []).map((r) => ({
        map: r.map,
        tSeconds: Number(r.tSeconds),
        maxCoins: Number(r.maxCoins),
        maxHeightM: Number(r.maxHeightM),
        maxTreasures: Number(r.maxTreasures),
        margin: Number(r.margin) || 1.2,
      })).filter((r) => r.map && r.tSeconds > 0);
      if (!rows.length) {
        if (!this.fallbackLogged) { this.fallbackLogged = true; console.error('rules_plausibility empty, conservative fallback'); }
        const fb = plausBuckets();
        this.ruleCache = { at: now, rows: fb };
        return fb;
      }
      this.ruleCache = { at: now, rows };
      return rows;
    } catch (err) {
      console.error('rules_plausibility read failed, conservative fallback');
      return plausBuckets();
    }
  }

  /**
   * Return server elapsed seconds for a payable run, or null for a rejected finish. Missing runId or server start is a reject,
   * same as a claim over the ceiling. The suspicious row is written on `susRepo`,
   * which is the finish transaction when one is open.
   */
  private async checkRunPlausibility(
    susRepo: Repository<SuspiciousRun> | undefined,
    startRepo: Repository<RunStart> | undefined,
    playerId: string, runId: string, map: string,
    height: number, coins: number, bonusCoins: number, rawHero: unknown, rawVer: unknown, finishedAt: Date,
  ): Promise<number | null> {
    const treasures = Math.ceil(Math.max(0, bonusCoins) / 25);
    const hero = Math.max(0, Math.min(5, Math.floor(Number(rawHero) || 0)));
    const ver = String(rawVer || '').slice(0, 16);
    const reject = async (
      reason: string, duration: number,
      rule?: { maxCoins: number; maxHeightM: number; maxTreasures: number },
    ) => {
      if (susRepo) {
        try {
          await susRepo.save(susRepo.create({
            id: randomUUID(),
            playerId,
            runId: (runId || '').slice(0, 64),
            map,
            hero,
            durationS: Math.max(0, Math.round(duration)),
            claimedCoins: coins,
            claimedHeight: height,
            claimedTreasures: treasures,
            maxCoins: rule ? rule.maxCoins : 0,
            maxHeight: rule ? rule.maxHeightM : 0,
            maxTreasures: rule ? rule.maxTreasures : 0,
            reason: reason.slice(0, 64),
            clientVersion: ver,
            createdAt: new Date(),
          }));
        } catch (err) {
          console.error('suspicious_runs write failed');
        }
      }
      return null;
    };

    if (!runId) return reject('NO_RUN_ID', 0);
    let started: Date | null = null;
    try {
      if (!startRepo) return reject('NO_RUN_START', 0);
      const row = await startRepo.findOne({ where: { playerId, runId } });
      started = row ? row.startedAt : null;
    } catch (err) {
      console.error('run start read failed');
      return reject('NO_RUN_START', 0);
    }
    if (!started) return reject('NO_RUN_START', 0);
    const duration = Math.max(0, (finishedAt.getTime() - new Date(started).getTime()) / 1000);
    const rows = await this.loadRules();
    const rule = bucketFor(rows, map, duration) || bucketFor(plausBuckets(), map, duration);
    if (!rule) return reject('NO_RUN_START', duration);
    const reasons: string[] = [];
    if (height > rule.maxHeightM) reasons.push('height');
    if (coins > rule.maxCoins) reasons.push('coins');
    if (treasures > rule.maxTreasures || bonusCoins > rule.maxTreasures * 25) reasons.push('treasures');
    if (!reasons.length) return duration;
    return reject(reasons.join(','), duration, rule);
  }
}
