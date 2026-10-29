/* Симуляция игры «Заброшка»: генерация подземелий, бой, враги и боссы.
   Никакого DOM, таймеров и рендера — только состояние и правила. */

import { TILE, LOCATIONS, ENEMIES, WEAPONS, STARTER } from './content.js';

export const VOID = 0;
export const FLOOR = 1;
export const WALL = 2;
export const DOOR = 3;
export const EXIT = 4;

const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const distance = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);

export function makeRandom(seed) {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/* ---------- level generation ---------- */
function carveRect(grid, w, rect, tile) {
  for (let y = rect.y; y < rect.y + rect.h; y += 1) {
    for (let x = rect.x; x < rect.x + rect.w; x += 1) grid[y * w + x] = tile;
  }
}
function carveCorridor(grid, w, ax, ay, bx, by, thickness = 1) {
  const step = (x, y) => {
    for (let oy = 0; oy < thickness; oy += 1) {
      for (let ox = 0; ox < thickness; ox += 1) grid[(y + oy) * w + (x + ox)] = FLOOR;
    }
  };
  let x = ax, y = ay;
  while (x !== bx) { step(x, y); x += x < bx ? 1 : -1; }
  while (y !== by) { step(x, y); y += y < by ? 1 : -1; }
  step(bx, by);
}
const overlaps = (a, b, pad) => a.x - pad < b.x + b.w && a.x + a.w + pad > b.x && a.y - pad < b.y + b.h && a.y + a.h + pad > b.y;
const center = (room) => ({ x: Math.floor(room.x + room.w / 2), y: Math.floor(room.y + room.h / 2) });

// Реквизит по локациям: в подвале ящики и покрышки, в больнице шкафчики,
// на заводе бочки и металлолом. У каждого вида своя прочность.
const PROP_KINDS = {
  basement: ['crate', 'barrel', 'crate', 'box', 'tyres'],
  hospital: ['crate', 'locker', 'box', 'barrel', 'locker'],
  factory: ['barrel', 'tyres', 'crate', 'barrel', 'locker'],
};
const PROP_STATS = {
  crate: { radius: 7, health: 3 },
  barrel: { radius: 7, health: 3 },
  box: { radius: 6, health: 1 },
  locker: { radius: 7, health: 5 },
  tyres: { radius: 8, health: 2 },
};

function generateLevel(game, locationIndex, slot) {
  const random = game.random;
  const location = LOCATIONS[locationIndex];
  const bossLevel = slot === location.levels - 1;
  const w = game.gridW, h = game.gridH;
  const grid = new Uint8Array(w * h);
  const rooms = [];
  const wanted = bossLevel ? 4 : 6 + Math.floor(random() * 3);
  for (let attempt = 0; attempt < 400 && rooms.length < wanted; attempt += 1) {
    const rw = 6 + Math.floor(random() * 7);
    const rh = 5 + Math.floor(random() * 6);
    const room = { x: 2 + Math.floor(random() * (w - rw - 4)), y: 2 + Math.floor(random() * (h - rh - 4)), w: rw, h: rh };
    if (rooms.some((other) => overlaps(room, other, 3))) continue;
    rooms.push(room);
  }
  rooms.sort((a, b) => center(a).x + center(a).y - (center(b).x + center(b).y));
  const spawnCenter = center(rooms[0]);
  const spawnPoint = { x: spawnCenter.x * TILE + TILE / 2, y: spawnCenter.y * TILE + TILE / 2 };
  for (const room of rooms) carveRect(grid, w, room, FLOOR);
  for (let i = 1; i < rooms.length; i += 1) {
    const a = center(rooms[i - 1]), b = center(rooms[i]);
    carveCorridor(grid, w, a.x, a.y, b.x, b.y, random() < .4 ? 2 : 1);
  }
  // Хранилище: маленькая комната с выходом за единственной запертой дверью.
  const vault = { w: 6, h: 6, x: 0, y: 0, vault: true };
  for (let attempt = 0; attempt < 300; attempt += 1) {
    vault.x = 2 + Math.floor(random() * (w - vault.w - 4));
    vault.y = 2 + Math.floor(random() * (h - vault.h - 4));
    if (!rooms.some((other) => overlaps(vault, other, 4))) break;
  }
  carveRect(grid, w, vault, FLOOR);
  rooms.push(vault);
  const last = center(rooms[rooms.length - 2]);
  const vaultCenter = center(vault);
  carveCorridor(grid, w, last.x, last.y, vaultCenter.x, vaultCenter.y, 1);
  const doorTile = { x: 0, y: 0 };
  // Клетка коридора у стены хранилища становится запертой дверью.
  if (Math.abs(vaultCenter.x - last.x) > Math.abs(vaultCenter.y - last.y)) {
    doorTile.x = vaultCenter.x + (last.x > vaultCenter.x ? Math.floor(vault.w / 2) : -Math.ceil(vault.w / 2));
    doorTile.y = vaultCenter.y;
  } else {
    doorTile.x = vaultCenter.x;
    doorTile.y = vaultCenter.y + (last.y > vaultCenter.y ? Math.floor(vault.h / 2) : -Math.ceil(vault.h / 2));
  }
  grid[doorTile.y * w + doorTile.x] = DOOR;
  grid[vaultCenter.y * w + vaultCenter.x] = EXIT;

  // Стены обрамляют всё вырезанное.
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (grid[y * w + x] !== VOID) continue;
      let touching = false;
      for (let oy = -1; oy <= 1 && !touching; oy += 1) {
        for (let ox = -1; ox <= 1; ox += 1) {
          const nx = x + ox, ny = y + oy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          if (grid[ny * w + nx] === FLOOR || grid[ny * w + nx] === EXIT) { touching = true; break; }
        }
      }
      if (touching) grid[y * w + x] = WALL;
    }
  }

  const torches = [];
  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      if (grid[y * w + x] !== WALL) continue;
      const openBelow = grid[(y + 1) * w + x] === FLOOR;
      if (openBelow && random() < .06) torches.push({ x: x * TILE + TILE / 2, y: y * TILE + TILE * .8, phase: random() * TAU });
    }
  }

  const level = {
    grid, w, h, rooms, torches, door: doorTile, spawn: spawnPoint,
    exit: { x: vaultCenter.x * TILE + TILE / 2, y: vaultCenter.y * TILE + TILE / 2 },
    props: [], enemies: [], pickups: [], boss: null,
    keysNeeded: bossLevel ? 0 : 1 + slot,
  };

  // Реквизит: в ящиках и бочках прячутся монеты, патроны, иногда ключи.
  const propTable = PROP_KINDS[location.id] || PROP_KINDS.basement;
  const propRooms = rooms.filter((room) => !room.vault);
  for (const room of propRooms) {
    const count = 1 + Math.floor(random() * 4);
    for (let i = 0; i < count; i += 1) {
      const x = (room.x + 1 + Math.floor(random() * (room.w - 2))) * TILE + TILE / 2;
      const y = (room.y + 1 + Math.floor(random() * (room.h - 2))) * TILE + TILE / 2;
      if (distance(x, y, level.exit.x, level.exit.y) < 40) continue;
      const kind = propTable[Math.floor(random() * propTable.length)];
      const stats = PROP_STATS[kind];
      level.props.push({ x, y, kind, radius: stats.radius, health: stats.health, loot: random() });
    }
  }

  // Ключи: один всегда в реквизите, остальные лежат на полу в дальних комнатах.
  const keyRooms = propRooms.slice(1);
  for (let i = 0; i < level.keysNeeded; i += 1) {
    if (i === 0 && level.props.length) {
      const prop = level.props[Math.floor(random() * level.props.length)];
      prop.key = true;
    } else if (keyRooms.length) {
      const room = keyRooms[Math.floor(random() * keyRooms.length)];
      level.pickups.push({ kind: 'key', x: (room.x + 1 + Math.floor(random() * (room.w - 2))) * TILE + TILE / 2, y: (room.y + 1 + Math.floor(random() * (room.h - 2))) * TILE + TILE / 2, bob: random() * TAU });
    }
  }

  // Враги с поправкой на локацию и глубину. Комната появления остаётся безопасной.
  const table = location.enemies;
  const arenaRoom = bossLevel ? rooms.reduce((best, room) => (
    room.vault || room === rooms[0] ? best : (best === rooms[0] || room.w * room.h > best.w * best.h ? room : best)
  ), rooms[0]) : null;
  for (const room of propRooms) {
    if (room === rooms[0] || room === arenaRoom) continue;
    const count = Math.round((.7 + random() * 1.7) * location.density * (1 + slot * .22) * (bossLevel ? .6 : 1));
    for (let i = 0; i < count; i += 1) {
      const type = table[Math.floor(random() * table.length)];
      const x = (room.x + 1 + Math.floor(random() * Math.max(1, room.w - 2))) * TILE + TILE / 2;
      const y = (room.y + 1 + Math.floor(random() * Math.max(1, room.h - 2))) * TILE + TILE / 2;
      if (distance(x, y, spawnPoint.x, spawnPoint.y) < 130) continue;
      level.enemies.push(spawnEnemy(game, type, x, y));
    }
  }

  if (bossLevel) {
    const arena = rooms.reduce((best, room) => (
      room.vault || room === rooms[0] ? best : (best === rooms[0] || room.w * room.h > best.w * best.h ? room : best)
    ), rooms[0]);
    const boss = location.boss;
    level.boss = {
      id: boss.id, name: boss.name, subtitle: boss.subtitle,
      x: arena.x * TILE + arena.w * TILE / 2, y: arena.y * TILE + arena.h * TILE / 2,
      radius: 14 * boss.scale, health: boss.health, maxHealth: boss.health,
      speed: boss.speed, damage: boss.damage, scale: boss.scale, palette: boss.palette,
      attacks: boss.attacks, reward: boss.reward,
      calm: boss.calm || [], rage: boss.rage || boss.attacks, abilities: boss.abilities || [],
      mode: 'drowsy', baseSpeed: boss.speed,
      phase: 1, phaseCount: 3, attack: null, timer: 2, windup: 0, cooldown: 1.4,
      awake: false, flash: 0, vx: 0, vy: 0, facing: 0,
      telegraph: null, chain: null, rageGlow: 0, bob: game.random() * 6,
    };
  }

  // На этаже с боссом в арене всегда лежит аптечка — бой должен быть проходимым.
  if (bossLevel && arenaRoom) {
    level.pickups.push({
      kind: 'medkit', bob: 0,
      x: (arenaRoom.x + 1) * TILE + TILE / 2, y: (arenaRoom.y + 1) * TILE + TILE / 2,
    });
    level.pickups.push({
      kind: 'ammo', bob: 0,
      x: (arenaRoom.x + arenaRoom.w - 2) * TILE + TILE / 2, y: (arenaRoom.y + arenaRoom.h - 2) * TILE + TILE / 2,
    });
  }

  // Немного разбросанной добычи — награда за то, что облазил всё.
  for (const room of propRooms) {
    if (random() < .5) level.pickups.push(makePickup(random, room, 'coin'));
    if (random() < .3) level.pickups.push(makePickup(random, room, random() < .5 ? 'ammo' : 'medkit'));
  }
  return level;
}

