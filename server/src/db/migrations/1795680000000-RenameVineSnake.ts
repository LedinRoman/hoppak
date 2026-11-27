import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameVineSnake1795680000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE public.game_translation
      SET value = CASE
            WHEN locale = 'ru' AND key = 'mob.snake' THEN 'ЗМЕЯ'
            WHEN locale = 'en' AND key = 'mob.snake' THEN 'SNAKE'
            WHEN locale = 'ru' AND key = 'death.vine' THEN 'ЗМЕЯ'
            WHEN locale = 'en' AND key = 'death.vine' THEN 'SNAKE'
            ELSE value
          END,
          default_value = CASE
            WHEN locale = 'ru' AND key = 'mob.snake' THEN 'ЗМЕЯ'
            WHEN locale = 'en' AND key = 'mob.snake' THEN 'SNAKE'
            WHEN locale = 'ru' AND key = 'death.vine' THEN 'ЗМЕЯ'
            WHEN locale = 'en' AND key = 'death.vine' THEN 'SNAKE'
            ELSE default_value
          END,
          updated_at = now()
      WHERE (key = 'mob.snake' OR key = 'death.vine')
        AND locale IN ('ru', 'en')
        AND form = ''
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE public.game_translation
      SET value = CASE
            WHEN locale = 'ru' AND key = 'mob.snake' THEN 'ЗМЕЯ-ЛИАНА'
            WHEN locale = 'en' AND key = 'mob.snake' THEN 'VINE SNAKE'
            WHEN locale = 'ru' AND key = 'death.vine' THEN 'ЛИАНА'
            WHEN locale = 'en' AND key = 'death.vine' THEN 'VINE'
            ELSE value
          END,
          default_value = CASE
            WHEN locale = 'ru' AND key = 'mob.snake' THEN 'ЗМЕЯ-ЛИАНА'
            WHEN locale = 'en' AND key = 'mob.snake' THEN 'VINE SNAKE'
            WHEN locale = 'ru' AND key = 'death.vine' THEN 'ЛИАНА'
            WHEN locale = 'en' AND key = 'death.vine' THEN 'VINE'
            ELSE default_value
          END,
          updated_at = now()
      WHERE (key = 'mob.snake' OR key = 'death.vine')
        AND locale IN ('ru', 'en')
        AND form = ''
    `);
  }
}
