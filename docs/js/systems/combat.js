/* Боевая система: атака, смерть босса, ответные удары, награды. */
import { getState, stats, rollDamage, addGold, addXp, nextBoss, currentBoss } from '../core/state.js';
import { rnd, chance } from '../core/rng.js';
import { rollLoot } from './loot.js';
import { onBossKilled, onDamageDealt } from './quests.js';
import { check as checkAch } from './achievements.js';

let bossAttackTimer = 6;
let listeners = [];
export function onCombatEvent(fn){ listeners.push(fn); }
function emit(ev){ listeners.forEach(fn => { try{ fn(ev); }catch(e){} }); }

export function bossAttackPower(boss){
  /* Урон босса привязан к его порядку, а не к здоровью: иначе на поздних
     кругах он убивает игрока одним ударом и фарм невозможен. */
  return Math.max(4, Math.round(9 + boss.index * 1.15 + boss.loop * 6));
}

/** Один удар. Возвращает полный результат для UI (урон, крит, смерть, награды). */
export function attack(manual = true){
  const gs = getState();
  if(gs.hp <= 0) return { blocked:true };

  const st2 = stats();
  const boss = currentBoss();
  const { dmg, isCrit } = rollDamage(st2);

  gs.boss.hp = Math.max(0, gs.boss.hp - dmg);
  gs.totalDamage += dmg;
  gs.maxHit = Math.max(gs.maxHit, dmg);
  if(manual) gs.clicks++;

  emit({ type:'hit', dmg, isCrit, hpLeft: gs.boss.hp, maxHp: boss.maxHp });
  onDamageDealt(dmg);
  checkAch();

  if(gs.boss.hp <= 0){
    const rewards = killBoss(boss);
    emit({ type:'kill', boss, rewards });
    return { dmg, isCrit, killed:true, rewards };
  }
  return { dmg, isCrit, killed:false };
}

function killBoss(boss){
  const st = stats();
  const gs = getState();
  const goldMul = st.goldMul;
  const xpMul = st.xpMul;

  const gold = Math.round(boss.gold * goldMul * rnd(0.88, 1.2));
  const xp   = Math.round(boss.xp * xpMul * rnd(0.92, 1.1));

  addGold(gold);
  const levels = addXp(xp);

  gs.kills++;
  const item = rollLoot(boss.tier, gs.level, st.luck);

  onBossKilled(boss);
  checkAch();

  const next = nextBoss();
  bossAttackTimer = 6;

  return { gold, xp, levels, item, next, boss };
}

/** Тик боя: ответные удары босса. dt в секундах. */
export function tickCombat(dt){
  const gs = getState();
  if(gs.hp <= 0){ gs.hp = stats().hpMax; return; }

  const st0 = stats();
  if(gs.hp < st0.hpMax) gs.hp = Math.min(st0.hpMax, gs.hp + st0.regen * dt);

  bossAttackTimer -= dt;
  if(bossAttackTimer > 0) return;

  const boss = currentBoss();
  bossAttackTimer = rnd(5.5, 8.5);

  const st = stats();
  const raw = bossAttackPower(boss) * rnd(0.85, 1.18);
  const taken = Math.max(1, Math.round(raw * (1 - st.dr)));

  gs.hp = Math.max(0, gs.hp - taken);
  emit({ type:'bossHit', dmg: taken, attack: boss.attacks[Math.floor(Math.random() * boss.attacks.length)], boss });

  if(gs.hp <= 0){
    const lost = Math.round(gs.gold * 0.03);
    gs.gold = Math.max(0, gs.gold - lost);
    gs.hp = stats().hpMax;
    emit({ type:'defeat', lost });
  }
}

export function resetCombatTimer(){ bossAttackTimer = 6; }