function makePickup(random, room, kind) {
  return {
    kind, bob: random() * TAU,
    x: (room.x + 1 + Math.floor(random() * Math.max(1, room.w - 2))) * TILE + TILE / 2,
    y: (room.y + 1 + Math.floor(random() * Math.max(1, room.h - 2))) * TILE + TILE / 2,
  };
}

// Мертвецы зарыты в землю и вылезают, когда игрок подходит близко.
const DIGGERS = new Set(['zombie', 'skeleton']);
export const DIG_TIME = 1.15;

function spawnEnemy(game, type, x, y) {
  const data = ENEMIES[type];
  const scale = 1 + game.locationIndex * .12;
  return {
    type, x, y, radius: data.radius, health: data.health * scale, maxHealth: data.health * scale,
    speed: data.speed, damage: data.damage, attackRate: data.attack, reach: data.reach,
    brain: data.brain, coins: data.coins, sight: data.sight, color: data.color,
    cooldown: Math.random() * .6, windup: 0, flash: 0, vx: 0, vy: 0, facing: 0, stagger: 0,
    state: 'idle',
    buried: DIGGERS.has(type), emerge: 0,
  };
}

/* ---------- game state ---------- */
export function createGame({ seed = Date.now(), locationIndex = 0, slot = 0, upgrades = {} } = {}) {
  const random = makeRandom(seed);
  const location = LOCATIONS[clamp(locationIndex, 0, LOCATIONS.length - 1)];
  const game = {
    seed, random, locationIndex, slot, location,
    gridW: 56, gridH: 46, level: null,
    player: null, bullets: [], grenades: [], particles: [], lights: [], decals: [], texts: [],
    shake: 0, flash: 0, time: 0, events: [],
    complete: false, dead: false, keys: 0, doorOpen: false,
    stats: { killed: 0, coins: 0, damage: 0, taken: 0 },
  };
  game.player = {
    x: 0, y: 0, vx: 0, vy: 0, radius: 6,
    health: 8 + (upgrades.maxhp || 0), maxHealth: 8 + (upgrades.maxhp || 0),
    speed: 76 * (1 + (upgrades.speed || 0) * .12),
    damageScale: 1 + (upgrades.damage || 0) * .25,
    facing: 0, melee: STARTER.melee, gun: null, grenades: 1 + (upgrades.grenades || 0),
    ammo: { pistol: 24, shells: 8, rifle: 0 },
    magazine: 0, reload: 0, cooldown: 0, swing: null, invulnerable: 0, hurt: 0, muzzle: 0, recoil: 0,
    walk: 0, moving: false, coins: 0,
  };
  game.level = generateLevel(game, locationIndex, slot);
  game.player.x = game.level.spawn.x;
  game.player.y = game.level.spawn.y;
  // Проверяем, что точка появления проходима.
  if (solidAt(game, game.player.x, game.player.y)) {
    const first = game.level.rooms[0];
    for (let ty = first.y; ty < first.y + first.h; ty += 1) {
      for (let tx = first.x; tx < first.x + first.w; tx += 1) {
        const tile = game.level.grid[ty * game.level.w + tx];
        if (tile === FLOOR) {
          game.player.x = tx * TILE + TILE / 2;
          game.player.y = ty * TILE + TILE / 2;
        }
      }
    }
  }
  return game;
}

