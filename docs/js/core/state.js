/* Единое игровое состояние, производные характеристики и формулы прогресса. */
import { bossAt, BOSS_COUNT } from '../data/bosses.js';
import { petById, petBonus } from '../data/pets.js';

export const SAVE_VERSION = 1;

/* ---------- улучшения ---------- */
export const UPGRADES = [
  { id:'weapon', name:'Оружие',        icon:'⚔', base:60,  mul:1.52, desc:'×1.16 к силе атаки за уровень' },
  { id:'attack', name:'Сила атаки',    icon:'✦', base:95,  mul:1.55, desc:'×1.11 к силе атаки за уровень' },
  { id:'crit',   name:'Шанс крита',    icon:'✧', base:310, mul:1.62, desc:'+0.8% к шансу критического удара' },
  { id:'critdmg',name:'Крит. урон',    icon:'☠', base:240, mul:1.64, desc:'+8% к множителю критического урона' },
  { id:'speed',  name:'Скорость',      icon:'⏵', base:280, mul:1.60, desc:'+7% к скорости клика' },
  { id:'auto',   name:'Авто-атака',    icon:'∞', base:520, mul:1.85, desc:'×1.35 к скорости авто-атаки' },
  { id:'defense',name:'Защита',        icon:'▣', base:190, mul:1.55, desc:'+6 к защите и +6 к максимуму здоровья' },
  { id:'gold',   name:'Бонус золота',  icon:'◈', base:210, mul:1.58, desc:'+8% к получаемому золоту' },
  { id:'xp',     name:'Бонус опыта',   icon:'◉', base:230, mul:1.58, desc:'+6% к получаемому опыту' }
];
export const UPG_BY_ID = Object.fromEntries(UPGRADES.map(u => [u.id, u]));
export const upgradeCost = (u, lvl) => Math.round(u.base * Math.pow(u.mul, lvl));

/* ---------- состояние по умолчанию ---------- */
export function defaults(){
  return {
    v: SAVE_VERSION,
    nick: 'Охотник',
    createdAt: Date.now(),
    level: 1, xp: 0, gold: 120,
    upg: {},
    inv: [],
    equip: { weapon:null, armor:null, artifact:null, ring:null },
    pets: [],
    activePet: null,
    boss: { index:0, hp:0, maxHp:0 },
    loop: 0,
    bossKills: 0, kills: 0, clicks: 0,
    totalDamage: 0, maxHit: 0,
    hp: 100,
    tower: { floor:1, best:1 },
    dungeons: {},
    quests: { date:'', list:[], claimed:[] },
    ach: {},
    seen: {},
    settings: { sound:true, ambience:false }
  };
}

let S = defaults();
export const getState = () => S;
export function setState(next){ S = next; }
export function resetState(){ S = defaults(); }

/* ---------- опыт ---------- */
export const xpToNext = lvl => Math.round(58 * Math.pow(lvl, 2.15));

/* ---------- снаряжение и питомец ---------- */
function equippedStats(){
  const out = { atk:0, hp:0, crit:0, critdmg:0, speed:0, gold:0, xp:0 };
  for(const uid of Object.values(S.equip)){
    if(!uid) continue;
    const it = S.inv.find(i => i.uid === uid);
    if(!it) continue;
    for(const [k, v] of Object.entries(it.stats)) out[k] = (out[k] || 0) + v;
  }
  return out;
}
export function activePetData(){
  const pet = petById(S.activePet);
  if(!pet) return null;
  const owned = S.pets.find(p => p.id === pet.id);
  return { ...pet, level: owned?.level || 1 };
}

/* ---------- производные характеристики ---------- */
export function stats(){
  const lvl = k => S.upg[k] || 0;
  const eq = equippedStats();
  const pet = activePetData();
  const pb = pet ? petBonus(pet, pet.level) : {};

  /* Сила растёт мультипликативно — иначе аддитивные бонусы не успевают
     за экспоненциальным здоровьем боссов и прогресс встаёт. */
  const baseAtk = 8 + (eq.atk || 0);
  const flatAtk = baseAtk * Math.pow(1.16, lvl('weapon')) * Math.pow(1.11, lvl('attack'));
  const petAtk = pb.atk || 0;

  const crit     = Math.min(0.92, 0.05 + lvl('crit') * 0.008 + (eq.crit || 0) / 100 + (pb.crit || 0));
  const critDmg  = 1.5 + lvl('critdmg') * 0.08 + (eq.critdmg || 0) / 100;
  const speedPct = lvl('speed') * 0.07 + (eq.speed || 0) / 100;
  const autoLvl  = lvl('auto');
  const defense  = lvl('defense') * 6 + (eq.hp || 0) * 0.5;

  return {
    power: Math.round(flatAtk * (1 + petAtk) * 10) / 10,
    crit, critDmg: Math.round(critDmg * 100) / 100,
    clickInterval: Math.max(0.09, 0.5 / (1 + speedPct)),
    autoInterval: autoLvl > 0 ? Math.max(0.16, 2.4 / Math.pow(1.35, autoLvl)) : 0,
    autoLvl,
    defense,
    dr: defense / (defense + 160),
    goldMul: 1 + lvl('gold') * 0.08 + (eq.gold || 0) / 100 + (pb.gold || 0),
    xpMul:   1 + lvl('xp')   * 0.06 + (eq.xp   || 0) / 100 + (pb.xp   || 0),
    luck: pb.luck || 0,
    hpMax: 100 + lvl('defense') * 6,
    regen: (100 + lvl('defense') * 6) * 0.03
  };
}

/** Боевая мощь — единая метрика для подземелий, башни и сравнения с боссом. */
export function combatPower(st = stats()){
  return st.power * (1 + st.crit * (st.critDmg - 1)) * 15;
}

/* ---------- урон: единая формула ---------- */
export function rollDamage(st = stats()){
  const isCrit = Math.random() < st.crit;
  const variance = 0.88 + Math.random() * 0.24;
  const dmg = Math.max(1, Math.round(st.power * variance * (isCrit ? st.critDmg : 1)));
  return { dmg, isCrit };
}

/* ---------- прогресс ---------- */
export function addGold(n){
  S.gold = Math.max(0, Math.round(S.gold + n));
  if(n > 0){ S.stats_goldEarned = (S.stats_goldEarned || 0) + n; }
}
export function spendGold(n){
  if(S.gold < n) return false;
  S.gold -= n;
  return true;
}
export function addXp(n){
  S.xp += n;
  let levels = 0;
  while(S.xp >= xpToNext(S.level)){
    S.xp -= xpToNext(S.level);
    S.level++;
    levels++;
    S.hp = stats().hpMax;
  }
  return levels;
}

/* ---------- босс ---------- */
export function currentBoss(){
  const b = bossAt(S.boss.index, S.loop);
  if(!S.boss.maxHp || S.boss.maxHp !== b.maxHp){
    S.boss.maxHp = b.maxHp;
    if(!S.boss.hp) S.boss.hp = b.maxHp;
  }
  return b;
}
export function nextBoss(){
  S.boss.index++;
  S.bossKills++;
  if(S.boss.index % BOSS_COUNT === 0) S.loop++;
  const b = bossAt(S.boss.index, S.loop);
  S.boss.maxHp = b.maxHp;
  S.boss.hp = b.maxHp;
  return b;
}
