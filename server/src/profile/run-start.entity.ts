import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'run_start', comment: 'Серверное время старта забега. Длительность для правдоподобия считается от started_at, не от часов клиента.' })
export class RunStart {
  @PrimaryColumn('uuid', { name: 'player_id', comment: 'UUID игрока, часть первичного ключа, внешний ключ на player.id.' })
  playerId: string;

  @PrimaryColumn({ name: 'run_id', type: 'varchar', length: 64, comment: 'Идентификатор забега с клиента, часть первичного ключа. Тот же run_id, что у player_run.' })
  runId: string;

  @Column({ type: 'varchar', length: 16, comment: 'Карта забега: city, jungle, ice, lava, aqua, space.' })
  map: string;

  @Column({ type: 'smallint', default: 0, comment: 'Индекс героя на старте, 0…5.' })
  hero: number;

  @Column({ name: 'started_at', type: 'timestamptz', default: () => 'now()', comment: 'timestamptz, когда сервер принял старт. Часы клиента не используются.' })
  startedAt: Date;
}