export const tileAt = (game, x, y) => {
  const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
  if (tx < 0 || ty < 0 || tx >= game.level.w || ty >= game.level.h) return VOID;
  return game.level.grid[ty * game.level.w + tx];
};
export function solidAt(game, x, y) {
  const tile = tileAt(game, x, y);
  return tile === VOID || tile === WALL || tile === DOOR;
}
function collides(game, entity, x, y) {
  const r = entity.radius;
  const minX = Math.floor((x - r) / TILE), maxX = Math.floor((x + r) / TILE);
  const minY = Math.floor((y - r) / TILE), maxY = Math.floor((y + r) / TILE);
  for (let ty = minY; ty <= maxY; ty += 1) {
    for (let tx = minX; tx <= maxX; tx += 1) {
      const tile = (tx < 0 || ty < 0 || tx >= game.level.w || ty >= game.level.h)
        ? VOID : game.level.grid[ty * game.level.w + tx];
      if (tile === VOID || tile === WALL || tile === DOOR) return true;
    }
  }
  return false;
}
function moveEntity(game, entity, dx, dy) {
  if (dx) {
    const nx = entity.x + dx;
    if (!collides(game, entity, nx, entity.y)) entity.x = nx;
  }
  if (dy) {
    const ny = entity.y + dy;
    if (!collides(game, entity, entity.x, ny)) entity.y = ny;
  }
}
// Отбрасывание обязано считаться со стенами, иначе удар загонит героя в стену навсегда.
function applyKnockback(game, entity, dt) {
  if (!entity.vx && !entity.vy) return;
  moveEntity(game, entity, entity.vx * dt, entity.vy * dt);
  if (collides(game, entity, entity.x, entity.y)) unstick(game, entity);
}
// Крайний случай: если кто-то оказался внутри стены, ставим его на ближайшую свободную клетку.
function unstick(game, entity) {
  const tx = Math.floor(entity.x / TILE), ty = Math.floor(entity.y / TILE);
  for (let radius = 1; radius <= 4; radius += 1) {
    for (let oy = -radius; oy <= radius; oy += 1) {
      for (let ox = -radius; ox <= radius; ox += 1) {
        if (Math.max(Math.abs(ox), Math.abs(oy)) !== radius) continue;
        const x = (tx + ox) * TILE + TILE / 2, y = (ty + oy) * TILE + TILE / 2;
        if (!collides(game, entity, x, y)) { entity.x = x; entity.y = y; return; }
      }
    }
  }
}
export function lineOfSight(game, ax, ay, bx, by, ignoreTargetTile = false) {
  const steps = Math.ceil(distance(ax, ay, bx, by) / (TILE / 2));
  const targetTile = `${Math.floor(bx / TILE)},${Math.floor(by / TILE)}`;
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    const x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
    // Сама клетка цели может быть твёрдой (закрытая дверь) — это не должно мешать проверке.
    if (ignoreTargetTile && `${Math.floor(x / TILE)},${Math.floor(y / TILE)}` === targetTile) continue;
    if (solidAt(game, x, y)) return false;
  }
  return true;
}

/* ---------- effects ---------- */
function burst(game, x, y, color, count = 8, speed = 60, size = 2) {
  for (let i = 0; i < count; i += 1) {
    const a = game.random() * TAU;
    const s = speed * (.3 + game.random() * .9);
    game.particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: .3 + game.random() * .4,
      maxLife: .7, color, size: size * (.6 + game.random()),
    });
  }
}
function light(game, x, y, radius, color, life = .1, intensity = 1) {
  game.lights.push({ x, y, radius, color, life, maxLife: life, intensity });
}
function say(game, x, y, text, color = '#ffe9b0') {
  game.texts.push({ x, y, text, color, life: .9, maxLife: .9 });
}

/* ---------- combat ---------- */
function damageEnemy(game, enemy, amount, sourceX, sourceY, knockback = 60) {
  enemy.health -= amount;
  enemy.flash = .12;
  enemy.stagger = .12;
  game.stats.damage += amount;
  const angle = Math.atan2(enemy.y - sourceY, enemy.x - sourceX);
  enemy.vx += Math.cos(angle) * knockback;
  enemy.vy += Math.sin(angle) * knockback;
  burst(game, enemy.x, enemy.y, '#8c1f2a', 5, 70, 1.6);
  game.events.push('hit-enemy');
  if (enemy.health <= 0) killEnemy(game, enemy);
}
function damageBoss(game, boss, amount, sourceX, sourceY, knockback = 40) {
  boss.awake = true;
  boss.health -= amount;
  boss.flash = .12;
  game.stats.damage += amount;
  if (sourceX != null) {
    const angle = Math.atan2(boss.y - sourceY, boss.x - sourceX);
    boss.vx += Math.cos(angle) * knockback;
    boss.vy += Math.sin(angle) * knockback;
  }
  burst(game, boss.x, boss.y, '#ffd27a', 4, 50, 1.6);
  game.events.push('hit-enemy');
  if (boss.health <= 0) killBoss(game, boss);
}
function killEnemy(game, enemy) {
  enemy.dead = true;
  game.stats.killed += 1;
  burst(game, enemy.x, enemy.y, enemy.color[0], 14, 110, 2.2);
  burst(game, enemy.x, enemy.y, '#6d1420', 8, 70, 2.6);
  game.decals.push({ x: enemy.x, y: enemy.y, r: 7 + game.random() * 5, a: .5, color: '#5c1019' });
  const coins = Math.max(1, Math.round(enemy.coins));
  for (let i = 0; i < coins; i += 1) {
    game.level.pickups.push({ kind: 'coin', x: enemy.x + (game.random() - .5) * 16, y: enemy.y + (game.random() - .5) * 16, bob: game.random() * TAU });
  }
  if (game.random() < .22) game.level.pickups.push({ kind: 'ammo', x: enemy.x, y: enemy.y, bob: 0 });
  if (game.random() < .12) game.level.pickups.push({ kind: 'medkit', x: enemy.x, y: enemy.y, bob: 0 });
  game.events.push('enemy-die');
  game.shake = Math.max(game.shake, .18);
}
export function damagePlayer(game, amount, sourceX, sourceY) {
  const player = game.player;
  if (player.invulnerable > 0 || game.dead) return;
  player.health -= amount;
  player.invulnerable = .7;
  player.hurt = .35;
  game.stats.taken += amount;
  game.shake = Math.max(game.shake, .4);
  game.flash = Math.max(game.flash, .35);
  if (sourceX != null) {
    const angle = Math.atan2(player.y - sourceY, player.x - sourceX);
    player.vx = Math.cos(angle) * 90;
    player.vy = Math.sin(angle) * 90;
  }
  burst(game, player.x, player.y, '#b3243a', 8, 80, 2);
  game.events.push('player-hurt');
  if (player.health <= 0) {
    player.health = 0;
    game.dead = true;
    game.events.push('player-die');
  }
}
function nearestEnemy(game, x, y, maxRange = 220) {
  let best = null, bestDistance = maxRange;
  for (const enemy of game.level.enemies) {
    if (enemy.dead) continue;
    const d = distance(x, y, enemy.x, enemy.y);
    if (d < bestDistance) { best = enemy; bestDistance = d; }
  }
  if (game.level.boss && !game.level.boss.dead) {
    // Босс — главная угроза, поэтому при прочих равных прицел выбирает его.
    const d = distance(x, y, game.level.boss.x, game.level.boss.y) * .75;
    if (d < bestDistance) { best = game.level.boss; bestDistance = d; }
  }
  return best;
}

