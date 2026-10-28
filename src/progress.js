import { CASES, MAX_UPGRADE, MISSIONS, SECTORS, SKINS, UPGRADES } from './content.js';

export const STORAGE_KEY = 'kosmopilot.v2';
export const LEGACY_KEY = 'kosmopilot.v1';
const bounded = (value, fallback, max = 999999) => Number.isFinite(value) ? Math.max(0, Math.min(max, Math.floor(value))) : fallback;

export function newProgress() {
  return {
    version: 2, best: 0, sound: true, music: true, tutorialSeen: false,
    credits: 200, parts: 2,
    upgrades: { weapon: 0, hull: 0, engine: 0, wave: 0 },
    ownedSkins: ['classic'], selectedSkin: 'classic', unlockedSectors: 1, completedSectors: [],
    metrics: { distance: 0, stars: 0, rocks: 0, bosses: 0, flights: 0 }, claimed: [],
  };
}

export function normalizeProgress(raw) {
  const initial = newProgress();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return initial;
  const skins = SKINS.map((skin) => skin.id);
  const sectorIds = SECTORS.map((sector) => sector.id);
  const missionIds = MISSIONS.map((mission) => mission.id);
  const ownedSkins = ['classic', ...(Array.isArray(raw.ownedSkins) ? raw.ownedSkins.filter((id) => skins.includes(id) && id !== 'classic') : [])];
  const uniqueSkins = [...new Set(ownedSkins)];
  const completedSectors = [...new Set(Array.isArray(raw.completedSectors) ? raw.completedSectors.filter((id) => sectorIds.includes(id)) : [])];
  const upgrades = Object.fromEntries(UPGRADES.map((upgrade) => [upgrade.id, bounded(raw.upgrades?.[upgrade.id], 0, MAX_UPGRADE)]));
  const metrics = Object.fromEntries(['distance', 'stars', 'rocks', 'bosses', 'flights'].map((id) => [id, bounded(raw.metrics?.[id], 0, 99999999)]));
  return {
    version: 2, best: bounded(raw.best, 0, 99999999), sound: raw.sound !== false, music: raw.music !== false, tutorialSeen: raw.tutorialSeen === true,
    credits: bounded(raw.credits, initial.credits), parts: bounded(raw.parts, initial.parts, 99999), upgrades,
    ownedSkins: uniqueSkins, selectedSkin: uniqueSkins.includes(raw.selectedSkin) ? raw.selectedSkin : 'classic',
    unlockedSectors: Math.max(1, bounded(raw.unlockedSectors, 1, SECTORS.length)), completedSectors, metrics,
    claimed: [...new Set(Array.isArray(raw.claimed) ? raw.claimed.filter((id) => missionIds.includes(id)) : [])],
  };
}

export function upgradeCost(progress, id) {
  const item = UPGRADES.find((entry) => entry.id === id);
  if (!item) return null;
  const level = progress.upgrades[id];
  return { credits: item.base + level * item.step, parts: 1 + Math.floor(level / 2), level, maxed: level >= MAX_UPGRADE };
}
export function purchaseUpgrade(progress, id) {
  const cost = upgradeCost(progress, id);
  if (!cost || cost.maxed || progress.credits < cost.credits || progress.parts < cost.parts) return false;
  progress.credits -= cost.credits; progress.parts -= cost.parts; progress.upgrades[id] += 1;
  return true;
}

export function openCase(progress, id, random = Math.random) {
  const box = CASES.find((entry) => entry.id === id);
  if (!box || progress.credits < box.price) return null;
  progress.credits -= box.price;
  if (random() < box.skinChance) {
    const choices = SKINS.filter((skin) => skin.id !== 'classic');
    const skin = choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))];
    if (progress.ownedSkins.includes(skin.id)) {
      const parts = box.id === 'stellar' ? 5 : 3;
      progress.parts += parts;
      return { kind: 'duplicate', skin, parts, label: `Повторный облик обменян на ${parts} деталей` };
    }
    progress.ownedSkins.push(skin.id);
    return { kind: 'skin', skin, label: `НОВЫЙ ОБЛИК: ${skin.name}` };
  }
  const parts = box.minParts + Math.min(box.maxParts - box.minParts, Math.floor(random() * (box.maxParts - box.minParts + 1)));
  progress.parts += parts;
  return { kind: 'parts', parts, label: `ДЕТАЛИ: +${parts}` };
}

export function missionValue(progress, mission) {
  return mission.metric === 'sectors' ? progress.completedSectors.length : (progress.metrics[mission.metric] || 0);
}
export function claimMission(progress, id) {
  const mission = MISSIONS.find((item) => item.id === id);
  if (!mission || progress.claimed.includes(id) || missionValue(progress, mission) < mission.target) return false;
  progress.claimed.push(id); progress.credits += mission.credits; progress.parts += mission.parts;
  return true;
}

export function settleFlight(progress, game) {
  if (game.settled) return null;
  game.settled = true;
  const isFirstClear = game.mode === 'campaign' && game.victory && !progress.completedSectors.includes(SECTORS[game.sectorIndex].id);
  const credits = Math.max(10, Math.floor(game.score / 20) + game.creditsCollected + game.bossesDefeated * 45) + (isFirstClear ? 100 : 0);
  const parts = game.partsCollected + game.bossesDefeated * 2 + (isFirstClear ? 2 : 0);
  progress.credits += credits; progress.parts += parts;
  progress.metrics.distance += Math.floor(game.distance);
  progress.metrics.stars += game.stars;
  progress.metrics.rocks += game.destroyed;
  progress.metrics.bosses += game.bossesDefeated;
  progress.metrics.flights += 1;
  if (isFirstClear) {
    progress.completedSectors.push(SECTORS[game.sectorIndex].id);
    progress.unlockedSectors = Math.min(SECTORS.length, Math.max(progress.unlockedSectors, game.sectorIndex + 2));
  }
  const newRecord = game.score > progress.best;
  progress.best = Math.max(progress.best, game.score);
  return { credits, parts, newRecord, isFirstClear };
}

export function exportProgress(progress) {
  return JSON.stringify({ format: 'kosmopilot-backup-v2', data: normalizeProgress(progress) });
}
export function importProgress(text) {
  try {
    const value = JSON.parse(text);
    if (value?.format !== 'kosmopilot-backup-v2' || !value.data || typeof value.data !== 'object') return null;
    return normalizeProgress(value.data);
  } catch { return null; }
}
