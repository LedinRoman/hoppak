import { MigrationInterface, QueryRunner } from 'typeorm';

/** Per-map records. Additive: a new jsonb column, dropped again on the way down. */
export class AddCampaign1795644000000 implements MigrationInterface {
  name = 'AddCampaign1795644000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "player" ADD COLUMN "campaign" jsonb NOT NULL DEFAULT '{"best":{}}'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "player" DROP COLUMN "campaign"`);
  }
}
