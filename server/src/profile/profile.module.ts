import { DynamicModule, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Player } from './player.entity';
import { PlayerRun } from './player-run.entity';
import { PlayerTelegram } from './player-telegram.entity';
import { PlayerGeo } from './player-geo.entity';
import { RunStart } from './run-start.entity';
import { RulesPlausibility } from './rules-plausibility.entity';
import { SuspiciousRun } from './suspicious-run.entity';
import { PlayerAuth } from './player-auth.entity';
import { PlayerStats } from './player-stats.entity';
import { PlayerPresence } from './player-presence.entity';
import { OnlineSnapshot } from './online-snapshot.entity';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { OnlineService } from '../online.service';

const ENTITIES = [Player, PlayerRun, PlayerTelegram, PlayerGeo, RunStart, RulesPlausibility, SuspiciousRun, PlayerAuth, PlayerStats, PlayerPresence, OnlineSnapshot];

@Module({})
export class ProfileModule {
  static forRoot(): DynamicModule {
    const controllers = [ProfileController];
    if (!process.env.DATABASE_URL) {
      return {
        module: ProfileModule,
        controllers,
        providers: [ProfileService, OnlineService],
        exports: [ProfileService, OnlineService],
      };
    }
    return {
      module: ProfileModule,
      imports: [TypeOrmModule.forFeature(ENTITIES)],
      controllers,
      providers: [ProfileService, OnlineService],
      exports: [ProfileService, OnlineService, TypeOrmModule],
    };
  }
}