function playerMelee(game) {
  const player = game.player;
  const weapon = WEAPONS[player.melee];
  player.swing = { angle: player.facing, timer: .18, max: .18, hit: new Set() };
  player.cooldown = weapon.cooldown;
  game.events.push('swing');
  game.events.push(`melee:${player.melee}`);
}
function resolveSwing(game, dt) {
  const player = game.player;
  const swing = player.swing;
  if (!swing) return;
  swing.timer -= dt;
  const weapon = WEAPONS[player.melee];
  const targets = [...game.level.enemies];
  for (const enemy of targets) {
    if (enemy.dead || swing.hit.has(enemy)) continue;
    const d = distance(player.x, player.y, enemy.x, enemy.y);
    if (d > weapon.reach + enemy.radius) continue;
    const angle = Math.atan2(enemy.y - player.y, enemy.x - player.x);
    let delta = Math.abs(((angle - swing.angle + Math.PI * 3) % TAU) - Math.PI);
    if (delta > weapon.arc / 2) continue;
    swing.hit.add(enemy);
    damageEnemy(game, enemy, weapon.damage * player.damageScale, player.x, player.y, weapon.knockback);
    game.shake = Math.max(game.shake, .12);
  }
  const boss = game.level.boss;
  if (boss && !boss.dead && !swing.hit.has(boss)) {
    const d = distance(player.x, player.y, boss.x, boss.y);
    if (d <= weapon.reach + boss.radius) {
      const angle = Math.atan2(boss.y - player.y, boss.x - player.x);
      const delta = Math.abs(((angle - swing.angle + Math.PI * 3) % TAU) - Math.PI);
      if (delta <= weapon.arc / 2) {
        swing.hit.add(boss);
        damageBoss(game, boss, weapon.damage * player.damageScale, player.x, player.y, weapon.knockback * .4);
        game.shake = Math.max(game.shake, .12);
      }
    }
  }
  for (const prop of game.level.props) {
    if (prop.broken || swing.hit.has(prop)) continue;
    if (distance(player.x, player.y, prop.x, prop.y) > weapon.reach + prop.radius) continue;
    swing.hit.add(prop);
    breakProp(game, prop);
  }
  if (swing.timer <= 0) player.swing = null;
}
function playerShoot(game) {
  const player = game.player;
  if (!player.gun) return;
  const weapon = WEAPONS[player.gun];
  if (player.magazine <= 0) { startReload(game); return; }
  if ((player.ammo[weapon.ammo] || 0) <= 0 && player.magazine <= 0) return;
  player.magazine -= 1;
  player.cooldown = weapon.cooldown;
  const target = nearestEnemy(game, player.x, player.y, 260);
  let aim = player.facing;
  if (target) {
    const toTarget = Math.atan2(target.y - player.y, target.x - player.x);
    if (lineOfSight(game, player.x, player.y, target.x, target.y)) aim = toTarget;
  }
  for (let i = 0; i < weapon.pellets; i += 1) {
    const a = aim + (game.random() - .5) * weapon.spread * 2;
    game.bullets.push({
      x: player.x + Math.cos(a) * 10, y: player.y + Math.sin(a) * 10,
      vx: Math.cos(a) * weapon.speed * (.9 + game.random() * .2), vy: Math.sin(a) * weapon.speed * (.9 + game.random() * .2),
      damage: weapon.damage * player.damageScale, life: 1.4, radius: 2, friendly: true,
      color: '#ffe6a8', knockback: weapon.knockback || 40,
    });
  }
  player.vx -= Math.cos(aim) * 26;
  player.vy -= Math.sin(aim) * 26;
  light(game, player.x + Math.cos(aim) * 14, player.y + Math.sin(aim) * 14, 60, '#ffd48a', .08, 1.2);
  burst(game, player.x + Math.cos(aim) * 12, player.y + Math.sin(aim) * 12, '#ffcf7a', 3, 60, 1.4);
  game.shake = Math.max(game.shake, .1);
  player.muzzle = .085;
  player.recoil = 1;
  game.events.push('shoot');
  game.events.push(`gun:${player.gun}`);
}
function startReload(game) {
  const player = game.player;
  if (!player.gun) return;
  const weapon = WEAPONS[player.gun];
  if (player.reload > 0) return;
  if (player.magazine >= weapon.magazine) return;
  const stock = player.ammo[weapon.ammo] || 0;
  if (stock <= 0) return;
  player.reload = weapon.reload;
  game.events.push('reload');
}
function finishReload(game) {
  const player = game.player;
  const weapon = WEAPONS[player.gun];
  const need = weapon.magazine - player.magazine;
  const take = Math.min(need, player.ammo[weapon.ammo] || 0);
  player.ammo[weapon.ammo] -= take;
  player.magazine += take;
  game.events.push('reload-done');
}
function throwGrenade(game) {
  const player = game.player;
  if (player.grenades <= 0) return;
  player.grenades -= 1;
  const aim = player.facing;
  game.grenades.push({
    x: player.x, y: player.y, vx: Math.cos(aim) * 190, vy: Math.sin(aim) * 190,
    fuse: 1.1, radius: 6, spin: 0,
  });
  game.events.push('grenade-throw');
}
// fromPlayer — единственный источник, которому босс вообще подставляется:
// чужие взрывы (его же «приземление», подрыв мин) не должны бить его самого.
function explode(game, x, y, radius = 62, damage = 7, fromPlayer = false) {
  for (const enemy of [...game.level.enemies]) {
    if (enemy.dead) continue;
    const d = distance(x, y, enemy.x, enemy.y);
    if (d > radius + enemy.radius) continue;
    const falloff = 1 - clamp((d - enemy.radius) / radius, 0, 1);
    damageEnemy(game, enemy, damage * (.4 + falloff), x, y, 180 * falloff);
  }
  const boss = game.level.boss;
  if (fromPlayer && boss && !boss.dead && boss.awake) {
    const d = distance(x, y, boss.x, boss.y);
    if (d <= radius + boss.radius) {
      const falloff = 1 - clamp((d - boss.radius) / radius, 0, 1);
      damageBoss(game, boss, damage * (.4 + falloff), x, y, 40 * falloff);
    }
  }
  for (const prop of game.level.props) {
    if (prop.broken) continue;
    if (distance(x, y, prop.x, prop.y) < radius) breakProp(game, prop);
  }
  if (distance(x, y, game.player.x, game.player.y) < radius * .8) damagePlayer(game, 2, x, y);
  burst(game, x, y, '#ffb04a', 26, 190, 3);
  burst(game, x, y, '#5a5a5a', 14, 90, 4);
  light(game, x, y, radius * 3, '#ffbe6a', .35, 1.6);
  game.shake = Math.max(game.shake, .7);
  game.flash = Math.max(game.flash, .25);
  game.decals.push({ x, y, r: radius * .5, a: .35, color: '#1b1b1b' });
  game.events.push('explosion');
}
function breakProp(game, prop) {
  if (prop.broken) return;
  prop.broken = true;
  burst(game, prop.x, prop.y, prop.kind === 'barrel' ? '#b3762f' : '#8a6a44', 12, 90, 2);
  // Шкафчик и коробка щедрее на полезное, покрышки чаще пустые.
  const bias = prop.kind === 'locker' ? .25 : prop.kind === 'box' ? -.1 : prop.kind === 'tyres' ? .5 : 0;
  const roll = Math.max(0, Math.min(1, prop.loot + bias));
  if (prop.key) game.level.pickups.push({ kind: 'key', x: prop.x, y: prop.y, bob: 0 });
  else if (roll < .3) for (let i = 0; i < 3; i += 1) game.level.pickups.push({ kind: 'coin', x: prop.x + (game.random() - .5) * 12, y: prop.y + (game.random() - .5) * 12, bob: game.random() * TAU });
  else if (roll < .55) game.level.pickups.push({ kind: 'ammo', x: prop.x, y: prop.y, bob: 0 });
  else if (roll < .68) game.level.pickups.push({ kind: 'medkit', x: prop.x, y: prop.y, bob: 0 });
  game.events.push('prop-break');
  game.shake = Math.max(game.shake, .12);
}

