import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';
import { Player } from './player.entity';

@Entity({ name: 'player_telegram', comment: 'Привязка к Telegram: id пользователя (единственное место, где он хранится) и поля профиля из initData. Один к одному с player; строки нет у гостя. Ключ входа — telegram_id.' })
export class PlayerTelegram {
  @PrimaryColumn('uuid', { name: 'player_id', comment: 'UUID игрока, первичный ключ и внешний ключ на player.id.' })
  playerId: string;

  @OneToOne(() => Player, (p) => p.tg, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'player_id' })
  player?: Player;

  @Column({ name: 'telegram_id', type: 'bigint', unique: true, comment: 'id пользователя Telegram (bigint) из проверенного initData.user.id. UNIQUE, NOT NULL. Нигде больше не хранится.' })
  telegramId: string;

  @Column({ name: 'linked_at', type: 'timestamptz', default: () => 'now()', comment: 'timestamptz первой привязки игрока к этому telegram_id.' })
  linkedAt: Date;

  @Column({ type: 'varchar', length: 64, nullable: true, comment: 'username из проверенного initData, до 64 символов. Обновляется при каждом успешном входе. В API не отдаётся.' })
  username: string | null;

  @Column({ name: 'first_name', type: 'varchar', length: 128, nullable: true, comment: 'first_name из проверенного initData, до 128 символов. В API не отдаётся.' })
  firstName: string | null;

  @Column({ name: 'last_name', type: 'varchar', length: 128, nullable: true, comment: 'last_name из проверенного initData, до 128 символов. В API не отдаётся.' })
  lastName: string | null;

  @Column({ type: 'varchar', length: 16, nullable: true, comment: 'language_code из проверенного initData, до 16 символов. В API не отдаётся.' })
  language: string | null;

  @Column({ name: 'is_premium', type: 'boolean', nullable: true, comment: 'is_premium из проверенного initData. NULL, если поля не было. В API не отдаётся.' })
  isPremium: boolean | null;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()', comment: 'timestamptz последнего обновления строки при успешном входе, привязке или мердже.' })
  updatedAt: Date;
}
