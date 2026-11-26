import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Moves Telegram profile fields onto player_telegram (copy, then drop).
 * Adds player_geo, online_now, online_snapshots, rules_plausibility, suspicious_runs, run_start,
 * and the previous-session token columns. Comments are in Russian. Down copies the fields back.
 */
export class SplitTelegramGeoOnlinePlausibility1795647000000 implements MigrationInterface {
  name = 'SplitTelegramGeoOnlinePlausibility1795647000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "player" ADD COLUMN IF NOT EXISTS "previous_token_hash" varchar(64)`);
    await queryRunner.query(`ALTER TABLE "player" ADD COLUMN IF NOT EXISTS "previous_token_at" timestamptz`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "player_telegram" (
        "player_id" uuid PRIMARY KEY REFERENCES "player"("id") ON DELETE CASCADE,
        "telegram_id" bigint UNIQUE,
        "username" varchar(64),
        "first_name" varchar(128),
        "last_name" varchar(128),
        "language" varchar(16),
        "is_premium" boolean,
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      INSERT INTO "player_telegram" ("player_id", "telegram_id", "username", "first_name", "last_name", "language", "is_premium", "updated_at")
      SELECT "id", "telegram_id", "telegram_username", "telegram_first_name", "telegram_last_name", "telegram_language", "telegram_is_premium",
             COALESCE("telegram_profile_updated_at", now())
      FROM "player"
      WHERE "telegram_id" IS NOT NULL
         OR "telegram_username" IS NOT NULL
         OR "telegram_first_name" IS NOT NULL
         OR "telegram_last_name" IS NOT NULL
         OR "telegram_language" IS NOT NULL
         OR "telegram_is_premium" IS NOT NULL
      ON CONFLICT ("player_id") DO UPDATE SET
        "telegram_id" = EXCLUDED."telegram_id",
        "username" = EXCLUDED."username",
        "first_name" = EXCLUDED."first_name",
        "last_name" = EXCLUDED."last_name",
        "language" = EXCLUDED."language",
        "is_premium" = EXCLUDED."is_premium",
        "updated_at" = EXCLUDED."updated_at"
    `);
    await queryRunner.query(`ALTER TABLE "player" DROP COLUMN IF EXISTS "telegram_username"`);
    await queryRunner.query(`ALTER TABLE "player" DROP COLUMN IF EXISTS "telegram_first_name"`);
    await queryRunner.query(`ALTER TABLE "player" DROP COLUMN IF EXISTS "telegram_last_name"`);
    await queryRunner.query(`ALTER TABLE "player" DROP COLUMN IF EXISTS "telegram_language"`);
    await queryRunner.query(`ALTER TABLE "player" DROP COLUMN IF EXISTS "telegram_is_premium"`);
    await queryRunner.query(`ALTER TABLE "player" DROP COLUMN IF EXISTS "telegram_profile_updated_at"`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "player_geo" (
        "player_id" uuid PRIMARY KEY REFERENCES "player"("id") ON DELETE CASCADE,
        "last_ip" varchar(64),
        "country" varchar(2),
        "origin_language" varchar(8),
        "first_seen" timestamptz NOT NULL DEFAULT now(),
        "last_seen" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "online_now" (
        "player_id" uuid PRIMARY KEY REFERENCES "player"("id") ON DELETE CASCADE,
        "room" varchar(16) NOT NULL DEFAULT '',
        "screen" varchar(16) NOT NULL,
        "client_version" varchar(16) NOT NULL DEFAULT '',
        "platform" varchar(16) NOT NULL DEFAULT '',
        "last_seen" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "online_snapshots" (
        "id" serial PRIMARY KEY,
        "ts" timestamptz NOT NULL DEFAULT now(),
        "count" int NOT NULL
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "run_start" (
        "player_id" uuid NOT NULL REFERENCES "player"("id") ON DELETE CASCADE,
        "run_id" varchar(64) NOT NULL,
        "map" varchar(16) NOT NULL,
        "hero" smallint NOT NULL DEFAULT 0,
        "started_at" timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY ("player_id", "run_id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "rules_plausibility" (
        "map" varchar(16) NOT NULL,
        "t_seconds" int NOT NULL,
        "max_coins" int NOT NULL,
        "max_height_m" int NOT NULL,
        "max_treasures" int NOT NULL,
        "margin" numeric(4,2) NOT NULL DEFAULT 1.20,
        "version" int NOT NULL DEFAULT 1,
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY ("map", "t_seconds")
      )
    `);
    await queryRunner.query(`
      INSERT INTO "rules_plausibility" ("map", "t_seconds", "max_coins", "max_height_m", "max_treasures", "margin", "version")
      VALUES
      ('city', 30, 2035, 2119, 12, 1.20, 1),
      ('city', 60, 4069, 4238, 26, 1.20, 1),
      ('city', 120, 8136, 8475, 51, 1.20, 1),
      ('city', 180, 12204, 12712, 76, 1.20, 1),
      ('city', 300, 19200, 20000, 120, 1.20, 1),
      ('city', 600, 19200, 20000, 120, 1.20, 1),
      ('jungle', 30, 2035, 2119, 12, 1.20, 1),
      ('jungle', 60, 4069, 4238, 26, 1.20, 1),
      ('jungle', 120, 8136, 8475, 51, 1.20, 1),
      ('jungle', 180, 12204, 12712, 76, 1.20, 1),
      ('jungle', 300, 19200, 20000, 120, 1.20, 1),
      ('jungle', 600, 19200, 20000, 120, 1.20, 1),
      ('ice', 30, 2035, 2119, 12, 1.20, 1),
      ('ice', 60, 4069, 4238, 26, 1.20, 1),
      ('ice', 120, 8136, 8475, 51, 1.20, 1),
      ('ice', 180, 12204, 12712, 76, 1.20, 1),
      ('ice', 300, 19200, 20000, 120, 1.20, 1),
      ('ice', 600, 19200, 20000, 120, 1.20, 1),
      ('lava', 30, 2035, 2119, 12, 1.20, 1),
      ('lava', 60, 4069, 4238, 26, 1.20, 1),
      ('lava', 120, 8136, 8475, 51, 1.20, 1),
      ('lava', 180, 12204, 12712, 76, 1.20, 1),
      ('lava', 300, 19200, 20000, 120, 1.20, 1),
      ('lava', 600, 19200, 20000, 120, 1.20, 1),
      ('aqua', 30, 2035, 2119, 12, 1.20, 1),
      ('aqua', 60, 4069, 4238, 26, 1.20, 1),
      ('aqua', 120, 8136, 8475, 51, 1.20, 1),
      ('aqua', 180, 12204, 12712, 76, 1.20, 1),
      ('aqua', 300, 19200, 20000, 120, 1.20, 1),
      ('aqua', 600, 19200, 20000, 120, 1.20, 1),
      ('space', 30, 2035, 2119, 12, 1.20, 1),
      ('space', 60, 4069, 4238, 26, 1.20, 1),
      ('space', 120, 8136, 8475, 51, 1.20, 1),
      ('space', 180, 12204, 12712, 76, 1.20, 1),
      ('space', 300, 19200, 20000, 120, 1.20, 1),
      ('space', 600, 19200, 20000, 120, 1.20, 1)
      ON CONFLICT ("map", "t_seconds") DO NOTHING
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "suspicious_runs" (
        "id" uuid PRIMARY KEY,
        "player_id" uuid NOT NULL REFERENCES "player"("id") ON DELETE CASCADE,
        "run_id" varchar(64) NOT NULL,
        "map" varchar(16) NOT NULL,
        "hero" smallint NOT NULL DEFAULT 0,
        "duration_s" int NOT NULL,
        "claimed_coins" int NOT NULL,
        "claimed_height" int NOT NULL,
        "claimed_treasures" int NOT NULL,
        "max_coins" int NOT NULL,
        "max_height" int NOT NULL,
        "max_treasures" int NOT NULL,
        "reason" varchar(64) NOT NULL,
        "client_version" varchar(16) NOT NULL DEFAULT '',
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    const comments: Array<[string, string]> = [
      ['TABLE "player"', 'Профиль игрока: монеты, покупки, рекорды. Поля Telegram лежат в player_telegram, страна в player_geo.'],
      ['COLUMN "player"."previous_token_hash"', 'SHA-256 предыдущего bearer-токена. Им ещё можно сдать уже начатый забег. Новый вход его затирает следующим.'],
      ['COLUMN "player"."previous_token_at"', 'timestamptz, когда текущий токен стал предыдущим (вход с другого устройства).'],
      ['TABLE "player_telegram"', 'Поля профиля Telegram, отдельно от player. В публичный API не отдаются.'],
      ['COLUMN "player_telegram"."player_id"', 'UUID игрока, первичный ключ и внешний ключ на player.id.'],
      ['COLUMN "player_telegram"."telegram_id"', 'id пользователя Telegram (bigint) из проверенного initData. UNIQUE.'],
      ['COLUMN "player_telegram"."username"', 'username из проверенного initData, до 64 символов. В API не отдаётся.'],
      ['COLUMN "player_telegram"."first_name"', 'first_name из проверенного initData, до 128 символов. В API не отдаётся.'],
      ['COLUMN "player_telegram"."last_name"', 'last_name из проверенного initData, до 128 символов. В API не отдаётся.'],
      ['COLUMN "player_telegram"."language"', 'language_code из проверенного initData, до 16 символов. В API не отдаётся.'],
      ['COLUMN "player_telegram"."is_premium"', 'is_premium из проверенного initData. NULL, если поля не было. В API не отдаётся.'],
      ['COLUMN "player_telegram"."updated_at"', 'timestamptz последнего обновления строки при успешном входе, привязке или мердже.'],
      ['TABLE "player_geo"', 'Последний IP и страна игрока. Только хранение, интерфейс по этому полю не переводится.'],
      ['COLUMN "player_geo"."player_id"', 'UUID игрока, первичный ключ и внешний ключ на player.id.'],
      ['COLUMN "player_geo"."last_ip"', 'Последний IP, который видел наш прокси (правый адрес X-Forwarded-For). В API не отдаётся.'],
      ['COLUMN "player_geo"."country"', 'Страна по офлайн-базе GeoIP, ISO 3166-1 alpha-2. NULL, если определить не удалось.'],
      ['COLUMN "player_geo"."origin_language"', 'Основной язык страны, справочно. Интерфейс по нему не локализуется.'],
      ['COLUMN "player_geo"."first_seen"', 'timestamptz первого успешного определения для этого игрока.'],
      ['COLUMN "player_geo"."last_seen"', 'timestamptz последнего входа или обновления профиля, когда гео записалось.'],
      ['TABLE "online_now"', 'Кто сейчас в игре. Строка живая, пока last_seen моложе 60 секунд. Без Redis.'],
      ['COLUMN "online_now"."player_id"', 'UUID игрока, первичный ключ, внешний ключ на player.id.'],
      ['COLUMN "online_now"."room"', 'Код комнаты, если игрок в мультиплеере. Пусто вне комнаты.'],
      ['COLUMN "online_now"."screen"', 'Экран: lobby, game или spectator.'],
      ['COLUMN "online_now"."client_version"', 'Версия клиента, которую прислал сокет.'],
      ['COLUMN "online_now"."platform"', 'Платформа Telegram (ios, android, tdesktop, web), как прислал клиент.'],
      ['COLUMN "online_now"."last_seen"', 'timestamptz последнего присутствия. Онлайн — моложе 60 секунд.'],
      ['TABLE "online_snapshots"', 'Снимок числа онлайн раз в минуту. Без Redis.'],
      ['COLUMN "online_snapshots"."id"', 'Порядковый номер снимка, первичный ключ.'],
      ['COLUMN "online_snapshots"."ts"', 'timestamptz снимка.'],
      ['COLUMN "online_snapshots"."count"', 'Сколько строк online_now были моложе 60 секунд в этот момент.'],
      ['TABLE "run_start"', 'Серверное время старта забега. Длительность для правдоподобия считается от started_at, не от часов клиента.'],
      ['COLUMN "run_start"."player_id"', 'UUID игрока, часть первичного ключа, внешний ключ на player.id.'],
      ['COLUMN "run_start"."run_id"', 'Идентификатор забега с клиента, часть первичного ключа. Тот же run_id, что у player_run.'],
      ['COLUMN "run_start"."map"', 'Карта забега: city, jungle, ice, lava, aqua, space.'],
      ['COLUMN "run_start"."hero"', 'Индекс героя на старте, 0…5.'],
      ['COLUMN "run_start"."started_at"', 'timestamptz, когда сервер принял старт. Часы клиента не используются.'],
      ['TABLE "rules_plausibility"', 'Потолок честного забега: для карты и длительности максимум монет, высоты и кладов. Сервер читает таблицу.'],
      ['COLUMN "rules_plausibility"."map"', 'Карта (city, jungle, ice, lava, aqua, space).'],
      ['COLUMN "rules_plausibility"."t_seconds"', 'Верх бакета длительности, секунды. Берётся наименьший бакет, который не меньше длительности забега.'],
      ['COLUMN "rules_plausibility"."max_coins"', 'Максимум подобранных монет (не высота и не клады) за этот бакет.'],
      ['COLUMN "rules_plausibility"."max_height_m"', 'Максимум высоты, метры, за этот бакет.'],
      ['COLUMN "rules_plausibility"."max_treasures"', 'Максимум кладов (сундуков) за этот бакет. Номинал одного клада 25 монет.'],
      ['COLUMN "rules_plausibility"."margin"', 'Запас, заложенный в максимумы. 1.20 значит около 20%.'],
      ['COLUMN "rules_plausibility"."version"', 'Версия формулы, которой посчитана строка.'],
      ['COLUMN "rules_plausibility"."updated_at"', 'timestamptz последнего сида или правки строки.'],
      ['TABLE "suspicious_runs"', 'Забег, который не начислен: заявка превысила потолок правдоподобия для серверной длительности.'],
      ['COLUMN "suspicious_runs"."id"', 'UUID записи, первичный ключ.'],
      ['COLUMN "suspicious_runs"."player_id"', 'UUID игрока, внешний ключ на player.id.'],
      ['COLUMN "suspicious_runs"."run_id"', 'run_id забега, который отклонён.'],
      ['COLUMN "suspicious_runs"."map"', 'Карта из заявки.'],
      ['COLUMN "suspicious_runs"."hero"', 'Индекс героя из заявки.'],
      ['COLUMN "suspicious_runs"."duration_s"', 'Длительность в секундах по серверному времени старта run_id.'],
      ['COLUMN "suspicious_runs"."claimed_coins"', 'Заявленные подобранные монеты.'],
      ['COLUMN "suspicious_runs"."claimed_height"', 'Заявленная высота, метры.'],
      ['COLUMN "suspicious_runs"."claimed_treasures"', 'Заявленные клады (округление bonusCoins / 25 вверх).'],
      ['COLUMN "suspicious_runs"."max_coins"', 'Потолок монет, с которым сравнивали заявку.'],
      ['COLUMN "suspicious_runs"."max_height"', 'Потолок высоты, метры, с которым сравнивали заявку.'],
      ['COLUMN "suspicious_runs"."max_treasures"', 'Потолок кладов, с которым сравнивали заявку.'],
      ['COLUMN "suspicious_runs"."reason"', 'Какие поля превышены: height, coins, treasures, через запятую.'],
      ['COLUMN "suspicious_runs"."client_version"', 'Версия клиента из заявки. Игроку причина не объясняется.'],
      ['COLUMN "suspicious_runs"."created_at"', 'timestamptz записи отказа.'],
    ];
    for (const [target, text] of comments) {
      const safe = text.replace(/\$/g, '');
      await queryRunner.query(`COMMENT ON ${target} IS $c$${safe}$c$`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "player" ADD COLUMN IF NOT EXISTS "telegram_username" varchar(64)`);
    await queryRunner.query(`ALTER TABLE "player" ADD COLUMN IF NOT EXISTS "telegram_first_name" varchar(128)`);
    await queryRunner.query(`ALTER TABLE "player" ADD COLUMN IF NOT EXISTS "telegram_last_name" varchar(128)`);
    await queryRunner.query(`ALTER TABLE "player" ADD COLUMN IF NOT EXISTS "telegram_language" varchar(16)`);
    await queryRunner.query(`ALTER TABLE "player" ADD COLUMN IF NOT EXISTS "telegram_is_premium" boolean`);
    await queryRunner.query(`ALTER TABLE "player" ADD COLUMN IF NOT EXISTS "telegram_profile_updated_at" timestamptz`);
    await queryRunner.query(`
      UPDATE "player" p SET
        "telegram_username" = t."username",
        "telegram_first_name" = t."first_name",
        "telegram_last_name" = t."last_name",
        "telegram_language" = t."language",
        "telegram_is_premium" = t."is_premium",
        "telegram_profile_updated_at" = t."updated_at"
      FROM "player_telegram" t
      WHERE t."player_id" = p."id"
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "suspicious_runs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "rules_plausibility"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "run_start"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "online_snapshots"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "online_now"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "player_geo"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "player_telegram"`);
    await queryRunner.query(`ALTER TABLE "player" DROP COLUMN IF EXISTS "previous_token_at"`);
    await queryRunner.query(`ALTER TABLE "player" DROP COLUMN IF EXISTS "previous_token_hash"`);
  }
}
