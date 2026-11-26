import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'rules_plausibility', comment: 'Потолок честного забега: для карты и длительности максимум монет, высоты и кладов. Сервер читает таблицу, в коде числа не зашиты как источник правды.' })
export class RulesPlausibility {
  @PrimaryColumn({ type: 'varchar', length: 16, comment: 'Карта (city, jungle, ice, lava, aqua, space) или * если строки карты нет.' })
  map: string;

  @PrimaryColumn({ name: 't_seconds', type: 'int', comment: 'Верх бакета длительности, секунды. Берётся наименьший бакет, который не меньше длительности забега.' })
  tSeconds: number;

  @Column({ name: 'max_coins', type: 'int', comment: 'Максимум подобранных монет (не высота и не клады) за этот бакет.' })
  maxCoins: number;

  @Column({ name: 'max_height_m', type: 'int', comment: 'Максимум высоты, метры, за этот бакет.' })
  maxHeightM: number;

  @Column({ name: 'max_treasures', type: 'int', comment: 'Максимум кладов (сундуков) за этот бакет. Номинал одного клада 25 монет.' })
  maxTreasures: number;

  @Column({ type: 'numeric', precision: 4, scale: 2, default: 1.2, comment: 'Запас, заложенный в максимумы. 1.20 значит около 20%.' })
  margin: string;

  @Column({ type: 'int', default: 1, comment: 'Версия формулы, которой посчитана строка.' })
  version: number;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()', comment: 'timestamptz последнего сида или правки строки.' })
  updatedAt: Date;
}
