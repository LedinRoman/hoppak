import { Controller, Get, Module } from '@nestjs/common';
import { GameGateway } from './game.gateway';
import { RoomsService, stats } from './rooms.service';

@Controller('api')
export class HealthController {
  constructor(private readonly rooms: RoomsService) {}
  @Get('health')
  health() {
    return {
      ok: true, rooms: this.rooms.rooms.size,
      players: [...this.rooms.rooms.values()].reduce((n, r) => n + r.players.length, 0),
      uptime: Math.round(process.uptime()), stats,
    };
  }
}

@Module({ controllers: [HealthController], providers: [RoomsService, GameGateway] })
export class AppModule {}
