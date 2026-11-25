import { DynamicModule, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Player } from './player.entity';
import { PlayerRun } from './player-run.entity';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';

@Module({})
export class ProfileModule {
  static forRoot(): DynamicModule {
    const controllers = [ProfileController];
    if (!process.env.DATABASE_URL) {
      return { module: ProfileModule, controllers, providers: [ProfileService] };
    }
    return {
      module: ProfileModule,
      imports: [TypeOrmModule.forFeature([Player, PlayerRun])],
      controllers,
      providers: [ProfileService],
    };
  }
}
