import { TILE, WIDTH, HEIGHT } from "./engine.js";
const hash = (x, y) => {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
};
export class Renderer {
  constructor(canvas, game) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.game = game;
    this.camera = { x: 0, y: 0 };
    this.particles = [];
    this.trails = [];
    this.lastFx = 0;
    this.walkPhase = 0;
    this.reduced = matchMedia("(prefers-reduced-motion: reduce)");
    this.size();
    this.observer = new ResizeObserver(() => this.size());
    this.observer.observe(canvas);
  }
  burst(type, position = this.game.player) {
    if (this.reduced.matches) return;
    const color =
      {
        key: "#f6d48b",
        hurt: "#ec987a",
        dash: "#8ee1ce",
        secret: "#bc9cf0",
        ember: "#ffc978",
        beacon: "#95e7c6",
        shield: "#f3d38e",
        win: "#f3d38e",
      }[type] || "#afdab3";
    for (let i = 0; i < (type === "win" ? 40 : 16); i++) {
      const angle = Math.random() * Math.PI * 2,
        speed = 20 + Math.random() * 65;
      this.particles.push({
        x: position.x,
        y: position.y - 4,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 12,
        life: 0.4 + Math.random() * 0.5,
        max: 0.9,
        color,
      });
    }
    this.particles = this.particles.slice(-150);
  }
  size() {
    const box = this.canvas.getBoundingClientRect();
    if (box.width < 1 || box.height < 1) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    this.w = box.width;
    this.h = box.height;
    this.dpr = dpr;
    this.canvas.width = Math.round(box.width * dpr);
    this.canvas.height = Math.round(box.height * dpr);
    this.zoom = box.width / ((box.width < 600 ? 14 : 23) * TILE);
    this.ctx.imageSmoothingEnabled = false;
    this.snap = true;
  }
  cacheTerrain() {
    const g = this.game;
    if (this.cachedMap === g.map && this.cachedSecret === g.secret.open) return;
    const original = this.ctx,
      layer = document.createElement("canvas");
    layer.width = WIDTH * TILE;
    layer.height = HEIGHT * TILE;
    this.ctx = layer.getContext("2d");
    this.ctx.imageSmoothingEnabled = false;
    this.buildingCache = true;
    for (let y = 0; y < HEIGHT; y++)
      for (let x = 0; x < WIDTH; x++) this.tile(x, y, g.map[y][x], 0);
    this.ctx = original;
    this.buildingCache = false;
    this.terrain = layer;
    this.cachedMap = g.map;
    this.cachedSecret = g.secret.open;
  }
  render(now) {
    if (!this.zoom) return;
    this.cacheTerrain();
    const dt = Math.min(0.05, (now - (this.lastFx || now)) / 1000);
    this.lastFx = now;
    if (this.game.phase !== "paused" && !this.reduced.matches) {
      const p = this.game.player;
      if (this.previous) {
        const d = Math.hypot(p.x - this.previous.x, p.y - this.previous.y);
        if (d < 30) this.walkPhase += d / 14;
        if (this.game.phase === "playing" && this.game.dashTime > 0) {
          this.trails.push({ x: p.x, y: p.y, life: 0.25 });
          this.trails = this.trails.slice(-12);
        }
      }
      this.previous = { x: p.x, y: p.y };
      for (const p of this.particles) {
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 45 * dt;
      }
      this.particles = this.particles.filter((p) => p.life > 0);
      for (const p of this.trails) p.life -= dt;
      this.trails = this.trails.filter((p) => p.life > 0);
    }
    const g = this.game,
      c = this.ctx,
      z = this.zoom,
      t = this.reduced.matches ? 0 : now / 1000;
    const vw = this.w / z,
      vh = this.h / z;
    const cx = Math.max(0, Math.min(WIDTH * TILE - vw, g.player.x - vw / 2)),
      cy = Math.max(0, Math.min(HEIGHT * TILE - vh, g.player.y - vh / 2));
    if (this.snap || this.reduced.matches) {
      this.camera = { x: cx, y: cy };
      this.snap = false;
    } else {
      this.camera.x += (cx - this.camera.x) * 0.12;
      this.camera.y += (cy - this.camera.y) * 0.12;
    }
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.fillStyle = "#091315";
    c.fillRect(0, 0, this.w, this.h);
    c.save();
    c.scale(z, z);
    if (g.shake > 0 && !this.reduced.matches)
      c.translate(
        Math.sin(t * 100) * g.shake * 9,
        Math.cos(t * 90) * g.shake * 8,
      );
    c.translate(-Math.round(this.camera.x), -Math.round(this.camera.y));
    const x0 = Math.max(0, Math.floor(this.camera.x / TILE)),
      y0 = Math.max(0, Math.floor(this.camera.y / TILE));
    for (let y = y0; y < Math.min(HEIGHT, y0 + Math.ceil(vh / TILE) + 2); y++)
      for (
        let x = x0;
        x < Math.min(WIDTH, x0 + Math.ceil(vw / TILE) + 2);
        x++
      ) {
        const key = y * WIDTH + x,
          visible = g.phase === "intro" || g.visible.has(key),
          seen = g.phase === "intro" || g.seen.has(key);
        if (!seen) continue;
        const distance =
          Math.hypot(
            (x + 0.5) * TILE - g.player.x,
            (y + 0.5) * TILE - g.player.y,
          ) / TILE;
        c.globalAlpha = visible ? Math.max(0.35, 1 - distance * 0.075) : 0.23;
        c.drawImage(
          this.terrain,
          x * TILE,
          y * TILE,
          TILE,
          TILE,
          x * TILE,
          y * TILE,
          TILE,
          TILE,
        );
        if (
          visible &&
          g.map[y][x] === "." &&
          g.map[y - 1]?.[x] === "#" &&
          x % 5 === 2
        )
          this.wallTorch(x * TILE + 16, y * TILE + 3, t);
      }
    c.globalAlpha = 1;
    const visible = (o) =>
      g.visible.has(Math.floor(o.y / TILE) * WIDTH + Math.floor(o.x / TILE));
    for (const trap of g.spikes)
      if (visible(trap)) this.spike(trap, g.spikeState(trap), t);
    for (const key of g.keys)
      if (!key.taken && visible(key)) this.key(key.x, key.y, t);
    if (visible(g.fountain)) this.fountain(g.fountain, t);
    if (visible(g.exit)) this.exit(g.exit, g.keyCount === g.keys.length, t);
    if (!g.secret.taken && visible(g.secret))
      this.gem(g.secret.x, g.secret.y, t);
    for (const e of g.enemies) if (visible(e)) this.enemy(e, t);
    if (g.embers)
      for (const ember of g.embers)
        if (!ember.taken && visible(ember)) {
          this.glow(ember.x, ember.y, 24, "rgba(255,181,80,.15)");
          c.save();
          c.translate(ember.x, ember.y + Math.sin(t * 3 + ember.x) * 2);
          c.rotate(Math.PI / 4);
          c.fillStyle = "#edbd71";
          c.fillRect(-3, -3, 6, 6);
          c.fillStyle = "#fff2bb";
          c.fillRect(-1, -1, 2, 2);
          c.restore();
        }
    if (g.beacon && visible(g.beacon)) {
      const b = g.beacon;
      c.fillStyle = "#5b7367";
      c.fillRect(b.x - 5, b.y - 5, 10, 15);
      c.fillStyle =
        g.beaconTime > 0 ? "#baf2c9" : g.beacon.used ? "#395349" : "#d9c089";
      c.fillRect(b.x - 3, b.y - 10, 6, 9);
      if (g.beaconTime > 0) {
        this.glow(b.x, b.y - 8, 100, "rgba(133,236,187,.22)");
        c.strokeStyle = "#b6e2ae80";
        c.beginPath();
        c.arc(b.x, b.y, 20 + Math.sin(t * 3) * 4, 0, Math.PI * 2);
        c.stroke();
      }
    }
    for (const p of this.trails) {
      c.globalAlpha = p.life * 0.8;
      c.fillStyle = g.bonuses?.color || "#66c6b0";
      c.fillRect(p.x - 8, p.y - 12, 16, 21);
    }
    c.globalAlpha = 1;
    this.hero(g.player, t);
    if (g.shield > 0) {
      c.strokeStyle = "#e8cc7b88";
      c.lineWidth = 1;
      c.beginPath();
      c.arc(g.player.x, g.player.y - 1, 17, 0, Math.PI * 2);
      c.stroke();
    }
    for (const p of this.particles) {
      c.globalAlpha = Math.min(1, p.life / 0.3);
      c.fillStyle = p.color;
      c.fillRect(p.x, p.y, 2 + p.life * 2, 2 + p.life * 2);
    }
    c.globalAlpha = 1;
    c.restore();
    // Light stays local to the adventurer, with quiet amber at the screen edges.
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const px = (g.player.x - this.camera.x) * z,
      py = (g.player.y - this.camera.y) * z;
    const v = c.createRadialGradient(
      px,
      py,
      30 * z,
      px,
      py,
      Math.max(this.w, this.h) * 0.8,
    );
    v.addColorStop(0, "rgba(3,10,12,0)");
    v.addColorStop(0.65, "rgba(3,10,12,.12)");
    v.addColorStop(1, "rgba(2,8,10,.7)");
    c.fillStyle = v;
    c.fillRect(0, 0, this.w, this.h);
    this.minimap();
  }
  tile(x, y, type, t) {
    const c = this.ctx,
      px = x * TILE,
      py = y * TILE,
      n = hash(x, y),
      floor = this.game.floorIndex;
    if (type === "#" || type === "X") {
      c.fillStyle = ["#263e40", "#293e4b", "#423e3c"][floor];
      c.fillRect(px, py, 32, 32);
      c.fillStyle = ["#385458", "#3b5362", "#575045"][floor];
      c.fillRect(px + 1, py + 1, 30, 7);
      c.fillStyle = "#142629";
      c.fillRect(px, py + 30, 32, 2);
      c.fillRect(px + (y % 2 ? 9 : 22), py + 9, 2, 20);
      c.fillStyle = "rgba(158,192,170,.08)";
      c.fillRect(px + 2, py + 11, 27, 2);
      c.fillRect(px + 3, py + 3, 26, 1);
      if (n > 0.75) {
        c.fillStyle = "#466250";
        c.fillRect(px + 3, py + 4, 6, 2);
        c.fillRect(px + 4, py + 6, 3, 4);
      }
      if (this.game.map[y + 1]?.[x] === ".") {
        c.fillStyle = "#0a191d";
        c.fillRect(px, py + 26, 32, 6);
        c.fillStyle = "#456164";
        c.fillRect(px + 1, py + 25, 30, 1);
      }
      if (type === "X") {
        c.strokeStyle = "#b8a37a";
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(px + 15, py + 3);
        c.lineTo(px + 19, py + 12);
        c.lineTo(px + 12, py + 19);
        c.lineTo(px + 17, py + 29);
        c.stroke();
        c.fillStyle = "#0c1516";
        c.fillRect(px + 10, py + 18, 5, 3);
      }
    } else {
      c.fillStyle =
        floor === 2
          ? n > 0.5
            ? "#252d2d"
            : "#28302e"
          : n > 0.5
            ? "#1d3033"
            : "#203336";
      c.fillRect(px, py, 32, 32);
      c.fillStyle = "#314143";
      c.fillRect(px + 1, py + 1, 30, 1);
      c.fillStyle = "#12272b";
      c.fillRect(px + 31, py, 1, 32);
      c.fillRect(px, py + 31, 32, 1);
      if (n > 0.55) {
        c.strokeStyle = "#15272a";
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(px + 8, py + 11);
        c.lineTo(px + 15, py + 16);
        c.lineTo(px + 13, py + 22);
        c.stroke();
      }
      if (n < 0.12) {
        c.fillStyle = "#38443e";
        c.fillRect(px + 10, py + 17, 3, 2);
        c.fillRect(px + 22, py + 8, 2, 2);
      }
      if (floor === 1 && n < 0.24) {
        c.fillStyle = "#415f6630";
        c.fillRect(px + 3, py + 12, 22, 12);
        c.fillStyle = "#63838d40";
        c.fillRect(px + 7, py + 15, 12, 1);
      }
      if (floor === 0 && x >= 3 && x <= 6 && y >= 4 && y <= 6) {
        c.fillStyle = "#88815a18";
        c.fillRect(px, py, 32, 32);
        c.fillStyle = "#a09b6b38";
        if (y === 4) c.fillRect(px, py + 2, 32, 1);
        if (y === 6) c.fillRect(px, py + 29, 32, 1);
        if (x === 3) c.fillRect(px + 2, py, 1, 32);
        if (x === 6) c.fillRect(px + 29, py, 1, 32);
        if ((x + y) % 2 === 0) {
          c.fillStyle = "#b7a27030";
          c.fillRect(px + 13, py + 14, 5, 5);
        }
      }
      if (
        floor === 0 &&
        ((y === 2 && x >= 3 && x <= 5) || (y === 1 && x >= 13 && x <= 17))
      ) {
        c.fillStyle = "#102023";
        c.fillRect(px + 1, py, 30, 11);
        c.fillStyle = "#77624b";
        c.fillRect(px + 2, py, 28, 2);
        c.fillRect(px + 2, py + 9, 28, 2);
        for (let i = 0; i < 7; i++) {
          c.fillStyle = ["#697760", "#a48b5e", "#7d6252", "#4d7370"][
            (x + i) % 4
          ];
          c.fillRect(px + 3 + i * 4, py + 3, 3, 6);
        }
      }
      if (
        !this.buildingCache &&
        this.game.map[y - 1]?.[x] === "#" &&
        x % 5 === 2
      ) {
        this.wallTorch(px + 16, py + 3, t);
      }
    }
  }
  glow(x, y, r, color) {
    const c = this.ctx;
    const glow = c.createRadialGradient(x, y, 0, x, y, r);
    glow.addColorStop(0, color);
    glow.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = glow;
    c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  wallTorch(x, y, t) {
    const c = this.ctx;
    this.glow(x, y, 34, "rgba(225,163,72,.13)");
    c.fillStyle = "#765237";
    c.fillRect(x - 2, y, 4, 10);
    c.fillStyle = "#d5944a";
    c.fillRect(x - 3, y - 6, 6, 8);
    c.fillStyle = "#ffe1a0";
    c.fillRect(x - 1, y - 8 - Math.round(Math.sin(t * 7 + x)), 3, 7);
  }
  key(x, y, t) {
    const c = this.ctx,
      dy = Math.round(Math.sin(t * 2.8 + x) * 2);
    this.glow(x, y, 27, "rgba(234,189,107,.15)");
    c.save();
    c.translate(Math.round(x), Math.round(y + dy));
    c.fillStyle = "#91713e";
    c.fillRect(-5, 3, 14, 3);
    c.fillStyle = "#edce86";
    c.fillRect(-5, -4, 7, 2);
    c.fillRect(-7, -2, 2, 5);
    c.fillRect(0, -2, 2, 5);
    c.fillRect(-5, 3, 7, 2);
    c.fillRect(1, 0, 11, 3);
    c.fillRect(8, 2, 3, 5);
    c.fillStyle = "#fff0bb";
    c.fillRect(-4, -4, 4, 1);
    c.restore();
  }
  gem(x, y, t) {
    const c = this.ctx;
    this.glow(x, y, 32, "rgba(111,202,185,.22)");
    c.save();
    c.translate(x, y + Math.sin(t * 2) * 2);
    c.fillStyle = "#6bc6b3";
    c.beginPath();
    c.moveTo(0, -9);
    c.lineTo(7, 0);
    c.lineTo(0, 9);
    c.lineTo(-7, 0);
    c.closePath();
    c.fill();
    c.fillStyle = "#bff2cd";
    c.beginPath();
    c.moveTo(0, -9);
    c.lineTo(0, 5);
    c.lineTo(-7, 0);
    c.fill();
    c.restore();
  }
  fountain(o, t) {
    const c = this.ctx;
    c.save();
    c.translate(o.x, o.y);
    c.fillStyle = "#101e23";
    c.fillRect(-14, -6, 28, 17);
    c.fillStyle = "#526a69";
    c.fillRect(-14, 5, 28, 5);
    c.fillRect(-12, -9, 24, 4);
    c.fillRect(-14, -5, 4, 10);
    c.fillRect(10, -5, 4, 10);
    c.fillStyle = o.used ? "#293c40" : "#68b9b5";
    c.fillRect(-9, -4, 18, 9);
    if (!o.used) {
      this.glow(0, 0, 34, "rgba(83,197,183,.16)");
      c.fillStyle = "#a6e1cc";
      c.fillRect(-6 + Math.round(Math.sin(t * 2) * 3), -2, 9, 1);
    }
    c.restore();
  }
  exit(o, unlocked, t) {
    const c = this.ctx;
    c.save();
    c.translate(o.x, o.y);
    this.glow(
      0,
      -7,
      unlocked ? 65 : 25,
      unlocked ? "rgba(125,218,179,.21)" : "rgba(226,170,77,.08)",
    );
    c.fillStyle = "#111d20";
    c.fillRect(-14, -23, 28, 36);
    c.fillStyle = unlocked ? "#568e79" : "#536362";
    c.fillRect(-16, -23, 5, 36);
    c.fillRect(11, -23, 5, 36);
    c.fillRect(-11, -28, 22, 6);
    c.fillStyle = unlocked ? "#244a42" : "#273437";
    c.fillRect(-10, -21, 20, 33);
    c.fillStyle = unlocked ? "#b8df9e" : "#6b7670";
    c.fillRect(-10, -21, 2, 33);
    c.fillRect(8, -21, 2, 33);
    for (let y = -16; y < 12; y += 6) {
      c.fillStyle = unlocked ? "#79aa85" : "#1b2b2e";
      c.fillRect(-7, y, 14, 2);
    }
    c.fillStyle = unlocked ? "#d6efac" : "#d1b175";
    c.fillRect(-3, -6, 6, 7);
    if (unlocked) {
      c.globalAlpha = 0.5 + 0.15 * Math.sin(t * 3);
      c.fillStyle = "#bedf9c";
      c.fillRect(-7, -18, 14, 30);
      c.globalAlpha = 1;
    }
    c.restore();
  }
  spike(o, state, t) {
    const c = this.ctx;
    c.save();
    c.translate(o.x, o.y);
    c.fillStyle = "#101e21";
    c.fillRect(-13, -11, 26, 23);
    c.fillStyle =
      state === "active"
        ? "#c78d7a"
        : state === "warning"
          ? "#bc9a5f"
          : "#46615f";
    for (let i = -9; i < 11; i += 6) {
      if (state === "active") {
        c.beginPath();
        c.moveTo(i, -10);
        c.lineTo(i - 3, 9);
        c.lineTo(i + 3, 9);
        c.fill();
      } else c.fillRect(i - 2, 2, 4, 4);
    }
    if (state === "warning") {
      c.strokeStyle = "#d6af66";
      c.lineWidth = 1;
      c.strokeRect(-13, -11, 26, 23);
    }
    c.restore();
  }
  enemy(e, t) {
    const c = this.ctx;
    c.save();
    c.translate(
      Math.round(e.x),
      Math.round(e.y + Math.sin(t * 5 + e.seed) * 2),
    );
    c.fillStyle = "#101a20";
    c.beginPath();
    c.ellipse(0, 9, 11, 4, 0, 0, Math.PI * 2);
    c.fill();
    const wing = Math.round(Math.sin(t * 9 + e.seed) * 3);
    c.fillStyle = "#6e657b";
    c.fillRect(-6, -5, 12, 12);
    c.fillRect(-14, -5 + wing, 8, 5);
    c.fillRect(6, -5 + wing, 8, 5);
    c.fillStyle = "#8b7a8d";
    c.fillRect(-4, -8, 3, 4);
    c.fillRect(2, -8, 3, 4);
    c.fillStyle = "#f0ad86";
    c.fillRect(-3, -2, 2, 2);
    c.fillRect(2, -2, 2, 2);
    c.restore();
  }
  hero(p, t) {
    const c = this.ctx,
      g = this.game;
    this.glow(p.x + 9, p.y - 9, 85, "rgba(246,188,104,.075)");
    c.save();
    c.translate(Math.round(p.x), Math.round(p.y));
    const step = this.reduced.matches
      ? 0
      : Math.round(Math.sin(this.walkPhase) * 2);
    c.fillStyle = g.bonuses?.color || "#55a89c";
    c.globalAlpha = 0.65;
    c.beginPath();
    c.moveTo(-7, -3);
    c.lineTo(-10 - step, 9);
    c.lineTo(8, 9);
    c.lineTo(7, -3);
    c.fill();
    c.globalAlpha = 1;
    if (g.invulnerable > 0 && !this.reduced.matches)
      c.globalAlpha = Math.sin(t * 25) > 0 ? 1 : 0.48;
    c.fillStyle = "#071518";
    c.beginPath();
    c.ellipse(0, 11, 12, 4, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = g.bonuses?.bootsColor || "#3a3d39";
    c.fillRect(-6, 6 + step, 5, 6);
    c.fillRect(2, 6 - step, 5, 6);
    c.translate(0, Math.abs(step) * -0.5);
    c.fillStyle = g.bonuses?.color || "#55a89c";
    c.fillRect(-8, -4, 16, 13);
    c.fillStyle = "#347a77";
    c.fillRect(-8, 3, 5, 6);
    c.fillStyle = "#a4d2c0";
    c.fillRect(-7, -12, 14, 4);
    c.fillStyle = g.bonuses?.color || "#5ba89c";
    c.fillRect(-10, -8, 20, 8);
    c.fillStyle = "#13292e";
    c.fillRect(-6, -6, 12, 6);
    c.fillStyle = "#ffe4ae";
    c.fillRect(-4, -4, 2, 2);
    c.fillRect(2, -4, 2, 2);
    c.fillStyle = "#c99767";
    c.fillRect(8, 0, 4, 4);
    c.fillStyle = "#846345";
    c.fillRect(11, -8, 3, 13);
    c.fillStyle = "#ffb95f";
    c.fillRect(10, -14, 5, 7);
    c.fillStyle = "#ffebaf";
    c.fillRect(12, -17 - Math.round(Math.sin(t * 8)), 3, 8);
    c.restore();
  }
  minimap() {
    const c = this.ctx,
      g = this.game,
      scale = 2.5,
      w = WIDTH * scale,
      h = HEIGHT * scale,
      x = this.w - w - 17,
      y = 17;
    c.save();
    c.fillStyle = "#081416dc";
    c.fillRect(x - 7, y - 7, w + 14, h + 14);
    c.strokeStyle = "#718c7730";
    c.strokeRect(x - 7, y - 7, w + 14, h + 14);
    for (const k of g.seen) {
      const tx = k % WIDTH,
        ty = Math.floor(k / WIDTH);
      c.fillStyle = g.map[ty][tx] === "." ? "#577b72" : "#29433f";
      c.fillRect(x + tx * scale, y + ty * scale, 2, 2);
    }
    c.fillStyle = "#e6cb8e";
    c.fillRect(
      x + Math.floor(g.player.x / TILE) * scale,
      y + Math.floor(g.player.y / TILE) * scale,
      3,
      3,
    );
    c.restore();
  }
}
