import { Body, Controller, Get, Headers, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ProfileService } from './profile.service';
import { bearerToken } from './auth';
import { clientAddress } from './client-ip';

@Controller('api')
export class ProfileController {
  constructor(private readonly profiles: ProfileService) {}

  private async geo(playerId: string, req: Request) {
    const ip = clientAddress(req.headers['x-forwarded-for'], req.socket?.remoteAddress);
    await this.profiles.noteGeo(playerId, ip);
  }

  @Post('profile/guest')
  async guest(@Req() req: Request, @Headers('authorization') auth?: string) {
    const token = bearerToken(auth);
    if (token) {
      const existing = await this.profiles.findByToken(token).catch(() => null);
      if (existing) {
        await this.geo(existing.id, req);
        return { ok: true, token, profile: this.profiles.toPublic(existing) };
      }
    }
    const created = await this.profiles.createGuest();
    await this.geo(created.profile.id, req);
    return { ok: true, ...created };
  }

  @Get('profile')
  async get(@Req() req: Request, @Headers('authorization') auth?: string) {
    const p = await this.profiles.requireByToken(bearerToken(auth));
    await this.geo(p.id, req);
    return { ok: true, profile: this.profiles.toPublic(p) };
  }

  @Post('profile/migrate')
  async migrate(
    @Headers('authorization') auth?: string,
    @Body() body?: { coins?: number; purchases?: Record<string, number>; best?: number },
  ) {
    const p = await this.profiles.requireByToken(bearerToken(auth));
    const profile = await this.profiles.migrate(p, body?.coins, body?.purchases, body?.best);
    return { ok: true, profile };
  }

  @Post('profile/buy')
  async buy(@Headers('authorization') auth?: string, @Body() body?: { key?: string }) {
    const p = await this.profiles.requireByToken(bearerToken(auth));
    const result = await this.profiles.buy(p, body?.key);
    return { ok: true, ...result };
  }

  @Post('profile/campaign')
  async campaign(
    @Headers('authorization') auth?: string,
    @Body() body?: { mapBest?: Record<string, number>; open?: Record<string, number> },
  ) {
    const p = await this.profiles.requireByToken(bearerToken(auth));
    const profile = await this.profiles.syncCampaign(p, body?.mapBest, body?.open);
    return { ok: true, profile };
  }

  @Post('run/start')
  async start(
    @Headers('authorization') auth?: string,
    @Body() body?: { runId?: string; map?: string; hero?: number },
  ) {
    const p = await this.profiles.requireByToken(bearerToken(auth));
    await this.profiles.beginRun(p, body?.runId, body?.map, body?.hero);
    return { ok: true };
  }

  @Post('run/finish')
  async finish(
    @Headers('authorization') auth?: string,
    @Body() body?: { height?: number; runCoins?: number; bonusCoins?: number; runId?: string; map?: string; hero?: number; ver?: string },
  ) {
    const p = await this.profiles.requireByToken(bearerToken(auth), { allowPrevious: true });
    const result = await this.profiles.finishRun(
      p, body?.height, body?.runCoins, body?.bonusCoins, body?.runId, body?.map, body?.hero, body?.ver,
    );
    return { ok: true, awarded: result.awarded, profile: result.profile, limited: result.limited, duplicate: result.duplicate };
  }

  @Post('auth/telegram')
  async authTelegram(@Req() req: Request, @Headers('authorization') auth?: string, @Body() body?: { initData?: string }) {
    const result = await this.profiles.authTelegram(bearerToken(auth), body?.initData);
    if (result.profile && result.profile.id) await this.geo(result.profile.id, req);
    return { ok: true, ...result };
  }
}
