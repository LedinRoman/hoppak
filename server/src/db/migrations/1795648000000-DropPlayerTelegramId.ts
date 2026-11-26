import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Login stays on player.telegram_id. player_telegram.telegram_id was a duplicate.
 * Down copies it back from player. Comments on the remaining columns stay.
 */
export class DropPlayerTelegramId1795648000000 implements MigrationInterface {
  name = 'DropPlayerTelegramId1795648000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "player_telegram" DROP COLUMN IF EXISTS "telegram_id"`);
    const comments: Array<[string, string]> = [
      ['TABLE "player_telegram"', 'Поля профиля Telegram, отдельно от player. В публичный API не отдаются. Ключ входа — player.telegram_id.'],
      ['COLUMN "player_telegram"."player_id"', 'UUID игрока, первичный ключ и внешний ключ на player.id.'],
      ['COLUMN "player_telegram"."username"', 'username из проверенного initData, до 64 символов. В API не отдаётся.'],
      ['COLUMN "player_telegram"."first_name"', 'first_name из проверенного initData, до 128 символов. В API не отдаётся.'],
      ['COLUMN "player_telegram"."last_name"', 'last_name из проверенного initData, до 128 символов. В API не отдаётся.'],
      ['COLUMN "player_telegram"."language"', 'language_code из проверенного initData, до 16 символов. В API не отдаётся.'],
      ['COLUMN "player_telegram"."is_premium"', 'is_premium из проверенного initData. NULL, если поля не было. В API не отдаётся.'],
      ['COLUMN "player_telegram"."updated_at"', 'timestamptz последнего обновления строки при успешном входе, привязке или мердже.'],
      ['COLUMN "suspicious_runs"."reason"', 'Почему не начислено: height, coins, treasures через запятую, либо NO_RUN_ID, либо NO_RUN_START.'],
    ];
    for (const [target, text] of comments) {
      const safe = text.replace(/\$/g, '');
      await queryRunner.query(`COMMENT ON ${target} IS $c$${safe}$c$`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "player_telegram" ADD COLUMN IF NOT EXISTS "telegram_id" bigint`);
    await queryRunner.query(`
      UPDATE "player_telegram" t SET "telegram_id" = p."telegram_id"
      FROM "player" p
      WHERE p."id" = t."player_id" AND t."telegram_id" IS NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "player_telegram_telegram_id_key" ON "player_telegram" ("telegram_id")
    `);
    await queryRunner.query(
      `COMMENT ON COLUMN "player_telegram"."telegram_id" IS $c$id пользователя Telegram (bigint) из проверенного initData. UNIQUE.$c$`,
    );
  }
}
