import { BadRequestException, Body, Controller, Get, Header, Headers, Optional, Put, ServiceUnavailableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DEFAULT_VISUAL_CONTRAST, GameSetting } from '../db/game-setting.entity';
import { requireAdmin } from './admin-auth';

const KEY = 'visual_contrast';
const fields = Object.keys(DEFAULT_VISUAL_CONTRAST) as (keyof typeof DEFAULT_VISUAL_CONTRAST)[];

@Controller('api')
export class VisualConfigController {
  constructor(@Optional() @InjectRepository(GameSetting) private readonly settings?: Repository<GameSetting>) {}

  @Get('config/visual')
  @Header('Cache-Control', 'public, max-age=60')
  async getVisual() {
    const row = await this.settings?.findOneBy({ key: KEY });
    return row?.value ?? DEFAULT_VISUAL_CONTRAST;
  }

  @Put('admin/config/visual')
  @Header('Cache-Control', 'no-store')
  async putVisual(@Headers('authorization') auth?: string, @Body() body?: Record<string, unknown>) {
    requireAdmin(auth);
    const value = { ...DEFAULT_VISUAL_CONTRAST };
    for (const field of fields) {
      const input = body?.[field];
      if (typeof input !== 'number' || !Number.isInteger(input) || input < 50 || input > 110) {
        throw new BadRequestException({ ok: false, error: 'INVALID_CONTRAST', field });
      }
      value[field] = input;
    }
    if (!this.settings) throw new ServiceUnavailableException({ ok: false, error: 'PROFILE_UNAVAILABLE' });
    await this.settings.upsert({ key: KEY, value, updatedBy: 'admin' }, ['key']);
    return value;
  }
}
