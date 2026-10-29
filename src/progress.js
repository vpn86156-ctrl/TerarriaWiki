/* Сохранение: прогресс по локациям, деньги, покупки, настройки, туториал. */

const KEY = 'zabroshka.save.v1';

export function defaultSave() {
  return {
    coins: 0,
    location: 0,
    level: 1,
    unlocked: 1,
    maxLevel: { 0: 1, 1: 1, 2: 1 },
    health: 8,
    melee: 'crowbar',
    gun: 'pistol',
    grenades: 2,
    weapons: ['crowbar', 'pistol'],
    ammo: { pistol: 24, shells: 8, rifle: 0 },
    upgrades: { damage: 0, speed: 0, reload: 0, luck: 0 },
    stats: { kills: 0, deaths: 0, keys: 0, coins: 0, bosses: 0, time: 0, levels: 0, best: 0 },
    tutorialSeen: false,
    settings: {
      sound: true,
      music: true,
      volume: .8,
      stickSide: 'left',
      stickSize: 1,
      shake: true,
      hints: true,
      blood: true,
      minimap: true,
    },
  };
}

export function loadProgress() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSave();
    const data = JSON.parse(raw);
    const base = defaultSave();
    return {
      ...base,
      ...data,
      upgrades: { ...base.upgrades, ...(data.upgrades || {}) },
      stats: { ...base.stats, ...(data.stats || {}) },
      settings: { ...base.settings, ...(data.settings || {}) },
      ammo: { ...base.ammo, ...(data.ammo || {}) },
      maxLevel: { ...base.maxLevel, ...(data.maxLevel || {}) },
    };
  } catch {
    return defaultSave();
  }
}

export function saveProgress(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch { /* storage is unavailable — играем без сохранения */ }
}

export function wipeProgress() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  return defaultSave();
}
