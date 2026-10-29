import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, evaluateStars, updateGame, useWave, BOSS_WARNING, MINI_BOSS_DELAY, SECTOR_FLIGHT_TIME, MAX_HEALTH } from '../src/engine.js';
import { BIOMES, LEVELS, LEVELS_BY_ID } from '../src/content.js';

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
// Objective tests isolate the level goal from the random traffic of the biome.
function still(game) {
  for (const key of ['rock', 'drone', 'star', 'repair', 'credits', 'part']) game.timers[key] = Infinity;
  game.hazardTimers = game.hazardTimers.map(() => Infinity);
  return game;
}
const enemy = (game, x = game.player.x + 150) => ({
  x, y: game.player.y, radius: 12, vx: 0, vy: 0, rotation: 0, spin: 0, shape: 1,
  health: 1, comet: false, biome: game.biomeIndex, removed: false,
});
const shot = (game, x) => ({ x, y: game.player.y, radius: 5, vx: 560, damage: 1, removed: false });
const hazard = (game, type) => ({
  type, x: game.player.x + 90, y: game.player.y, baseY: game.player.y, radius: 70, vx: 0, phase: 0,
  life: 30, maxLife: 30, state: 'idle', timer: 0, cooldown: 0, health: 0, maxHealth: 0,
  hitFlash: 0, fire: 0, removed: false, biome: game.biomeIndex,
});

test('the campaign holds eight biomes and twenty-four levels with a guardian each', () => {
  assert.equal(BIOMES.length, 8);
  assert.equal(LEVELS.length, 24);
  const patterns = LEVELS.filter((level) => level.kind === 'boss').map((level) => level.boss.pattern);
  assert.equal(patterns.length, 8);
  assert.equal(new Set(patterns).size, 8, 'every guardian fights differently');
  const healths = LEVELS.filter((level) => level.kind === 'boss').map((level) => level.boss.health);
  assert.deepEqual(healths, [26, 35, 44, 53, 62, 71, 80, 89], 'guardians get tougher with every biome');
  for (const level of LEVELS) {
    assert.ok(level.par > 0 && level.target > 0, `${level.id} has a goal and a par time`);
    assert.ok(level.brief.length > 5);
  }
});

test('a survive level completes when the timer runs out and pays stars for an untouched hull', () => {
  const game = still(createGame({ width: 900, random: seeded(11), level: 'lyra-1' }));
  assert.equal(game.objective.kind, 'survive');
  assert.equal(game.objective.target, 30);
  assert.equal(Number.isFinite(game.timers.boss), false, 'an objective level has no guardian');
  run(game, 29);
  assert.equal(game.levelComplete, false);
  const events = run(game, 1.5);
  assert.ok(events.includes('level-complete'));
  assert.ok(events.includes('victory'));
  assert.equal(game.gameOver, true);
  assert.equal(evaluateStars(LEVELS_BY_ID['lyra-1'], game), 3);
  assert.deepEqual(updateGame(game, 1), [], 'a finished level stops simulating');
});

test('stars reward a healthy hull and a clean run', () => {
  const level = LEVELS_BY_ID['lyra-1'];
  const flawless = still(createGame({ width: 900, random: seeded(41), level: 'lyra-1' }));
  run(flawless, 31);
  assert.equal(evaluateStars(level, flawless), 3);
  const scratched = still(createGame({ width: 900, random: seeded(41), level: 'lyra-1' }));
  scratched.player.health = 2; scratched.tookDamage = true;
  run(scratched, 31);
  assert.equal(evaluateStars(level, scratched), 2, 'half the hull left still earns two stars');
  const broken = still(createGame({ width: 900, random: seeded(41), level: 'lyra-1' }));
  broken.player.health = 1; broken.tookDamage = true;
  run(broken, 31);
  assert.equal(evaluateStars(level, broken), 1);
  const failed = still(createGame({ width: 900, random: seeded(41), level: 'lyra-1' }));
  run(failed, 5);
  assert.equal(evaluateStars(level, failed), 0, 'an unfinished level pays nothing');
});

