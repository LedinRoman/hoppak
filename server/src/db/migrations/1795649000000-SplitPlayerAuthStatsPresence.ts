import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Normalises player: the core row keeps wallet + purchases, everything else moves to 1:1 tables.
 *
 *   player            id, coins, purchases, migrated_at, created_at, merged_into, merged_at
 *   player_auth       token_hash, token_issued_at, previous_token_hash, previous_token_at   (was player.guest_token_hash, previous_*)
 *   player_telegram   telegram_id (the only copy), linked_at + profile fields               (was player.telegram_id, telegram_linked_at)
 *   player_stats      best, campaign                                                        (was player.best, campaign)
 *   player_presence   first_seen_at, last_seen_at, left_at, screen, room, client_version, platform
 *                     (was online_now; seeded for every player)
 *   player_geo        last_seen dropped (it is player_presence.last_seen_at now)
 *   player_online_v   view: is_online = last_seen_at fresher than 60 s and not left after it
 *
 * Dropped as dead: player.last_finish_at, window_started_at, awarded_in_window (the hourly limit is gone).
 * Data is copied before any column is dropped, all inside the migration transaction.
 * A guard aborts the migration if a player_telegram row has no telegram_id on the player (nothing is lost silently).
 * Rollback in production = restore the pg_dump taken before this migration (see PROD-0.6.1-PLAN.md).
 * down() rebuilds the old columns best-effort from the new tables.
 */
export class SplitPlayerAuthStatsPresence1795649000000 implements MigrationInterface {
  name = 'SplitPlayerAuthStatsPresence1795649000000';