/* ---------- enemies ---------- */
function updateEnemy(game, enemy, dt) {
  const player = game.player;
  if (enemy.dead) return;
  enemy.flash = Math.max(0, enemy.flash - dt);
  enemy.stagger = Math.max(0, enemy.stagger - dt);
  enemy.cooldown = Math.max(0, enemy.cooldown - dt);
  const d = distance(enemy.x, enemy.y, player.x, player.y);
  const sees = d < enemy.sight && lineOfSight(game, enemy.x, enemy.y, player.x, player.y);
  if (sees) enemy.state = 'chase'; else if (enemy.state === 'chase' && d > enemy.sight * 1.4) enemy.state = 'idle';
  enemy.facing = Math.atan2(player.y - enemy.y, player.x - enemy.x);

  // Зарытый мертвец ждёт, пока игрок подойдёт, и вылезает из-под земли.
  if (enemy.buried) {
    if (d < 250 && lineOfSight(game, enemy.x, enemy.y, player.x, player.y)) {
      enemy.buried = false;
      enemy.emerge = DIG_TIME;
      enemy.state = 'emerge';
      game.events.push('enemy-dig');
      light(game, enemy.x, enemy.y, 70, '#6b563a', .4, .8);
      for (let i = 0; i < 10; i += 1) {
        burst(game, enemy.x + (game.random() - .5) * 18, enemy.y + 2, '#6b563a', 2, 55, 1.8);
      }
    }
    return;
  }
  if (enemy.emerge > 0) {
    enemy.emerge -= dt;
    if (game.random() < .55) {
      burst(game, enemy.x + (game.random() - .5) * 14, enemy.y + 3, '#5a4a33', 1, 36, 1.3);
    }
    if (enemy.emerge <= 0) {
      enemy.state = 'idle';
      for (let i = 0; i < 12; i += 1) {
        burst(game, enemy.x + (game.random() - .5) * 20, enemy.y + 4, '#6b563a', 2, 70, 1.8);
      }
      game.shake = Math.max(game.shake, .18);
      game.events.push('enemy-emerge');
    }
    return;
  }

  // Отбрасывание и оглушение сдвигают врага с места.
  applyKnockback(game, enemy, dt);
  enemy.vx *= Math.pow(.02, dt); enemy.vy *= Math.pow(.02, dt);
  if (Math.abs(enemy.vx) < 1) enemy.vx = 0;
  if (Math.abs(enemy.vy) < 1) enemy.vy = 0;

  if (enemy.stagger > 0) return;
  if (!sees) {
    // Бесцельное брожение, чтобы заброшка казалась живой.
    if (enemy.state === 'idle') {
      enemy.wander = (enemy.wander ?? 0) - dt;
      if (enemy.wander <= 0) {
        enemy.wander = 1.5 + game.random() * 2.5;
        enemy.aim = game.random() * TAU;
      }
      if (enemy.aim != null) moveEntity(game, enemy, Math.cos(enemy.aim) * enemy.speed * .35 * dt, Math.sin(enemy.aim) * enemy.speed * .35 * dt);
    }
    return;
  }

  if (enemy.brain === 'ranged') {
    const preferred = enemy.reach * .7;
    const sign = d > preferred ? 1 : d < preferred * .7 ? -1 : 0;
    if (sign) moveEntity(game, enemy, Math.cos(enemy.facing) * enemy.speed * sign * dt, Math.sin(enemy.facing) * enemy.speed * sign * dt);
    if (enemy.cooldown <= 0 && d < enemy.reach) {
      enemy.cooldown = enemy.attackRate;
      enemy.windup = .35;
    }
    if (enemy.windup > 0) {
      enemy.windup -= dt;
      if (enemy.windup <= 0) {
        game.bullets.push({
          x: enemy.x + Math.cos(enemy.facing) * 10, y: enemy.y + Math.sin(enemy.facing) * 10,
          vx: Math.cos(enemy.facing) * 210, vy: Math.sin(enemy.facing) * 210,
          damage: enemy.damage, life: 2, radius: 3, friendly: false, color: '#d8d3c2', knockback: 40,
        });
        game.events.push('enemy-shoot');
      }
    }
    return;
  }

  // Ближний бой: идти к игроку, замахнуться, ударить.
  if (d > enemy.reach * .8) {
    moveEntity(game, enemy, Math.cos(enemy.facing) * enemy.speed * dt, Math.sin(enemy.facing) * enemy.speed * dt);
  } else if (enemy.cooldown <= 0) {
    enemy.cooldown = enemy.attackRate;
    enemy.windup = .3;
  }
  if (enemy.windup > 0) {
    enemy.windup -= dt;
    if (enemy.windup <= 0 && d < enemy.reach + 6) {
      damagePlayer(game, enemy.damage, enemy.x, enemy.y);
      burst(game, (enemy.x + player.x) / 2, (enemy.y + player.y) / 2, '#ff6b6b', 6, 70, 1.6);
    }
  }
}

// Сколько босс «замахивается» перед атакой и как это показывается.
const TELEGRAPH_TIME = { charge: .55, slam: .5, summon: .6, volley: .4, syringe: .4, chain: .5, shockwave: .7, flame: .65, shrapnel: .45, heal: .5, blink: .3 };
const TELEGRAPH_RADIUS = { slam: 80, shockwave: 120, summon: 60, flame: 130, charge: 90, shrapnel: 100, chain: 150, heal: 50, blink: 60, volley: 70, syringe: 70 };
const ATTACK_SHOUT = {
  charge: 'РЫВОК!', slam: 'УДАР!', summon: 'ПОДМОГА!', volley: 'ЗАЛП!', syringe: 'ШПРИЦЫ!',
  chain: 'ЦЕПЬ!', shockwave: 'ВОЛНА!', flame: 'ОГОНЬ!', shrapnel: 'ОСКОЛКИ!', heal: 'НАРКОЗ!', blink: 'ПЕРЕМЕЩЕНИЕ!',
};
// Атаки из приоритетных списков: в ярости босс чаще берёт свои коронные приёмы.
function pickBossAttack(game, boss, pool) {
  if (boss.mode !== 'rage') return pool[Math.floor(game.random() * pool.length)];
  const signature = pool.filter((name) => (boss.abilities || []).includes(name));
  if (signature.length && game.random() < .6) return signature[Math.floor(game.random() * signature.length)];
  return pool[Math.floor(game.random() * pool.length)];
}
// В дремоте босс бьёт вполсилы — это тревожный звоночек, а не бой.
function bossDamage(boss, base) {
  return base * (boss.mode === 'drowsy' ? .6 : boss.mode === 'rage' ? 1.15 : 1);
}

