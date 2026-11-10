/* Боссы. У каждого — собственный образ, палитра, характер и награда. */
export const BOSSES = [
  {
    id:'stone', name:'ГРААЛ', title:'Каменный страж первых руин', category:'Каменные гиганты',
    img:'img/bosses/stone-giant.jpg', rgb:'201,164,106', tier:0,
    hp:280, gold:34, xp:22,
    lore:'Его разбудили раскопки в глубинах первых руин. Он не зол — он просто охраняет то, что забыли боги.',
    attacks:['Замах глыбой','Камнепад','Дробящий шаг']
  },
  {
    id:'demon', name:'ВАРГОТ', title:'Рогатый вестник пепла', category:'Демоны',
    img:'img/bosses/demon.jpg', rgb:'194,59,76', tier:1,
    hp:1450, gold:150, xp:96,
    lore:'Пришёл через трещину в алтаре, которую сами же монахи и прорубили. Каждое убийство делает трещину шире.',
    attacks:['Коготь пепла','Ожог цепью','Взмах крыла']
  },
  {
    id:'dragon', name:'НЕССАР', title:'Дракон застывшего неба', category:'Драконы',
    img:'img/bosses/dragon.jpg', rgb:'211,69,91', tier:2,
    hp:9200, gold:640, xp:410,
    lore:'Спит на вершине, где воздух уже не греет. Просыпается, только когда кто-то поднимается достаточно высоко.',
    attacks:['Огненное дыхание','Удар хвостом','Крушение с небес']
  },
  {
    id:'lich', name:'АРМАРИС', title:'Король за гранью короны', category:'Магические короли',
    img:'img/bosses/lich-king.jpg', rgb:'117,70,168', tier:3,
    hp:58000, gold:2900, xp:1750,
    lore:'Правил справедливо. Потом нашёл способ не умирать — и перестал понимать, зачем править справедливо.',
    attacks:['Рунический разряд','Корона молчания','Погребальный клинок']
  },
  {
    id:'cosmic', name:'ЗУЛЬ-НЕТ', title:'То, что смотрит из разлома', category:'Космические существа',
    img:'img/bosses/cosmic.jpg', rgb:'162,118,216', tier:4,
    hp:410000, gold:14500, xp:9200,
    lore:'Оно не приходит и не уходит. Оно просто находится там, где пространство тоньше всего — и смотрит.',
    attacks:['Разрыв пространства','Астральное кольцо','Сдвиг реальности']
  }
];

/** Масштабирование: каждый круг (loop) прохождения всех боссов усиливает их. */
export function bossAt(index, loop = 0){
  const b = BOSSES[index % BOSSES.length];
  const tierBoost = Math.floor(index / BOSSES.length);
  const k = Math.pow(2.3, loop) * Math.pow(1.55, tierBoost);
  return {
    ...b,
    loop, index,
    maxHp: Math.round(b.hp * k),
    gold:  Math.round(b.gold * Math.pow(1.85, loop) * Math.pow(1.5, tierBoost)),
    xp:    Math.round(b.xp * Math.pow(1.7, loop) * Math.pow(1.45, tierBoost)),
    tier:  Math.min(5, b.tier + loop + tierBoost),
    level: 1 + index * 3 + loop * BOSSES.length * 3
  };
}
export const BOSS_COUNT = BOSSES.length;
