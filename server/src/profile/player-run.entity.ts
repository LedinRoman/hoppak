import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'player_run', comment: 'Журнал забегов для идемпотентности POST /api/run/finish: одна запись на пару игрок + run_id.' })
export class PlayerRun {
  @PrimaryColumn({ name: 'player_id', type: 'uuid', comment: 'UUID игрока, часть первичного ключа, внешний ключ на player.id (ON DELETE CASCADE).' })
  playerId: string;

  @PrimaryColumn({ name: 'run_id', type: 'varchar', length: 64, comment: 'Идентификатор забега от клиента, varchar до 64, символы [A-Za-z0-9_.:-]. Повтор с тем же run_id не начисляет монеты снова.' })
  runId: string;

  @Column({ type: 'int', default: 0, comment: 'Сколько монет сервер начислил за этот забег (за высоту: floor(м/25) начиная с 100 м, плюс runCoins и bonusCoins). Целое.' })
  awarded: number;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()', comment: 'timestamptz создания записи, по умолчанию now().' })
  createdAt: Date;
}
