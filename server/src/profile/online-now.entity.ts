import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'online_now', comment: 'Кто сейчас в игре. Строка живая, пока last_seen моложе 60 секунд. Без Redis.' })
export class OnlineNow {
  @PrimaryColumn('uuid', { name: 'player_id', comment: 'UUID игрока, первичный ключ, внешний ключ на player.id.' })
  playerId: string;

  @Column({ type: 'varchar', length: 16, default: '', comment: 'Код комнаты, если игрок в мультиплеере. Пусто вне комнаты.' })
  room: string;

  @Column({ type: 'varchar', length: 16, comment: 'Экран: lobby, game или spectator.' })
  screen: string;

  @Column({ name: 'client_version', type: 'varchar', length: 16, default: '', comment: 'Версия клиента, которую прислал сокет.' })
  clientVersion: string;

  @Column({ type: 'varchar', length: 16, default: '', comment: 'Платформа Telegram (ios, android, tdesktop, web), как прислал клиент.' })
  platform: string;

  @Column({ name: 'last_seen', type: 'timestamptz', comment: 'timestamptz последнего присутствия. Онлайн — моложе 60 секунд.' })
  lastSeen: Date;
}