test('a clear level counts destroyed rocks, drones and hazards', () => {
  const game = still(createGame({ width: 900, random: seeded(12), level: 'lyra-2' }));
  assert.equal(game.objective.kind, 'clear');
  for (let i = 0; i < 12; i += 1) {
    const rock = enemy(game);
    game.rocks.push(rock);
    game.bullets.push(shot(game, rock.x - 2));
    updateGame(game, 1 / 60);
  }
  assert.equal(game.objective.progress, 12);
  assert.equal(game.levelComplete, true);
  assert.equal(game.victory, true);
  const withHazard = still(createGame({ width: 900, random: seeded(13), level: 'lyra-2' }));
  withHazard.hazards.push({ ...hazard(withHazard, 'mine'), health: 1, maxHealth: 1, radius: 21 });
  withHazard.bullets.push(shot(withHazard, withHazard.player.x + 88));
  assert.ok(updateGame(withHazard, 1 / 60).includes('hazard-break'), 'hazards can be shot apart');
  assert.equal(withHazard.destroyed, 1);
});

test('a collect level counts the stars the pilot catches', () => {
  const game = still(createGame({ width: 900, random: seeded(14), level: 'debris-2' }));
  assert.equal(game.objective.kind, 'collect');
  assert.equal(game.objective.target, 8);
  for (let i = 0; i < 8; i += 1) {
    game.pickups.push({ kind: 'star', x: game.player.x, y: game.player.y, radius: 17, vx: 0, phase: 0, spin: 0, removed: false });
    updateGame(game, 1 / 60);
  }
  assert.equal(game.stars, 8);
  assert.equal(game.levelComplete, true);
});

test('a guardian level telegraphs the arrival and ends the level with the shatter', () => {
  const game = still(createGame({ width: 900, random: seeded(21), level: 'lyra-3' }));
  assert.equal(game.timers.boss, MINI_BOSS_DELAY);
  const early = run(game, MINI_BOSS_DELAY - BOSS_WARNING - 1);
  assert.equal(early.includes('boss-warning'), false);
  assert.equal(game.boss, null);
  const warned = run(game, 1.4);
  assert.ok(warned.includes('boss-warning'));
  assert.ok(game.warning > 0 && game.warning <= BOSS_WARNING);
  const events = run(game, 3);
  assert.ok(events.includes('boss-arrives'));
  assert.equal(game.boss.pattern, 'fan');
  assert.equal(game.boss.maxHealth, 26);
  assert.equal(game.rocks.length + game.drones.length, 0, 'nothing hides behind the guardian');
  game.boss.health = 1;
  game.bullets.push({ x: game.boss.x - 40, y: game.boss.y, radius: 5, vx: 560, damage: 3, removed: false });
  const kills = updateGame(game, 1 / 60);
  assert.ok(kills.includes('boss-defeated'));
  assert.equal(game.gameOver, false, 'the shatter plays out before the level ends');
  assert.ok(game.debris.length >= 20);
  assert.ok(game.timeScale < 1, 'the kill blow slows time down');
  const finale = run(game, 3);
  assert.ok(finale.includes('boss-blast'));
  assert.ok(finale.includes('level-complete'), 'killing the guardian completes the level');
  assert.equal(game.levelComplete, true);
  assert.equal(game.victory, true);
  assert.equal(game.bossesDefeated, 1);
  assert.equal(game.timeScale, 1);
});

test('a guardian becomes enraged below half health and fires more', () => {
  const game = still(createGame({ width: 900, random: seeded(22), level: 'sun-3' }));
  run(game, MINI_BOSS_DELAY + 1);
  assert.equal(game.boss.pattern, 'beam');
  game.boss.health = Math.floor(game.boss.maxHealth * .5);
  game.bullets.push({ x: game.boss.x - 40, y: game.boss.y, radius: 5, vx: 560, damage: 1, removed: false });
  const events = updateGame(game, 1 / 60);
  assert.ok(events.includes('boss-rage'));
  assert.equal(game.boss.phase, 2);
  assert.ok(game.shake > .5);
  run(game, 6);
  assert.ok(game.hostileBullets.length + game.boss?.burst >= 0);
  assert.ok(game.boss, 'the fight continues while the guardian lives');
});

test('frost fields chill the ship and bite after a while', () => {
  const game = still(createGame({ width: 900, random: seeded(31), level: 'ice-1' }));
  game.hazards.push({ ...hazard(game, 'frost'), x: game.player.x, y: game.player.y, baseY: game.player.y, radius: 70 });
  run(game, 1);
  assert.ok(game.chill > .2, 'the cold builds up inside the field');
  const events = run(game, 3);
  assert.ok(game.player.health < game.player.maxHealth, 'staying in the cold costs a hull point');
  assert.ok(events.includes('hit'));
});

