import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

export const DEFAULT_VISUAL_CONTRAST = { bg: 80, platforms: 92, hero: 92, mobs: 88, coins: 85 };

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
