import { MigrationInterface, QueryRunner } from 'typeorm';

/** Sonya Knyazeva (@knnyazzzevaa) — her campaign was not reset, so her epoch stays 0. */
const SONYA_PLAYER_ID = '01297000-3afa-48ba-a491-6de9665a0afb';

export class CampaignEpochAndMapAvailable1795700000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE player_stats
        ADD COLUMN IF NOT EXISTS campaign_epoch integer NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN player_stats.campaign_epoch IS
        'Эпоха сброса рекордов. 0 у новых игроков. После сброса сервер поднимает значение; POST /api/profile/campaign с меньшим epoch не поднимает рекорды из старого локального сейва.'
    `);
    await queryRunner.query(`
      UPDATE player_stats
         SET campaign_epoch = 1
       WHERE player_id IS DISTINCT FROM '${SONYA_PLAYER_ID}'
    `);
    await queryRunner.query(`
      UPDATE public.game_translation
         SET value = CASE
               WHEN locale = 'ru' THEN 'ДОСТУПНА НОВАЯ КАРТА'
               WHEN locale = 'en' THEN 'NEW MAP AVAILABLE'
               ELSE value
             END,
             default_value = CASE
               WHEN locale = 'ru' THEN 'ДОСТУПНА НОВАЯ КАРТА'
               WHEN locale = 'en' THEN 'NEW MAP AVAILABLE'
               ELSE default_value
             END,
             updated_at = now()
       WHERE key = 'results.map_available'
         AND locale IN ('ru', 'en')
         AND form = ''
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE public.game_translation
         SET value = CASE
               WHEN locale = 'ru' THEN '{name}: МОЖНО ОТКРЫТЬ'
               WHEN locale = 'en' THEN '{name}: CAN UNLOCK'
               ELSE value
             END,
             default_value = CASE
               WHEN locale = 'ru' THEN '{name}: МОЖНО ОТКРЫТЬ'
               WHEN locale = 'en' THEN '{name}: CAN UNLOCK'
               ELSE default_value
             END,
             updated_at = now()
       WHERE key = 'results.map_available'
         AND locale IN ('ru', 'en')
         AND form = ''
    `);
    await queryRunner.query(`
      ALTER TABLE player_stats
        DROP COLUMN IF EXISTS campaign_epoch
    `);
  }
}
