// Campaign content: eight biomes, twenty-four levels, their hazards and their guardians.
export const BIOMES = [
  {
    id: 'lyra', name: 'ТУМАННОСТЬ ЛИРЫ', short: 'ЛИРА', subtitle: 'Первый рубеж',
    guardian: 'СТРАЖ ПУСТОТЫ', description: 'Плазменные облака и дроны-разведчики.',
    accent: 'cyan', image: 'space-background.webp', pattern: 'fan',
    palette: { deep: '#08122c', mid: '#152a52', glow: '#7ef0ff', tint: '120,240,235', rock: ['#e8fbff', '#7caec7', '#4b6e93', '#283854'] },
    spawn: { rock: [1.05, 1.7], drone: [9, 13], comet: .25, speed: 1 },
    hazards: [{ type: 'plasma', every: [3.4, 5.4], limit: 4 }],
  },
  {
    id: 'debris', name: 'ПОЯС ОБЛОМКОВ', short: 'ОБЛОМКИ', subtitle: 'Кладбище астероидов',
    guardian: 'КУЗНЕЦ-РАЗРУШИТЕЛЬ', description: 'Плотный рой обломков и контактные мины.',
    accent: 'gold', image: null, pattern: 'slag',
    palette: { deep: '#12121f', mid: '#2f2739', glow: '#ffd9a0', tint: '255,214,158', rock: ['#f3e2c2', '#b58f6a', '#7a5a4c', '#3a2c2e'] },
    spawn: { rock: [.75, 1.25], drone: [11, 16], comet: .4, speed: 1.15 },
    hazards: [{ type: 'mine', every: [3.8, 5.8], limit: 3 }],
  },
  {
    id: 'ice', name: 'ЛЕДЯНОЙ РАЗЛОМ', short: 'ЛЕДЯНОЙ РАЗЛОМ', subtitle: 'Тихий холод',
    guardian: 'КРИОСТРАЖ', description: 'Кристальные кометы и морозящие поля.',
    accent: 'ice', image: 'ice-sector.webp', pattern: 'frost',
    palette: { deep: '#07182b', mid: '#123a5c', glow: '#b8ecff', tint: '150,205,255', rock: ['#e6fbff', '#7caec7', '#4b6e93', '#283854'] },
    spawn: { rock: [.85, 1.35], drone: [8, 12], comet: .35, speed: 1.05 },
    hazards: [{ type: 'frost', every: [4.2, 6.4], limit: 3 }],
  },
  {
    id: 'gas', name: 'ГАЗОВЫЙ ОМУТ', short: 'ГАЗОВЫЙ ОМУТ', subtitle: 'Живая атмосфера',
    guardian: 'РОЕВАЯ МАТКА', description: 'Потоки газа сбивают с курса, рой не даёт передышки.',
    accent: 'green', image: null, pattern: 'swarm',
    palette: { deep: '#0d1a15', mid: '#164437', glow: '#8bffcf', tint: '120,255,196', rock: ['#d8ffe9', '#6fae90', '#3f6b5c', '#25363a'] },
    spawn: { rock: [1, 1.5], drone: [6, 9], comet: .2, speed: .95 },
    hazards: [{ type: 'vortex', every: [3.6, 5.6], limit: 3 }],
  },
  {
    id: 'graveyard', name: 'КЛАДБИЩЕ ФЛОТА', short: 'КЛАДБИЩЕ', subtitle: 'Останки эскадры',
    guardian: 'ПРИЗРАК ЭФИРА', description: 'Турели на корпусах погибших кораблей.',
    accent: 'violet', image: null, pattern: 'phase',
    palette: { deep: '#141019', mid: '#332438', glow: '#e0a6ff', tint: '196,150,255', rock: ['#e3d3f2', '#8d76a8', '#5b4770', '#2f2540'] },
    spawn: { rock: [1.1, 1.7], drone: [7, 11], comet: .25, speed: 1 },
    hazards: [{ type: 'turret', every: [4.6, 6.8], limit: 3 }, { type: 'mine', every: [7, 10], limit: 2 }],
  },
  {
    id: 'sun', name: 'КОРОНА СОЛНЦА', short: 'КОРОНА', subtitle: 'Путь к звезде',
    guardian: 'СОЛЯРИС', description: 'Солнечные вспышки бьют по всей вертикали.',
    accent: 'fire', image: 'fire-sector.webp', pattern: 'beam',
    palette: { deep: '#2a0f10', mid: '#6b2417', glow: '#ffd08a', tint: '255,150,96', rock: ['#ffd2b0', '#a65e58', '#613d4b', '#332935'] },
    spawn: { rock: [.9, 1.4], drone: [7, 11], comet: .45, speed: 1.2 },
    hazards: [{ type: 'flare', every: [3.8, 5.4], limit: 2 }],
  },
  {
    id: 'caves', name: 'РЕЗОНАНСНЫЕ ПЕЩЕРЫ', short: 'ПЕЩЕРЫ', subtitle: 'Поющие кристаллы',
    guardian: 'ОРАКЛ БЕЗДНЫ', description: 'Кристальные излучатели отвечают на каждый выстрел.',
    accent: 'indigo', image: null, pattern: 'lead',
    palette: { deep: '#101024', mid: '#2c2358', glow: '#c8b6ff', tint: '186,160,255', rock: ['#e7dcff', '#8878c4', '#524a86', '#2b2450'] },
    spawn: { rock: [1, 1.5], drone: [8, 12], comet: .3, speed: 1.1 },
    hazards: [{ type: 'crystal', every: [4.4, 6.6], limit: 3 }],
  },
  {
    id: 'singularity', name: 'СИНГУЛЯРНОСТЬ', short: 'СИНГУЛЯРНОСТЬ', subtitle: 'Край карты',
    guardian: 'СЕРДЦЕ СИНГУЛЯРНОСТИ', description: 'Гравитация тянет корабль в ядро.',
    accent: 'magenta', image: null, pattern: 'pull',
    palette: { deep: '#050510', mid: '#1b1436', glow: '#ff9de0', tint: '255,140,220', rock: ['#ffd9f2', '#9b6ba8', '#5c3a6b', '#2a1c3c'] },
    spawn: { rock: [.8, 1.3], drone: [6.5, 10], comet: .5, speed: 1.25 },
    hazards: [{ type: 'well', every: [5.5, 8], limit: 2 }],
  },
];

