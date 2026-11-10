/* Добыча: шанс выпадения, редкость, модификатор, запись в инвентарь. */
import { chance, rnd } from '../core/rng.js';
import { makeItem } from '../data/items.js';
import { addItem } from './inventory.js';
import { getState } from '../core/state.js';

/* Шанс, что с босса вообще что-то выпадет, растёт с уровнем добычи. */
const DROP_CHANCE = [0.34, 0.44, 0.54, 0.66, 0.78, 0.86];

export function rollLoot(tier, level, luck = 0){
  const gs = getState();
  const t = Math.max(0, Math.min(DROP_CHANCE.length - 1, tier));
  if(!chance(DROP_CHANCE[t] + luck * 0.05)) return null;

  const item = makeItem(t, level, luck);
  addItem(item);
  gs.seen[item.rarity] = true;
  return item;
}

/** Награда подземелья: гарантированный предмет указанного уровня добычи. */
export function grantDungeonLoot(tier, level, luck = 0){
  const item = makeItem(Math.min(5, tier), level, luck + 0.35);
  addItem(item);
  getState().seen[item.rarity] = true;
  return item;
}
