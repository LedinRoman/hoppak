import { Controller, Get, Header, Optional, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';

type Row = { locale: 'ru' | 'en'; key: string; form: string; value: string };

@Controller('api/translations')
export class TranslationsController {
  constructor(@Optional() private readonly db?: DataSource) {}

  @Get()
  @Header('Access-Control-Allow-Origin', '*')
  @Header('Cache-Control', 'no-store')
  async get() {
    const catalog = { ru: Object.create(null), en: Object.create(null) };
    if (!this.db) return catalog;
    let rows: Row[];
    try {
      rows = await this.db.query('SELECT locale, key, form, value FROM public.game_translation ORDER BY key, locale, form');
    } catch {
      throw new ServiceUnavailableException('Translations unavailable');
    }
    for (const { locale, key, form, value } of rows) {
      if (!form) catalog[locale][key] = value;
      else (catalog[locale][key] ??= Object.create(null))[form] = value;
    }
    return catalog;
  }
}
