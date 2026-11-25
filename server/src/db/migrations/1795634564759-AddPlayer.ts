import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPlayer1795634564759 implements MigrationInterface {
  name = 'AddPlayer1795634564759';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "player" (
        "id" uuid NOT NULL,
        "guest_token_hash" character varying(64) NOT NULL,
        "coins" integer NOT NULL DEFAULT 0,
        "purchases" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "migrated_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "last_finish_at" TIMESTAMPTZ,
        "window_started_at" TIMESTAMPTZ,
        "awarded_in_window" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_player" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_player_guest_token_hash" UNIQUE ("guest_token_hash")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "player"`);
  }
}
