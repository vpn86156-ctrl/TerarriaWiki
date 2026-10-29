/* Всё содержимое игры «Заброшка»: локации, враги, оружие, магазин и подсказки туториала. */

export const TILE = 16;

export const LOCATIONS = [
  {
    id: 'basement',
    name: 'ЗАБРОШЕННЫЙ ПОДВАЛ',
    short: 'ПОДВАЛ',
    intro: 'Сырой бетон, ржавые трубы и запах сырости. Здесь кто-то живёт — и он не рад гостям.',
    palette: {
      floor: ['#2b2b33', '#242430', '#1e1e28', '#31313b'],
      wall: '#4a4a58',
      wallTop: '#5c5c6c',
      shadow: '#12121a',
      accent: '#c9a227',
      torch: '#ffb347',
      fog: '#0b0b12',
      blood: '#6d1420',
      props: ['#7a5a3a', '#5d432b'],
    },
    levels: 3,
    enemies: ['rat', 'zombie', 'zombie', 'zombie'],
    density: 1,
    boss: {
      id: 'caretaker',
      name: 'СМОТРИТЕЛЬ',
      subtitle: 'Хранитель подвала',
      health: 46,
      speed: 46,
      damage: 2,
      scale: 1.5,
      palette: ['#8d6b4a', '#5c4530', '#2b2019'],
      attacks: ['charge', 'summon', 'slam'],
      reward: 120,
    },
  },
  {
    id: 'hospital',
    name: 'ЗАБРОШЕННАЯ БОЛЬНИЦА',
    short: 'БОЛЬНИЦА',
    intro: 'Коридоры в трещинах, каталки у стен, таблички на дверях. Тишина здесь не пустая.',
    palette: {
      floor: ['#2f3b3d', '#273437', '#1e2a2c', '#374547'],
      wall: '#4d6165',
      wallTop: '#5f7679',
      shadow: '#0e1618',
      accent: '#7ce0d0',
      torch: '#9ff2ff',
      fog: '#080f10',
      blood: '#6d1420',
      props: ['#8d9a9c', '#5f6b6d'],
    },
    levels: 3,
    enemies: ['zombie', 'skeleton', 'nurse', 'skeleton'],
    density: 1.25,
    boss: {
      id: 'surgeon',
      name: 'ГЛАВВРАЧ',
      subtitle: 'Он всё ещё принимает',
      health: 74,
      speed: 52,
      damage: 2,
      scale: 1.6,
      palette: ['#cfe6e4', '#7fa8a5', '#2c3c3c'],
      attacks: ['syringe', 'summon', 'slam'],
      reward: 180,
    },
  },
  {
    id: 'factory',
    name: 'ЗАБРОШЕННЫЙ ЗАВОД',
    short: 'ЗАВОД',
    intro: 'Цех, конвейер, искры под потолком. Металл скрипит так, будто станки вот-вот снова запустятся.',
    palette: {
      floor: ['#33302b', '#2b2823', '#221f1b', '#3c3833'],
      wall: '#5a5148',
      wallTop: '#6e6357',
      shadow: '#141210',
      accent: '#ff8c42',
      torch: '#ffd166',
      fog: '#0d0b09',
      blood: '#6d1420',
      props: ['#6b6259', '#4a4340'],
    },
    levels: 4,
    enemies: ['skeleton', 'worker', 'rat', 'worker'],
    density: 1.5,
    boss: {
      id: 'foreman',
      name: 'НАЧАЛЬНИК СМЕНЫ',
      subtitle: 'Пресс работает круглые сутки',
      health: 104,
      speed: 54,
      damage: 2.5,
      scale: 1.7,
      palette: ['#9aa3ab', '#5f6a72', '#2a2f34'],
      attacks: ['volley', 'charge', 'slam'],
      reward: 260,
    },
  },
];

/* ---------- enemies ---------- */
export const ENEMIES = {
  rat: {
    name: 'КРЫСА', health: 3, speed: 84, damage: 1, attack: .7, reach: 12, radius: 5,
    color: ['#6b6259', '#4a4340'], coins: 2, sight: 190, brain: 'chase',
  },
  zombie: {
    name: 'ЗОМБИ', health: 9, speed: 38, damage: 1.2, attack: 1.05, reach: 16, radius: 7,
    color: ['#6f8f5a', '#3f5c38'], coins: 4, sight: 230, brain: 'chase',
  },
  skeleton: {
    name: 'СКЕЛЕТ', health: 8, speed: 48, damage: 1, attack: 1.7, reach: 150, radius: 6,
    color: ['#d8d3c2', '#8a8676'], coins: 5, sight: 260, brain: 'ranged',
  },
  nurse: {
    name: 'МЕДСЕСТРА', health: 12, speed: 62, damage: 1.2, attack: .8, reach: 16, radius: 7,
    color: ['#dfe6e6', '#8e9ea0'], coins: 7, sight: 280, brain: 'chase',
  },
  worker: {
    name: 'РАБОЧИЙ', health: 20, speed: 42, damage: 2, attack: 1.2, reach: 20, radius: 8,
    color: ['#c08a4a', '#7a5326'], coins: 9, sight: 250, brain: 'chase',
  },
};

