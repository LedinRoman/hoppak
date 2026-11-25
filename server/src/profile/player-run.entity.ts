import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'player_run' })
export class PlayerRun {
  @PrimaryColumn({ name: 'player_id', type: 'uuid' })
  playerId: string;

  @PrimaryColumn({ name: 'run_id', type: 'varchar', length: 64 })
  runId: string;

  @Column({ type: 'int', default: 0 })
  awarded: number;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;
}
