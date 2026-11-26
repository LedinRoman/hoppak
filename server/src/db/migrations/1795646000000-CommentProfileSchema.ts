import { MigrationInterface, QueryRunner } from 'typeorm';

/** Only COMMENT ON TABLE/COLUMN. Idempotent; does not change data or schema. */
export class CommentProfileSchema1795646000000 implements MigrationInterface {
  name = 'CommentProfileSchema1795646000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`COMMENT ON TABLE "migrations" IS $c$Служебная таблица TypeORM: список уже применённых миграций этой БД.$c$`);
    await queryRunner.query(`COMMENT ON TABLE "player" IS $c$Профиль игрока (гость или аккаунт Telegram): монеты, покупки, рекорды и поля Telegram для админки.$c$`);
    await queryRunner.query(`COMMENT ON TABLE "player_run" IS $c$Журнал забегов для идемпотентности POST /api/run/finish: одна запись на пару игрок + run_id.$c$`);
    await queryRunner.query(`COMMENT ON COLUMN "migrations"."id" IS $c$Порядковый номер записи (serial integer, первичный ключ). Ставит TypeORM.$c$`);
    await queryRunner.query(`COMMENT ON COLUMN "migrations"."timestamp" IS $c$Метка миграции (bigint), как в имени файла и класса миграции.$c$`);
    await queryRunner.query(`COMMENT ON COLUMN "migrations"."name" IS $c$Имя класса миграции (varchar), например AddTelegramProfile1795645000000.$c$`);
    await queryRunner.query(`COMMENT ON COLUMN "player"."id" IS $c$UUID игрока, первичный ключ. Сервер задаёт uuid v4 при создании строки.$c$`);
    await queryRunner.query(`COMMENT ON COLUMN "player"."guest_token_hash" IS $c$SHA-256 (hex, 64 символа) от bearer-токена сессии (32 случайных байта в hex). Сам токен в БД не хранится.$c$`);
    await queryRunner.query(`COMMENT ON COLUMN "player"."coins" IS $c$Баланс монет на сервере, целое ≥ 0. Начисляется за забеги и разовую миграцию локального сейва (вход до 8000), списывается в POST /api/profile/buy.$c$`);
    await queryRunner.query(`COMMENT ON COLUMN "player"."best" IS $c$Лучшая высота забега, метры, целое 0…20000. Максимум из finishRun, миграции сейва и campaign.best.$c$`);
    await queryRunner.query(`COMMENT ON COLUMN "player"."purchases" IS $c$JSONB купленных предметов. Ключи hero:/char:/map:, значение 1. Открытия карт хранятся здесь, не в campaign. Пишется buy(), мерджем и миграцией сейва (карты из сейва не импортируются).$c$`);
    await queryRunner.query(`COMMENT ON COLUMN "player"."campaign" IS $c$JSONB вида {"best":{карта:метры}}. Рекорды по картам, 1…20000 м. Монеты и открытия карт не хранит. Обновляется finishRun и POST /api/profile/campaign; при мердже берётся максимум по карте.$c$`);
    await queryRunner.query(`COMMENT ON COLUMN "player"."migrated_at" IS $c$timestamptz одноразовой миграции локального сейва (POST /api/profile/migrate). NULL, если ещё не было. Повтор не меняет данные.$c$`);
    await queryRunner.query(`COMMENT ON COLUMN "player"."created_at" IS $c$timestamptz создания строки, по умолчанию now().$c$`);
    await queryRunner.query(`COMMENT ON COLUMN "player"."last_finish_at" IS $c$timestamptz; колонка осталась от прежнего интервала между finishRun. Текущий код её не обновляет.$c$`);
    await queryRunner.query(`COMMENT ON COLUMN "player"."window_started_at" IS $c$timestamptz начала часового окна лимита наград. Текущий код не обновляет: часовой лимит снят.$c$`);
    await queryRunner.query(`COMMENT ON COLUMN "player"."awarded_in_window" IS $c$Сколько монет начислено в том часовом окне, целое, по умолчанию 0. Текущий код не обновляет: часовой лимит снят.$c$`);
    await queryRunner.query(`COMMENT ON COLUMN "player"."telegram_id" IS $c$id пользователя Telegram (bigint) из уже проверенного initData.user.id. UNIQUE, у гостя NULL.$c$`);
    await queryRunner.query(`COMMENT ON COLUMN "player"."telegram_linked_at" IS $c$timestamptz первой привязки этой строки к telegram_id.$c$`);
    await queryRunner.query(`COMMENT ON COLUMN "player"."merged_into" IS $c$UUID игрока, в которого слили эту гостевую строку. Токен строки при слиянии отзывается.$c$`);
    await queryRunner.query(`COMMENT ON COLUMN "player"."merged_at" IS $c$timestamptz слияния гостя в существующий Telegram-профиль.$c$`);
    await queryRunner.query(`COMMENT ON COLUMN "player"."telegram_username" IS $c$username из проверенного initData.user, до 64 символов. Обновляется при каждом успешном TG-логине, привязке или мердже. Только для админки, в API не отдаётся.$c$`);
    await queryRunner.query(`COMMENT ON COLUMN "player"."telegram_first_name" IS $c$first_name из проверенного initData, до 128 символов. Обновляется при каждом успешном TG-входе. В API не отдаётся.$c$`);
    await queryRunner.query(`COMMENT ON COLUMN "player"."telegram_last_name" IS $c$last_name из проверенного initData, до 128 символов. Обновляется при каждом успешном TG-входе. В API не отдаётся.$c$`);
    await queryRunner.query(`COMMENT ON COLUMN "player"."telegram_language" IS $c$language_code из проверенного initData, до 16 символов. Обновляется при каждом успешном TG-входе. В API не отдаётся.$c$`);
    await queryRunner.query(`COMMENT ON COLUMN "player"."telegram_is_premium" IS $c$is_premium из проверенного initData (boolean или NULL, если поля не было). Обновляется при каждом успешном TG-входе. В API не отдаётся.$c$`);
    await queryRunner.query(`COMMENT ON COLUMN "player"."telegram_profile_updated_at" IS $c$timestamptz последнего обновления telegram_* полей при успешном TG-логине, привязке или мердже.$c$`);
    await queryRunner.query(`COMMENT ON COLUMN "player_run"."player_id" IS $c$UUID игрока, часть первичного ключа, внешний ключ на player.id (ON DELETE CASCADE).$c$`);
    await queryRunner.query(`COMMENT ON COLUMN "player_run"."run_id" IS $c$Идентификатор забега от клиента, varchar до 64, символы [A-Za-z0-9_.:-]. Повтор с тем же run_id не начисляет монеты снова.$c$`);
    await queryRunner.query(`COMMENT ON COLUMN "player_run"."awarded" IS $c$Сколько монет сервер начислил за этот забег (за высоту: floor(м/25) начиная с 100 м, плюс runCoins и bonusCoins). Целое.$c$`);
    await queryRunner.query(`COMMENT ON COLUMN "player_run"."created_at" IS $c$timestamptz создания записи, по умолчанию now().$c$`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`COMMENT ON COLUMN "player_run"."created_at" IS NULL`);
    await queryRunner.query(`COMMENT ON COLUMN "player_run"."awarded" IS NULL`);
    await queryRunner.query(`COMMENT ON COLUMN "player_run"."run_id" IS NULL`);
    await queryRunner.query(`COMMENT ON COLUMN "player_run"."player_id" IS NULL`);
    await queryRunner.query(`COMMENT ON COLUMN "player"."telegram_profile_updated_at" IS NULL`);
    await queryRunner.query(`COMMENT ON COLUMN "player"."telegram_is_premium" IS NULL`);
    await queryRunner.query(`COMMENT ON COLUMN "player"."telegram_language" IS NULL`);
    await queryRunner.query(`COMMENT ON COLUMN "player"."telegram_last_name" IS NULL`);
    await queryRunner.query(`COMMENT ON COLUMN "player"."telegram_first_name" IS NULL`);
    await queryRunner.query(`COMMENT ON COLUMN "player"."telegram_username" IS NULL`);
    await queryRunner.query(`COMMENT ON COLUMN "player"."merged_at" IS NULL`);
    await queryRunner.query(`COMMENT ON COLUMN "player"."merged_into" IS NULL`);
    await queryRunner.query(`COMMENT ON COLUMN "player"."telegram_linked_at" IS NULL`);
    await queryRunner.query(`COMMENT ON COLUMN "player"."telegram_id" IS NULL`);
    await queryRunner.query(`COMMENT ON COLUMN "player"."awarded_in_window" IS NULL`);
    await queryRunner.query(`COMMENT ON COLUMN "player"."window_started_at" IS NULL`);
    await queryRunner.query(`COMMENT ON COLUMN "player"."last_finish_at" IS NULL`);
    await queryRunner.query(`COMMENT ON COLUMN "player"."created_at" IS NULL`);
    await queryRunner.query(`COMMENT ON COLUMN "player"."migrated_at" IS NULL`);
    await queryRunner.query(`COMMENT ON COLUMN "player"."campaign" IS NULL`);
    await queryRunner.query(`COMMENT ON COLUMN "player"."purchases" IS NULL`);
    await queryRunner.query(`COMMENT ON COLUMN "player"."best" IS NULL`);
    await queryRunner.query(`COMMENT ON COLUMN "player"."coins" IS NULL`);
    await queryRunner.query(`COMMENT ON COLUMN "player"."guest_token_hash" IS NULL`);
    await queryRunner.query(`COMMENT ON COLUMN "player"."id" IS NULL`);
    await queryRunner.query(`COMMENT ON COLUMN "migrations"."name" IS NULL`);
    await queryRunner.query(`COMMENT ON COLUMN "migrations"."timestamp" IS NULL`);
    await queryRunner.query(`COMMENT ON COLUMN "migrations"."id" IS NULL`);
    await queryRunner.query(`COMMENT ON TABLE "player_run" IS NULL`);
    await queryRunner.query(`COMMENT ON TABLE "player" IS NULL`);
    await queryRunner.query(`COMMENT ON TABLE "migrations" IS NULL`);
  }
}