  public async up(q: QueryRunner): Promise<void> {
    /* ---- player_auth ---- */
    await q.query(`
      CREATE TABLE "player_auth" (
        "player_id" uuid PRIMARY KEY REFERENCES "player"("id") ON DELETE CASCADE,
        "token_hash" varchar(64) NOT NULL,
        "token_issued_at" timestamptz NOT NULL DEFAULT now(),
        "previous_token_hash" varchar(64),
        "previous_token_at" timestamptz,
        CONSTRAINT "player_auth_token_hash_key" UNIQUE ("token_hash")
      )
    `);
    await q.query(`
      INSERT INTO "player_auth" ("player_id", "token_hash", "token_issued_at", "previous_token_hash", "previous_token_at")
      SELECT "id", "guest_token_hash", COALESCE("previous_token_at", "created_at"), "previous_token_hash", "previous_token_at" FROM "player"
    `);
    await q.query(`CREATE INDEX "player_auth_previous_token_hash_idx" ON "player_auth" ("previous_token_hash")`);

    /* ---- player_stats ---- */
    await q.query(`
      CREATE TABLE "player_stats" (
        "player_id" uuid PRIMARY KEY REFERENCES "player"("id") ON DELETE CASCADE,
        "best" int NOT NULL DEFAULT 0,
        "campaign" jsonb NOT NULL DEFAULT '{"best":{}}'
      )
    `);
    await q.query(`INSERT INTO "player_stats" ("player_id", "best", "campaign") SELECT "id", "best", "campaign" FROM "player"`);

    /* ---- player_telegram: telegram_id + linked_at become the single home ---- */
    await q.query(`
      DO $$
      DECLARE n int;
      BEGIN
        SELECT count(*) INTO n FROM "player_telegram" t
          WHERE NOT EXISTS (SELECT 1 FROM "player" p WHERE p."id" = t."player_id" AND p."telegram_id" IS NOT NULL);
        IF n > 0 THEN
          RAISE EXCEPTION 'player_telegram has % rows without player.telegram_id; fix the data first', n;
        END IF;
      END $$
    `);
    await q.query(`ALTER TABLE "player_telegram" ADD COLUMN "telegram_id" bigint`);
    await q.query(`ALTER TABLE "player_telegram" ADD COLUMN "linked_at" timestamptz`);
    await q.query(`
      UPDATE "player_telegram" t SET "telegram_id" = p."telegram_id", "linked_at" = COALESCE(p."telegram_linked_at", p."created_at")
      FROM "player" p WHERE p."id" = t."player_id"
    `);
    await q.query(`
      INSERT INTO "player_telegram" ("player_id", "telegram_id", "linked_at", "updated_at")
      SELECT p."id", p."telegram_id", COALESCE(p."telegram_linked_at", p."created_at"), now()
      FROM "player" p WHERE p."telegram_id" IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM "player_telegram" t WHERE t."player_id" = p."id")
    `);
    await q.query(`ALTER TABLE "player_telegram" ALTER COLUMN "telegram_id" SET NOT NULL`);
    await q.query(`ALTER TABLE "player_telegram" ALTER COLUMN "linked_at" SET NOT NULL`);
    await q.query(`ALTER TABLE "player_telegram" ALTER COLUMN "linked_at" SET DEFAULT now()`);
    await q.query(`ALTER TABLE "player_telegram" ADD CONSTRAINT "player_telegram_telegram_id_key" UNIQUE ("telegram_id")`);

    /* ---- player_presence (replaces online_now), seeded for every player ---- */
    await q.query(`
      CREATE TABLE "player_presence" (
        "player_id" uuid PRIMARY KEY REFERENCES "player"("id") ON DELETE CASCADE,
        "first_seen_at" timestamptz NOT NULL DEFAULT now(),
        "last_seen_at" timestamptz NOT NULL DEFAULT now(),
        "left_at" timestamptz,
        "screen" varchar(16) NOT NULL DEFAULT 'menu',
        "room" varchar(16) NOT NULL DEFAULT '',
        "client_version" varchar(16) NOT NULL DEFAULT '',
        "platform" varchar(16) NOT NULL DEFAULT ''
      )
    `);
    await q.query(`
      INSERT INTO "player_presence" ("player_id", "first_seen_at", "last_seen_at", "screen", "room", "client_version", "platform")
      SELECT p."id",
             LEAST(p."created_at", COALESCE(g."first_seen", p."created_at")),
             GREATEST(COALESCE(o."last_seen", g."last_seen", p."created_at"), p."created_at"),
             COALESCE(o."screen", 'menu'), COALESCE(o."room", ''), COALESCE(o."client_version", ''), COALESCE(o."platform", '')
      FROM "player" p
      LEFT JOIN "online_now" o ON o."player_id" = p."id"
      LEFT JOIN "player_geo" g ON g."player_id" = p."id"
    `);
    await q.query(`CREATE INDEX "player_presence_last_seen_at_idx" ON "player_presence" ("last_seen_at")`);
    await q.query(`DROP TABLE "online_now"`);
    await q.query(`ALTER TABLE "player_geo" DROP COLUMN "last_seen"`);

    /* ---- slim the core row ---- */
    for (const col of [
      'guest_token_hash', 'previous_token_hash', 'previous_token_at', 'best', 'campaign',
      'telegram_id', 'telegram_linked_at', 'last_finish_at', 'window_started_at', 'awarded_in_window',
    ]) {
      await q.query(`ALTER TABLE "player" DROP COLUMN "${col}"`);
    }

    /* ---- online view ---- */
    await q.query(`
      CREATE VIEW "player_online_v" AS
      SELECT s."player_id",
             (s."last_seen_at" > now() - interval '60 seconds' AND (s."left_at" IS NULL OR s."left_at" < s."last_seen_at")) AS "is_online",
             s."last_seen_at",
             s."left_at",
             round(extract(epoch FROM (now() - s."last_seen_at")))::int AS "seconds_since_seen",
             s."screen", s."room", s."client_version", s."platform",
             t."telegram_id", t."username", t."first_name"
      FROM "player_presence" s
      LEFT JOIN "player_telegram" t ON t."player_id" = s."player_id"
    `);

    await this.comments(q);
  }

