import { MigrationInterface, QueryRunner } from 'typeorm';

/** Telegram profile fields for admin. Additive only; existing rows stay unchanged. */
export class AddTelegramProfile1795645000000 implements MigrationInterface {
  name = 'AddTelegramProfile1795645000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "player" ADD COLUMN IF NOT EXISTS "telegram_username" varchar(64)`,
    );
    await queryRunner.query(
      `ALTER TABLE "player" ADD COLUMN IF NOT EXISTS "telegram_first_name" varchar(128)`,
    );
    await queryRunner.query(
      `ALTER TABLE "player" ADD COLUMN IF NOT EXISTS "telegram_last_name" varchar(128)`,
    );
    await queryRunner.query(
      `ALTER TABLE "player" ADD COLUMN IF NOT EXISTS "telegram_language" varchar(16)`,
    );
    await queryRunner.query(
      `ALTER TABLE "player" ADD COLUMN IF NOT EXISTS "telegram_is_premium" boolean`,
    );
    await queryRunner.query(
      `ALTER TABLE "player" ADD COLUMN IF NOT EXISTS "telegram_profile_updated_at" TIMESTAMPTZ`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "player" DROP COLUMN IF EXISTS "telegram_profile_updated_at"`,
    );
    await queryRunner.query(`ALTER TABLE "player" DROP COLUMN IF EXISTS "telegram_is_premium"`);
    await queryRunner.query(`ALTER TABLE "player" DROP COLUMN IF EXISTS "telegram_language"`);
    await queryRunner.query(`ALTER TABLE "player" DROP COLUMN IF EXISTS "telegram_last_name"`);
    await queryRunner.query(`ALTER TABLE "player" DROP COLUMN IF EXISTS "telegram_first_name"`);
    await queryRunner.query(`ALTER TABLE "player" DROP COLUMN IF EXISTS "telegram_username"`);
  }
}
