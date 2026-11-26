import { BeforeInsert, Column, Entity, PrimaryColumn } from 'typeorm';
import { randomUUID } from 'crypto';

@Entity({ name: 'player', comment: 'Профиль игрока: монеты, покупки, рекорды. Поля Telegram лежат в player_telegram, страна в player_geo.' })
export class Player {
  @PrimaryColumn('uuid', { comment: 'UUID игрока, первичный ключ. Сервер задаёт uuid v4 при создании строки.' })
  id: string;

  @Column({ name: 'guest_token_hash', type: 'varchar', length: 64, unique: true, comment: 'SHA-256 (hex, 64 символа) от bearer-токена сессии (32 случайных байта в hex). Сам токен в БД не хранится.' })
  guestTokenHash: string;

  @Column({ type: 'int', default: 0, comment: 'Баланс монет на сервере, целое ≥ 0. Начисляется за забеги и разовую миграцию локального сейва (вход до 8000), списывается в POST /api/profile/buy.' })
  coins: number;

  @Column({ type: 'int', default: 0, comment: 'Лучшая высота забега, метры, целое 0…20000. Максимум из finishRun, миграции сейва и campaign.best.' })
  best: number;

  @Column({ type: 'jsonb', default: () => "'{}'", comment: 'JSONB купленных предметов. Ключи hero:/char:/map:, значение 1. Открытия карт хранятся здесь, не в campaign. Пишется buy(), мерджем и миграцией сейва (карты из сейва не импортируются).' })
  purchases: Record<string, number>;

  /** Per-map records. Opens stay in purchases (`map:*`). Coins are not stored here. */
  @Column({ type: 'jsonb', default: () => `'{"best":{}}'`, comment: 'JSONB вида {"best":{карта:метры}}. Рекорды по картам, 1…20000 м. Монеты и открытия карт не хранит. Обновляется finishRun и POST /api/profile/campaign; при мердже берётся максимум по карте.' })
  campaign: { best: Record<string, number> };

  @Column({ name: 'migrated_at', type: 'timestamptz', nullable: true, comment: 'timestamptz одноразовой миграции локального сейва (POST /api/profile/migrate). NULL, если ещё не было. Повтор не меняет данные.' })
  migratedAt: Date | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()', comment: 'timestamptz создания строки, по умолчанию now().' })
  createdAt: Date;

  @Column({ name: 'last_finish_at', type: 'timestamptz', nullable: true, comment: 'timestamptz; колонка осталась от прежнего интервала между finishRun. Текущий код её не обновляет.' })
  lastFinishAt: Date | null;

  @Column({ name: 'window_started_at', type: 'timestamptz', nullable: true, comment: 'timestamptz начала часового окна лимита наград. Текущий код не обновляет: часовой лимит снят.' })
  windowStartedAt: Date | null;

  @Column({ name: 'awarded_in_window', type: 'int', default: 0, comment: 'Сколько монет начислено в том часовом окне, целое, по умолчанию 0. Текущий код не обновляет: часовой лимит снят.' })
  awardedInWindow: number;

  @Column({ name: 'telegram_id', type: 'bigint', nullable: true, unique: true, comment: 'id пользователя Telegram (bigint) из уже проверенного initData.user.id. UNIQUE, у гостя NULL.' })
  telegramId: string | null;

  @Column({ name: 'telegram_linked_at', type: 'timestamptz', nullable: true, comment: 'timestamptz первой привязки этой строки к telegram_id.' })
  telegramLinkedAt: Date | null;

  /** Set when this guest row was folded into an existing Telegram player. Its token is revoked. */
  @Column({ name: 'merged_into', type: 'uuid', nullable: true, comment: 'UUID игрока, в которого слили эту гостевую строку. Токен строки при слиянии отзывается.' })
  mergedInto: string | null;

  @Column({ name: 'merged_at', type: 'timestamptz', nullable: true, comment: 'timestamptz слияния гостя в существующий Telegram-профиль.' })
  mergedAt: Date | null;

  @Column({ name: 'previous_token_hash', type: 'varchar', length: 64, nullable: true, comment: 'SHA-256 предыдущего bearer-токена. Им ещё можно сдать уже начатый забег. Новый вход его затирает следующим.' })
  previousTokenHash: string | null;

  @Column({ name: 'previous_token_at', type: 'timestamptz', nullable: true, comment: 'timestamptz, когда текущий токен стал предыдущим (вход с другого устройства).' })
  previousTokenAt: Date | null;

  @BeforeInsert()
  assignId() {
    if (!this.id) this.id = randomUUID();
    if (this.coins == null) this.coins = 0;
    if (this.best == null) this.best = 0;
    if (!this.purchases) this.purchases = {};
    if (!this.campaign || !this.campaign.best) this.campaign = { best: {} };
    if (this.awardedInWindow == null) this.awardedInWindow = 0;
  }
}
