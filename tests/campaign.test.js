import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, updateGame, useWave, BOSS_WARNING, SECTOR_FLIGHT_TIME, MAX_HEALTH } from '../src/engine.js';
import { SECTORS } from '../src/content.js';

function seeded(seed = 7) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
const run = (game, seconds, step = 1 / 60) => {
  const events = [];
  for (let elapsed = 0; elapsed < seconds; elapsed += step) events.push(...updateGame(game, step));
  return events;
};

test('a campaign flight spawns the sector boss and ends with a victory', () => {
  const game = createGame({ width: 900, random: seeded(11), mode: 'campaign', sectorIndex: 0 });
  const before = run(game, SECTOR_FLIGHT_TIME - 0.4);
  assert.equal(before.includes('boss-arrives'), false);
  const events = run(game, 1);
  assert.ok(events.includes('boss-arrives'));
  assert.ok(game.boss);
  assert.equal(game.boss.maxHealth, 28);
  assert.ok(game.rocks.length === 0 && game.drones.length === 0, 'the introduction must not hide an asteroid behind the boss');
  game.boss.health = 1;
  game.bullets.push({ x: game.boss.x - 40, y: game.boss.y, radius: 5, vx: 560, damage: 3, removed: false });
  const kills = updateGame(game, 1 / 60);
  assert.ok(kills.includes('boss-defeated'));
  assert.equal(game.gameOver, false, 'the shatter plays out before the flight ends');
  assert.ok(game.debris.length >= 20, 'the boss breaks into flying debris');
  assert.ok(game.timeScale < 1, 'the kill blow slows time down');
  assert.ok(game.shake > 0 && game.flash > 0);
  const finale = run(game, 3);
  assert.ok(finale.includes('boss-blast'), 'a chain of explosions follows');
  assert.ok(finale.includes('victory'));
  assert.equal(game.gameOver, true);
  assert.equal(game.victory, true);
  assert.equal(game.bossesDefeated, 1);
  assert.equal(game.finale, null);
  assert.equal(game.timeScale, 1);
  const frozen = updateGame(game, 1);
  assert.deepEqual(frozen, [], 'a finished flight stops simulating');
});

test('a boss becomes enraged below half health and fires more', () => {
  const game = createGame({ width: 900, random: seeded(21), mode: 'campaign', sectorIndex: 2 });
  run(game, SECTOR_FLIGHT_TIME + .5);
  assert.equal(game.boss.phase, 1);
  game.boss.health = Math.floor(game.boss.maxHealth * .5);
  game.bullets.push({ x: game.boss.x - 40, y: game.boss.y, radius: 5, vx: 560, damage: 1, removed: false });
  const events = updateGame(game, 1 / 60);
  assert.ok(events.includes('boss-rage'));
  assert.equal(game.boss.phase, 2);
  assert.ok(game.shake > .5);
  const shots = game.hostileBullets.length;
  run(game, 5);
  assert.ok(game.hostileBullets.length + shots >= 10, 'an enraged boss fills the screen with fire');
});

test('the boss telegraph warns before the arrival and clears the field', () => {
  const game = createGame({ width: 900, random: seeded(31), mode: 'campaign', sectorIndex: 0 });
  const early = run(game, SECTOR_FLIGHT_TIME - BOSS_WARNING - 2);
  assert.equal(early.includes('boss-warning'), false);
  const warned = run(game, 2.2);
  assert.ok(warned.includes('boss-warning'));
  assert.ok(game.warning > 0 && game.warning <= BOSS_WARNING);
  run(game, 3);
  assert.ok(game.boss, 'the boss arrives right after the warning');
  assert.equal(game.warning, 0);
  assert.equal(game.rocks.length + game.drones.length, 0, 'nothing hides behind the boss');
});

test('bosses get tougher per sector and their spread attacks travel toward the ship', () => {
  const strengths = SECTORS.map((sector, index) => {
    const game = createGame({ width: 900, random: seeded(3), mode: 'campaign', sectorIndex: index });
    run(game, SECTOR_FLIGHT_TIME + 0.5);
    const boss = game.boss;
    assert.ok(boss);
    run(game, 4);
    assert.ok(game.hostileBullets.length >= 3, `sector ${index} boss fires a spread`);
    assert.ok(game.hostileBullets.every((bullet) => bullet.vx < 0), 'boss fire travels from the right edge');
    return boss.maxHealth;
  });
  assert.deepEqual(strengths, [28, 37, 46]);
});

