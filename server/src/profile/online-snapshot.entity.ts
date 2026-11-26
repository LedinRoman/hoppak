import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'online_snapshots', comment: 'Снимок числа онлайн раз в минуту. Без Redis.' })
export class OnlineSnapshot {
  @PrimaryGeneratedColumn({ comment: 'Порядковый номер снимка, первичный ключ.' })
  id: number;

  @Column({ type: 'timestamptz', default: () => 'now()', comment: 'timestamptz снимка.' })
  ts: Date;

  @Column({ type: 'int', comment: 'Сколько строк online_now были моложе 60 секунд в этот момент.' })
  count: number;
}