// Three levels per biome: an objective run, a second objective run and the guardian of the biome.
const PLANS = {
  lyra: [['survive', 30, 36, 'РАЗВЕДКА', 'Продержись 30 секунд'], ['clear', 12, 30, 'ЗАЧИСТКА', 'Разбей 12 помех'], ['boss', 1, 55, 'СТРАЖ ПУСТОТЫ', 'Победи стража туманности']],
  debris: [['survive', 35, 42, 'СКВОЗЬ ПОЯС', 'Продержись 35 секунд'], ['collect', 8, 38, 'СБОР ОБЛОМКОВ', 'Собери 8 звёзд'], ['boss', 1, 60, 'КУЗНЕЦ-РАЗРУШИТЕЛЬ', 'Победи кузнеца']],
  ice: [['clear', 16, 34, 'КОЛОТЬ ЛЁД', 'Разбей 16 помех'], ['survive', 40, 48, 'МОРОЗ', 'Продержись 40 секунд'], ['boss', 1, 62, 'КРИОСТРАЖ', 'Победи криостража']],
  gas: [['collect', 10, 40, 'В ОМУТЕ', 'Собери 10 звёзд'], ['survive', 40, 48, 'ПОТОК', 'Продержись 40 секунд'], ['boss', 1, 64, 'РОЕВАЯ МАТКА', 'Победи роевую матку']],
  graveyard: [['clear', 20, 38, 'РАСЧИСТКА', 'Разбей 20 помех'], ['survive', 45, 54, 'СРЕДЬ ОБЛОМКОВ', 'Продержись 45 секунд'], ['boss', 1, 66, 'ПРИЗРАК ЭФИРА', 'Победи призрака']],
  sun: [['survive', 45, 54, 'ЖАР', 'Продержись 45 секунд'], ['clear', 22, 40, 'ПЕПЕЛ', 'Разбей 22 помехи'], ['boss', 1, 68, 'СОЛЯРИС', 'Победи солярис']],
  caves: [['collect', 12, 44, 'ЭХО', 'Собери 12 звёзд'], ['clear', 24, 42, 'РЕЗОНАНС', 'Разбей 24 помехи'], ['boss', 1, 70, 'ОРАКЛ БЕЗДНЫ', 'Победи оракула']],
  singularity: [['survive', 50, 60, 'ГОРИЗОНТ', 'Продержись 50 секунд'], ['clear', 26, 44, 'ПЕРЕД КРАЕМ', 'Разбей 26 помех'], ['boss', 1, 74, 'СЕРДЦЕ СИНГУЛЯРНОСТИ', 'Победи сердце']],
};

export const LEVELS = BIOMES.flatMap((biome, biomeIndex) => PLANS[biome.id].map(([kind, target, par, name, brief], slot) => ({
  id: `${biome.id}-${slot + 1}`, biome: biome.id, biomeIndex, slot,
  kind, target, par, name, brief,
  boss: kind === 'boss' ? { name: biome.guardian, pattern: biome.pattern, health: 26 + biomeIndex * 9 } : null,
})));

export const LEVELS_BY_ID = Object.fromEntries(LEVELS.map((level) => [level.id, level]));
export const levelById = (id) => LEVELS_BY_ID[id] || null;

export const OBJECTIVE_LABEL = {
  survive: (level) => `ПРОДЕРЖАТЬСЯ ${level.target} С`,
  clear: (level) => `РАЗБИТЬ ${level.target}`,
  collect: (level) => `СОБРАТЬ ✦ ${level.target}`,
  boss: () => 'ПОБЕДИТЬ СТРАЖА',
};

