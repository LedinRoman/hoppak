import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';
import { Player } from './player.entity';

@Entity({ name: 'player_stats', comment: 'Рекорды игрока: общий лучший результат и рекорды по картам. Один к одному с player. Монеты и покупки лежат в player.' })
export class PlayerStats {
  @PrimaryColumn('uuid', { name: 'player_id', comment: 'UUID игрока, первичный ключ и внешний ключ на player.id (ON DELETE CASCADE).' })
  playerId: string;

  @OneToOne(() => Player, (p) => p.stats, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'player_id' })
  player?: Player;

  @Column({ type: 'int', default: 0, comment: 'Лучшая высота забега, метры, целое 0…20000. Максимум из finishRun, миграции сейва и campaign.best.' })
  best: number;

  /** Per-map records. Opens stay in player.purchases (`map:*`). Coins are not stored here. */
  @Column({ type: 'jsonb', default: () => `'{"best":{}}'`, comment: 'JSONB вида {"best":{карта:метры}}. Рекорды по картам, 1…20000 м. Монеты и открытия карт не хранит. Обновляется finishRun и POST /api/profile/campaign; при мердже берётся максимум по карте.' })
  campaign: { best: Record<string, number> };

  /** Bumped on a server-side campaign reset. A client with a lower epoch cannot raise records from an old local save. */
  @Column({ name: 'campaign_epoch', type: 'int', default: 0, comment: 'Эпоха сброса рекордов. 0 у новых игроков. После сброса сервер поднимает значение; POST /api/profile/campaign с меньшим epoch не поднимает рекорды из старого локального сейва.' })
  campaignEpoch: number;
}
