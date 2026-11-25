import { MigrationInterface, QueryRunner } from 'typeorm';

/** Empty baseline. TypeORM will still create the `migrations` bookkeeping table. */
export class Init1795634271113 implements MigrationInterface {
  name = 'Init1795634271113';

  public async up(_queryRunner: QueryRunner): Promise<void> {
    /* no schema yet — point 0 only stands up the migrator */
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    /* no-op */
  }
}
