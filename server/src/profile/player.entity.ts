import { BeforeInsert, Column, Entity, PrimaryColumn } from 'typeorm';
import { randomUUID } from 'crypto';

@Entity({ name: 'player' })
export class Player {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'guest_token_hash', type: 'varchar', length: 64, unique: true })
  guestTokenHash: string;

  @Column({ type: 'int', default: 0 })
  coins: number;

  @Column({ type: 'int', default: 0 })
  best: number;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  purchases: Record<string, number>;

  @Column({ name: 'migrated_at', type: 'timestamptz', nullable: true })
  migratedAt: Date | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @Column({ name: 'last_finish_at', type: 'timestamptz', nullable: true })
  lastFinishAt: Date | null;

  @Column({ name: 'window_started_at', type: 'timestamptz', nullable: true })
  windowStartedAt: Date | null;

  @Column({ name: 'awarded_in_window', type: 'int', default: 0 })
  awardedInWindow: number;

  @Column({ name: 'telegram_id', type: 'bigint', nullable: true, unique: true })
  telegramId: string | null;

  @Column({ name: 'telegram_linked_at', type: 'timestamptz', nullable: true })
  telegramLinkedAt: Date | null;

  /** Set when this guest row was folded into an existing Telegram player. Its token is revoked. */
  @Column({ name: 'merged_into', type: 'uuid', nullable: true })
  mergedInto: string | null;

  @Column({ name: 'merged_at', type: 'timestamptz', nullable: true })
  mergedAt: Date | null;

  @BeforeInsert()
  assignId() {
    if (!this.id) this.id = randomUUID();
    if (this.coins == null) this.coins = 0;
    if (this.best == null) this.best = 0;
    if (!this.purchases) this.purchases = {};
    if (this.awardedInWindow == null) this.awardedInWindow = 0;
  }
}
