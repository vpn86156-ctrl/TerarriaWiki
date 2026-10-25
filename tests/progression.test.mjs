import { test } from "node:test";
import assert from "node:assert/strict";
import { Profile, ITEMS, RARITIES } from "../src/profile.js";
import { Dungeon, TILE, makeFloor, FLOORS } from "../src/engine.js";
const memory = () => {
  let raw = null;
  return { getItem: () => raw, setItem: (k, v) => (raw = v) };
};
test("profile starts at zero, rejects invalid saves and keeps defaults", () => {
  for (const raw of [
    "null",
    "[]",
    '{"coins":-500,"owned":["fake"],"equipped":{"skin":"mercury"}}',
    "{",
  ]) {
    const p = new Profile({ getItem: () => raw });
    assert.equal(p.coins, 0);
    assert.deepEqual([...p.owned], ["wanderer", "worn"]);
    assert.equal(p.equipped.skin, "wanderer");
  }
});
test("cannot open without coins, invalid RNG does not charge, duplicates refund", () => {
  const p = new Profile(memory());
  assert.equal(
    p.openCase(() => 0),
    null,
  );
  p.earn(200);
  assert.throws(() => p.openCase(() => NaN));
  assert.equal(p.coins, 200);
  const a = p.openCase(() => 0);
  assert.equal(a.item.rarity, "common");
  assert.equal(a.duplicate, false);
  assert.equal(p.coins, 100);
  const b = p.openCase(() => 0);
  assert.equal(b.duplicate, true);
  assert.equal(b.refund, 15);
  assert.equal(p.coins, 15);
  assert.equal(p.opened, 2);
});
test("exact rarity thresholds and all drop items can be reached", () => {
  const found = new Set();
  for (const [sample, id] of [
    [0, "common"],
    [0.599999, "common"],
    [0.6, "rare"],
    [0.849999, "rare"],
    [0.85, "epic"],
    [0.969999, "epic"],
    [0.97, "legendary"],
    [0.999999, "legendary"],
  ]) {
    const pool = ITEMS.filter(
      (i) => i.rarity === id && !["wanderer", "worn"].includes(i.id),
    );
    for (let i = 0; i < pool.length; i++) {
      const p = new Profile(memory());
      p.earn(100);
      let calls = 0;
      const r = p.openCase(() =>
        calls++ === 0 ? sample : (i + 0.5) / pool.length,
      );
      assert.equal(r.rarity.id, id);
      found.add(r.item.id);
    }
  }
  assert.equal(found.size, ITEMS.length - 2);
  assert.equal(
    RARITIES.reduce((s, r) => s + r.chance, 0),
    100,
  );
});
test("owned slots, stats and persistence restore without spending", () => {
  const m = memory(),
    p = new Profile(m);
  p.earn(100);
  let call = 0;
  const drop = p.openCase(() => (call++ ? 0 : 0.99));
  assert.equal(p.equip("fake"), false);
  assert.equal(p.equip("mercury"), false);
  assert.ok(p.equip(drop.item.id));
  const q = new Profile(m);
  assert.ok(q.owned.has(drop.item.id));
  assert.deepEqual(q.equipped, p.equipped);
  assert.deepEqual(q.stats(), p.stats());
});
test("storage failure is non-fatal and communicated", () => {
  const p = new Profile({
    getItem() {
      throw Error();
    },
    setItem() {
      throw Error();
    },
  });
  p.earn(100);
  assert.equal(p.persistent, false);
  assert.ok(p.openCase(() => 0));
});
test("gear affects speed, cooldown, vision and absorbs exactly one hit", () => {
  const a = new Dungeon(),
    b = new Dungeon({
      getLoadout: () => ({ speed: 0.15, cooldown: 0.2, vision: 1, shield: 1 }),
    });
  a.start();
  b.start();
  const initial = a.player.x;
  a.tick(0.02, { x: 1 });
  b.tick(0.02, { x: 1 });
  assert.ok(b.player.x - initial > a.player.x - initial);
  assert.equal(b.dashDuration, 1.6);
  assert.ok(b.visible.size >= a.visible.size);
  b.hurt();
  assert.equal(b.player.hp, 3);
  assert.equal(b.shield, 0);
  b.invulnerable = 0;
  b.hurt();
  assert.equal(b.player.hp, 2);
  b.phase = "dead";
  b.retry();
  assert.equal(b.shield, 1);
});
test("beacon slows enemies and embers grant temporary haste without repeated pickup", () => {
  const g = new Dungeon();
  g.start();
  Object.assign(g.player, g.beacon);
  assert.equal(g.context, "Зажечь маяк");
  g.interact();
  assert.equal(g.beacon.used, true);
  assert.equal(g.beaconTime, 7);
  const ember = g.embers[0];
  Object.assign(g.player, { x: ember.x, y: ember.y });
  g.tick(0.01);
  assert.ok(ember.taken);
  assert.equal(g.hasteTime, 4);
  g.tick(0.01);
  assert.ok(g.hasteTime < 4);
});
test("all new pickups and beacons occupy accessible walkable cells", () => {
  for (let i = 0; i < 3; i++) {
    const g = new Dungeon();
    g.floorIndex = i;
    g.loadFloor();
    const seen = new Set(),
      queue = [FLOORS[i].spawn];
    while (queue.length) {
      const [x, y] = queue.shift(),
        id = `${x},${y}`;
      if (seen.has(id) || g.map[y]?.[x] !== ".") continue;
      seen.add(id);
      queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    for (const p of [g.beacon, ...g.embers])
      assert.ok(
        seen.has(`${Math.floor(p.x / TILE)},${Math.floor(p.y / TILE)}`),
      );
  }
});
