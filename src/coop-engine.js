// Shared deterministic rules. The server alone advances this simulation.
export const COOP_WIDTH = 23,
  COOP_HEIGHT = 15,
  CT = 32;
const at = (x, y) => ({ x: (x + 0.5) * CT, y: (y + 0.5) * CT });
export class CoopLevel {
  constructor(level = 0) {
    this.level = level === 1 ? 1 : 0;
    this.name = this.level ? "Зеркальный зал" : "Два огня";
    this.phase = "playing";
    this.elapsed = 0;
    this.map = Array.from({ length: 15 }, (_, y) =>
      Array.from({ length: 23 }, (_, x) =>
        x > 0 && y > 0 && x < 22 && y < 14 ? "." : "#",
      ),
    );
    for (let y = 1; y < 11; y++) {
      this.map[y][10] = "#";
      this.map[y][11] = "#";
      this.map[y][12] = "#";
    }
    for (let y = 1; y <= 2; y++)
      for (let x = 10; x <= 12; x++) this.map[y][x] = ".";
    this.map[3][11] = "G";
    for (let y = 4; y < 12; y++) this.map[y][11] = ".";
    if (this.level) {
      for (const [y, leftGap, rightGap] of [
        [7, 3, 19],
        [10, 7, 15],
      ]) {
        for (let x = 1; x <= 9; x++) if (x !== leftGap) this.map[y][x] = "#";
        for (let x = 13; x <= 21; x++) if (x !== rightGap) this.map[y][x] = "#";
      }
    }
    this.players = [
      { ...at(3, 12), hp: 3, inv: 0, cd: 0, dash: 0, face: { x: 0, y: -1 } },
      { ...at(19, 12), hp: 3, inv: 0, cd: 0, dash: 0, face: { x: 0, y: -1 } },
    ];
    this.keys = [
      { ...at(3, 3), taken: false },
      { ...at(19, 3), taken: false },
    ];
    this.plates = (
      this.level
        ? [
            [4, 5],
            [19, 5],
          ]
        : [
            [6, 6],
            [17, 6],
          ]
    ).map(([x, y]) => ({ ...at(x, y), active: false }));
    this.exit = at(11, 1);
    this.charge = 0;
    this.gateOpen = false;
    this.spikes = (
      this.level
        ? [
            [4, 8],
            [6, 9],
            [17, 8],
            [19, 9],
            [11, 8],
          ]
        : [
            [6, 9],
            [17, 9],
            [11, 6],
          ]
    ).map(([x, y], i) => ({ ...at(x, y), offset: i * 0.5 }));
  }
  solid(x, y) {
    return this.map[Math.floor(y / 32)]?.[Math.floor(x / 32)] !== ".";
  }
  blocked(x, y) {
    return [
      [-8, -8],
      [8, -8],
      [-8, 8],
      [8, 8],
    ].some(([dx, dy]) => this.solid(x + dx, y + dy));
  }
  spikeState(s) {
    const t = (this.elapsed + s.offset) % 3;
    return t > 2 ? "active" : t > 1.4 ? "warning" : "safe";
  }
  tick(dt, inputs = []) {
    if (this.phase !== "playing") return;
    dt = Math.min(0.05, Math.max(0, dt));
    this.elapsed += dt;
    this.players.forEach((p, i) => {
      p.inv = Math.max(0, p.inv - dt);
      p.cd = Math.max(0, p.cd - dt);
      if (p.hp <= 0) return;
      let x = Number.isFinite(inputs[i]?.x)
          ? Math.max(-1, Math.min(1, inputs[i].x))
          : 0,
        y = Number.isFinite(inputs[i]?.y)
          ? Math.max(-1, Math.min(1, inputs[i].y))
          : 0;
      const len = Math.hypot(x, y);
      if (len > 0) {
        x /= len;
        y /= len;
        p.face = { x, y };
      }
      if (inputs[i]?.dash && p.cd === 0) {
        p.dash = 0.19;
        p.inv = Math.max(p.inv, 0.22);
        p.cd = 1.8;
      }
      if (p.dash > 0) {
        x = p.face.x;
        y = p.face.y;
      }
      const speed = p.dash > 0 ? 360 : 112,
        steps = Math.ceil((speed * dt) / 4) || 1;
      for (let n = 0; n < steps; n++) {
        const dx = (x * speed * dt) / steps,
          dy = (y * speed * dt) / steps;
        if (!this.blocked(p.x + dx, p.y)) p.x += dx;
        if (!this.blocked(p.x, p.y + dy)) p.y += dy;
      }
      p.dash = Math.max(0, p.dash - dt);
      for (const k of this.keys)
        if (!k.taken && Math.hypot(p.x - k.x, p.y - k.y) < 18) k.taken = true;
      for (const s of this.spikes)
        if (
          this.spikeState(s) === "active" &&
          Math.hypot(p.x - s.x, p.y - s.y) < 17 &&
          p.inv === 0
        ) {
          p.hp--;
          p.inv = 1.3;
        }
      if (inputs[i]?.interact) {
        const friend = this.players[1 - i];
        if (friend.hp <= 0 && Math.hypot(p.x - friend.x, p.y - friend.y) < 44) {
          friend.hp = 2;
          friend.inv = 2;
        }
        if (
          this.gateOpen &&
          this.keys.every((k) => k.taken) &&
          this.players.every(
            (q) =>
              q.hp > 0 && Math.hypot(q.x - this.exit.x, q.y - this.exit.y) < 65,
          )
        )
          this.phase = "won";
      }
    });
    this.plates.forEach(
      (s) =>
        (s.active = this.players.some(
          (p) => p.hp > 0 && Math.hypot(p.x - s.x, p.y - s.y) < 18,
        )),
    );
    if (!this.gateOpen) {
      this.charge = this.plates.every((s) => s.active) ? this.charge + dt : 0;
      if (this.charge >= 1) {
        this.gateOpen = true;
        this.map[3][11] = ".";
      }
    }
    if (this.players.every((p) => p.hp <= 0)) this.phase = "dead";
  }
  snapshot() {
    return {
      level: this.level,
      name: this.name,
      phase: this.phase,
      elapsed: this.elapsed,
      map: this.map,
      players: this.players,
      keys: this.keys,
      plates: this.plates,
      exit: this.exit,
      gateOpen: this.gateOpen,
      charge: this.charge,
      spikes: this.spikes.map((s) => ({ ...s, state: this.spikeState(s) })),
    };
  }
}
