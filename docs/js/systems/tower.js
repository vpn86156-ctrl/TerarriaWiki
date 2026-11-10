/* Бесконечная башня: каждый этаж сложнее, прогресс сохраняется. */
import { getState, stats, addGold, addXp } from '../core/state.js';
import { rnd } from '../core/rng.js';
import { rollLoot } from './loot.js';

export function floorPower(floor){
  return Math.round(180 * Math.pow(1.28, floor - 1));
}
export function floorReward(floor){
  return {
    gold: Math.round(90 * Math.pow(1.24, floor - 1)),
    xp:   Math.round(70 * Math.pow(1.22, floor - 1))
  };
}

/** Попытка пройти этаж. Успех зависит от силы игрока и защиты. */
export function climb(){
  const gs = getState();
  const st = stats();
  const floor = gs.tower.floor;
  const need = floorPower(floor);

  const power = st.power * (1 + st.crit * (st.critDmg - 1)) * 14;
  const survived = power * rnd(0.78, 1.3) >= need;

  if(!survived){
    const taken = Math.max(1, Math.round(need * 0.012 * (1 - st.dr)));
    gs.hp = Math.max(0, gs.hp - taken);
    if(gs.hp <= 0) gs.hp = st.hpMax;
    return { ok:false, floor, need, power:Math.round(power), taken };
  }

  const reward = floorReward(floor);
  const st2 = stats();
  const gold = Math.round(reward.gold * st2.goldMul);
  const xp   = Math.round(reward.xp * st2.xpMul);
  addGold(gold); addXp(xp);

  gs.tower.floor = floor + 1;
  gs.tower.best = Math.max(gs.tower.best, gs.tower.floor);

  const item = rollLoot(Math.min(5, Math.floor(floor / 12)), gs.level, st2.luck + 0.15);

  return { ok:true, floor, gold, xp, item, next: gs.tower.floor };
}
