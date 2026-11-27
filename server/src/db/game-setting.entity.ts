import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

export const DEFAULT_VISUAL_CONTRAST = { bg: 73, platforms: 85, hero: 87, mobs: 83, coins: 78, shield: 89 };

@Entity({ name: 'game_settings' })
export class GameSetting {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  key: string;

  @Column({ type: 'jsonb' })
  value: typeof DEFAULT_VISUAL_CONTRAST;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @Column({ name: 'updated_by', type: 'varchar', length: 64 })
  updatedBy: string;
}
