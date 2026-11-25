import { Body, Controller, Get, Headers, Post } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { bearerToken } from './auth';

@Controller('api')
export class ProfileController {
  constructor(private readonly profiles: ProfileService) {}

  @Post('profile/guest')
  async guest(@Headers('authorization') auth?: string) {
    const token = bearerToken(auth);
    if (token) {
      const existing = await this.profiles.findByToken(token).catch(() => null);
      if (existing) return { ok: true, token, profile: this.profiles.toPublic(existing) };
    }
    const created = await this.profiles.createGuest();
    return { ok: true, ...created };
  }

  @Get('profile')
  async get(@Headers('authorization') auth?: string) {
    const p = await this.profiles.requireByToken(bearerToken(auth));
    return { ok: true, profile: this.profiles.toPublic(p) };
  }

  @Post('profile/migrate')
  async migrate(@Headers('authorization') auth?: string, @Body() body?: { coins?: number; purchases?: Record<string, number> }) {
    const p = await this.profiles.requireByToken(bearerToken(auth));
    const profile = await this.profiles.migrate(p, body?.coins, body?.purchases);
    return { ok: true, profile };
  }

  @Post('run/finish')
  async finish(
    @Headers('authorization') auth?: string,
    @Body() body?: { height?: number; runCoins?: number; bonusCoins?: number },
  ) {
    const p = await this.profiles.requireByToken(bearerToken(auth));
    const result = await this.profiles.finishRun(p, body?.height, body?.runCoins, body?.bonusCoins);
    return { ok: true, ...result };
  }
}