test('a gravity well drags the ship toward its core', () => {
  const game = still(createGame({ width: 900, random: seeded(32), level: 'singularity-1' }));
  game.hazards.push({ ...hazard(game, 'well'), x: game.player.x + 220, y: game.player.y, baseY: game.player.y, radius: 44 });
  const before = game.player.targetX;
  run(game, 2);
  assert.ok(game.player.targetX > before + 30, 'the pull moves the flight plan');
});

test('endless flights rotate biomes instead of ending after a boss', () => {
  const game = still(createGame({ width: 900, random: seeded(5), mode: 'endless', biomeIndex: 0 }));
  run(game, SECTOR_FLIGHT_TIME + 0.5);
  assert.equal(game.biomeIndex, 0);
  game.boss.health = 1;
  game.bullets.push({ x: game.boss.x - 40, y: game.boss.y, radius: 5, vx: 560, damage: 3, removed: false });
  const events = updateGame(game, 1 / 60);
  assert.ok(events.includes('boss-defeated'));
  assert.equal(game.gameOver, false);
  assert.ok(game.finale, 'the shatter runs before the biome rotates');
  const finale = run(game, 3);
  assert.ok(finale.includes('sector-change'));
  assert.equal(game.biomeIndex, 1);
  assert.equal(game.sectorCycle, 1);
  assert.ok(game.timers.boss > SECTOR_FLIGHT_TIME, 'the next guardian takes longer to arrive');
  const last = still(createGame({ width: 900, random: seeded(5), mode: 'endless', biomeIndex: BIOMES.length - 1 }));
  run(last, SECTOR_FLIGHT_TIME + 0.5);
  last.boss.health = 1;
  last.bullets.push({ x: last.boss.x - 40, y: last.boss.y, radius: 5, vx: 560, damage: 3, removed: false });
  updateGame(last, 1 / 60);
  run(last, 3);
  assert.equal(last.biomeIndex, 0, 'biome rotation wraps around');
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
  const makeRock = (game) => ({ x: game.player.x + 200, y: game.player.y, radius: 24, vx: 0, vy: 0, rotation: 0, spin: 0, shape: 1, health: 1, comet: false, biome: game.biomeIndex, removed: false });
  const baseRock = makeRock(base);
  const upgradedRock = makeRock(upgraded);
  base.rocks.push(baseRock); upgraded.rocks.push(upgradedRock);
  assert.equal(useWave(base), true);
  assert.equal(useWave(upgraded), true);
  assert.equal(baseRock.removed, false, 'the base wave does not reach 200px');
  assert.equal(upgradedRock.removed, true, 'an upgraded wave clears further');
});

test('the wave also damages the guardian and pickups pay credits and parts', () => {
  const game = still(createGame({ width: 900, random: seeded(13), level: 'lyra-3' }));
  run(game, MINI_BOSS_DELAY + 1);
  game.player.x = game.player.targetX = game.width * .64;
  game.boss.x = game.player.x + 120;
  const health = game.boss.health;
  useWave(game);
  assert.ok(game.boss.health < health);
  const credits = game.creditsCollected;
  const parts = game.partsCollected;
  game.pickups.push({ kind: 'credit', x: game.player.x, y: game.player.y, radius: 18, vx: 0, phase: 0, spin: 0, removed: false });
  game.pickups.push({ kind: 'part', x: game.player.x, y: game.player.y, radius: 18, vx: 0, phase: 0, spin: 0, removed: false });
  const events = updateGame(game, 1 / 60);
  assert.ok(events.includes('credit'));
  assert.ok(events.includes('part'));
  assert.equal(game.creditsCollected - credits, 20);
  assert.equal(game.partsCollected - parts, 1);
});

test('repairs never exceed the upgraded hull', () => {
  const game = still(createGame({ width: 900, random: seeded(17), upgrades: { hull: 2 } }));
  game.player.health = 1;
  for (let i = 0; i < 4; i += 1) {
    game.pickups.push({ kind: 'repair', x: game.player.x, y: game.player.y, radius: 18, vx: 0, phase: 0, spin: 0, removed: false });
    updateGame(game, 1 / 60);
  }
  assert.equal(game.player.health, game.player.maxHealth);
});
