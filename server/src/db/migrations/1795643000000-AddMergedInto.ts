import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMergedInto1795643000000 implements MigrationInterface {
  name = 'AddMergedInto1795643000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "player" ADD COLUMN "merged_into" uuid`);
    await queryRunner.query(`ALTER TABLE "player" ADD COLUMN "merged_at" TIMESTAMPTZ`);
    await queryRunner.query(`
      ALTER TABLE "player"
      ADD CONSTRAINT "FK_player_merged_into"
      FOREIGN KEY ("merged_into") REFERENCES "player"("id") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "player" DROP CONSTRAINT "FK_player_merged_into"`);
    await queryRunner.query(`ALTER TABLE "player" DROP COLUMN "merged_at"`);
    await queryRunner.query(`ALTER TABLE "player" DROP COLUMN "merged_into"`);
  }
}
