import { Column, Entity, Index, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';
import { Player } from './player.entity';

@Entity({ name: 'player_auth', comment: 'Сессия игрока: хеш текущего токена и хеш предыдущего (смена устройства). Один к одному с player. Сами токены в БД не хранятся.' })
export class PlayerAuth {
  @PrimaryColumn('uuid', { name: 'player_id', comment: 'UUID игрока, первичный ключ и внешний ключ на player.id (ON DELETE CASCADE).' })
  playerId: string;

  @OneToOne(() => Player, (p) => p.auth, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'player_id' })
  player?: Player;

  @Column({ name: 'token_hash', type: 'varchar', length: 64, unique: true, comment: 'SHA-256 (hex, 64 символа) от текущего bearer-токена сессии (32 случайных байта в hex). UNIQUE. Сам токен в БД не хранится.' })
  tokenHash: string;

  @Column({ name: 'token_issued_at', type: 'timestamptz', default: () => 'now()', comment: 'timestamptz выдачи текущего токена: создание игрока или последний вход с другого устройства.' })
  tokenIssuedAt: Date;

  @Index('player_auth_previous_token_hash_idx')
  @Column({ name: 'previous_token_hash', type: 'varchar', length: 64, nullable: true, comment: 'SHA-256 предыдущего bearer-токена. Им ещё можно сдать уже начатый забег; остальные запросы получают SESSION_REPLACED. Новый вход затирает его следующим.' })
  previousTokenHash: string | null;

  @Column({ name: 'previous_token_at', type: 'timestamptz', nullable: true, comment: 'timestamptz, когда текущий токен стал предыдущим (вход с другого устройства).' })
  previousTokenAt: Date | null;
}