function updateBoss(game, boss, dt) {
  const player = game.player;
  boss.flash = Math.max(0, boss.flash - dt);
  boss.bob += dt;
  applyKnockback(game, boss, dt);
  boss.vx *= Math.pow(.05, dt); boss.vy *= Math.pow(.05, dt);
  const d = distance(boss.x, boss.y, player.x, player.y);
  boss.facing = Math.atan2(player.y - boss.y, player.x - boss.x);
  updateBossChain(game, boss, dt);
  // Переход между фазами.
  const ratio = boss.health / boss.maxHealth;
  const wanted = ratio <= .33 ? 3 : ratio <= .66 ? 2 : 1;
  if (wanted > boss.phase) {
    boss.phase = wanted;
    boss.cooldown = .6;
    boss.attack = null;
    boss.telegraph = null;
    light(game, boss.x, boss.y, 200, '#ff9a4a', .5, 1.5);
    game.shake = Math.max(game.shake, .5);
    game.events.push('boss-phase');
    if (boss.phase >= 3) {
      boss.mode = 'rage';
      boss.speed = boss.baseSpeed * 1.3;
      game.shake = Math.max(game.shake, 1);
      game.flash = Math.max(game.flash, .45);
      light(game, boss.x, boss.y, 320, '#ff4a3a', .9, 2);
      say(game, boss.x, boss.y - 34, 'ЯРОСТЬ!', '#ff5a4a');
      game.events.push('boss-rage');
      for (let i = 0; i < 20; i += 1) {
        const a = game.random() * TAU;
        burst(game, boss.x + Math.cos(a) * 24, boss.y + Math.sin(a) * 24, '#ff6a3a', 1, 100, 2.2);
      }
    } else {
      say(game, boss.x, boss.y - 30, `ФАЗА ${boss.phase}`, '#ff9d5c');
    }
  }
  if (boss.mode === 'rage') boss.rageGlow = Math.min(1, boss.rageGlow + dt * 1.5);

  if (boss.attack) {
    boss.timer -= dt;
    if (boss.telegraph) boss.telegraph.t += dt;
    if (boss.windup > 0) {
      boss.windup -= dt;
      if (boss.windup <= 0) {
        boss.telegraph = null;
        runBossAttack(game, boss);
      }
      return;
    }
    if (boss.attack === 'charge' && boss.timer > 0) {
      moveEntity(game, boss, Math.cos(boss.chargeAngle) * boss.speed * 3.1 * dt, Math.sin(boss.chargeAngle) * boss.speed * 3.1 * dt);
      if (d < boss.radius + player.radius + 4) damagePlayer(game, boss.damage, boss.x, boss.y);
      if (game.random() < .6) burst(game, boss.x, boss.y, boss.palette[1], 2, 40, 2);
    }
    if (boss.attack === 'flame' && boss.timer > 0 && game.random() < .8) {
      const a = boss.facing + (game.random() - .5) * .9;
      const speed = 120 + game.random() * 90;
      game.bullets.push({
        x: boss.x + Math.cos(a) * 16, y: boss.y + Math.sin(a) * 16,
        vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, damage: bossDamage(boss, .8), life: .5,
        radius: 5, friendly: false, color: '#ff9a3a', knockback: 15,
      });
      burst(game, boss.x + Math.cos(a) * 20, boss.y + Math.sin(a) * 20, '#ff8a2a', 1, 60, 1.2);
    }
    if (boss.timer <= 0) {
      boss.attack = null;
      boss.cooldown = Math.max(.85, 2 - boss.phase * .35) * (boss.mode === 'rage' ? .75 : 1);
    }
    return;
  }

  boss.cooldown -= dt;
  // Держат дистанцию, кроме рывка: боссы медленно идут к игроку.
  if (d > 60) moveEntity(game, boss, Math.cos(boss.facing) * boss.speed * .6 * dt, Math.sin(boss.facing) * boss.speed * .6 * dt);
  if (boss.cooldown <= 0) {
    const pool = boss.mode === 'rage' && boss.rage.length ? boss.rage : boss.attacks;
    boss.attack = pickBossAttack(game, boss, pool);
    boss.windup = TELEGRAPH_TIME[boss.attack] ?? .45;
    boss.timer = boss.attack === 'charge' ? .8 : boss.attack === 'flame' ? 1.1 : boss.attack === 'heal' ? .4 : .5;
    if (boss.attack === 'charge') boss.chargeAngle = boss.facing;
    boss.telegraph = { kind: boss.attack, t: 0, max: boss.windup, angle: boss.facing, radius: TELEGRAPH_RADIUS[boss.attack] ?? 70 };
    game.events.push('boss-telegraph');
    say(game, boss.x, boss.y - 26, ATTACK_SHOUT[boss.attack] || 'АТАКА!', '#ffb27a');
  }
}

// Босс ещё спит, но уже ворочается: редкие слабые выпады на шум.
function updateDrowsyBoss(game, boss, dt) {
  const player = game.player;
  boss.bob += dt;
  boss.flash = Math.max(0, boss.flash - dt);
  updateBossChain(game, boss, dt);
  if (boss.attack) {
    boss.timer -= dt;
    if (boss.telegraph) boss.telegraph.t += dt;
    if (boss.windup > 0) {
      boss.windup -= dt;
      if (boss.windup <= 0) {
        boss.telegraph = null;
        runBossAttack(game, boss);
      }
      return;
    }
    if (boss.timer <= 0) { boss.attack = null; boss.cooldown = 3.4 + game.random() * 2.2; }
    return;
  }
  boss.cooldown -= dt;
  if (boss.cooldown <= 0) {
    const pool = boss.calm.length ? boss.calm : boss.attacks;
    boss.attack = pool[Math.floor(game.random() * pool.length)];
    boss.facing = Math.atan2(player.y - boss.y, player.x - boss.x);
    boss.windup = (TELEGRAPH_TIME[boss.attack] ?? .45) + .5;
    boss.timer = .5;
    boss.telegraph = { kind: boss.attack, t: 0, max: boss.windup, angle: boss.facing, radius: TELEGRAPH_RADIUS[boss.attack] ?? 70, weak: true };
    game.events.push('boss-telegraph');
  }
}

// Цепь-крюк: летит вперёд, при попадании притягивает игрока к боссу.
function updateBossChain(game, boss, dt) {
  const chain = boss.chain;
  if (!chain) return;
  const player = game.player;
  chain.timer -= dt;
  if (chain.state === 'out') {
    chain.length = Math.min(chain.max, chain.length + dt * 620);
    const tipX = boss.x + Math.cos(chain.angle) * chain.length;
    const tipY = boss.y + Math.sin(chain.angle) * chain.length;
    if (solidAt(game, tipX, tipY)) { chain.state = 'back'; return; }
    if (distance(tipX, tipY, player.x, player.y) < player.radius + 10) {
      damagePlayer(game, boss.damage * .5, boss.x, boss.y);
      chain.state = 'pull';
      chain.timer = .4;
      game.events.push('chain-hit');
      light(game, player.x, player.y, 90, '#ffd08a', .4, .5);
    }
    if (chain.length >= chain.max) chain.state = 'back';
  } else if (chain.state === 'pull') {
    chain.length = Math.max(24, chain.length - dt * 320);
    moveEntity(game, player, (boss.x - player.x) * dt * 3.4, (boss.y - player.y) * dt * 3.4);
    if (chain.timer <= 0) chain.state = 'back';
  } else {
    chain.length = Math.max(0, chain.length - dt * 780);
    if (chain.length <= 0) boss.chain = null;
  }
}

