import { BeforeInsert, Column, Entity, OneToOne, PrimaryColumn } from 'typeorm';
import { randomUUID } from 'crypto';
import { PlayerAuth } from './player-auth.entity';
import { PlayerStats } from './player-stats.entity';
import { PlayerTelegram } from './player-telegram.entity';
import { PlayerPresence } from './player-presence.entity';

/**
 * Core row: wallet and purchases. Everything else is a 1:1 table keyed by player_id:
 * player_auth (tokens), player_telegram (telegram_id + profile), player_stats (records),
 * player_presence (last seen / online), player_geo (IP, country).
 * The flat accessors below (guestTokenHash, best, campaign, telegramId, …) read and write
 * those child rows, so service code keeps one aggregate while the DB stays normalised.
 */
@Entity({ name: 'player', comment: 'Ядро игрока: монеты, покупки, миграция локального сейва, слияние гостя. Сессия — player_auth, Telegram — player_telegram, рекорды — player_stats, присутствие — player_presence, страна — player_geo.' })
export class Player {
  @PrimaryColumn('uuid', { comment: 'UUID игрока, первичный ключ. Сервер задаёт uuid v4 при создании строки.' })
  id: string;

  @Column({ type: 'int', default: 0, comment: 'Баланс монет на сервере, целое ≥ 0. Начисляется за забеги, списывается в POST /api/profile/buy.' })
  coins: number;

  @Column({ type: 'jsonb', default: () => "'{}'", comment: 'JSONB купленных предметов. Ключи hero:/char:/map:, значение 1. Открытия карт хранятся здесь, не в player_stats.campaign. Пишется buy(), мерджем и миграцией сейва (карты из сейва не импортируются).' })
  purchases: Record<string, number>;

  @Column({ name: 'migrated_at', type: 'timestamptz', nullable: true, comment: 'timestamptz одноразовой миграции локального сейва (POST /api/profile/migrate). NULL, если ещё не было. Повтор не меняет данные.' })
  migratedAt: Date | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()', comment: 'timestamptz создания строки, по умолчанию now().' })
  createdAt: Date;

  /** Set when this guest row was folded into an existing Telegram player. Its token is revoked. */
  @Column({ name: 'merged_into', type: 'uuid', nullable: true, comment: 'UUID игрока, в которого слили эту гостевую строку. Токен строки при слиянии отзывается.' })
  mergedInto: string | null;

  @Column({ name: 'merged_at', type: 'timestamptz', nullable: true, comment: 'timestamptz слияния гостя в существующий Telegram-профиль.' })
  mergedAt: Date | null;

  @OneToOne(() => PlayerAuth, (a) => a.player, { eager: true, cascade: true })
  auth?: PlayerAuth;

  @OneToOne(() => PlayerStats, (s) => s.player, { eager: true, cascade: true })
  stats?: PlayerStats;

  @OneToOne(() => PlayerTelegram, (t) => t.player, { eager: true, cascade: true })
  tg?: PlayerTelegram | null;

  @OneToOne(() => PlayerPresence, (s) => s.player)
  presence?: PlayerPresence;

  private ensureAuth(): PlayerAuth {
    if (!this.auth) this.auth = Object.assign(new PlayerAuth(), { playerId: this.id, previousTokenHash: null, previousTokenAt: null });
    return this.auth;
  }

  private ensureStats(): PlayerStats {
    if (!this.stats) this.stats = Object.assign(new PlayerStats(), { playerId: this.id, best: 0, campaign: { best: {} } });
    return this.stats;
  }

  private ensureTg(): PlayerTelegram {
    if (!this.tg) this.tg = Object.assign(new PlayerTelegram(), { playerId: this.id, linkedAt: new Date() });
    return this.tg;
  }

  get guestTokenHash(): string { return this.auth ? this.auth.tokenHash : (undefined as unknown as string); }
  set guestTokenHash(v: string) { this.ensureAuth().tokenHash = v; }
  get previousTokenHash(): string | null { return this.auth ? this.auth.previousTokenHash : null; }
  set previousTokenHash(v: string | null) { if (v != null || this.auth) this.ensureAuth().previousTokenHash = v; }
  get previousTokenAt(): Date | null { return this.auth ? this.auth.previousTokenAt : null; }
  set previousTokenAt(v: Date | null) { if (v != null || this.auth) this.ensureAuth().previousTokenAt = v; }

  get best(): number { return this.stats ? this.stats.best : 0; }
  set best(v: number) { this.ensureStats().best = v; }
  get campaign(): { best: Record<string, number> } { return this.stats ? this.stats.campaign : { best: {} }; }
  set campaign(v: { best: Record<string, number> }) { this.ensureStats().campaign = v; }

  get telegramId(): string | null { return this.tg ? this.tg.telegramId : null; }
  set telegramId(v: string | null) { if (v != null || this.tg) this.ensureTg().telegramId = v as string; }
  get telegramLinkedAt(): Date | null { return this.tg ? this.tg.linkedAt : null; }
  set telegramLinkedAt(v: Date | null) { if (v != null || this.tg) this.ensureTg().linkedAt = v as Date; }

  /** Build a new player with its 1:1 rows already attached. */
  static make(init: { guestTokenHash: string; telegramId?: string | number | null }): Player {
    const p = new Player();
    p.id = randomUUID();
    p.coins = 0;
    p.purchases = {};
    p.ensureAuth().tokenHash = init.guestTokenHash;
    p.auth!.tokenIssuedAt = new Date();
    p.ensureStats();
    if (init.telegramId != null) {
      p.ensureTg().telegramId = String(init.telegramId);
    }
    return p;
  }

  @BeforeInsert()
  assignId() {
    if (!this.id) this.id = randomUUID();
    if (this.coins == null) this.coins = 0;
    if (!this.purchases) this.purchases = {};
    if (this.auth) this.auth.playerId = this.id;
    this.ensureStats().playerId = this.id;
    if (this.tg) this.tg.playerId = this.id;
  }
}
