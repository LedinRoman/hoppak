import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { join } from 'path';

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL is required to run migrations');
}

/** CLI data source (`npm run migration:run` against compiled dist/). */
export default new DataSource({
  type: 'postgres',
  url,
  synchronize: false,
  migrationsRun: false,
  entities: [join(__dirname, '..', '**', '*.entity.js')],
  migrations: [join(__dirname, 'migrations', '*.js')],
});