test('endless flights rotate sectors instead of ending after a boss', () => {
  const game = createGame({ width: 900, random: seeded(5), mode: 'endless', sectorIndex: 0 });
  run(game, SECTOR_FLIGHT_TIME + 0.5);
  assert.equal(game.sectorIndex, 0);
  game.boss.health = 1;
  game.bullets.push({ x: game.boss.x - 40, y: game.boss.y, radius: 5, vx: 560, damage: 3, removed: false });
  const events = updateGame(game, 1 / 60);
  assert.ok(events.includes('boss-defeated'));
  assert.equal(game.gameOver, false);
  assert.ok(game.finale, 'the shatter runs before the sector rotates');
  const finale = run(game, 3);
  assert.ok(finale.includes('sector-change'));
  assert.equal(game.sectorIndex, 1);
  assert.equal(game.sectorCycle, 1);
  assert.ok(game.timers.boss > SECTOR_FLIGHT_TIME, 'the next boss takes longer to arrive');
  const second = createGame({ width: 900, random: seeded(5), mode: 'endless', sectorIndex: SECTORS.length - 1 });
  run(second, SECTOR_FLIGHT_TIME + 0.5);
  second.boss.health = 1;
  second.bullets.push({ x: second.boss.x - 40, y: second.boss.y, radius: 5, vx: 560, damage: 3, removed: false });
  updateGame(second, 1 / 60);
  run(second, 3);
  assert.equal(second.sectorIndex, 0, 'sector rotation wraps around');
});

test('upgrades raise survivability, fire rate and the wave reach', () => {
  const base = createGame({ width: 900, random: seeded(9) });
  const upgraded = createGame({ width: 900, random: seeded(9), upgrades: { weapon: 5, hull: 2, engine: 3, wave: 4 } });
  assert.equal(base.player.maxHealth, MAX_HEALTH);
  assert.equal(upgraded.player.maxHealth, MAX_HEALTH + 2);
  assert.ok(upgraded.waveMax < base.waveMax);
  run(base, 3); run(upgraded, 3);
  base.timers.shot = 0; upgraded.timers.shot = 0;
  updateGame(base, 1 / 60); updateGame(upgraded, 1 / 60);
  assert.ok(upgraded.timers.shot < base.timers.shot, 'an upgraded cannon reloads faster');
  assert.ok(upgraded.bullets.at(-1).damage > base.bullets.at(-1).damage, 'upgraded shots hit harder');
  const makeRock = (game) => ({ x: game.player.x + 200, y: game.player.y, radius: 24, vx: 0, vy: 0, rotation: 0, spin: 0, shape: 1, health: 1, comet: false, removed: false });
  const baseRock = makeRock(base);
  const upgradedRock = makeRock(upgraded);
  base.rocks.push(baseRock); upgraded.rocks.push(upgradedRock);
  assert.equal(useWave(base), true);
  assert.equal(useWave(upgraded), true);
  assert.equal(baseRock.removed, false, 'the base wave does not reach 200px');
  assert.equal(upgradedRock.removed, true, 'an upgraded wave clears further');
});

test('the wave also damages the boss and pickups pay credits and parts', () => {
  const game = createGame({ width: 900, random: seeded(13), mode: 'campaign', sectorIndex: 0 });
  run(game, SECTOR_FLIGHT_TIME + 0.5);
  game.player.x = game.player.targetX = game.width * .64;
  game.boss.x = game.player.x + 120;
  const health = game.boss.health;
  useWave(game);
  assert.ok(game.boss.health < health);
  const credits = game.creditsCollected;
  const parts = game.partsCollected;
  game.pickups.push({ kind: 'credit', x: game.player.x, y: game.player.y, radius: 18, vx: 0, phase: 0, removed: false });
  game.pickups.push({ kind: 'part', x: game.player.x, y: game.player.y, radius: 18, vx: 0, phase: 0, removed: false });
  const events = updateGame(game, 1 / 60);
  assert.ok(events.includes('credit'));
  assert.ok(events.includes('part'));
  assert.equal(game.creditsCollected - credits, 20);
  assert.equal(game.partsCollected - parts, 1);
});

test('repairs never exceed the upgraded hull', () => {
  const game = createGame({ width: 900, random: seeded(17), upgrades: { hull: 2 } });
  game.player.health = 1;
  for (let i = 0; i < 4; i += 1) {
    game.pickups.push({ kind: 'repair', x: game.player.x, y: game.player.y, radius: 18, vx: 0, phase: 0, removed: false });
    updateGame(game, 1 / 60);
  }
  assert.equal(game.player.health, game.player.maxHealth);
});
