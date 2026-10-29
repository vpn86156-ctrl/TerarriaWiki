import { BIOMES, CASES, LEVELS, MAX_UPGRADE, MISSIONS, SKINS, UPGRADES } from './content.js';
import { evaluateStars } from './engine.js';

export const STORAGE_KEY = 'kosmopilot.v2';
export const LEGACY_KEY = 'kosmopilot.v1';
const bounded = (value, fallback, max = 999999) => Number.isFinite(value) ? Math.max(0, Math.min(max, Math.floor(value))) : fallback;
// The 1.2.0 campaign used three sectors; they map onto the biomes of the new campaign map.
const SECTOR_TO_BIOME = { nebula: 'lyra', ice: 'ice', fire: 'sun' };
const UNLOCK_TO_INDEX = { 1: 0, 2: 2, 3: 5 };

export function newProgress() {
  return {
    version: 3, best: 0, sound: true, music: true, tutorialSeen: false,
    credits: 200, parts: 2,
    upgrades: { weapon: 0, hull: 0, engine: 0, wave: 0 },
    ownedSkins: ['classic'], selectedSkin: 'classic',
    campaign: { stars: {}, unlockedBiomes: 1 }, unlockedSectors: 1, completedSectors: [],
    metrics: { distance: 0, stars: 0, rocks: 0, bosses: 0, flights: 0, levels: 0 }, claimed: [],
  };
}
function normalizeCampaign(raw, initial) {
  const stars = {};
  const source = raw?.stars && typeof raw.stars === 'object' ? raw.stars : {};
  for (const level of LEVELS) {
    const value = bounded(source[level.id], 0, 3);
    if (value > 0) stars[level.id] = value;
  }
  return { stars, unlockedBiomes: Math.max(1, bounded(raw?.unlockedBiomes, initial.unlockedBiomes, BIOMES.length)) };
}
// Old 1.2.0 saves keep their credits, ships and upgrades; cleared sectors become cleared biomes.
function migrateCampaign(raw, initial) {
  const stars = {};
  const levelIds = new Set(LEVELS.map((level) => level.id));
  const source = raw?.campaign?.stars && typeof raw.campaign.stars === 'object' ? raw.campaign.stars : null;
  if (source) for (const [id, value] of Object.entries(source)) if (levelIds.has(id)) stars[id] = bounded(value, 0, 3);
  const completed = Array.isArray(raw?.completedSectors) ? raw.completedSectors : [];
  let highest = -1;
  for (const sector of completed) {
    const biomeId = SECTOR_TO_BIOME[sector];
    if (!biomeId) continue;
    const index = BIOMES.findIndex((biome) => biome.id === biomeId);
    if (index < 0) continue;
    for (const level of LEVELS.filter((entry) => entry.biome === biomeId)) stars[level.id] = Math.max(stars[level.id] || 0, 1);
    highest = Math.max(highest, index);
  }
  const unlockedCount = Math.min(3, Math.max(1, bounded(raw?.unlockedSectors, 1, BIOMES.length)));
  const unlockedFromSectors = UNLOCK_TO_INDEX[unlockedCount] ?? 0;
  const unlockedBiomes = Math.max(1, highest + 1, unlockedFromSectors + 1, bounded(raw?.campaign?.unlockedBiomes, 1, BIOMES.length));
  return { stars, unlockedBiomes: Math.min(BIOMES.length, unlockedBiomes) };
}
export function normalizeProgress(raw) {
  const initial = newProgress();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return initial;
  const skins = SKINS.map((skin) => skin.id);
  const missionIds = MISSIONS.map((mission) => mission.id);
  const ownedSkins = ['classic', ...(Array.isArray(raw.ownedSkins) ? raw.ownedSkins.filter((id) => skins.includes(id) && id !== 'classic') : [])];
  const uniqueSkins = [...new Set(ownedSkins)];
  const sectorIds = BIOMES.map((biome) => biome.id);
  const completedSectors = [...new Set(Array.isArray(raw.completedSectors) ? raw.completedSectors.filter((id) => sectorIds.includes(id)) : [])];
  const upgrades = Object.fromEntries(UPGRADES.map((upgrade) => [upgrade.id, bounded(raw.upgrades?.[upgrade.id], 0, MAX_UPGRADE)]));
  const metrics = Object.fromEntries(['distance', 'stars', 'rocks', 'bosses', 'flights', 'levels'].map((id) => [id, bounded(raw.metrics?.[id], 0, 99999999)]));
  const campaign = raw.version >= 3 ? normalizeCampaign(raw.campaign, initial.campaign) : migrateCampaign(raw, initial.campaign);
  return {
    version: 3, best: bounded(raw.best, 0, 99999999), sound: raw.sound !== false, music: raw.music !== false, tutorialSeen: raw.tutorialSeen === true,
    credits: bounded(raw.credits, initial.credits), parts: bounded(raw.parts, initial.parts, 99999), upgrades,
    ownedSkins: uniqueSkins, selectedSkin: uniqueSkins.includes(raw.selectedSkin) ? raw.selectedSkin : 'classic',
    campaign, unlockedSectors: Math.max(1, bounded(raw.unlockedSectors, 1, BIOMES.length)), completedSectors, metrics,
    claimed: [...new Set(Array.isArray(raw.claimed) ? raw.claimed.filter((id) => missionIds.includes(id)) : [])],
  };
}
export const levelStars = (progress, id) => progress.campaign.stars[id] || 0;
export const biomeCleared = (progress, biomeId) => LEVELS.filter((level) => level.biome === biomeId).every((level) => levelStars(progress, level.id) > 0);

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
  return mission.metric === 'sectors' ? progress.campaign.unlockedBiomes : (progress.metrics[mission.metric] || 0);
}
export function claimMission(progress, id) {
  const mission = MISSIONS.find((item) => item.id === id);
  if (!mission || progress.claimed.includes(id) || missionValue(progress, mission) < mission.target) return false;
  progress.claimed.push(id); progress.credits += mission.credits; progress.parts += mission.parts;
  return true;
}
// A finished level pays for the flight, for every star and for opening a new biome.
export function settleFlight(progress, game) {
  if (game.settled) return null;
  game.settled = true;
  const level = game.level;
  let stars = 0, isFirstClear = false, unlockedBiome = null;
  if (level && game.levelComplete) {
    stars = evaluateStars(level, game);
    const previous = progress.campaign.stars[level.id] || 0;
    progress.campaign.stars[level.id] = Math.max(previous, stars);
    isFirstClear = previous === 0;
    if (isFirstClear) progress.metrics.levels += 1;
    const clearedBiome = biomeCleared(progress, level.biome);
    if (clearedBiome && level.biomeIndex + 1 >= progress.campaign.unlockedBiomes) {
      const next = Math.min(BIOMES.length, level.biomeIndex + 2);
      progress.campaign.unlockedBiomes = next;
      unlockedBiome = BIOMES[next - 1].name;
    }
  }
  const isSectorClear = !level && game.mode === 'campaign' && game.victory;
  const credits = Math.max(10, Math.floor(game.score / 20) + game.creditsCollected + game.bossesDefeated * 45)
    + stars * 30 + (isFirstClear ? 120 : 0) + (unlockedBiome ? 150 : 0);
  const parts = game.partsCollected + game.bossesDefeated * 2 + (stars >= 3 ? 2 : stars === 2 ? 1 : 0) + (isFirstClear ? 2 : 0);
  progress.credits += credits; progress.parts += parts;
  progress.metrics.distance += Math.floor(game.distance);
  progress.metrics.stars += game.stars;
  progress.metrics.rocks += game.destroyed;
  progress.metrics.bosses += game.bossesDefeated;
  progress.metrics.flights += 1;
  if (isSectorClear) {
    const id = BIOMES[game.biomeIndex].id;
    if (!progress.completedSectors.includes(id)) progress.completedSectors.push(id);
  }
  const newRecord = game.score > progress.best;
  progress.best = Math.max(progress.best, game.score);
  return { credits, parts, newRecord, isFirstClear, stars, unlockedBiome };
}
export function exportProgress(progress) {
  return JSON.stringify({ format: 'kosmopilot-backup-v3', data: normalizeProgress(progress) });
}
export function importProgress(text) {
  try {
    const value = JSON.parse(text);
    if (value?.format !== 'kosmopilot-backup-v3' && value?.format !== 'kosmopilot-backup-v2') return null;
    if (!value.data || typeof value.data !== 'object') return null;
    return normalizeProgress(value.data);
  } catch { return null; }
}
