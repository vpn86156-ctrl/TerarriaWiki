/* Предметы: модификаторы, шаблоны, генерация характеристик. */
import { weighted, rnd, rndi, chance } from '../core/rng.js';
import { DROP_TABLES, RARITIES, RAR_INDEX } from './rarities.js';

/* ---- 10 модификаторов ---- */
export const MODIFIERS = [
  { id:'broken',   name:'Сломанный',        w:14, mul:0.62, stats:0 },
  { id:'worn',     name:'Изношенный',       w:16, mul:0.82, stats:0 },
  { id:'tempered', name:'Закалённый',       w:16, mul:1.12, stats:0 },
  { id:'ancient',  name:'Древний',          w:12, mul:1.30, stats:1 },
  { id:'cursed',   name:'Проклятый',        w:9,  mul:1.46, stats:1, quirk:'crit' },
  { id:'hallowed', name:'Освящённый',       w:8,  mul:1.40, stats:1, quirk:'gold' },
  { id:'godforged',name:'Скованный богами', w:6,  mul:1.62, stats:2 },
  { id:'souleater',name:'Пожиратель душ',   w:5,  mul:1.78, stats:2, quirk:'critdmg' },
  { id:'divine',   name:'Божественный',     w:3,  mul:2.05, stats:2, quirk:'all' },
  { id:'forbidden',name:'Запретный',        w:1.4,mul:2.45, stats:3, quirk:'all' }
];

/* ---- шаблоны ---- */
export const TEMPLATES = [
  { slot:'weapon',   names:['Клинок','Секира','Молот','Коса','Кинжал','Шестопёр','Меч-тень'],
    epithets:['Тьмы','Пепла','Заката','Погибели','Крови','Бездны','Мороза'],
    main:'atk',  icon:'⚔' },
  { slot:'armor',    names:['Латы','Доспех','Панцирь','Нагрудник','Мантия','Кираса'],
    epithets:['Стража','Глубин','Обсидиана','Туманов','Глухих троп','Вечного сна'],
    main:'hp',   icon:'▣' },
  { slot:'artifact', names:['Талисман','Печать','Сфера','Реликвия','Сердце','Фонарь'],
    epithets:['Мудрости','Забвения','Призраков','Древних','Разлома','Провидца'],
    main:'xp',   icon:'◈' },
  { slot:'ring',     names:['Перстень','Кольцо','Обруч','Знак'],
    epithets:['Скупца','Вора','Судьбы','Клятвы','Тени','Змеи'],
    main:'gold', icon:'○' }
];
export const SLOT_NAMES = { weapon:'Оружие', armor:'Броня', artifact:'Артефакт', ring:'Кольцо' };

/* ---- выпадение редкости ---- */
export function rollRarity(tier, luck = 0){
  const table = DROP_TABLES[Math.max(0, Math.min(DROP_TABLES.length - 1, tier))] || DROP_TABLES[0];
  const items = RARITIES.map(r => ({ id:r.id, w:Math.max(0, (table[r.id] || 0) * (1 + luck * (RAR_INDEX[r.id] * 0.34))) }));
  return weighted(items).id;
}

/* ---- модификатор: чем выше редкость, тем чаще сильные ---- */
export function rollModifier(rarityId){
  const ri = RAR_INDEX[rarityId] ?? 0;
  const pool = MODIFIERS.map(m => ({
    ...m,
    w: m.w * (1 + ri * 0.55) * (m.mul >= 1.4 ? (0.35 + ri * 0.42) : 1)
  }));
  return weighted(pool);
}

const STAT_KEYS = ['atk','crit','critdmg','speed','gold','xp','hp'];
export const STAT_LABELS = {
  atk:'Сила атаки', crit:'Шанс крита', critdmg:'Крит. урон',
  speed:'Скорость', gold:'Золото', xp:'Опыт', hp:'Защита'
};
export const STAT_SUFFIX = { atk:'', crit:'%', critdmg:'%', speed:'%', gold:'%', xp:'%', hp:'' };

/** Значение характеристики масштабируется уровнем игрока и множителем редкости. */
function statValue(key, mul, level){
  const base = 1 + level * 0.55;
  switch(key){
    case 'atk':     return Math.max(1, Math.round(base * 1.35 * mul * rnd(0.85, 1.2)));
    case 'hp':      return Math.max(1, Math.round(base * 2.1 * mul * rnd(0.85, 1.2)));
    case 'crit':    return Math.round(rnd(0.8, 2.4) * mul * 10) / 10;
    case 'critdmg': return Math.round(rnd(3, 11) * mul * 10) / 10;
    case 'speed':   return Math.round(rnd(0.6, 2.2) * mul * 10) / 10;
    case 'gold':    return Math.round(rnd(2, 7) * mul * 10) / 10;
    case 'xp':      return Math.round(rnd(2, 7) * mul * 10) / 10;
    default:        return 1;
  }
}

let uid = 0;
export function makeItem(tier, level, luck = 0, forceRarity = null){
  const rarity = forceRarity || rollRarity(tier, luck);
  const ri = RAR_INDEX[rarity] ?? 0;
  const mod = rollModifier(rarity);
  const tpl = TEMPLATES[rndi(0, TEMPLATES.length - 1)];

  const name = `${tpl.names[rndi(0, tpl.names.length - 1)]} ${tpl.epithets[rndi(0, tpl.epithets.length - 1)]}`;

  const stats = {};
  stats[tpl.main] = statValue(tpl.main, mod.mul * (1 + ri * 0.28), level);

  let extraCount = mod.stats + (ri >= 4 ? 1 : 0) + (chance(0.35 + ri * 0.08) ? 1 : 0);
  const pool = STAT_KEYS.filter(k => k !== tpl.main);
  for(let i = 0; i < extraCount && i < 3; i++){
    const key = mod.quirk === 'all' ? pool[rndi(0, pool.length - 1)]
              : mod.quirk ? ({ crit:'crit', critdmg:'critdmg', gold:'gold' }[mod.quirk] || pool[rndi(0, pool.length - 1)])
              : pool[rndi(0, pool.length - 1)];
    if(stats[key] !== undefined) continue;
    stats[key] = statValue(key, mod.mul * (1 + ri * 0.22) * 0.7, level);
  }

  const price = Math.round((28 + level * 14) * mod.mul * Math.pow(2.35, ri) * rnd(0.85, 1.25));

  return {
    uid: 'i' + (Date.now().toString(36)) + (uid++).toString(36),
    name, slot: tpl.slot, icon: tpl.icon, rarity, mod: mod.id, modName: mod.name,
    stats, price, level: Math.max(1, level),
    locked:false, equipped:false, obtainedAt: Date.now(), source: 'Добыча с босса'
  };
}

export function itemPower(it){
  let p = 0;
  for(const [k, v] of Object.entries(it.stats)){
    const w = { atk:3.2, hp:1.1, crit:6, critdmg:1.4, speed:5, gold:2.4, xp:2.4 }[k] || 1;
    p += v * w;
  }
  return Math.round(p * 10) / 10;
}
