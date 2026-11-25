import { DynamicModule, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

/**
 * Loads TypeORM only when DATABASE_URL is set.
 * Without it the process starts as before (rooms + health, no DB).
 */
@Module({})
export class DbModule {
  static forRoot(): DynamicModule {
    if (!process.env.DATABASE_URL) {
      return { module: DbModule };
    }
    return {
      module: DbModule,
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          url: process.env.DATABASE_URL,
          synchronize: false,
          autoLoadEntities: true,
          migrationsRun: false,
        }),
      ],
    };
  }
}
