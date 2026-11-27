import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'online_snapshots', comment: 'Снимок числа онлайн раз в минуту (из player_online_v). Без Redis.' })
export class OnlineSnapshot {
  @PrimaryGeneratedColumn({ comment: 'Порядковый номер снимка, первичный ключ.' })
  id: number;

  @Column({ type: 'timestamptz', default: () => 'now()', comment: 'timestamptz снимка.' })
  ts: Date;

  @Column({ type: 'int', comment: 'Сколько игроков были онлайн в этот момент (player_online_v.is_online).' })
  count: number;
}
