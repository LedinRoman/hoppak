import { MigrationInterface, QueryRunner } from 'typeorm';

export class GameSettings1795670000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE game_settings (
        key varchar(64) PRIMARY KEY,
        value jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now(),
        updated_by varchar(64) NOT NULL
      )
    `);
    await queryRunner.query(`
      INSERT INTO game_settings (key, value, updated_by)
      VALUES ('visual_contrast', '{"bg":80,"platforms":92,"hero":92,"mobs":88,"coins":85}', 'migration')
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE game_settings');
  }
}
