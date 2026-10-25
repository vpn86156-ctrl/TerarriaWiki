import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import { WebSocket } from "ws";
import { CoopLevel } from "../src/coop-engine.js";
import { attachRooms } from "../server/rooms.mjs";
for (const level of [0, 1])
  test(`coop ${level}: two plates, key requirement and both players at exit`, () => {
    const g = new CoopLevel(level);
    Object.assign(g.players[0], g.plates[0]);
    for (let n = 0; n < 40; n++) g.tick(1 / 30);
    assert.equal(g.gateOpen, false);
    Object.assign(g.players[1], g.plates[1]);
    for (let n = 0; n < 40; n++) g.tick(1 / 30);
    assert.equal(g.gateOpen, true);
    assert.equal(g.map[3][11], ".");
    Object.assign(g.players[0], g.exit);
    g.tick(0.01, [{ interact: true }]);
    assert.equal(g.phase, "playing");
    g.keys.forEach((k) => (k.taken = true));
    g.tick(0.01, [{ interact: true }]);
    assert.equal(g.phase, "playing");
    Object.assign(g.players[1], { x: g.exit.x + 32, y: g.exit.y });
    g.tick(0.01, [{ interact: true }]);
    assert.equal(g.phase, "won");
  });
test("coop validates input, blocks walls, revives friend and fails only when both down", () => {
  const g = new CoopLevel();
  const old = g.players[0].x;
  g.tick(0.02, [{ x: Infinity, y: NaN }]);
  assert.equal(g.players[0].x, old);
  g.players[0].x = 40;
  for (let n = 0; n < 50; n++) g.tick(0.03, [{ x: -999 }]);
  assert.ok(g.players[0].x >= 40);
  const p = g.players[0],
    friend = g.players[1];
  Object.assign(friend, { x: p.x + 24, y: p.y, hp: 0 });
  g.tick(0.02, [{ interact: true }]);
  assert.equal(friend.hp, 2);
  friend.hp = 0;
  p.hp = 0;
  g.tick(0.02);
  assert.equal(g.phase, "dead");
});
test("network: create, join, host-only start, authoritative movement, capacity, disconnect", async () => {
  const server = http.createServer((req, res) => res.end("ok")),
    api = attachRooms(server, { origins: ["http://test"] });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const url = `ws://127.0.0.1:${server.address().port}/socket`,
    clients = [];
  async function client() {
    const ws = new WebSocket(url, { origin: "http://test" });
    clients.push(ws);
    await once(ws, "open");
    return ws;
  }
  const wait = (ws, predicate) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        ws.off("message", listener);
        reject(Error("No matching message"));
      }, 2500);
      function listener(data) {
        const m = JSON.parse(data);
        if (predicate(m)) {
          clearTimeout(timer);
          ws.off("message", listener);
          resolve(m);
        }
      }
      ws.on("message", listener);
    });
  try {
    const a = await client(),
      pending = wait(a, (m) => m.code);
    a.send(JSON.stringify({ type: "create", name: "Alice" }));
    const first = await pending,
      room = api.rooms.get(first.code);
    assert.equal(first.host, true);
    const b = await client(),
      joined = wait(b, (m) => m.names?.length === 2);
    b.send(JSON.stringify({ type: "join", code: first.code, name: "Bob" }));
    await joined;
    b.send(JSON.stringify({ type: "start" }));
    await new Promise((r) => setTimeout(r, 80));
    assert.equal(room.game, null);
    const started = wait(a, (m) => m.state?.phase === "playing");
    a.send(JSON.stringify({ type: "start" }));
    await started;
    const startX = room.game.players[0].x;
    a.send(JSON.stringify({ type: "input", x: 1, y: 0 }));
    await new Promise((r) => setTimeout(r, 180));
    assert.ok(room.game.players[0].x > startX + 8);
    await new Promise((r) => setTimeout(r, 500));
    const stopped = room.game.players[0].x;
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(room.game.players[0].x, stopped);
    const c = await client(),
      full = wait(c, (m) => m.type === "error");
    c.send(JSON.stringify({ type: "join", code: first.code }));
    assert.match((await full).message, /занята/);
    const disconnected = wait(
      a,
      (m) => m.type === "state" && m.names.length === 1 && m.state === null,
    );
    b.close();
    await disconnected;
    assert.equal(room.game, null);
  } finally {
    for (const ws of clients) ws.terminate();
    api.close();
    await new Promise((r) => server.close(r));
  }
});

test("both cooperative layouts connect spawns, plates, keys and opened exit", () => {
  for (const level of [0, 1]) {
    const g = new CoopLevel(level);
    g.map[3][11] = ".";
    const seen = new Set(),
      queue = [[3, 12]];
    while (queue.length) {
      const [x, y] = queue.shift(),
        id = `${x},${y}`;
      if (seen.has(id) || g.map[y]?.[x] !== ".") continue;
      seen.add(id);
      queue.push([x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]);
    }
    for (const p of [...g.players, ...g.keys, ...g.plates, g.exit])
      assert.ok(seen.has(`${Math.floor(p.x / 32)},${Math.floor(p.y / 32)}`));
  }
  assert.notDeepEqual(new CoopLevel(0).map, new CoopLevel(1).map);
});