  private async comments(q: QueryRunner): Promise<void> {
    const c: Array<[string, string]> = [
      ['TABLE "player"', 'Ядро игрока: монеты, покупки, миграция локального сейва, слияние гостя. Сессия — player_auth, Telegram — player_telegram, рекорды — player_stats, присутствие — player_presence, страна — player_geo.'],
      ['COLUMN "player"."id"', 'UUID игрока, первичный ключ. Сервер задаёт uuid v4 при создании строки.'],
      ['COLUMN "player"."coins"', 'Баланс монет на сервере, целое ≥ 0. Начисляется за забеги и разовую миграцию локального сейва (вход до 8000), списывается в POST /api/profile/buy.'],
      ['COLUMN "player"."purchases"', 'JSONB купленных предметов. Ключи hero:/char:/map:, значение 1. Открытия карт хранятся здесь, не в player_stats.campaign. Пишется buy(), мерджем и миграцией сейва (карты из сейва не импортируются).'],
      ['COLUMN "player"."migrated_at"', 'timestamptz одноразовой миграции локального сейва (POST /api/profile/migrate). NULL, если ещё не было. Повтор не меняет данные.'],
      ['COLUMN "player"."created_at"', 'timestamptz создания строки, по умолчанию now().'],
      ['COLUMN "player"."merged_into"', 'UUID игрока, в которого слили эту гостевую строку (FK на player.id). Токен строки при слиянии отзывается.'],
      ['COLUMN "player"."merged_at"', 'timestamptz слияния гостя в существующий Telegram-профиль.'],

      ['TABLE "player_auth"', 'Сессия игрока: хеш текущего токена и хеш предыдущего (смена устройства). Один к одному с player. Сами токены в БД не хранятся.'],
      ['COLUMN "player_auth"."player_id"', 'UUID игрока, первичный ключ и внешний ключ на player.id (ON DELETE CASCADE).'],
      ['COLUMN "player_auth"."token_hash"', 'SHA-256 (hex, 64 символа) от текущего bearer-токена сессии (32 случайных байта в hex). UNIQUE. Сам токен в БД не хранится.'],
      ['COLUMN "player_auth"."token_issued_at"', 'timestamptz выдачи текущего токена: создание игрока или последний вход с другого устройства.'],
      ['COLUMN "player_auth"."previous_token_hash"', 'SHA-256 предыдущего bearer-токена. Им ещё можно сдать уже начатый забег; остальные запросы получают SESSION_REPLACED. Новый вход затирает его следующим.'],
      ['COLUMN "player_auth"."previous_token_at"', 'timestamptz, когда текущий токен стал предыдущим (вход с другого устройства).'],

      ['TABLE "player_stats"', 'Рекорды игрока: общий лучший результат и рекорды по картам. Один к одному с player. Монеты и покупки лежат в player.'],
      ['COLUMN "player_stats"."player_id"', 'UUID игрока, первичный ключ и внешний ключ на player.id (ON DELETE CASCADE).'],
      ['COLUMN "player_stats"."best"', 'Лучшая высота забега, метры, целое 0…20000. Максимум из finishRun, миграции сейва и campaign.best.'],
      ['COLUMN "player_stats"."campaign"', 'JSONB вида {"best":{карта:метры}}. Рекорды по картам, 1…20000 м. Монеты и открытия карт не хранит. Обновляется finishRun и POST /api/profile/campaign; при мердже берётся максимум по карте.'],

      ['TABLE "player_telegram"', 'Привязка к Telegram: id пользователя (единственное место, где он хранится) и поля профиля из initData. Один к одному с player; строки нет у гостя. Ключ входа — telegram_id.'],
      ['COLUMN "player_telegram"."player_id"', 'UUID игрока, первичный ключ и внешний ключ на player.id (ON DELETE CASCADE).'],
      ['COLUMN "player_telegram"."telegram_id"', 'id пользователя Telegram (bigint) из проверенного initData.user.id. UNIQUE, NOT NULL. Нигде больше не хранится.'],
      ['COLUMN "player_telegram"."linked_at"', 'timestamptz первой привязки игрока к этому telegram_id.'],
      ['COLUMN "player_telegram"."username"', 'username из проверенного initData, до 64 символов. Обновляется при каждом успешном входе. В API не отдаётся.'],
      ['COLUMN "player_telegram"."first_name"', 'first_name из проверенного initData, до 128 символов. В API не отдаётся.'],
      ['COLUMN "player_telegram"."last_name"', 'last_name из проверенного initData, до 128 символов. В API не отдаётся.'],
      ['COLUMN "player_telegram"."language"', 'language_code из проверенного initData, до 16 символов. В API не отдаётся.'],
      ['COLUMN "player_telegram"."is_premium"', 'is_premium из проверенного initData. NULL, если поля не было. В API не отдаётся.'],
      ['COLUMN "player_telegram"."updated_at"', 'timestamptz последнего обновления строки при успешном входе, привязке или мердже.'],

      ['TABLE "player_presence"', 'Присутствие игрока: когда видели последний раз, выходил ли он, где сидит и с какой версии. Один к одному с player. «Онлайн сейчас» считает view player_online_v по last_seen_at, без Redis и без чистки.'],
      ['COLUMN "player_presence"."player_id"', 'UUID игрока, первичный ключ и внешний ключ на player.id (ON DELETE CASCADE).'],
      ['COLUMN "player_presence"."first_seen_at"', 'timestamptz первого появления игрока в игре.'],
      ['COLUMN "player_presence"."last_seen_at"', 'timestamptz последнего признака жизни: вход, пульс клиента раз в ~25 с, активность в сокете, выход. Пишется не чаще раза в 20 с на игрока. Онлайн — моложе 60 секунд.'],
      ['COLUMN "player_presence"."left_at"', 'timestamptz последнего явного выхода (закрыл или свернул игру). Игрок вне сети, пока left_at не старше last_seen_at. Любой следующий пульс снова делает его онлайн.'],
      ['COLUMN "player_presence"."screen"', 'Экран: menu (меню), lobby (комната до старта), game (идёт забег) или spectator (наблюдатель).'],
      ['COLUMN "player_presence"."room"', 'Код комнаты, если игрок в мультиплеере. Пусто вне комнаты.'],
      ['COLUMN "player_presence"."client_version"', 'Версия клиента, которую прислал браузер или сокет. Пустое значение не затирает прежнее.'],
      ['COLUMN "player_presence"."platform"', 'Платформа Telegram (ios, android, tdesktop, web), как прислал клиент. Пустое значение не затирает прежнее.'],

      ['TABLE "player_geo"', 'Последний IP и страна игрока. Только хранение, интерфейс по этому полю не переводится. Один к одному с player.'],
      ['COLUMN "player_geo"."first_seen"', 'timestamptz первого успешного определения для этого игрока. Время последнего захода — в player_presence.last_seen_at.'],

      ['VIEW "player_online_v"', 'Кто онлайн сейчас. По строке на игрока из player_presence: is_online = last_seen_at моложе 60 секунд и игрок не выходил после него. Упавший процесс не оставляет «вечный онлайн»: строка просто стареет. Для админки: SELECT * FROM player_online_v WHERE is_online.'],
      ['COLUMN "player_online_v"."player_id"', 'UUID игрока (player.id).'],
      ['COLUMN "player_online_v"."is_online"', 'true, если last_seen_at моложе 60 секунд и left_at пуст или старше last_seen_at.'],
      ['COLUMN "player_online_v"."last_seen_at"', 'Когда игрока видели последний раз (player_presence.last_seen_at).'],
      ['COLUMN "player_online_v"."left_at"', 'Последний явный выход (player_presence.left_at).'],
      ['COLUMN "player_online_v"."seconds_since_seen"', 'Сколько секунд назад игрока видели, целое, на момент запроса.'],
      ['COLUMN "player_online_v"."screen"', 'Экран: menu, lobby, game или spectator.'],
      ['COLUMN "player_online_v"."room"', 'Код комнаты или пусто.'],
      ['COLUMN "player_online_v"."client_version"', 'Версия клиента.'],
      ['COLUMN "player_online_v"."platform"', 'Платформа Telegram.'],
      ['COLUMN "player_online_v"."telegram_id"', 'id в Telegram, если игрок вошёл через Telegram, иначе NULL.'],
      ['COLUMN "player_online_v"."username"', 'username в Telegram или NULL.'],
      ['COLUMN "player_online_v"."first_name"', 'Имя в Telegram или NULL.'],

      ['TABLE "online_snapshots"', 'Снимок числа онлайн раз в минуту (из player_online_v). Без Redis.'],
      ['COLUMN "online_snapshots"."count"', 'Сколько игроков были онлайн в этот момент (player_online_v.is_online).'],
    ];
    for (const [target, text] of c) {
      const safe = text.replace(/\$/g, '');
      await q.query(`COMMENT ON ${target} IS $c$${safe}$c$`);
    }
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP VIEW IF EXISTS "player_online_v"`);
    await q.query(`ALTER TABLE "player" ADD COLUMN "guest_token_hash" varchar(64)`);
    await q.query(`ALTER TABLE "player" ADD COLUMN "previous_token_hash" varchar(64)`);
    await q.query(`ALTER TABLE "player" ADD COLUMN "previous_token_at" timestamptz`);
    await q.query(`ALTER TABLE "player" ADD COLUMN "best" int NOT NULL DEFAULT 0`);
    await q.query(`ALTER TABLE "player" ADD COLUMN "campaign" jsonb NOT NULL DEFAULT '{"best":{}}'`);
    await q.query(`ALTER TABLE "player" ADD COLUMN "telegram_id" bigint`);
    await q.query(`ALTER TABLE "player" ADD COLUMN "telegram_linked_at" timestamptz`);
    await q.query(`ALTER TABLE "player" ADD COLUMN "last_finish_at" timestamptz`);
    await q.query(`ALTER TABLE "player" ADD COLUMN "window_started_at" timestamptz`);
    await q.query(`ALTER TABLE "player" ADD COLUMN "awarded_in_window" int NOT NULL DEFAULT 0`);
    await q.query(`
      UPDATE "player" p SET "guest_token_hash" = a."token_hash", "previous_token_hash" = a."previous_token_hash", "previous_token_at" = a."previous_token_at"
      FROM "player_auth" a WHERE a."player_id" = p."id"
    `);
    await q.query(`UPDATE "player" p SET "best" = s."best", "campaign" = s."campaign" FROM "player_stats" s WHERE s."player_id" = p."id"`);
    await q.query(`
      UPDATE "player" p SET "telegram_id" = t."telegram_id", "telegram_linked_at" = t."linked_at"
      FROM "player_telegram" t WHERE t."player_id" = p."id"
    `);
    await q.query(`ALTER TABLE "player" ALTER COLUMN "guest_token_hash" SET NOT NULL`);
    await q.query(`ALTER TABLE "player" ADD CONSTRAINT "player_guest_token_hash_key" UNIQUE ("guest_token_hash")`);
    await q.query(`ALTER TABLE "player" ADD CONSTRAINT "player_telegram_id_key" UNIQUE ("telegram_id")`);

    await q.query(`ALTER TABLE "player_geo" ADD COLUMN "last_seen" timestamptz NOT NULL DEFAULT now()`);
    await q.query(`UPDATE "player_geo" g SET "last_seen" = s."last_seen_at" FROM "player_presence" s WHERE s."player_id" = g."player_id"`);
    await q.query(`
      CREATE TABLE "online_now" (
        "player_id" uuid PRIMARY KEY REFERENCES "player"("id") ON DELETE CASCADE,
        "room" varchar(16) NOT NULL DEFAULT '',
        "screen" varchar(16) NOT NULL,
        "client_version" varchar(16) NOT NULL DEFAULT '',
        "platform" varchar(16) NOT NULL DEFAULT '',
        "last_seen" timestamptz NOT NULL
      )
    `);
    await q.query(`
      INSERT INTO "online_now" ("player_id", "room", "screen", "client_version", "platform", "last_seen")
      SELECT "player_id", "room", "screen", "client_version", "platform", "last_seen_at" FROM "player_presence"
      WHERE "last_seen_at" > now() - interval '60 seconds'
    `);
    await q.query(`DROP TABLE "player_presence"`);
    await q.query(`DROP TABLE "player_stats"`);
    await q.query(`DROP TABLE "player_auth"`);
    await q.query(`ALTER TABLE "player_telegram" DROP CONSTRAINT "player_telegram_telegram_id_key"`);
    await q.query(`ALTER TABLE "player_telegram" DROP COLUMN "telegram_id"`);
    await q.query(`ALTER TABLE "player_telegram" DROP COLUMN "linked_at"`);
  }
}
