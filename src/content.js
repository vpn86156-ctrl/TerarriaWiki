export const SECTORS = [
  { id: 'nebula', name: 'ЗВЁЗДНАЯ ТУМАННОСТЬ', short: 'ТУМАННОСТЬ', subtitle: 'Первый рубеж', boss: 'СТРАЖ ПУСТОТЫ', image: 'space-background.webp', color: '#9df9f0', accent: 'cyan', description: 'Дроны-разведчики и россыпь астероидов.' },
  { id: 'ice', name: 'ЛЕДЯНОЙ ПОЯС', short: 'ЛЕДЯНОЙ ПОЯС', subtitle: 'Тихий холод', boss: 'КРИОСТРАЖ', image: 'ice-sector.webp', color: '#98cfff', accent: 'ice', description: 'Быстрые кристальные кометы и ледяные залпы.' },
  { id: 'fire', name: 'ПЫЛАЮЩЕЕ ЯДРО', short: 'ПЫЛАЮЩЕЕ ЯДРО', subtitle: 'Путь к солнцу', boss: 'СОЛЯРИС', image: 'fire-sector.webp', color: '#ffb17e', accent: 'fire', description: 'Огненные обломки и самый опасный страж.' },
];

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
  { id: 'distance', name: 'ПЕРВЫЙ МАРШРУТ', description: 'Пролети суммарно 400 м', metric: 'distance', target: 400, credits: 120, parts: 1, icon: '➤' },
  { id: 'stars', name: 'ЛОВЕЦ ЗВЁЗД', description: 'Собери 3 звезды', metric: 'stars', target: 3, credits: 120, parts: 2, icon: '✦' },
  { id: 'rocks', name: 'РАСЧИСТИТЬ ПУТЬ', description: 'Разбей 10 астероидов', metric: 'rocks', target: 10, credits: 150, parts: 2, icon: '✹' },
  { id: 'bosses', name: 'ПЕРВЫЙ СТРАЖ', description: 'Победи любого босса', metric: 'bosses', target: 1, credits: 200, parts: 3, icon: '⬡' },
  { id: 'sectors', name: 'ИССЛЕДОВАТЕЛЬ', description: 'Пройди все три сектора кампании', metric: 'sectors', target: 3, credits: 350, parts: 5, icon: '◈' },
];
