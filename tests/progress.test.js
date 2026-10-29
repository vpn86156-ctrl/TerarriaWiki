import test from 'node:test';
import assert from 'node:assert/strict';
import { claimMission, exportProgress, importProgress, missionValue, newProgress, normalizeProgress, openCase, purchaseUpgrade, settleFlight, upgradeCost } from '../src/progress.js';
import { BIOMES, LEVELS, MAX_UPGRADE, MISSIONS } from '../src/content.js';

test('fresh and normalized progress always have playable values', () => {
  const fresh = newProgress();
  assert.equal(fresh.credits, 200);
  assert.deepEqual(fresh.ownedSkins, ['classic']);
  assert.equal(fresh.campaign.unlockedBiomes, 1);
  assert.deepEqual(fresh.campaign.stars, {});
  const messy = normalizeProgress({ credits: -50, parts: 1e9, upgrades: { weapon: 99, hull: -4 }, ownedSkins: ['ghost', 'classic', 'classic'], selectedSkin: 'ghost', unlockedSectors: 42, completedSectors: ['nowhere'], metrics: { stars: 'x' }, claimed: ['nope'] });
  assert.equal(messy.credits, 0);
  assert.equal(messy.parts, 99999);
  assert.equal(messy.upgrades.weapon, MAX_UPGRADE);
  assert.equal(messy.upgrades.hull, 0);
  assert.deepEqual(messy.ownedSkins, ['classic']);
  assert.equal(messy.selectedSkin, 'classic');
  assert.equal(messy.campaign.unlockedBiomes, 6, 'all three old sectors unlocked means the sun biome is open');
  assert.deepEqual(messy.completedSectors, []);
  assert.equal(messy.metrics.stars, 0);
  assert.deepEqual(messy.claimed, []);
});

test('upgrades cost credits and parts and stop at the maximum level', () => {
  const progress = newProgress();
  progress.credits = 5000; progress.parts = 50;
  const first = upgradeCost(progress, 'weapon');
  assert.equal(first.level, 0);
  assert.equal(first.maxed, false);
  assert.ok(purchaseUpgrade(progress, 'weapon'));
  assert.equal(progress.credits, 5000 - first.credits);
  assert.equal(progress.parts, 50 - first.parts);
  assert.ok(upgradeCost(progress, 'weapon').credits > first.credits);
  for (let i = 0; i < 20; i += 1) purchaseUpgrade(progress, 'weapon');
  assert.equal(progress.upgrades.weapon, MAX_UPGRADE);
  const maxed = upgradeCost(progress, 'weapon');
  assert.equal(maxed.maxed, true);
  assert.equal(purchaseUpgrade(progress, 'weapon'), false);
  const poor = newProgress();
  poor.credits = 5; poor.parts = 0;
  assert.equal(purchaseUpgrade(poor, 'hull'), false);
  assert.equal(poor.upgrades.hull, 0);
});

test('cases spend credits and grant parts, a new skin, or a parts exchange', () => {
  const alwaysSkin = () => 0.1;
  const progress = newProgress();
  progress.credits = 100;
  const skinDrop = openCase(progress, 'pilot', alwaysSkin);
  assert.equal(skinDrop.kind, 'skin');
  assert.equal(progress.credits, 0);
  assert.ok(progress.ownedSkins.includes(skinDrop.skin.id));
  const duplicate = openCase(progress, 'pilot', alwaysSkin);
  assert.equal(duplicate, null, 'no credits left: nothing is spent');
  progress.credits = 500;
  const again = openCase(progress, 'pilot', alwaysSkin);
  assert.equal(again.kind, 'duplicate');
  assert.ok(progress.parts >= 2 + again.parts);
  const partsDrop = openCase(progress, 'stellar', () => 0.99);
  assert.equal(partsDrop.kind, 'parts');
  assert.ok(partsDrop.parts >= 5 && partsDrop.parts <= 9);
  const before = progress.parts;
  assert.equal(openCase(progress, 'ghost-case', () => 0.5), null);
  assert.equal(progress.parts, before);
});

test('missions can only be claimed once they are complete and only once', () => {
  const progress = newProgress();
  const starMission = MISSIONS.find((mission) => mission.id === 'stars');
  assert.equal(claimMission(progress, 'stars'), false);
  progress.metrics.stars = starMission.target;
  assert.equal(missionValue(progress, starMission), starMission.target);
  const credits = progress.credits, parts = progress.parts;
  assert.ok(claimMission(progress, 'stars'));
  assert.equal(progress.credits, credits + starMission.credits);
  assert.equal(progress.parts, parts + starMission.parts);
  assert.equal(claimMission(progress, 'stars'), false, 'already claimed');
  progress.campaign.unlockedBiomes = BIOMES.length;
  assert.equal(missionValue(progress, { metric: 'sectors' }), BIOMES.length);
  assert.ok(claimMission(progress, 'sectors'));
});

