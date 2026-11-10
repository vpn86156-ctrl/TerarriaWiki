/* Ежедневные задания: генерируются на текущую дату, прогресс пишется в состояние. */
import { getState, addGold, addXp } from '../core/state.js';
import { pick, rndi } from '../core/rng.js';

const TYPES = [
  { kind:'damage',   label:'Нанести урона',        goal:l => Math.round(600 * Math.pow(1.9, l/12)),        reward:l => ({ gold: Math.round(180*Math.pow(1.7,l/10)), xp: Math.round(120*Math.pow(1.6,l/10)) }) },
  { kind:'bosses',   label:'Победить боссов',      goal:l => rndi(3, 7) + Math.floor(l/8),                 reward:l => ({ gold: Math.round(240*Math.pow(1.7,l/10)), xp: Math.round(160*Math.pow(1.6,l/10)) }) },
  { kind:'attacks',  label:'Совершить атак',       goal:l => rndi(30, 70) + Math.floor(l/3),               reward:l => ({ gold: Math.round(150*Math.pow(1.7,l/10)), xp: Math.round(110*Math.pow(1.6,l/10)) }) },
  { kind:'items',    label:'Получить предметов',   goal:l => rndi(2, 5),                                   reward:l => ({ gold: Math.round(300*Math.pow(1.7,l/10)), xp: Math.round(190*Math.pow(1.6,l/10)) }) },
  { kind:'upgrade',  label:'Купить улучшений',     goal:l => rndi(2, 5),                                   reward:l => ({ gold: Math.round(200*Math.pow(1.7,l/10)), xp: Math.round(140*Math.pow(1.6,l/10)) }) },
  { kind:'dungeon',  label:'Пройти подземелий',    goal:l => rndi(1, 3),                                   reward:l => ({ gold: Math.round(420*Math.pow(1.7,l/10)), xp: Math.round(260*Math.pow(1.6,l/10)) }) }
];

const today = () => new Date().toISOString().slice(0, 10);

export function ensureDaily(){
  const gs = getState();
  const d = today();
  if(gs.quests.date === d && gs.quests.list?.length) return gs.quests.list;

  const chosen = [];
  const pool = TYPES.slice();
  for(let i = 0; i < 3 && pool.length; i++){
    const idx = Math.floor(Math.random() * pool.length);
    chosen.push(pool.splice(idx, 1)[0]);
  }
  gs.quests = {
    date: d,
    list: chosen.map((t, i) => ({
      id: d + '_' + i,
      kind: t.kind, label: t.label,
      goal: t.goal(gs.level),
      progress: 0,
      reward: t.reward(gs.level)
    })),
    claimed: []
  };
  return gs.quests.list;
}

function bump(kind, amount = 1){
  const gs = getState();
  ensureDaily();
  let changed = false;
  for(const q of gs.quests.list){
    if(q.kind !== kind) continue;
    if(q.progress < q.goal){
      q.progress = Math.min(q.goal, q.progress + amount);
      changed = true;
    }
  }
  return changed;
}

export const onDamageDealt = dmg => bump('damage', dmg);
export const onBossKilled  = ()  => bump('bosses', 1);
export const onItemGot     = ()  => bump('items', 1);
export const onUpgrade     = ()  => bump('upgrade', 1);
export const onDungeonDone = ()  => bump('dungeon', 1);
export const onAttack      = ()  => bump('attacks', 1);

export function readyCount(){
  const gs = getState();
  ensureDaily();
  return gs.quests.list.filter(q => q.progress >= q.goal && !gs.quests.claimed.includes(q.id)).length;
}

export function claim(qid){
  const gs = getState();
  const q = gs.quests.list.find(x => x.id === qid);
  if(!q || q.progress < q.goal || gs.quests.claimed.includes(qid)) return null;
  gs.quests.claimed.push(qid);
  addGold(q.reward.gold);
  addXp(q.reward.xp);
  return q.reward;
}
