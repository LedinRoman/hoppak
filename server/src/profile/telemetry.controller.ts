import { BadRequestException, Controller, Get, Header, Headers, Optional, Query, ServiceUnavailableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { requireAdmin } from '../admin/admin-auth';
import { PlayerRun } from './player-run.entity';

const DAY_MS = 86_400_000;

function utcDate(value: unknown): string {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(value);
    if (value.slice(0, 4) !== '0000' && Number.isFinite(+date) && date.toISOString().slice(0, 10) === value) return value;
  }
  throw new BadRequestException({ ok: false, error: 'INVALID_DATE_RANGE' });
}

@Controller('api/admin')
export class TelemetryController {
  constructor(@Optional() @InjectRepository(PlayerRun) private readonly runs?: Repository<PlayerRun>) {}

  @Get('telemetry')
  @Header('Cache-Control', 'no-store')
  async telemetry(@Headers('authorization') auth?: string, @Query('from') from?: string, @Query('to') to?: string) {
    requireAdmin(auth);
    const end = utcDate(to ?? new Date().toISOString().slice(0, 10));
    const start = utcDate(from ?? new Date(Date.parse(end) - 6 * DAY_MS).toISOString().slice(0, 10));
    if (start > end) throw new BadRequestException({ ok: false, error: 'INVALID_DATE_RANGE' });
    if (!this.runs) throw new ServiceUnavailableException({ ok: false, error: 'PROFILE_UNAVAILABLE' });

    const [report] = await this.runs.query(`
      WITH selected AS (
        SELECT (finished_at AT TIME ZONE 'UTC')::date AS day, height_m, cause, hero
        FROM player_run
        WHERE finished_at >= ($1::date::timestamp AT TIME ZONE 'UTC')
          AND finished_at < (($2::date + 1)::timestamp AT TIME ZONE 'UTC')
      ), days AS (
        SELECT day AS date, COUNT(*) AS runs, AVG(height_m) AS "avgHeight"
        FROM selected GROUP BY day
      ), causes AS (
        SELECT cause, COUNT(*) AS n FROM selected WHERE cause IS NOT NULL GROUP BY cause
      ), heroes AS (
        SELECT hero, COUNT(*) AS n, ROUND(100::numeric * COUNT(*) / SUM(COUNT(*)) OVER (), 2) AS pct
        FROM selected WHERE hero IS NOT NULL GROUP BY hero
      )
      SELECT
        COALESCE((SELECT json_agg(days ORDER BY date) FROM days), '[]'::json) AS days,
        COALESCE((SELECT json_agg(causes ORDER BY n DESC, cause) FROM causes), '[]'::json) AS causes,
        COALESCE((SELECT json_agg(heroes ORDER BY hero) FROM heroes), '[]'::json) AS heroes
    `, [start, end]);
    return report;
  }
}