// A level opens when the previous one in the same biome has at least one star.
export function isLevelUnlocked(progress, level) {
  if (level.biomeIndex >= progress.campaign.unlockedBiomes) return false;
  if (level.slot === 0) return true;
  const previous = LEVELS_BY_ID[`${level.biome}-${level.slot}`];
  return (progress.campaign.stars[previous.id] || 0) > 0;
}
export function biomeStars(progress, biomeId) {
  return LEVELS.filter((level) => level.biome === biomeId).reduce((total, level) => total + (progress.campaign.stars[level.id] || 0), 0);
}
export function campaignStars(progress) {
  return LEVELS.reduce((total, level) => total + (progress.campaign.stars[level.id] || 0), 0);
}

export const SKINS = [
  { id: 'classic', name: 'ПЕРВОПРОХОДЕЦ', description: 'Первый корабль пилота', fin: '#f48d76', light: '#ffc6a8', hull: '#f5f8f1', glass: '#244e6d' },
  { id: 'ice', name: 'СЕВЕРНОЕ СИЯНИЕ', description: 'Холодное свечение', fin: '#6ebfff', light: '#c6efff', hull: '#e5f9ff', glass: '#154572' },
  { id: 'sun', name: 'СОЛНЕЧНЫЙ ВЕТЕР', description: 'Золото далёкой звезды', fin: '#ffad50', light: '#ffe4a4', hull: '#fff3d2', glass: '#694741' },
  { id: 'violet', name: 'НЕОНОВЫЙ СЛЕД', description: 'Глубокий фиолетовый', fin: '#c08cff', light: '#efd0ff', hull: '#f5eaff', glass: '#453279' },
];

export const UPGRADES = [
  {
    id: 'weapon', name: 'ПУШКА', description: 'Скорость и сила выстрелов', base: 90, step: 60, color: 'cyan',
    icon: '<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M4 13h11" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M20 3 9 18h6l-2 11 12-17h-7l3-9Z" fill="currentColor"/></svg>',
  },
  {
    id: 'hull', name: 'КОРПУС', description: '+1 деление прочности', base: 110, step: 70, color: 'coral',
    icon: '<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M16 3l11 4.5v9c0 7-5 11.5-11 13C10 27.5 5 23.5 5 16.5v-9L16 3Z" stroke="currentColor" stroke-width="2.3" stroke-linejoin="round"/><path d="M16 11.5v9M11.5 16h9" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"/></svg>',
  },
  {
    id: 'engine', name: 'ДВИГАТЕЛЬ', description: 'Быстрее реагирует на движение', base: 80, step: 55, color: 'ice',
    icon: '<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M3 16h17M14 8.5 21 16l-7 7.5" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M25 6v20" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
  },
  {
    id: 'wave', name: 'ВОЛНА', description: 'Больше радиус, меньше перезарядка', base: 100, step: 65, color: 'gold',
    icon: '<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><circle cx="14" cy="16" r="4.5" fill="currentColor"/><path d="M21 9a10 10 0 0 1 0 14M25.5 5.5a16 16 0 0 1 0 21" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  },
];
export const MAX_UPGRADE = 5;

export const CASES = [
  { id: 'pilot', name: 'КЕЙС ПИЛОТА', caption: 'Хорошее начало', price: 100, skinChance: .25, minParts: 2, maxParts: 5, color: 'cyan' },
  { id: 'stellar', name: 'ЗВЁЗДНЫЙ КЕЙС', caption: 'Больше редких деталей', price: 220, skinChance: .4, minParts: 5, maxParts: 9, color: 'gold' },
];

export const MISSIONS = [
  { id: 'distance', name: 'ПЕРВЫЙ МАРШРУТ', description: 'Пролети суммарно 1200 м', metric: 'distance', target: 1200, credits: 120, parts: 1, icon: '➤' },
  { id: 'stars', name: 'ЛОВЕЦ ЗВЁЗД', description: 'Собери 20 звёзд', metric: 'stars', target: 20, credits: 140, parts: 2, icon: '✦' },
  { id: 'rocks', name: 'РАСЧИСТИТЬ ПУТЬ', description: 'Разбей 40 помех', metric: 'rocks', target: 40, credits: 160, parts: 2, icon: '✹' },
  { id: 'levels', name: 'КАРТОГРАФ', description: 'Пройди 10 уровней кампании', metric: 'levels', target: 10, credits: 220, parts: 3, icon: '▦' },
  { id: 'bosses', name: 'ОХОТНИК НА СТРАЖЕЙ', description: 'Победи 4 стражей', metric: 'bosses', target: 4, credits: 260, parts: 3, icon: '⬡' },
  { id: 'sectors', name: 'ИССЛЕДОВАТЕЛЬ', description: 'Открой все 8 биомов', metric: 'sectors', target: 8, credits: 400, parts: 5, icon: '◈' },
];

// Kept as an alias: the endless run still cycles through the biomes in this order.
export const SECTORS = BIOMES;
