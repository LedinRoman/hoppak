import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTelegramToPlayer1795638000000 implements MigrationInterface {
  name = 'AddTelegramToPlayer1795638000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "player" ADD COLUMN "telegram_id" bigint`);
    await queryRunner.query(`ALTER TABLE "player" ADD COLUMN "telegram_linked_at" TIMESTAMPTZ`);
    await queryRunner.query(`ALTER TABLE "player" ADD CONSTRAINT "UQ_player_telegram_id" UNIQUE ("telegram_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "player" DROP CONSTRAINT "UQ_player_telegram_id"`);
    await queryRunner.query(`ALTER TABLE "player" DROP COLUMN "telegram_linked_at"`);
    await queryRunner.query(`ALTER TABLE "player" DROP COLUMN "telegram_id"`);
  }
}
