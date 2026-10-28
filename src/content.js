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
  { id: 'weapon', name: 'ПУШКА', icon: '✦', description: 'Скорость и сила выстрелов', base: 90, step: 60, color: 'cyan' },
  { id: 'hull', name: 'КОРПУС', icon: '⬡', description: '+1 деление прочности', base: 110, step: 70, color: 'coral' },
  { id: 'engine', name: 'ДВИГАТЕЛЬ', icon: '➤', description: 'Быстрее реагирует на движение', base: 80, step: 55, color: 'ice' },
  { id: 'wave', name: 'ВОЛНА', icon: 'ϟ', description: 'Больше радиус, меньше перезарядка', base: 100, step: 65, color: 'gold' },
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
