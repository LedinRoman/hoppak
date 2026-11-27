import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'player_geo', comment: 'Последний IP и страна игрока. Только хранение, интерфейс по этому полю не переводится.' })
export class PlayerGeo {
  @PrimaryColumn('uuid', { name: 'player_id', comment: 'UUID игрока, первичный ключ и внешний ключ на player.id.' })
  playerId: string;

  @Column({ name: 'last_ip', type: 'varchar', length: 64, nullable: true, comment: 'Последний IP, который видел наш прокси (правый адрес X-Forwarded-For). В API не отдаётся.' })
  lastIp: string | null;

  @Column({ type: 'varchar', length: 2, nullable: true, comment: 'Страна по офлайн-базе GeoIP, ISO 3166-1 alpha-2. NULL, если определить не удалось.' })
  country: string | null;

  @Column({ name: 'origin_language', type: 'varchar', length: 8, nullable: true, comment: 'Основной язык страны, справочно. Интерфейс по нему не локализуется.' })
  originLanguage: string | null;

  @Column({ name: 'first_seen', type: 'timestamptz', comment: 'timestamptz первого успешного определения для этого игрока. Время последнего захода — в player_presence.last_seen_at.' })
  firstSeen: Date;

}
