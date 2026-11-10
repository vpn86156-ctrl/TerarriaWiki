/* Питомцы: разные бонусы, разные редкости, прокачка за золото. */
import { RAR_BY_ID } from './rarities.js';

export const PETS = [
  {
    id:'firewolf', name:'Огненный волчонок', img:'img/pets/fire-wolf.jpg', rarity:'rare',
    bonus:{ gold:0.12 },
    desc:'Приносит удачу в золоте: рыщет по следам монет, которые другие не замечают.',
    baseCost:1200
  },
  {
    id:'icespirit', name:'Дух льда', img:'img/pets/ice-spirit.jpg', rarity:'superb',
    bonus:{ xp:0.15 },
    desc:'Впитывает холод мёртвых знаний и отдаёт хозяину опыт павших врагов.',
    baseCost:3400
  },
  {
    id:'raven', name:'Теневой ворон', img:'img/pets/shadow-raven.jpg', rarity:'epic',
    bonus:{ crit:0.04 },
    desc:'Видит слабые места раньше, чем хозяин заносит оружие.',
    baseCost:7800
  },
  {
    id:'dragon', name:'Маленький дракон', img:'img/pets/baby-dragon.jpg', rarity:'mythic',
    bonus:{ atk:0.10 },
    desc:'Дышит огнём в такт ударам. Пока мал — но уже кусается серьёзно.',
    baseCost:16000
  },
  {
    id:'astral', name:'Астральный хранитель', img:'img/pets/astral-guardian.jpg', rarity:'legendary',
    bonus:{ luck:0.35, gold:0.1 },
    desc:'Заглядывает в разлом и вытаскивает оттуда то, что должно было выпасть не вам.',
    baseCost:42000
  }
];

export const PET_BONUS_LABELS = {
  gold:'к золоту', xp:'к опыту', crit:'к шансу крита',
  atk:'к силе атаки', luck:'к шансу редкой добычи', speed:'к скорости'
};

/** Бонус питомца масштабируется его уровнем. */
export function petBonus(pet, level = 1){
  if(!pet) return {};
  const k = 1 + (level - 1) * 0.42;
  const out = {};
  for(const [key, val] of Object.entries(pet.bonus)) out[key] = val * k;
  return out;
}
export function petUpgradeCost(pet, level){
  return Math.round(pet.baseCost * Math.pow(1.85, level - 1));
}
export function petById(id){ return PETS.find(p => p.id === id) || null; }
export function petRarity(p){ return RAR_BY_ID[p.rarity] || RAR_BY_ID.common; }
