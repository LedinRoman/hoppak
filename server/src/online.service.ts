import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OnlineNow } from './profile/online-now.entity';
import { OnlineSnapshot } from './profile/online-snapshot.entity';

const TOUCH_MS = 1500;

export type Presence = {
  playerId: string;
  room?: string;
  screen?: string;
  clientVersion?: string;
  platform?: string;
};

@Injectable()
export class OnlineService {
  private lastSnap = 0;

  constructor(
    @Optional() @InjectRepository(OnlineNow) private readonly now?: Repository<OnlineNow>,
    @Optional() @InjectRepository(OnlineSnapshot) private readonly snaps?: Repository<OnlineSnapshot>,
  ) {}

  /** Fire-and-forget. A database error must not reach the socket loop. */
  touch(p: Presence) {
    void this.write(p);
  }

  leave(playerId: string) {
    if (!playerId || !this.now) return;
    void this.now.delete({ playerId }).catch(() => console.error('online leave failed'));
  }

  private async write(p: Presence) {
    if (!p.playerId || !this.now) return;
    const screen = p.screen === 'game' || p.screen === 'spectator' || p.screen === 'lobby' ? p.screen : 'lobby';
    const job = (async () => {
      const row = this.now!.create({
        playerId: p.playerId,
        room: String(p.room || '').slice(0, 16),
        screen,
        clientVersion: String(p.clientVersion || '').slice(0, 16),
        platform: String(p.platform || '').slice(0, 16),
        lastSeen: new Date(),
      });
      await this.now!.save(row);
      await this.now!.createQueryBuilder().delete()
        .where("last_seen < now() - interval '60 seconds'").execute();
      const minute = Math.floor(Date.now() / 60000);
      if (this.snaps && minute !== this.lastSnap) {
        this.lastSnap = minute;
        const n = await this.now!.createQueryBuilder().where("last_seen >= now() - interval '60 seconds'").getCount();
        await this.snaps.save(this.snaps.create({ ts: new Date(), count: n }));
      }
    })();
    await Promise.race([
      job.catch(() => console.error('online write failed')),
      new Promise((resolve) => setTimeout(resolve, TOUCH_MS)),
    ]);
  }
}
