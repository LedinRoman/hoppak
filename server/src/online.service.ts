import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlayerPresence } from './profile/player-presence.entity';
import { OnlineSnapshot } from './profile/online-snapshot.entity';

const TOUCH_MS = 1500;
/** At most one presence write per player per this many ms (screen/room changes and exit skip the gate). */
export const PRESENCE_WRITE_GAP_MS = 20_000;
/** Same number as in the view player_online_v: online while last_seen_at is younger. */
export const ONLINE_WINDOW_SECONDS = 60;

export type Presence = {
  playerId: string;
  room?: string;
  screen?: string;
  clientVersion?: string;
  platform?: string;
};

const SCREENS = ['menu', 'lobby', 'game', 'spectator'];

/**
 * Who is in the game right now, kept in Postgres only (table player_presence, view player_online_v).
 * "Online" is computed from last_seen_at, so a crashed process cannot leave a stuck "online" flag:
 * the row simply gets older than 60 seconds.
 */
@Injectable()
export class OnlineService {
  private lastSnap = 0;
  private readonly gate = new Map<string, { at: number; screen: string; room: string; ver?: string; plat?: string }>();

  constructor(
    @Optional() @InjectRepository(PlayerPresence) private readonly presence?: Repository<PlayerPresence>,
    @Optional() @InjectRepository(OnlineSnapshot) private readonly snaps?: Repository<OnlineSnapshot>,
  ) {}

  /** Fire-and-forget. A database error must not reach the socket loop. Throttled to one write per player per 20 s. */
  touch(p: Presence) {
    if (!p.playerId || !this.presence) return;
    const screen = SCREENS.indexOf(String(p.screen)) >= 0 ? String(p.screen) : 'menu';
    const room = String(p.room || '').slice(0, 16);
    const now = Date.now();
    const g = this.gate.get(p.playerId);
    const ver = String(p.clientVersion || '').slice(0, 16);
    const plat = String(p.platform || '').slice(0, 16);
    const fresh = (ver && ver !== g?.ver) || (plat && plat !== g?.plat);
    if (g && !fresh && now - g.at < PRESENCE_WRITE_GAP_MS && g.screen === screen && g.room === room) return;
    this.gate.set(p.playerId, { at: now, screen, room, ver: ver || g?.ver, plat: plat || g?.plat });
    if (this.gate.size > 5000) {
      for (const [k, v] of this.gate) if (now - v.at > PRESENCE_WRITE_GAP_MS * 3) this.gate.delete(k);
    }
    void this.write(p, screen, room);
  }

  /**
   * HTTP sign of life (login, profile load, client heartbeat): refreshes last_seen_at and the version/platform only.
   * It never touches screen or room, which the socket owns. Same 20 s gate per player.
   */
  ping(playerId: string, clientVersion?: string, platform?: string) {
    if (!playerId || !this.presence) return;
    const key = `http:${playerId}`;
    const now = Date.now();
    const g = this.gate.get(key);
    const ver = String(clientVersion || '').slice(0, 16);
    const plat = String(platform || '').slice(0, 16);
    const fresh = (ver && ver !== g?.ver) || (plat && plat !== g?.plat);
    if (g && !fresh && now - g.at < PRESENCE_WRITE_GAP_MS) return;
    this.gate.set(key, { at: now, screen: '', room: '', ver: ver || g?.ver, plat: plat || g?.plat });
    void this.presence.query(
      `INSERT INTO "player_presence" ("player_id", "client_version", "platform", "last_seen_at")
       VALUES ($1, $2, $3, now())
       ON CONFLICT ("player_id") DO UPDATE SET
         "client_version" = COALESCE(NULLIF(EXCLUDED."client_version", ''), "player_presence"."client_version"),
         "platform" = COALESCE(NULLIF(EXCLUDED."platform", ''), "player_presence"."platform"),
         "last_seen_at" = now()`,
      [playerId, ver, plat],
    ).catch(() => console.error('presence ping failed'));
  }

  /** The player left a room or lost the socket, but the app may still be open: back to the menu. */
  leave(playerId: string) {
    this.touch({ playerId, screen: 'menu', room: '' });
  }

  /** The player closed or backgrounded the app (client beacon on pagehide). Skips the throttle. */
  exit(playerId: string) {
    if (!playerId || !this.presence) return;
    this.gate.delete(playerId);
    this.gate.delete(`http:${playerId}`);
    void this.presence.query(
      `INSERT INTO "player_presence" ("player_id", "screen", "room", "last_seen_at", "left_at")
       VALUES ($1, 'menu', '', now(), now())
       ON CONFLICT ("player_id") DO UPDATE SET
         "screen" = 'menu', "room" = '', "last_seen_at" = now(), "left_at" = now()`,
      [playerId],
    ).catch(() => console.error('presence exit failed'));
  }

  private async write(p: Presence, screen: string, room: string) {
    const ver = String(p.clientVersion || '').slice(0, 16);
    const plat = String(p.platform || '').slice(0, 16);
    const job = (async () => {
      /* Empty version or platform must not wipe a value the client already sent. left_at stays: the view compares it with last_seen_at. */
      await this.presence!.query(
        `INSERT INTO "player_presence" ("player_id", "room", "screen", "client_version", "platform", "last_seen_at")
         VALUES ($1, $2, $3, $4, $5, now())
         ON CONFLICT ("player_id") DO UPDATE SET
           "room" = EXCLUDED."room",
           "screen" = EXCLUDED."screen",
           "client_version" = COALESCE(NULLIF(EXCLUDED."client_version", ''), "player_presence"."client_version"),
           "platform" = COALESCE(NULLIF(EXCLUDED."platform", ''), "player_presence"."platform"),
           "last_seen_at" = now()`,
        [p.playerId, room, screen, ver, plat],
      );
      const minute = Math.floor(Date.now() / 60000);
      if (this.snaps && minute !== this.lastSnap) {
        this.lastSnap = minute;
        const rows = await this.presence!.query(
          `SELECT count(*)::int AS n FROM "player_online_v" WHERE "is_online"`,
        );
        await this.snaps.save(this.snaps.create({ ts: new Date(), count: Number(rows && rows[0] && rows[0].n) || 0 }));
      }
    })();
    await Promise.race([
      job.catch(() => console.error('presence write failed')),
      new Promise((resolve) => setTimeout(resolve, TOUCH_MS)),
    ]);
  }
}