/* ---------- weapons ---------- */
export const WEAPONS = {
  crowbar: {
    id: 'crowbar', name: 'ЛОМ', kind: 'melee', damage: 3.4, cooldown: .5, reach: 26, arc: 1.5,
    knockback: 90, price: 0, description: 'Первое, что попалось под руку. Долго, но бьёт крепко.',
  },
  knife: {
    id: 'knife', name: 'НОЖ', kind: 'melee', damage: 1.8, cooldown: .24, reach: 20, arc: 1.1,
    knockback: 30, price: 40, description: 'Быстрые короткие удары. Слабо, зато часто.',
  },
  axe: {
    id: 'axe', name: 'ТОПОР', kind: 'melee', damage: 5.5, cooldown: .78, reach: 28, arc: 1.7,
    knockback: 140, price: 130, description: 'Одного взмаха хватает почти на всё. Но медленный.',
  },
  pistol: {
    id: 'pistol', name: 'ПИСТОЛЕТ', kind: 'gun', damage: 3.2, cooldown: .3, spread: .04,
    pellets: 1, speed: 340, ammo: 'pistol', price: 90, magazine: 12, reload: 1.1, knockback: 40,
    description: 'Надёжный, но патроны на исходе.',
  },
  shotgun: {
    id: 'shotgun', name: 'ДРОБОВИК', kind: 'gun', damage: 1.9, cooldown: .9, spread: .28,
    pellets: 6, speed: 300, ammo: 'shells', price: 190, magazine: 6, reload: 1.7, knockback: 130,
    description: 'В упор не оставляет шансов.',
  },
  rifle: {
    id: 'rifle', name: 'АВТОМАТ', kind: 'gun', damage: 2.6, cooldown: .13, spread: .12,
    pellets: 1, speed: 420, ammo: 'rifle', price: 260, magazine: 30, reload: 1.5, knockback: 25,
    description: 'Длинная очередь прошивает коридор.',
  },
};

export const AMMO_LABEL = { pistol: 'ПАТРОНЫ', shells: 'ДРОБЬ', rifle: 'ОБОЙМА' };

/* ---------- shop ---------- */
export const SHOP_ITEMS = [
  { id: 'medkit', name: 'АПТЕЧКА', price: 35, description: '+3 к здоровью прямо сейчас' },
  { id: 'maxhp', name: 'БРОНЕЖИЛЕТ', price: 120, description: '+1 к максимальному здоровью' },
  { id: 'damage', name: 'ЗАТОЧКА', price: 140, description: '+25 % урона навсегда' },
  { id: 'speed', name: 'КРОССОВКИ', price: 110, description: '+12 % скорости' },
  { id: 'ammo_pistol', name: 'ПАТРОНЫ ×24', price: 30, description: 'Пополнить патронташ' },
  { id: 'ammo_shells', name: 'ДРОБЬ ×12', price: 45, description: 'Патроны для дробовика' },
  { id: 'ammo_rifle', name: 'ОБОЙМА ×60', price: 60, description: 'Патроны для автомата' },
  { id: 'grenade', name: 'ГРАНАТА ×2', price: 70, description: 'Взрыв по площади' },
];

export const STARTER = { melee: 'crowbar', gun: null, grenades: 1, coins: 0 };

/* ---------- магазин: снаряжение ---------- */
export const SHOP_WEAPONS = [
  { id: 'buy_knife', name: 'НОЖ', price: 60, weapon: 'knife', description: 'Быстрые удары, слабый урон' },
  { id: 'buy_pistol', name: 'ПИСТОЛЕТ', price: 110, weapon: 'pistol', description: '12 патронов в магазине' },
  { id: 'buy_axe', name: 'ТОПОР', price: 170, weapon: 'axe', description: 'Тяжёлый урон в ближнем бою' },
  { id: 'buy_shotgun', name: 'ДРОБОВИК', price: 240, weapon: 'shotgun', description: 'Шесть дробин одним залпом' },
  { id: 'buy_rifle', name: 'АВТОМАТ', price: 330, weapon: 'rifle', description: 'Очередь по коридору' },
];

/* ---------- tutorial ---------- */
export const TUTORIAL = [
  { text: 'ЛЕВЫЙ ДЖОЙСТИК — движение. Ты идёшь пешком, по сырому бетону заброшки.', key: 'move' },
  { text: 'КНОПКА «УДАР» бьёт оружием ближнего боя по дуге перед тобой. Лом бьёт медленно, но больно.', key: 'melee' },
  { text: 'КНОПКА «ОГОНЬ» стреляет, если есть оружие и патроны. «ПЕРЕЗАРЯД» меняет магазин.', key: 'shoot' },
  { text: 'ИЩИ КЛЮЧИ в ящиках и бочках: без ключа дверь к выходу заперта. Монеты тратишь в магазине между этажами.', key: 'keys' },
  { text: 'СВЕТИТ только фонарь и факелы: враг виден, когда входит в круг света. Граната — кнопка с опасным значком.', key: 'light' },
];