function runBossAttack(game, boss) {
  const player = game.player;
  if (boss.attack === 'slam') {
    explode(game, boss.x, boss.y, 70, 2);
    for (let i = 0; i < 10; i += 1) {
      const a = (i / 10) * TAU;
      game.bullets.push({ x: boss.x, y: boss.y, vx: Math.cos(a) * 150, vy: Math.sin(a) * 150, damage: 1.2, life: 1.4, radius: 3, friendly: false, color: '#ffb04a', knockback: 60 });
    }
  } else if (boss.attack === 'summon') {
    const table = game.location.enemies;
    for (let i = 0; i < 1 + boss.phase; i += 1) {
      const a = game.random() * TAU;
      const x = boss.x + Math.cos(a) * 34, y = boss.y + Math.sin(a) * 34;
      if (solidAt(game, x, y)) continue;
      const minion = spawnEnemy(game, table[Math.floor(game.random() * table.length)], x, y);
      minion.buried = false;
      minion.emerge = .75;
      minion.state = 'emerge';
      game.level.enemies.push(minion);
      burst(game, x, y, '#8f7', 6, 60, 2);
    }
    game.events.push('boss-summon');
  } else if (boss.attack === 'volley' || boss.attack === 'syringe') {
    const shots = 4 + boss.phase;
    const spread = boss.attack === 'volley' ? 1.2 : .5;
    for (let i = 0; i < shots; i += 1) {
      const a = boss.facing + (i - (shots - 1) / 2) * (spread / shots) * 2;
      game.bullets.push({
        x: boss.x + Math.cos(a) * 14, y: boss.y + Math.sin(a) * 14,
        vx: Math.cos(a) * 230, vy: Math.sin(a) * 230, damage: 1.2, life: 2,
        radius: boss.attack === 'syringe' ? 2 : 3, friendly: false,
        color: boss.attack === 'syringe' ? '#bff6ff' : '#ffd166', knockback: 50,
      });
    }
    game.events.push('boss-shoot');
  } else if (boss.attack === 'chain') {
    boss.chain = { angle: boss.facing, length: 0, max: 230, state: 'out', timer: 1.6 };
    game.events.push('boss-chain');
  } else if (boss.attack === 'shockwave') {
    game.shake = Math.max(game.shake, .9);
    for (let ring = 0; ring < 2; ring += 1) {
      for (let i = 0; i < 14; i += 1) {
        const a = (i / 14) * TAU + ring * .22;
        const speed = 150 + ring * 70;
        game.bullets.push({
          x: boss.x + Math.cos(a) * 18, y: boss.y + Math.sin(a) * 18,
          vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
          damage: bossDamage(boss, 1.3), life: 1.7, radius: 4, friendly: false,
          color: '#ffd08a', knockback: 70,
        });
      }
    }
    for (let i = 0; i < 22; i += 1) {
      burst(game, boss.x + (game.random() - .5) * 46, boss.y + (game.random() - .5) * 46, '#8a7a5a', 2, 80, 2.2);
    }
    light(game, boss.x, boss.y, 160, '#ffb060', .6, .8);
    game.events.push('boss-slam');
  } else if (boss.attack === 'flame') {
    for (let i = 0; i < 18; i += 1) {
      const a = boss.facing + (game.random() - .5) * 1.1;
      const speed = 120 + game.random() * 100;
      game.bullets.push({
        x: boss.x + Math.cos(a) * 16, y: boss.y + Math.sin(a) * 16,
        vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
        damage: bossDamage(boss, .8), life: .55, radius: 5, friendly: false,
        color: '#ff9a3a', knockback: 15,
      });
    }
    light(game, boss.x + Math.cos(boss.facing) * 34, boss.y + Math.sin(boss.facing) * 34, 130, '#ff7a2a', .6, .7);
    game.events.push('boss-flame');
  } else if (boss.attack === 'shrapnel') {
    for (let wave = 0; wave < 2; wave += 1) {
      for (let i = 0; i < 10; i += 1) {
        const a = (i / 10) * TAU + wave * .32 + game.random() * .1;
        const speed = 110 + wave * 70;
        game.bullets.push({
          x: boss.x, y: boss.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
          damage: bossDamage(boss, 1.2), life: 1.9, radius: 3, friendly: false,
          color: '#cfd6dd', knockback: 55,
        });
      }
    }
    game.shake = Math.max(game.shake, .4);
    game.events.push('boss-shoot');
  } else if (boss.attack === 'heal') {
    const amount = boss.maxHealth * (boss.mode === 'rage' ? .13 : .09);
    boss.health = Math.min(boss.maxHealth, boss.health + amount);
    light(game, boss.x, boss.y, 150, '#8fffa8', .7, 1.3);
    for (let i = 0; i < 16; i += 1) {
      burst(game, boss.x + (game.random() - .5) * 42, boss.y + (game.random() - .5) * 42, '#9fffb4', 1, 55, 2.4);
    }
    say(game, boss.x, boss.y - 30, 'РЕГЕНЕРАЦИЯ', '#9fffb4');
    game.events.push('boss-heal');
  } else if (boss.attack === 'blink') {
    for (let i = 0; i < 14; i += 1) burst(game, boss.x, boss.y, '#bff6ff', 2, 90, 2);
    const angle = game.random() * TAU;
    const nx = player.x + Math.cos(angle) * 78, ny = player.y + Math.sin(angle) * 78;
    if (!solidAt(game, nx, ny)) { boss.x = nx; boss.y = ny; }
    else if (!solidAt(game, boss.x, boss.y + 40)) { boss.y += 40; }
    for (let i = 0; i < 14; i += 1) burst(game, boss.x, boss.y, '#bff6ff', 2, 90, 2);
    light(game, boss.x, boss.y, 130, '#bff6ff', .6, .9);
    game.events.push('boss-blink');
  }
}
function killBoss(game, boss) {
  boss.dead = true;
  game.stats.killed += 1;
  game.events.push('boss-die');
  game.shake = 1; game.flash = .8;
  for (let i = 0; i < 6; i += 1) {
    const a = game.random() * TAU, r = game.random() * 40;
    explode(game, boss.x + Math.cos(a) * r, boss.y + Math.sin(a) * r, 40, 1);
  }
  for (let i = 0; i < 18; i += 1) {
    game.level.pickups.push({ kind: 'coin', x: boss.x + (game.random() - .5) * 70, y: boss.y + (game.random() - .5) * 70, bob: game.random() * TAU });
  }
  game.level.pickups.push({ kind: 'medkit', x: boss.x, y: boss.y, bob: 0 });
  // Босс стережёт выход: зачистил арену — дверь открыта.
  game.level.grid[game.level.door.y * game.level.w + game.level.door.x] = FLOOR;
  game.doorOpen = true;
  say(game, boss.x, boss.y - 40, 'ВЫХОД ОТКРЫТ', '#ffd27a');
}

/* ---------- pickups ---------- */
function collect(game, pickup) {
  const player = game.player;
  if (pickup.kind === 'coin') {
    player.coins += 1; game.stats.coins += 1;
    game.events.push('coin');
    burst(game, pickup.x, pickup.y, '#ffd76a', 4, 50, 1.4);
  } else if (pickup.kind === 'key') {
    game.keys += 1;
    game.events.push('key');
    say(game, pickup.x, pickup.y - 14, '+ КЛЮЧ', '#ffe9b0');
    burst(game, pickup.x, pickup.y, '#ffe9b0', 8, 60, 1.6);
  } else if (pickup.kind === 'ammo') {
    const types = player.gun ? [WEAPONS[player.gun].ammo] : ['pistol'];
    const type = types[0];
    player.ammo[type] = (player.ammo[type] || 0) + (type === 'rifle' ? 30 : type === 'shells' ? 8 : 16);
    game.events.push('pickup');
    say(game, pickup.x, pickup.y - 14, '+ ПАТРОНЫ', '#cfe6ff');
  } else if (pickup.kind === 'medkit') {
    if (player.health >= player.maxHealth) return false;
    player.health = Math.min(player.maxHealth, player.health + 2);
    game.events.push('pickup');
    say(game, pickup.x, pickup.y - 14, '+ ЗДОРОВЬЕ', '#9ff2a8');
  }
  return true;
}