test('flights pay out once and track the metrics of the run', () => {
  const progress = newProgress();
  const game = { mode: 'campaign', biomeIndex: 0, victory: true, levelComplete: false, level: null, score: 900, distance: 120.8, stars: 4, destroyed: 7, bossesDefeated: 1, creditsCollected: 20, partsCollected: 1, boss: null };
  const outcome = settleFlight(progress, game);
  assert.ok(outcome.newRecord);
  assert.equal(outcome.isFirstClear, false, 'only campaign levels count as a first clear');
  assert.equal(progress.best, 900);
  assert.equal(progress.credits, 200 + outcome.credits);
  assert.deepEqual(progress.completedSectors, ['lyra']);
  assert.equal(progress.metrics.distance, 120);
  assert.equal(progress.metrics.stars, 4);
  assert.equal(progress.metrics.rocks, 7);
  assert.equal(progress.metrics.bosses, 1);
  assert.equal(progress.metrics.flights, 1);
  const repeat = settleFlight(progress, { ...game, score: 10 });
  assert.equal(repeat, null, 'a settled flight cannot be paid out twice');
  assert.equal(progress.best, 900, 'the record is not lowered by a worse flight');
  const endless = newProgress();
  settleFlight(endless, { mode: 'endless', biomeIndex: 1, victory: false, levelComplete: false, level: null, score: 100, distance: 10, stars: 0, destroyed: 0, bossesDefeated: 0, creditsCollected: 0, partsCollected: 0 });
  assert.deepEqual(endless.completedSectors, [], 'endless flights do not mark campaign biomes as complete');
  assert.equal(endless.campaign.unlockedBiomes, 1, 'endless flights do not open the campaign map');
});

test('clearing the third level of a biome opens the next one', () => {
  const progress = newProgress();
  const level = (id) => LEVELS.find((entry) => entry.id === id);
  const flight = (id, stars) => ({
    mode: 'campaign', level: level(id), levelComplete: true, victory: true, biomeIndex: level(id).biomeIndex,
    score: 400, distance: 100, stars, destroyed: 4, dronesDestroyed: 1, bossesDefeated: id.endsWith('-3') ? 1 : 0,
    creditsCollected: 0, partsCollected: 0, player: { health: 3, maxHealth: 3 }, tookDamage: false, levelTime: 20,
  });
  const first = settleFlight(progress, flight('lyra-1', 3));
  assert.equal(first.stars, 3);
  assert.equal(first.isFirstClear, true);
  assert.equal(progress.campaign.stars['lyra-1'], 3);
  assert.equal(progress.metrics.levels, 1);
  assert.equal(progress.campaign.unlockedBiomes, 1, 'the biome opens only after its last level');
  assert.equal(first.unlockedBiome, null);
  settleFlight(progress, flight('lyra-2', 1));
  const last = settleFlight(progress, flight('lyra-3', 2));
  assert.equal(last.unlockedBiome, BIOMES[1].name, 'the guardian level opens the next biome');
  assert.equal(progress.campaign.unlockedBiomes, 2);
  assert.equal(progress.metrics.levels, 3);
  const replay = settleFlight(progress, flight('lyra-1', 1));
  assert.equal(replay.isFirstClear, false, 'a replay is not a first clear');
  assert.equal(progress.campaign.stars['lyra-1'], 3, 'the best star count is kept');
  assert.equal(progress.metrics.levels, 3, 'replays do not count as new levels');
});

test('a 1.2.0 save keeps its wallet and turns cleared sectors into cleared biomes', () => {
  const old = {
    version: 2, best: 4200, credits: 640, parts: 9, tutorialSeen: true,
    upgrades: { weapon: 3, hull: 2, engine: 1, wave: 4 }, ownedSkins: ['classic', 'sun'], selectedSkin: 'sun',
    unlockedSectors: 3, completedSectors: ['nebula', 'ice'], metrics: { distance: 900, stars: 12, rocks: 30, bosses: 2, flights: 8 },
    claimed: ['distance'],
  };
  const progress = normalizeProgress(old);
  assert.equal(progress.version, 3);
  assert.equal(progress.best, 4200);
  assert.equal(progress.credits, 640);
  assert.equal(progress.parts, 9);
  assert.deepEqual(progress.upgrades, { weapon: 3, hull: 2, engine: 1, wave: 4 });
  assert.deepEqual(progress.ownedSkins, ['classic', 'sun']);
  assert.equal(progress.selectedSkin, 'sun');
  assert.deepEqual(progress.claimed, ['distance']);
  assert.ok(progress.campaign.stars['lyra-1'] === 1 && progress.campaign.stars['ice-3'] === 1, 'cleared sectors give their levels a star');
  assert.equal(progress.campaign.stars['debris-1'], undefined, 'a skipped biome stays unplayed');
  assert.equal(progress.campaign.unlockedBiomes, 6, 'the sun biome was unlocked in 1.2.0, so it stays open');
  const restored = importProgress(exportProgress(progress));
  assert.deepEqual(restored.campaign, progress.campaign, 'the campaign survives a backup round-trip');
  assert.equal(restored.credits, progress.credits);
  const oldCode = JSON.stringify({ format: 'kosmopilot-backup-v2', data: old });
  assert.ok(importProgress(oldCode), 'backup codes made by 1.2.0 still restore');
  assert.equal(importProgress(oldCode).campaign.unlockedBiomes, 6);
});

test('backup codes round-trip and reject unrelated data', () => {
  const progress = newProgress();
  progress.credits = 777; progress.upgrades.hull = 2; progress.ownedSkins.push('ice'); progress.selectedSkin = 'ice';
  const code = exportProgress(progress);
  const restored = importProgress(code);
  assert.deepEqual(restored, progress);
  assert.equal(importProgress('{"format":"other","data":{}}'), null);
  assert.equal(importProgress('not json'), null);
  assert.equal(importProgress(null), null);
});
