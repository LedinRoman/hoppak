import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'suspicious_runs', comment: 'Забег, который не начислен: заявка превысила потолок правдоподобия для серверной длительности.' })
export class SuspiciousRun {
  @PrimaryGeneratedColumn('uuid', { comment: 'UUID записи, первичный ключ.' })
  id: string;

  @Column('uuid', { name: 'player_id', comment: 'UUID игрока, внешний ключ на player.id.' })
  playerId: string;

  @Column({ name: 'run_id', type: 'varchar', length: 64, comment: 'run_id забега, который отклонён.' })
  runId: string;

  @Column({ type: 'varchar', length: 16, comment: 'Карта из заявки.' })
  map: string;

  @Column({ type: 'smallint', default: 0, comment: 'Индекс героя из заявки.' })
  hero: number;

  @Column({ name: 'duration_s', type: 'int', comment: 'Длительность в секундах по серверному времени старта run_id.' })
  durationS: number;

  @Column({ name: 'claimed_coins', type: 'int', comment: 'Заявленные подобранные монеты.' })
  claimedCoins: number;

  @Column({ name: 'claimed_height', type: 'int', comment: 'Заявленная высота, метры.' })
  claimedHeight: number;

  @Column({ name: 'claimed_treasures', type: 'int', comment: 'Заявленные клады (округление bonusCoins / 25 вверх).' })
  claimedTreasures: number;

  @Column({ name: 'max_coins', type: 'int', comment: 'Потолок монет, с которым сравнивали заявку.' })
  maxCoins: number;

  @Column({ name: 'max_height', type: 'int', comment: 'Потолок высоты, метры, с которым сравнивали заявку.' })
  maxHeight: number;

  @Column({ name: 'max_treasures', type: 'int', comment: 'Потолок кладов, с которым сравнивали заявку.' })
  maxTreasures: number;

  @Column({ type: 'varchar', length: 64, comment: 'Почему не начислено: height, coins, treasures через запятую, либо NO_RUN_ID, либо NO_RUN_START.' })
  reason: string;

  @Column({ name: 'client_version', type: 'varchar', length: 16, default: '', comment: 'Версия клиента из заявки, как прислал finish. Не показывается игроку как причина.' })
  clientVersion: string;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()', comment: 'timestamptz записи отказа.' })
  createdAt: Date;
}
