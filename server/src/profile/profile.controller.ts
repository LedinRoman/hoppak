import { Body, Controller, Get, Headers, HttpException, HttpStatus, Optional, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ProfileService } from './profile.service';
import { accessToken, accessViaCookie, clearSessionCookie, setSessionCookie } from './auth';
import { publicBotId } from './telegram';
import { clientAddress } from './client-ip';
import { OnlineService } from '../online.service';

@Controller('api')
export class ProfileController {
  constructor(
    private readonly profiles: ProfileService,
    @Optional() private readonly online?: OnlineService,
  ) {}

  /** HTTP activity counts as "seen" (login, profile load, run start/finish). Throttled inside the service. */
  private seen(playerId: string, v?: unknown, p?: unknown) {
    this.online?.ping(playerId, v ? String(v) : '', p ? String(p) : '');
  }

  private async geo(playerId: string, req: Request) {
    const ip = clientAddress(req.headers['x-forwarded-for'], req.socket?.remoteAddress);
    await this.profiles.noteGeo(playerId, ip);
  }

  @Post('profile/guest')
  async guest(@Req() req: Request, @Headers('authorization') auth?: string) {
    const token = accessToken(req, auth);
    if (token) {
      const existing = await this.profiles.requireByToken(token);
      await this.geo(existing.id, req);
      this.seen(existing.id);
      if (accessViaCookie(req, auth)) {
        return { ok: true, profile: this.profiles.toPublic(existing), session: 'cookie' };
      }
      return { ok: true, token, profile: this.profiles.toPublic(existing) };
    }
    const created = await this.profiles.createGuest();
    await this.geo(created.profile.id, req);
    this.seen(created.profile.id);
    return { ok: true, ...created };
  }

  @Get('profile')
  async get(@Req() req: Request, @Headers('authorization') auth?: string) {
    const p = await this.profiles.requireByToken(accessToken(req, auth));
    await this.geo(p.id, req);
    this.seen(p.id);
    return { ok: true, profile: this.profiles.toPublic(p) };
  }

  /**
   * Client heartbeat (every ~25 s while the game is visible) and exit beacon (pagehide).
   * A rotated-out token gets 409 DEVICE_REPLACED here, so the first device learns about a takeover quickly.
   */
  @Post('profile/seen')
  async seenPing(
    @Req() req: Request,
    @Headers('authorization') auth?: string,
    @Body() body?: { v?: string; p?: string; exit?: boolean },
  ) {
    const p = await this.profiles.requireByToken(accessToken(req, auth));
    if (body && body.exit === true) this.online?.exit(p.id);
    else this.seen(p.id, body && body.v, body && body.p);
    return { ok: true };
  }

  @Post('profile/migrate')
  async migrate(
    @Req() req: Request,
    @Headers('authorization') auth?: string,
    @Body() body?: { purchases?: Record<string, number>; best?: number },
  ) {
    const p = await this.profiles.requireByToken(accessToken(req, auth));
    const profile = await this.profiles.migrate(p, body?.purchases, body?.best);
    return { ok: true, profile };
  }

  @Post('profile/buy')
  async buy(@Req() req: Request, @Headers('authorization') auth?: string, @Body() body?: { key?: string }) {
    const p = await this.profiles.requireByToken(accessToken(req, auth));
    const result = await this.profiles.buy(p, body?.key);
    return { ok: true, ...result };
  }

  @Post('profile/campaign')
  async campaign(
    @Req() req: Request,
    @Headers('authorization') auth?: string,
    @Body() body?: { mapBest?: Record<string, number>; open?: Record<string, number> },
  ) {
    const p = await this.profiles.requireByToken(accessToken(req, auth));
    const profile = await this.profiles.syncCampaign(p, body?.mapBest, body?.open);
    return { ok: true, profile };
  }

  @Post('run/start')
  async start(
    @Req() req: Request,
    @Headers('authorization') auth?: string,
    @Body() body?: { runId?: string; map?: string; hero?: number },
  ) {
    const p = await this.profiles.requireByToken(accessToken(req, auth));
    await this.profiles.beginRun(p, body?.runId, body?.map, body?.hero);
    this.seen(p.id);
    return { ok: true };
  }

  @Post('run/finish')
  async finish(
    @Req() req: Request,
    @Headers('authorization') auth?: string,
    @Body() body?: { height?: number; runCoins?: number; bonusCoins?: number; runId?: string; map?: string; hero?: number; ver?: string; cause?: string; mode?: string },
  ) {
    const p = await this.profiles.requireByToken(accessToken(req, auth), { allowPrevious: true });
    const result = await this.profiles.finishRun(
      p, body?.height, body?.runCoins, body?.bonusCoins, body?.runId, body?.map, body?.hero, body?.ver,
      body?.cause, body?.mode,
    );
    return { ok: true, awarded: result.awarded, profile: result.profile, limited: result.limited, duplicate: result.duplicate };
  }

  @Post('auth/telegram')
  async authTelegram(@Req() req: Request, @Headers('authorization') auth?: string, @Body() body?: { initData?: string }) {
    const result = await this.profiles.authTelegram(accessToken(req, auth), body?.initData);
    if (result.profile && result.profile.id) {
      await this.geo(result.profile.id, req);
      this.seen(result.profile.id);
    }
    return { ok: true, ...result };
  }

  /** Public bot id + username for the oauth.telegram.org redirect. Never includes the bot token. */
  @Get('auth/telegram-login')
  telegramLogin() {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const botId = botToken ? publicBotId(botToken) : null;
    if (!botId) {
      throw new HttpException({ ok: false, error: 'TELEGRAM_AUTH_UNAVAILABLE' }, HttpStatus.SERVICE_UNAVAILABLE);
    }
    const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'HoppakBot';
    return { ok: true, botId, botUsername };
  }

  /**
   * Browser Telegram Login Widget / oauth.telegram.org redirect.
   * Sets an HttpOnly + Secure + SameSite=Lax session cookie and does not return the raw token in the body.
   * Mini App login stays on POST /api/auth/telegram (Bearer in localStorage).
   */
  @Post('auth/telegram-widget')
  async authTelegramWidget(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Headers('authorization') auth?: string,
    @Body() body?: Record<string, unknown>,
  ) {
    const result = await this.profiles.authTelegramWidget(accessToken(req, auth), body);
    setSessionCookie(res, result.token);
    if (result.profile && result.profile.id) {
      await this.geo(result.profile.id, req);
      this.seen(result.profile.id);
    }
    const { token: _omit, ...rest } = result;
    return { ok: true, ...rest, session: 'cookie' };
  }

  @Post('auth/logout')
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Headers('authorization') auth?: string,
  ) {
    const token = accessToken(req, auth);
    if (token) {
      try {
        await this.profiles.revokeSession(token);
      } catch {
        /* Already invalid or profile DB off — still clear the cookie. */
      }
    }
    clearSessionCookie(res);
    return { ok: true };
  }
}