/* ---------- main update ---------- */
export function updateGame(game, dt, input = {}) {
  game.events = [];
  game.time += dt;
  game.shake = Math.max(0, game.shake - dt * 2.2);
  game.flash = Math.max(0, game.flash - dt * 2.4);
  const player = game.player;
  const level = game.level;
  if (game.dead || game.complete) {
    updateParticles(game, dt);
    return game.events;
  }

  // --- movement ---
  let mx = input.move?.x || 0, my = input.move?.y || 0;
  const magnitude = Math.hypot(mx, my);
  if (magnitude > 1) { mx /= magnitude; my /= magnitude; }
  player.moving = magnitude > .15;
  if (player.moving) {
    player.facing = Math.atan2(my, mx);
    player.walk += dt * 9;
  }
  // Отбрасывание от взрывов и ударов.
  applyKnockback(game, player, dt);
  player.vx *= Math.pow(.02, dt); player.vy *= Math.pow(.02, dt);
  if (Math.abs(player.vx) < 2) player.vx = 0;
  if (Math.abs(player.vy) < 2) player.vy = 0;
  moveEntity(game, player, mx * player.speed * dt, my * player.speed * dt);
  player.invulnerable = Math.max(0, player.invulnerable - dt);
  player.hurt = Math.max(0, player.hurt - dt);
  player.cooldown = Math.max(0, player.cooldown - dt);
  player.muzzle = Math.max(0, (player.muzzle || 0) - dt);
  player.recoil = Math.max(0, (player.recoil || 0) - dt * 5);

  if (player.reload > 0) {
    player.reload -= dt;
    if (player.reload <= 0) { player.reload = 0; finishReload(game); }
  }

  // --- actions ---
  if (input.melee && player.cooldown <= 0) playerMelee(game);
  if (input.shoot && player.cooldown <= 0 && player.reload <= 0) playerShoot(game);
  if (input.reload) startReload(game);
  if (input.grenade) { throwGrenade(game); input.grenade = false; }
  resolveSwing(game, dt);

  // --- door and exit ---
  const ptx = Math.floor(player.x / TILE), pty = Math.floor(player.y / TILE);
  if (!game.doorOpen && game.keys > 0) {
    const dx = Math.abs(ptx - level.door.x), dy = Math.abs(pty - level.door.y);
    if (dx + dy <= 2 && lineOfSight(game, player.x, player.y, level.door.x * TILE + TILE / 2, level.door.y * TILE + TILE / 2, true)) {
      game.keys -= 1;
      game.doorOpen = true;
      level.grid[level.door.y * level.w + level.door.x] = FLOOR;
      game.events.push('door-open');
      say(game, player.x, player.y - 20, 'ДВЕРЬ ОТКРЫТА', '#ffd27a');
      game.shake = Math.max(game.shake, .3);
    }
  }
  if (distance(player.x, player.y, level.exit.x, level.exit.y) < 18) {
    const canLeave = level.boss ? !!level.boss.dead : true;
    if (canLeave) {
      game.complete = true;
      game.events.push('level-complete');
    }
  }

  // --- enemies ---
  for (const enemy of level.enemies) if (!enemy.dead) updateEnemy(game, enemy, dt);
  // Босс дремлет в арене и встречает игрока с полным здоровьем: зомби его не грызут.
  const boss = level.boss;
  if (boss && !boss.dead) {
    if (!boss.awake) {
      const near = distance(player.x, player.y, boss.x, boss.y) < 230;
      if (near && lineOfSight(game, boss.x, boss.y, player.x, player.y)) {
        boss.awake = true;
        boss.mode = 'combat';
        boss.cooldown = .8;
        game.events.push('boss-wake');
        game.shake = Math.max(game.shake, .6);
        light(game, boss.x, boss.y, 260, '#ff8a5a', .5, 1.2);
        say(game, boss.x, boss.y - 34, boss.name.toUpperCase(), '#ff9a6a');
      } else if (distance(player.x, player.y, boss.x, boss.y) < 380) {
        // Спит, но слышит: ворочается и делает редкие выпады на шум.
        updateDrowsyBoss(game, boss, dt);
      }
    }
    if (boss.awake) updateBoss(game, boss, dt);
  }

  // --- bullets ---
  for (const bullet of game.bullets) {
    if (bullet.removed) continue;
    bullet.x += bullet.vx * dt; bullet.y += bullet.vy * dt;
    bullet.life -= dt;
    if (bullet.life <= 0 || solidAt(game, bullet.x, bullet.y)) {
      bullet.removed = true;
      burst(game, bullet.x, bullet.y, bullet.color, 3, 40, 1.2);
      continue;
    }
    if (bullet.friendly) {
      for (const enemy of level.enemies) {
        if (enemy.dead) continue;
        if (distance(bullet.x, bullet.y, enemy.x, enemy.y) < enemy.radius + bullet.radius) {
          bullet.removed = true;
          damageEnemy(game, enemy, bullet.damage, bullet.x, bullet.y, bullet.knockback);
          break;
        }
      }
      if (!bullet.removed && level.boss && !level.boss.dead && distance(bullet.x, bullet.y, level.boss.x, level.boss.y) < level.boss.radius + bullet.radius) {
        bullet.removed = true;
        damageBoss(game, level.boss, bullet.damage, bullet.x, bullet.y, bullet.knockback);
      }
      if (!bullet.removed) {
        for (const prop of level.props) {
          if (prop.broken) continue;
          if (distance(bullet.x, bullet.y, prop.x, prop.y) < prop.radius + bullet.radius) { bullet.removed = true; breakProp(game, prop); break; }
        }
      }
    } else if (distance(bullet.x, bullet.y, player.x, player.y) < player.radius + bullet.radius) {
      bullet.removed = true;
      damagePlayer(game, bullet.damage, bullet.x, bullet.y);
    }
  }

  // --- grenades ---
  for (const grenade of game.grenades) {
    if (grenade.removed) continue;
    grenade.fuse -= dt;
    grenade.spin += dt * 12;
    const nx = grenade.x + grenade.vx * dt, ny = grenade.y + grenade.vy * dt;
    if (!solidAt(game, nx, ny)) { grenade.x = nx; grenade.y = ny; }
    else { grenade.vx *= -.4; grenade.vy *= -.4; }
    grenade.vx *= Math.pow(.25, dt); grenade.vy *= Math.pow(.25, dt);
    if (grenade.fuse <= 0) {
      grenade.removed = true;
      explode(game, grenade.x, grenade.y, 64, 8, true);
    }
  }

  // --- pickups ---
  for (const pickup of level.pickups) {
    if (pickup.taken) continue;
    pickup.bob += dt * 3;
    const d = distance(pickup.x, pickup.y, player.x, player.y);
    if (d < 26) {
      const dx = (player.x - pickup.x) / d, dy = (player.y - pickup.y) / d;
      pickup.x += dx * 130 * dt; pickup.y += dy * 130 * dt;
    }
    if (d < player.radius + 7) {
      if (collect(game, pickup)) pickup.taken = true;
    }
  }

  updateParticles(game, dt);
  game.bullets = game.bullets.filter((bullet) => !bullet.removed && bullet.life > 0);
  game.grenades = game.grenades.filter((grenade) => !grenade.removed);
  level.pickups = level.pickups.filter((pickup) => !pickup.taken);
  level.enemies = level.enemies.filter((enemy) => !enemy.dead);
  return game.events;
}

function updateParticles(game, dt) {
  for (const particle of game.particles) {
    particle.x += particle.vx * dt; particle.y += particle.vy * dt;
    particle.vx *= Math.pow(.06, dt); particle.vy *= Math.pow(.06, dt);
    particle.life -= dt;
  }
  game.particles = game.particles.filter((particle) => particle.life > 0);
  for (const text of game.texts) { text.life -= dt; text.y -= dt * 12; }
  game.texts = game.texts.filter((text) => text.life > 0);
  for (const lamp of game.lights) lamp.life -= dt;
  game.lights = game.lights.filter((lamp) => lamp.life > 0);
  if (game.decals.length > 120) game.decals.splice(0, game.decals.length - 120);
}

/* ---------- shop ---------- */
export function applyPurchase(game, id, progress) {
  const player = game.player;
  if (id === 'medkit') { player.health = Math.min(player.maxHealth, player.health + 3); return true; }
  if (id === 'maxhp') { progress.upgrades.maxhp = (progress.upgrades.maxhp || 0) + 1; player.maxHealth += 1; player.health += 1; return true; }
  if (id === 'damage') { progress.upgrades.damage = (progress.upgrades.damage || 0) + 1; player.damageScale = 1 + progress.upgrades.damage * .25; return true; }
  if (id === 'speed') { progress.upgrades.speed = (progress.upgrades.speed || 0) + 1; player.speed = 76 * (1 + progress.upgrades.speed * .12); return true; }
  if (id === 'grenade') { player.grenades += 2; return true; }
  if (id.startsWith('ammo_')) {
    const type = id.slice(5);
    player.ammo[type] = (player.ammo[type] || 0) + (type === 'rifle' ? 60 : type === 'shells' ? 12 : 24);
    return true;
  }
  return false;
}
export function equipWeapon(game, id) {
  const weapon = WEAPONS[id];
  if (!weapon) return;
  if (weapon.kind === 'melee') game.player.melee = id;
  else {
    game.player.gun = id;
    game.player.magazine = Math.min(weapon.magazine, game.player.ammo[weapon.ammo] || 0);
    game.player.ammo[weapon.ammo] = Math.max(0, (game.player.ammo[weapon.ammo] || 0) - game.player.magazine);
  }
}
export const levelTitle = (locationIndex, slot) => `${LOCATIONS[locationIndex].short} · ЭТАЖ ${slot + 1}`;
