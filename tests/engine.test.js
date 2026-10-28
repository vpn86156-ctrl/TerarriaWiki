import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, resizeGame, setTarget, updateGame, useWave, WORLD_HEIGHT, WAVE_COOLDOWN } from '../src/engine.js';

function quiet(game) {
  for (const key of Object.keys(game.timers)) game.timers[key] = Infinity;
  return game;
}
function rock(game, x = game.player.x, y = game.player.y) {
  return { x, y, radius: 25, vx: 0, vy: 0, rotation: 0, spin: 0, shape: 1, health: 99, removed: false };
}
function advance(game, seconds) {
  for (let elapsed = 0; elapsed < seconds - 1e-8; elapsed += .05) updateGame(game, Math.min(.05, seconds - elapsed));
}
function seeded(seed) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }

test('new game starts with three health units and a clean score', () => {
  const game = createGame({ width: 1000, random: seeded(1) });
  assert.equal(game.player.health, 3);
  assert.equal(game.player.x, 220);
  assert.equal(game.player.y, WORLD_HEIGHT / 2);
  assert.equal(game.score, 0);
  assert.equal(game.gameOver, false);
  assert.equal(game.waveCooldown, 0);
});

test('movement is smooth and clamped within the playable area', () => {
  const game = quiet(createGame({ width: 1000 }));
  setTarget(game, -1000, 9999);
  assert.equal(game.player.targetX, 52);
  assert.equal(game.player.targetY, WORLD_HEIGHT - 54);
  const before = game.player.x;
  updateGame(game, .05);
  assert.ok(game.player.x < before && game.player.x > 52);
  setTarget(game, 9999, -1000);
  assert.equal(game.player.targetX, 640);
  assert.equal(game.player.targetY, 67);
});

test('resize preserves relative position and keeps the target in bounds', () => {
  const game = quiet(createGame({ width: 1000 }));
  setTarget(game, 500, 100);
  resizeGame(game, 1200);
  assert.equal(game.width, 1200);
  assert.equal(game.player.x, 264);
  assert.equal(game.player.targetX, 600);
  resizeGame(game, 100);
  assert.equal(game.width, 540);
  assert.ok(game.player.targetX <= game.width * .64);
});

test('huge or invalid frame intervals cannot advance an absent game', () => {
  const game = quiet(createGame());
  updateGame(game, 60);
  assert.equal(game.elapsed, .05);
  updateGame(game, NaN);
  updateGame(game, -1);
  assert.equal(game.elapsed, .05);
  game.gameOver = true;
  updateGame(game, .05);
  assert.equal(game.elapsed, .05);
});

test('collisions take one health unit and brief invulnerability prevents double damage', () => {
  const game = quiet(createGame({ random: seeded(2) }));
  game.rocks.push(rock(game));
  assert.ok(updateGame(game, .01).includes('hit'));
  assert.equal(game.player.health, 2);
  game.rocks.push(rock(game));
  assert.ok(!updateGame(game, .01).includes('hit'));
  assert.equal(game.player.health, 2);
  advance(game, 1.7);
  game.rocks.push(rock(game));
  updateGame(game, .01);
  assert.equal(game.player.health, 1);
});

test('third hit ends the game once, without negative health', () => {
  const game = quiet(createGame({ random: seeded(3) }));
  game.player.health = 1;
  game.rocks.push(rock(game), rock(game));
  const events = updateGame(game, .01);
  assert.equal(game.player.health, 0);
  assert.equal(game.gameOver, true);
  assert.equal(events.filter((event) => event === 'gameover').length, 1);
  const elapsed = game.elapsed;
  updateGame(game, .05);
  assert.equal(game.elapsed, elapsed);
});

test('a star grants 50 points plus distance', () => {
  const game = quiet(createGame({ random: seeded(4) }));
  game.pickups.push({ kind: 'star', x: game.player.x, y: game.player.y, radius: 16, vx: 0, phase: 0, removed: false });
  const events = updateGame(game, .01);
  assert.equal(game.stars, 1);
  assert.equal(game.score, 50);
  assert.ok(events.includes('star'));
  assert.equal(game.pickups.length, 0);
});

