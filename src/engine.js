export const TILE = 32;
export const WIDTH = 29,
  HEIGHT = 19;
export const FLOORS = [
  {
    name: "Забытый архив",
    subtitle: "Даже камень хранит чужие секреты",
    color: "#73c6b8",
    keys: [
      [15, 3],
      [12, 15],
    ],
    exit: [25, 15],
    spawn: [4, 5],
    fountain: [6, 4],
    secret: { wall: [8, 14], gem: [3, 15] },
    rooms: [
      [1, 2, 8, 6],
      [12, 1, 7, 6],
      [22, 3, 6, 7],
      [10, 11, 10, 7],
      [23, 13, 5, 5],
      [1, 13, 6, 4],
    ],
    paths: [
      [5, 5, 15, 5],
      [15, 5, 15, 4],
      [15, 4, 25, 6],
      [15, 5, 15, 14],
      [25, 6, 25, 15],
      [15, 14, 25, 15],
      [6, 14, 10, 14],
    ],
    spikes: [
      [11, 5],
      [12, 5],
      [15, 9],
      [25, 11],
    ],
    enemies: [
      [24, 6, 22, 6],
      [17, 14, 12, 14],
    ],
  },
  {
    name: "Затопленный склеп",
    subtitle: "Слушай тишину между ловушками",
    color: "#89aed1",
    keys: [
      [5, 14],
      [24, 4],
    ],
    exit: [25, 15],
    spawn: [4, 4],
    fountain: [15, 14],
    secret: { wall: [20, 2], gem: [24, 1] },
    rooms: [
      [1, 1, 8, 7],
      [12, 2, 6, 7],
      [22, 3, 6, 5],
      [1, 11, 8, 7],
      [12, 11, 7, 7],
      [22, 11, 6, 7],
      [21, 1, 7, 2],
    ],
    paths: [
      [5, 4, 15, 4],
      [15, 4, 25, 4],
      [5, 4, 5, 14],
      [5, 14, 15, 14],
      [15, 14, 25, 14],
      [25, 4, 25, 14],
      [15, 4, 15, 14],
      [17, 2, 22, 2],
    ],
    spikes: [
      [10, 4],
      [11, 4],
      [5, 9],
      [9, 14],
      [10, 14],
      [25, 9],
      [15, 10],
    ],
    enemies: [
      [24, 14, 24, 11],
      [4, 12, 7, 14],
      [15, 6, 15, 14],
    ],
  },
  {
    name: "Сердце подземелья",
    subtitle: "Последняя дверь уже близко",
    color: "#d8af75",
    keys: [
      [14, 3],
      [25, 7],
      [5, 15],
    ],
    exit: [25, 15],
    spawn: [4, 4],
    fountain: [15, 14],
    secret: { wall: [10, 16], gem: [10, 17] },
    rooms: [
      [1, 1, 8, 7],
      [11, 1, 8, 6],
      [22, 3, 6, 7],
      [2, 12, 7, 6],
      [12, 11, 7, 7],
      [22, 12, 6, 6],
      [9, 17, 4, 2],
    ],
    paths: [
      [5, 4, 15, 4],
      [15, 4, 25, 6],
      [5, 4, 5, 15],
      [5, 15, 15, 14],
      [15, 4, 15, 14],
      [25, 6, 25, 15],
      [15, 14, 25, 15],
      [10, 14, 10, 18],
    ],
    spikes: [
      [10, 4],
      [20, 4],
      [5, 9],
      [5, 10],
      [10, 15],
      [15, 9],
      [20, 14],
      [25, 11],
    ],
    enemies: [
      [25, 7, 23, 5],
      [16, 14, 12, 14],
      [6, 15, 6, 12],
      [15, 4, 15, 6],
    ],
  },
];
const center = ([x, y]) => ({ x: (x + 0.5) * TILE, y: (y + 0.5) * TILE });
export function makeFloor(index) {
  const config = FLOORS[index],
    map = Array.from({ length: HEIGHT }, () => Array(WIDTH).fill("#"));
  const carve = (x, y) => {
    if (x > 0 && y > 0 && x < WIDTH - 1 && y < HEIGHT - 1) map[y][x] = ".";
  };
  for (const [x, y, w, h] of config.rooms)
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) carve(i, j);
  for (const [x1, y1, x2, y2] of config.paths) {
    for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
      carve(x, y1);
      if (x1 !== 6) carve(x, y1 + 1);
    }
    for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
      carve(x2, y);
      carve(x2 + 1, y);
    }
  }
  const [sx, sy] = config.secret.wall;
  map[sy][sx] = "X";
  // Secret entrances are one tile wide: no route around the cracked masonry.
  if (index === 0) {
    map[13][8] = "#";
    map[15][8] = "#";
  }
  if (index === 1) {
    map[1][20] = "#";
    for (let x = 19; x < 28; x++) map[3][x] = "#";
    map[2][19] = ".";
  }
  if (index === 2) {
    map[16][9] = "#";
    map[16][11] = "#";
    map[17][9] = "#";
    map[17][11] = "#";
  }
  return { config, map };
}
export function lineOfSight(map, x0, y0, x1, y1) {
  let dx = Math.abs(x1 - x0),
    sx = x0 < x1 ? 1 : -1,
    dy = -Math.abs(y1 - y0),
    sy = y0 < y1 ? 1 : -1,
    err = dx + dy;
  while (true) {
    if (x0 === x1 && y0 === y1) return true;
    if (map[y0]?.[x0] !== ".") return false;
    const e = 2 * err;
    if (e >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}
export class Dungeon {
  constructor({ onChange = () => {}, onEvent = () => {} } = {}) {
    this.onChange = onChange;
    this.onEvent = onEvent;
    this.reset(false);
  }
  reset(start = true) {
    this.elapsed = 0;
    this.deaths = 0;
    this.secretFloors = new Set();
    this.floorIndex = 0;
    this.loadFloor();
    this.phase = start ? "playing" : "intro";
    this.emit();
  }
  loadFloor() {
    const { config, map } = makeFloor(this.floorIndex);
    this.config = config;
    this.map = map;
    this.player = { ...center(config.spawn), hp: 3, facing: { x: 0, y: 1 } };
    this.keys = config.keys.map((p) => ({ ...center(p), taken: false }));
    this.exit = center(config.exit);
    this.fountain = { ...center(config.fountain), used: false };
    this.secret = {
      ...center(config.secret.gem),
      taken: this.secretFloors.has(this.floorIndex),
      open: false,
    };
    this.spikes = config.spikes.map((p, i) => ({
      ...center(p),
      offset: i * 0.41,
    }));
    this.enemies = config.enemies.map((e, i) => ({
      ...center(e.slice(0, 2)),
      a: center(e.slice(0, 2)),
      b: center(e.slice(2)),
      target: 1,
      seed: i * 1.7,
    }));
    this.floorTime = 0;
    this.dashCooldown = 0;
    this.dashTime = 0;
    this.invulnerable = 0;
    this.shake = 0;
    this.seen = new Set();
    this.visible = new Set();
    this.lastVision = "";
    this.updateVision();
    this.message = "Найди ключи и доберись до выхода.";
    this.messageTime = 5;
    this.lastHud = "";
  }
  get keyCount() {
    return this.keys.filter((k) => k.taken).length;
  }
  get context() {
    const p = this.player,
      near = (o) =>
        Math.hypot(p.x - o.x, p.y - o.y) < TILE * 1.45 &&
        lineOfSight(
          this.map,
          Math.floor(p.x / TILE),
          Math.floor(p.y / TILE),
          Math.floor(o.x / TILE),
          Math.floor(o.y / TILE),
        );
    if (near(this.exit))
      return this.keyCount === this.keys.length
        ? "Открыть выход"
        : `Нужно ещё ${this.keys.length - this.keyCount} кл.`;
    const wall = center(this.config.secret.wall);
    if (!this.secret.open && near(wall)) return "Проверить стену";
    if (!this.fountain.used && near(this.fountain)) return "Выпить воду";
    return null;
  }
  emit() {
    this.onChange(this.snapshot());
  }
  snapshot() {
    return {
      phase: this.phase,
      floor: this.floorIndex,
      name: this.config.name,
      hp: this.player.hp,
      keys: this.keyCount,
      needed: this.keys.length,
      secrets: this.secretFloors.size,
      deaths: this.deaths,
      elapsed: this.elapsed,
      dash: Math.max(0, 1 - this.dashCooldown / 1.8),
      context: this.context,
      message: this.messageTime > 0 ? this.message : "",
    };
  }
  notify(text, type = "notice") {
    this.message = text;
    this.messageTime = 4;
    this.onEvent(type);
    this.emit();
  }
  start() {
    if (this.phase === "intro") {
      this.phase = "playing";
      this.emit();
    }
  }
  pause() {
    if (this.phase === "playing") {
      this.phase = "paused";
      this.emit();
    }
  }
  resume() {
    if (this.phase === "paused") {
      this.phase = "playing";
      this.emit();
    }
  }
  retry() {
    if (this.phase === "dead") {
      this.loadFloor();
      this.phase = "playing";
      this.emit();
    }
  }
  next() {
    if (this.phase !== "floor-clear") return;
    this.floorIndex++;
    this.loadFloor();
    this.phase = "playing";
    this.notify("Новый этаж. Факел ещё горит.", "level");
  }
  solid(x, y) {
    const t = this.map[Math.floor(y / TILE)]?.[Math.floor(x / TILE)];
    return t !== ".";
  }
  blocked(x, y, r = 8) {
    return [
      [-r, -r],
      [r, -r],
      [-r, r],
      [r, r],
    ].some(([dx, dy]) => this.solid(x + dx, y + dy));
  }
  move(object, dx, dy, r = 8) {
    if (!this.blocked(object.x + dx, object.y, r)) object.x += dx;
    if (!this.blocked(object.x, object.y + dy, r)) object.y += dy;
  }
  dash() {
    if (this.phase !== "playing" || this.dashCooldown > 0) return false;
    this.dashTime = 0.19;
    this.dashCooldown = 1.8;
    this.invulnerable = Math.max(this.invulnerable, 0.22);
    this.onEvent("dash");
    this.emit();
    return true;
  }
  hurt() {
    if (this.phase !== "playing" || this.invulnerable > 0) return;
    this.player.hp--;
    this.invulnerable = 1.25;
    this.shake = 0.22;
    this.onEvent("hurt");
    if (this.player.hp <= 0) {
      this.deaths++;
      this.phase = "dead";
      this.message = "Факел погас. Но путь ты уже знаешь.";
      this.messageTime = 8;
    } else {
      this.message = "Осторожно! Факел защищает тебя лишь на мгновение.";
      this.messageTime = 3;
    }
    this.emit();
  }
  interact() {
    if (this.phase !== "playing") return;
    const context = this.context;
    if (context === "Открыть выход") {
      if (this.floorIndex === FLOORS.length - 1) {
        this.phase = "won";
        this.onEvent("win");
      } else {
        this.phase = "floor-clear";
        this.onEvent("level");
      }
      this.emit();
      return;
    }
    if (context === "Проверить стену") {
      const [x, y] = this.config.secret.wall;
      this.map[y][x] = ".";
      this.secret.open = true;
      this.lastVision = "";
      this.updateVision();
      this.notify("За кладкой — тайный проход. Загляни внутрь.", "secret");
      return;
    }
    if (context === "Выпить воду") {
      if (this.player.hp === 3) {
        this.notify("Здоровье полное. Прибереги источник.");
        return;
      }
      this.player.hp++;
      this.fountain.used = true;
      this.notify("Источник вернул одно сердце.", "heal");
      return;
    }
    this.notify(
      context?.startsWith("Нужно")
        ? "Выход заперт. Собери все ключи этого этажа."
        : "Подойди к источнику, треснувшей стене или выходу.",
    );
  }
  spikeState(spike) {
    const t = (this.floorTime + spike.offset) % 2.9;
    return t > 1.9 ? "active" : t > 1.4 ? "warning" : "safe";
  }
  updateVision() {
    const x = Math.floor(this.player.x / TILE),
      y = Math.floor(this.player.y / TILE),
      stamp = `${x},${y},${this.secret.open}`;
    if (stamp === this.lastVision) return;
    this.lastVision = stamp;
    this.visible = new Set();
    for (let j = Math.max(0, y - 6); j <= Math.min(HEIGHT - 1, y + 6); j++)
      for (let i = Math.max(0, x - 6); i <= Math.min(WIDTH - 1, x + 6); i++) {
        if (
          Math.hypot(i - x, j - y) <= 6.2 &&
          lineOfSight(this.map, x, y, i, j)
        ) {
          const k = j * WIDTH + i;
          this.visible.add(k);
          this.seen.add(k);
        }
      }
  }
  tick(delta, input = { x: 0, y: 0 }) {
    if (this.phase !== "playing") return;
    const dt = Math.min(Math.max(delta, 0), 0.04);
    this.elapsed += dt;
    this.floorTime += dt;
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.shake = Math.max(0, this.shake - dt);
    this.messageTime = Math.max(0, this.messageTime - dt);
    let { x = 0, y = 0 } = input;
    const length = Math.hypot(x, y);
    if (length > 0) {
      x /= length;
      y /= length;
      this.player.facing = { x, y };
    }
    const speed = this.dashTime > 0 ? 360 : 112,
      dir = this.dashTime > 0 ? this.player.facing : { x, y };
    // Small movement substeps prevent dashes from tunnelling through thin walls.
    const steps = Math.max(1, Math.ceil((speed * dt) / 5));
    for (let i = 0; i < steps; i++)
      this.move(
        this.player,
        (dir.x * speed * dt) / steps,
        (dir.y * speed * dt) / steps,
      );
    this.dashTime = Math.max(0, this.dashTime - dt);
    this.updateVision();
    for (const key of this.keys)
      if (
        !key.taken &&
        Math.hypot(key.x - this.player.x, key.y - this.player.y) < 17
      ) {
        key.taken = true;
        this.notify(
          this.keyCount === this.keys.length
            ? "Все ключи собраны. Найди светящийся выход!"
            : "Ключ найден. Продолжай исследование.",
          "key",
        );
      }
    if (
      !this.secret.taken &&
      this.secret.open &&
      Math.hypot(this.secret.x - this.player.x, this.secret.y - this.player.y) <
        17
    ) {
      this.secret.taken = true;
      this.secretFloors.add(this.floorIndex);
      this.notify("Найдена древняя печать. Ещё один секрет раскрыт.", "secret");
    }
    for (const spike of this.spikes)
      if (
        this.spikeState(spike) === "active" &&
        Math.hypot(spike.x - this.player.x, spike.y - this.player.y) < 17
      )
        this.hurt();
    for (const enemy of this.enemies) {
      const dx = this.player.x - enemy.x,
        dy = this.player.y - enemy.y,
        d = Math.hypot(dx, dy);
      const sees =
        d < TILE * 4 &&
        lineOfSight(
          this.map,
          Math.floor(enemy.x / TILE),
          Math.floor(enemy.y / TILE),
          Math.floor(this.player.x / TILE),
          Math.floor(this.player.y / TILE),
        );
      const target = sees ? this.player : enemy.target ? enemy.b : enemy.a;
      const vx = target.x - enemy.x,
        vy = target.y - enemy.y,
        dist = Math.hypot(vx, vy);
      if (dist < 5) enemy.target = 1 - enemy.target;
      else
        this.move(
          enemy,
          (vx / dist) * (sees ? 62 : 33) * dt,
          (vy / dist) * (sees ? 62 : 33) * dt,
          7,
        );
      if (d < 19) this.hurt();
    }
    const hud = JSON.stringify([
      Math.floor(this.elapsed),
      this.player.hp,
      this.keyCount,
      this.phase,
      this.context,
      this.messageTime > 0,
      this.dashCooldown === 0,
    ]);
    if (hud !== this.lastHud) {
      this.lastHud = hud;
      this.emit();
    }
  }
}
export const formatTime = (seconds) =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
