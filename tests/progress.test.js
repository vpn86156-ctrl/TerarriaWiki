import test from 'node:test';
import assert from 'node:assert/strict';
import { claimMission, exportProgress, importProgress, missionValue, newProgress, normalizeProgress, openCase, purchaseUpgrade, settleFlight, upgradeCost } from '../src/progress.js';
import { MAX_UPGRADE, SECTORS } from '../src/content.js';

test('fresh and normalized progress always have playable values', () => {
  const fresh = newProgress();
  assert.equal(fresh.credits, 200);
  assert.deepEqual(fresh.ownedSkins, ['classic']);
  assert.equal(fresh.unlockedSectors, 1);
  const messy = normalizeProgress({ credits: -50, parts: 1e9, upgrades: { weapon: 99, hull: -4 }, ownedSkins: ['ghost', 'classic', 'classic'], selectedSkin: 'ghost', unlockedSectors: 42, completedSectors: ['nowhere'], metrics: { stars: 'x' }, claimed: ['nope'] });
  assert.equal(messy.credits, 0);
  assert.equal(messy.parts, 99999);
  assert.equal(messy.upgrades.weapon, MAX_UPGRADE);
  assert.equal(messy.upgrades.hull, 0);
  assert.deepEqual(messy.ownedSkins, ['classic']);
  assert.equal(messy.selectedSkin, 'classic');
  assert.equal(messy.unlockedSectors, SECTORS.length);
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
  assert.equal(claimMission(progress, 'stars'), false);
  progress.metrics.stars = 3;
  assert.equal(missionValue(progress, { metric: 'stars' }), 3);
  const credits = progress.credits, parts = progress.parts;
  assert.ok(claimMission(progress, 'stars'));
  assert.equal(progress.credits, credits + 120);
  assert.equal(progress.parts, parts + 2);
  assert.equal(claimMission(progress, 'stars'), false, 'already claimed');
  progress.completedSectors = SECTORS.map((sector) => sector.id);
  assert.ok(claimMission(progress, 'sectors'));
});

test('flights pay out once, track metrics and unlock the next sector', () => {
  const progress = newProgress();
  const game = { mode: 'campaign', sectorIndex: 0, victory: true, score: 900, distance: 120.8, stars: 4, destroyed: 7, bossesDefeated: 1, creditsCollected: 20, partsCollected: 1, boss: null };
  const outcome = settleFlight(progress, game);
  assert.ok(outcome.newRecord);
  assert.equal(outcome.isFirstClear, true);
  assert.equal(progress.best, 900);
  assert.equal(progress.credits, 200 + outcome.credits);
  assert.deepEqual(progress.completedSectors, ['nebula']);
  assert.equal(progress.unlockedSectors, 2);
  assert.equal(progress.metrics.distance, 120);
  assert.equal(progress.metrics.stars, 4);
  assert.equal(progress.metrics.rocks, 7);
  assert.equal(progress.metrics.bosses, 1);
  assert.equal(progress.metrics.flights, 1);
  const repeat = settleFlight(progress, { ...game, score: 10 });
  assert.equal(repeat, null, 'a settled flight cannot be paid out twice');
  assert.equal(progress.best, 900, 'the record is not lowered by a worse flight');
  assert.equal(progress.unlockedSectors, 2);
  const endless = newProgress();
  settleFlight(endless, { mode: 'endless', sectorIndex: 1, victory: false, score: 100, distance: 10, stars: 0, destroyed: 0, bossesDefeated: 0, creditsCollected: 0, partsCollected: 0 });
  assert.deepEqual(endless.completedSectors, [], 'endless flights do not mark campaign sectors as complete');
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
