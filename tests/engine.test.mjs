import { test } from "node:test";
import assert from "node:assert/strict";
import {
  Dungeon,
  FLOORS,
  makeFloor,
  TILE,
  WIDTH,
  HEIGHT,
  lineOfSight,
  formatTime,
} from "../src/engine.js";
const point = ([x, y]) => ({ x: (x + 0.5) * TILE, y: (y + 0.5) * TILE });
function reachable(map, start) {
  const visited = new Set(),
    queue = [start];
  while (queue.length) {
    const [x, y] = queue.shift(),
      key = `${x},${y}`;
    if (visited.has(key) || map[y]?.[x] !== ".") continue;
    visited.add(key);
    queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  return visited;
}
const go = (game, p) => {
  Object.assign(game.player, point(p));
  game.lastVision = "";
  game.updateVision();
};
for (let i = 0; i < FLOORS.length; i++) {
  test(`floor ${i + 1}: mandatory targets reachable, secret sealed, boundary solid`, () => {
    const { config, map } = makeFloor(i),
      r = reachable(map, config.spawn);
    assert.equal(map.length, HEIGHT);
    assert.ok(map.every((row) => row.length === WIDTH));
    assert.ok(map[0].every((c) => c === "#"));
    assert.ok(map[HEIGHT - 1].every((c) => c === "#"));
    assert.ok(map.every((row) => row[0] === "#" && row[WIDTH - 1] === "#"));
    for (const p of [
      ...config.keys,
      config.exit,
      config.fountain,
      ...config.enemies.map((e) => e.slice(0, 2)),
    ])
      assert.ok(r.has(p.join(",")), `target ${p} must be reachable`);
    assert.ok(
      !r.has(config.secret.gem.join(",")),
      "secret must not have an unsealed route",
    );
    const [wx, wy] = config.secret.wall;
    assert.equal(map[wy][wx], "X");
    assert.ok(
      [
        [wx + 1, wy],
        [wx - 1, wy],
        [wx, wy - 1],
        [wx, wy + 1],
      ].some((p) => r.has(p.join(","))),
      "entrance must be accessible",
    );
    map[wy][wx] = ".";
    assert.ok(
      reachable(map, config.spawn).has(config.secret.gem.join(",")),
      "opening wall must give access to secret",
    );
  });
}
test("constructor, intro, start and pause freeze simulation", () => {
  const g = new Dungeon();
  assert.equal(g.phase, "intro");
  g.tick(1, { x: 1 });
  assert.equal(g.elapsed, 0);
  g.start();
  g.tick(0.02, { x: 1 });
  assert.equal(g.elapsed, 0.02);
  g.pause();
  const state = JSON.stringify(g.snapshot()),
    x = g.player.x;
  g.tick(1, { x: 1 });
  assert.equal(JSON.stringify(g.snapshot()), state);
  assert.equal(g.player.x, x);
  g.resume();
  assert.equal(g.phase, "playing");
});
test("diagonal speed is normalized and invalid wall is solid", () => {
  const a = new Dungeon(),
    b = new Dungeon();
  a.start();
  b.start();
  a.tick(0.02, { x: 1, y: 0 });
  b.tick(0.02, { x: 1, y: 1 });
  const spawn = point(FLOORS[0].spawn);
  assert.ok(
    Math.abs(
      Math.hypot(a.player.x - spawn.x, a.player.y - spawn.y) -
        Math.hypot(b.player.x - spawn.x, b.player.y - spawn.y),
    ) < 1e-8,
  );
  assert.ok(a.solid(-1, 10));
  assert.ok(a.blocked(1, 1));
});
test("movement and dashes cannot tunnel through walls", () => {
  const g = new Dungeon();
  g.start();
  go(g, [1, 4]);
  g.player.facing = { x: -1, y: 0 };
  assert.equal(g.dash(), true);
  for (let i = 0; i < 15; i++) g.tick(0.04, { x: -1, y: 0 });
  assert.ok(g.player.x >= TILE + 8);
  assert.equal(g.blocked(g.player.x, g.player.y), false);
  assert.equal(g.dash(), false);
});
test("dash needs playing phase, protects briefly and recharges", () => {
  const g = new Dungeon();
  assert.equal(g.dash(), false);
  g.start();
  assert.ok(g.dash());
  g.hurt();
  assert.equal(g.player.hp, 3);
  for (let i = 0; i < 50; i++) g.tick(0.04);
  assert.equal(g.dashCooldown, 0);
  g.hurt();
  assert.equal(g.player.hp, 2);
  assert.ok(g.dash());
});
test("damage i-frames, death, and retry preserve run clock and deaths", () => {
  const g = new Dungeon();
  g.start();
  g.tick(0.04);
  g.hurt();
  g.hurt();
  assert.equal(g.player.hp, 2);
  g.invulnerable = 0;
  g.hurt();
  g.invulnerable = 0;
  g.hurt();
  assert.equal(g.phase, "dead");
  assert.equal(g.deaths, 1);
  g.hurt();
  assert.equal(g.player.hp, 0);
  const t = g.elapsed;
  g.retry();
  assert.equal(g.phase, "playing");
  assert.equal(g.player.hp, 3);
  assert.equal(g.elapsed, t);
  assert.equal(g.deaths, 1);
  assert.equal(g.keyCount, 0);
});
test("keys are automatic and cannot be taken twice", () => {
  let events = 0;
  const g = new Dungeon({
    onEvent: (t) => {
      if (t === "key") events++;
    },
  });
  g.start();
  go(g, FLOORS[0].keys[0]);
  g.tick(0.001);
  g.tick(0.001);
  assert.equal(g.keyCount, 1);
  assert.equal(events, 1);
});
test("exit requires all keys and close proximity", () => {
  const g = new Dungeon();
  g.start();
  go(g, g.config.exit);
  g.interact();
  assert.equal(g.phase, "playing");
  assert.match(g.message, /заперт/);
  g.keys.forEach((k) => (k.taken = true));
  go(g, g.config.spawn);
  g.interact();
  assert.equal(g.phase, "playing");
  go(g, g.config.exit);
  g.interact();
  assert.equal(g.phase, "floor-clear");
  const t = g.elapsed;
  g.next();
  assert.equal(g.floorIndex, 1);
  assert.equal(g.phase, "playing");
  assert.equal(g.player.hp, 3);
  assert.equal(g.keyCount, 0);
  assert.equal(g.elapsed, t);
});
test("three exits finish game and next cannot exceed floor count", () => {
  const g = new Dungeon();
  g.start();
  for (let i = 0; i < 3; i++) {
    g.keys.forEach((k) => (k.taken = true));
    go(g, g.config.exit);
    g.interact();
    assert.equal(g.phase, i === 2 ? "won" : "floor-clear");
    g.next();
  }
  assert.equal(g.floorIndex, 2);
  g.tick(1, { x: 1 });
  assert.equal(g.elapsed, 0);
});
test("fountain not consumed at full health; heals once via action", () => {
  const g = new Dungeon();
  g.start();
  go(g, g.config.fountain);
  g.interact();
  assert.equal(g.fountain.used, false);
  g.player.hp = 1;
  g.interact();
  assert.equal(g.player.hp, 2);
  assert.equal(g.fountain.used, true);
  g.interact();
  assert.equal(g.player.hp, 2);
});
test("secret needs interaction, collection persists through retry without duplicate points", () => {
  const g = new Dungeon();
  g.start();
  const [x, y] = g.config.secret.wall;
  go(g, [x + 1, y]);
  g.interact();
  assert.equal(g.secret.open, true);
  assert.equal(g.map[y][x], ".");
  go(g, g.config.secret.gem);
  g.tick(0.001);
  assert.equal(g.secretFloors.size, 1);
  g.phase = "dead";
  g.retry();
  assert.equal(g.secretFloors.size, 1);
  assert.equal(g.secret.open, false);
  assert.equal(g.secret.taken, true);
  g.reset();
  assert.equal(g.secretFloors.size, 0);
});
test("spikes are telegraphed, cyclic and only hurt while active", () => {
  const g = new Dungeon();
  g.start();
  const spike = g.spikes[0];
  Object.assign(g.player, { x: spike.x, y: spike.y });
  g.floorTime = 0;
  assert.equal(g.spikeState(spike), "safe");
  g.tick(0.001);
  assert.equal(g.player.hp, 3);
  g.floorTime = 1.5;
  assert.equal(g.spikeState(spike), "warning");
  g.floorTime = 2;
  assert.equal(g.spikeState(spike), "active");
  g.tick(0.001);
  assert.equal(g.player.hp, 2);
  g.floorTime = 3;
  assert.equal(g.spikeState(spike), "safe");
});
test("fog remembers discovered tiles and LOS stops behind wall", () => {
  const g = new Dungeon(),
    before = g.seen.size;
  assert.ok(before > 0);
  go(g, [15, 5]);
  assert.ok(g.seen.size >= before);
  assert.ok(g.seen.has(5 * WIDTH + 4));
  assert.ok(!g.visible.has(5 * WIDTH + 4));
  const map = [".....".split(""), "..#..".split(""), ".....".split("")];
  assert.equal(lineOfSight(map, 0, 1, 1, 1), true);
  assert.equal(lineOfSight(map, 0, 1, 2, 1), true);
  assert.equal(lineOfSight(map, 0, 1, 4, 1), false);
});
test("large deltas are clamped, negative deltas cannot reverse timer", () => {
  const g = new Dungeon();
  g.start();
  g.tick(10);
  assert.equal(g.elapsed, 0.04);
  g.tick(-10);
  assert.equal(g.elapsed, 0.04);
});
test("time formatter supports long runs", () => {
  assert.equal(formatTime(0), "00:00");
  assert.equal(formatTime(65.9), "01:05");
  assert.equal(formatTime(3600), "60:00");
});
