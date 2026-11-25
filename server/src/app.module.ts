import { Controller, Get, Module } from '@nestjs/common';
import { BlueGreenModule } from './bluegreen/bluegreen.module';
import { BlueGreenService } from './bluegreen/bluegreen.service';
import { GameGateway } from './game.gateway';
import { RoomsService, stats } from './rooms.service';

@Controller('api')
export class HealthController {
  constructor(
    private readonly rooms: RoomsService,
    private readonly bg: BlueGreenService,
  ) {}
  @Get('health')
  health() {
    return {
      ok: true, rooms: this.rooms.rooms.size,
      players: [...this.rooms.rooms.values()].reduce((n, r) => n + r.players.length, 0),
      uptime: Math.round(process.uptime()), stats,
      ...this.bg.healthFields(),
    };
  }
}

@Module({
  imports: [BlueGreenModule],
  controllers: [HealthController],
  providers: [RoomsService, GameGateway],
})
export class AppModule {}
