import { MigrationInterface, QueryRunner } from 'typeorm';

export class RunTelemetry1795660000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE player_run
        ADD COLUMN height_m int,
        ADD COLUMN cause varchar(32),
        ADD COLUMN map varchar(16),
        ADD COLUMN hero smallint,
        ADD COLUMN mode varchar(8),
        ADD COLUMN duration_s int,
        ADD COLUMN client_version varchar(16),
        ADD COLUMN finished_at timestamptz
    `);
    await queryRunner.query('CREATE INDEX player_run_finished_at_idx ON player_run (finished_at) WHERE finished_at IS NOT NULL');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX player_run_finished_at_idx');
    await queryRunner.query(`
      ALTER TABLE player_run
        DROP COLUMN height_m,
        DROP COLUMN cause,
        DROP COLUMN map,
        DROP COLUMN hero,
        DROP COLUMN mode,
        DROP COLUMN duration_s,
        DROP COLUMN client_version,
        DROP COLUMN finished_at
    `);
  }
}
