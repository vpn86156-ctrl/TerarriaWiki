/* Подземелья: требования по уровню, награды, уникальные предметы. */
import { getState, stats, combatPower, addGold, addXp } from '../core/state.js';
import { DUNGEONS } from '../data/dungeons.js';
import { grantDungeonLoot } from './loot.js';
import { onDungeonDone } from './quests.js';
import { rnd } from '../core/rng.js';

export function canEnter(d, gs = getState()){
  if(gs.level < d.reqLevel) return { ok:false, reason:'Нужен уровень ' + d.reqLevel };
  if(gs.hp <= 0) return { ok:false, reason:'Вы обессилены. Подождите восстановления.' };
  return { ok:true };
}

export function run(dungeonId){
  const gs = getState();
  const d = DUNGEONS.find(x => x.id === dungeonId);
  if(!d) return null;
  const gate = canEnter(d, gs);
  if(!gate.ok) return { ok:false, reason:gate.reason };

  const st = stats();
  const power = combatPower(st);
  const need = 260 * Math.pow(2.1, d.difficulty) * Math.pow(1.06, gs.level * 0.3);
  const ok = power * rnd(0.72, 1.35) >= need;

  if(!ok){
    const taken = Math.max(1, Math.round(need * 0.02 * (1 - st.dr)));
    gs.hp = Math.max(0, gs.hp - taken);
    if(gs.hp <= 0) gs.hp = st.hpMax;
    return { ok:false, dungeon:d, taken, need:Math.round(need), power:Math.round(power) };
  }

  const st2 = stats();
  const gold = Math.round(d.reward.gold * st2.goldMul * rnd(0.9, 1.15));
  const xp   = Math.round(d.reward.xp * st2.xpMul * rnd(0.9, 1.15));
  addGold(gold); addXp(xp);

  const first = !gs.dungeons[d.id];
  gs.dungeons[d.id] = { clears:(gs.dungeons[d.id]?.clears || 0) + 1, at: Date.now() };

  const item = grantDungeonLoot(d.reward.tier, gs.level, st2.luck + (first ? 0.5 : 0));
  onDungeonDone();

  return { ok:true, dungeon:d, gold, xp, item, first };
}
