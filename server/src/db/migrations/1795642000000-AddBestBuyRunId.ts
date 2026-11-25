import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBestBuyRunId1795642000000 implements MigrationInterface {
  name = 'AddBestBuyRunId1795642000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "player" ADD COLUMN "best" integer NOT NULL DEFAULT 0`);
    await queryRunner.query(`
      CREATE TABLE "player_run" (
        "player_id" uuid NOT NULL,
        "run_id" character varying(64) NOT NULL,
        "awarded" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_player_run" PRIMARY KEY ("player_id", "run_id"),
        CONSTRAINT "FK_player_run_player" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "player_run"`);
    await queryRunner.query(`ALTER TABLE "player" DROP COLUMN "best"`);
  }
}
