import { MigrationInterface, QueryRunner } from 'typeorm';

/* Widens the existing player_run.mode column (varchar(8), nullable, values
 * solo/squad/online) to varchar(32) NOT NULL and backfills EVERY existing row
 * to 'not_available'. This is not an additive expand: old profile images that
 * still write NULL or assume varchar(8) will fail. Rollback is a DB dump, same
 * as 1795647000000…9000000. Down() only drops the index / NOT NULL / default;
 * it does not restore previous values or shrink the type. */
export class PlayerRunMode1795690000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE player_run ALTER COLUMN mode TYPE varchar(32)`);
    /* Every row that already exists predates this vocabulary. */
    await queryRunner.query(`UPDATE player_run SET mode = 'not_available'`);
    await queryRunner.query(`ALTER TABLE player_run ALTER COLUMN mode SET DEFAULT 'solo'`);
    await queryRunner.query(`ALTER TABLE player_run ALTER COLUMN mode SET NOT NULL`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS player_run_mode_idx ON player_run (mode)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS player_run_mode_idx`);
    await queryRunner.query(`ALTER TABLE player_run ALTER COLUMN mode DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE player_run ALTER COLUMN mode DROP DEFAULT`);
  }
}