test('repair restores health and provides a bonus when already full', () => {
  const game = quiet(createGame({ random: seeded(5) }));
  const repair = () => ({ kind: 'repair', x: game.player.x, y: game.player.y, radius: 18, vx: 0, phase: 0, removed: false });
  game.player.health = 2;
  game.pickups.push(repair());
  assert.ok(updateGame(game, .01).includes('repair'));
  assert.equal(game.player.health, 3);
  game.pickups.push(repair());
  updateGame(game, .01);
  assert.equal(game.player.health, 3);
  assert.equal(game.bonus, 50);
});

test('automatic shots destroy rocks and award points', () => {
  const game = quiet(createGame({ random: seeded(6) }));
  const target = rock(game, game.player.x + 200, game.player.y);
  target.health = 1;
  game.rocks.push(target);
  game.bullets.push({ x: target.x - 12, y: target.y, radius: 5, vx: 560, removed: false });
  const events = updateGame(game, .02);
  assert.equal(game.destroyed, 1);
  assert.equal(game.rocks.length, 0);
  assert.equal(game.bullets.length, 0);
  assert.ok(game.score >= 20);
  assert.ok(events.includes('break'));
});

test('wave clears nearby threats, protects the ship and requires cooldown', () => {
  const game = quiet(createGame({ random: seeded(7) }));
  const nearby = rock(game, game.player.x + 100, game.player.y);
  const far = rock(game, game.player.x + 300, 100);
  const hostile = { x: game.player.x + 80, y: game.player.y, radius: 7, vx: 0, vy: 0, removed: false };
  game.rocks.push(nearby, far); game.hostileBullets.push(hostile);
  assert.equal(useWave(game), true);
  assert.equal(nearby.removed, true);
  assert.equal(far.removed, false);
  assert.equal(hostile.removed, true);
  assert.ok(game.player.invulnerable > 0);
  assert.equal(game.waveCooldown, WAVE_COOLDOWN);
  assert.equal(useWave(game), false);
  advance(game, WAVE_COOLDOWN + .1);
  assert.equal(game.waveCooldown, 0);
  assert.equal(useWave(game), true);
});

test('objects, pickups and shots spawn inside their expected envelopes', () => {
  const game = createGame({ width: 1000, random: seeded(8) });
  game.timers.rock = game.timers.star = game.timers.repair = game.timers.drone = game.timers.shot = 0;
  updateGame(game, .01);
  assert.equal(game.rocks.length, 1);
  assert.equal(game.drones.length, 1);
  assert.equal(game.pickups.length, 2);
  assert.equal(game.bullets.length, 1);
  for (const object of [...game.rocks, ...game.drones, ...game.pickups]) {
    assert.ok(object.x > game.width - 10);
    assert.ok(object.y > 0 && object.y < WORLD_HEIGHT);
  }
});

test('distance integration remains consistent across normal frame rates', () => {
  const a = quiet(createGame());
  const b = quiet(createGame());
  for (let i = 0; i < 300; i++) updateGame(a, 1 / 30);
  for (let i = 0; i < 600; i++) updateGame(b, 1 / 60);
  assert.ok(Math.abs(a.elapsed - b.elapsed) < 1e-8);
  assert.ok(Math.abs(a.distance - b.distance) < .05);
});

test('seeded long-running games are deterministic and keep entity counts bounded', () => {
  function play() {
    const game = createGame({ width: 1100, random: seeded(42) });
    for (let frame = 0; frame < 60 * 75; frame++) {
      game.player.invulnerable = 2;
      if (frame % 420 === 0) setTarget(game, 250 + (frame % 840 ? 100 : 0), 110 + (frame % 1260 ? 200 : 0));
      if (frame % 600 === 0) useWave(game);
      updateGame(game, 1 / 60);
      assert.ok(game.particles.length <= 220);
      assert.ok(game.bullets.length < 20 && game.rocks.length < 30);
    }
    return [game.score, game.stars, game.destroyed, game.dronesDestroyed, game.player.health, game.rocks.length];
  }
  assert.deepEqual(play(), play());
});
