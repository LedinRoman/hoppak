import { Column, Entity, Index, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';
import { Player } from './player.entity';

@Entity({
  name: 'player_presence',
  comment: 'Присутствие игрока: когда видели последний раз, выходил ли он, где сидит и с какой версии. Один к одному с player. «Онлайн сейчас» считает view player_online_v по last_seen_at, без Redis и без чистки.',
})
export class PlayerPresence {
  @PrimaryColumn('uuid', { name: 'player_id', comment: 'UUID игрока, первичный ключ и внешний ключ на player.id (ON DELETE CASCADE).' })
  playerId: string;

  @OneToOne(() => Player, (p) => p.presence, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'player_id' })
  player?: Player;

  @Column({ name: 'first_seen_at', type: 'timestamptz', default: () => 'now()', comment: 'timestamptz первого появления игрока в игре.' })
  firstSeenAt: Date;

  @Index('player_presence_last_seen_at_idx')
  @Column({ name: 'last_seen_at', type: 'timestamptz', default: () => 'now()', comment: 'timestamptz последнего признака жизни: вход, пульс клиента раз в ~25 с, активность в сокете, выход. Пишется не чаще раза в 20 с на игрока. Онлайн — моложе 60 секунд.' })
  lastSeenAt: Date;

  @Column({ name: 'left_at', type: 'timestamptz', nullable: true, comment: 'timestamptz последнего явного выхода (закрыл или свернул игру). Игрок вне сети, пока left_at не старше last_seen_at. Любой следующий пульс снова делает его онлайн.' })
  leftAt: Date | null;

  @Column({ type: 'varchar', length: 16, default: 'menu', comment: 'Экран: menu (меню), lobby (комната до старта), game (идёт забег) или spectator (наблюдатель).' })
  screen: string;

  @Column({ type: 'varchar', length: 16, default: '', comment: 'Код комнаты, если игрок в мультиплеере. Пусто вне комнаты.' })
  room: string;

  @Column({ name: 'client_version', type: 'varchar', length: 16, default: '', comment: 'Версия клиента, которую прислал браузер или сокет. Пустое значение не затирает прежнее.' })
  clientVersion: string;

  @Column({ type: 'varchar', length: 16, default: '', comment: 'Платформа Telegram (ios, android, tdesktop, web), как прислал клиент. Пустое значение не затирает прежнее.' })
  platform: string;
}
