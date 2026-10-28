// Deterministic game simulation: no DOM, timers, storage or rendering dependencies.
import { SECTORS } from './content.js';
export const WORLD_HEIGHT = 540;
export const MAX_HEALTH = 3;
export const WAVE_COOLDOWN = 9;
export const SECTOR_FLIGHT_TIME = 24;
const PLAYER_RADIUS = 22;
const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const randomBetween = (game, min, max) => min + game.random() * (max - min);
const overlaps = (a, b, extra = 0) => {
  const dx = a.x - b.x, dy = a.y - b.y, r = a.radius + b.radius + extra;
  return dx * dx + dy * dy < r * r;
};

export function createGame({ width = 960, random = Math.random, mode = 'endless', sectorIndex = 0, upgrades = {}, skin = 'classic' } = {}) {
  width = Math.max(540, width);
  const levels = Object.fromEntries(['weapon', 'hull', 'engine', 'wave'].map((id) => [id, clamp(Math.floor(upgrades[id] || 0), 0, 5)]));
  const maxHealth = MAX_HEALTH + levels.hull;
  return {
    width, height: WORLD_HEIGHT, random, mode: mode === 'campaign' ? 'campaign' : 'endless',
    sectorIndex: clamp(Math.floor(sectorIndex), 0, SECTORS.length - 1), sectorElapsed: 0, sectorCycle: 0,
    upgrades: levels, skin, elapsed: 0, distance: 0, score: 0, stars: 0, destroyed: 0, dronesDestroyed: 0,
    bossesDefeated: 0, creditsCollected: 0, partsCollected: 0, bonus: 0,
    gameOver: false, victory: false, settled: false, boss: null,
    player: { x: width * .22, y: 270, targetX: width * .22, targetY: 270, radius: PLAYER_RADIUS, health: maxHealth, maxHealth, invulnerable: 0 },
    waveCooldown: 0, waveMax: WAVE_COOLDOWN - levels.wave * .6,
    timers: { rock: 1.2, star: 2.6, repair: 19, drone: 14, shot: .15, boss: SECTOR_FLIGHT_TIME, credits: 9, part: 17 },
    rocks: [], drones: [], bullets: [], hostileBullets: [], pickups: [], particles: [], rings: [], events: [],
  };
}

export function resizeGame(game, width) {
  width = Math.max(540, width);
  const ratio = width / game.width;
  game.width = width;
  game.player.x *= ratio; game.player.targetX *= ratio;
  for (const list of [game.rocks, game.drones, game.bullets, game.hostileBullets, game.pickups, game.particles, game.rings]) {
    for (const object of list) object.x *= ratio;
  }
  if (game.boss) game.boss.x *= ratio;
  setTarget(game, game.player.targetX, game.player.targetY);
  game.player.x = clamp(game.player.x, 52, Math.max(52, width * .64));
}
export function setTarget(game, x, y) {
  game.player.targetX = clamp(x, 52, Math.max(52, game.width * .64));
  game.player.targetY = clamp(y, 67, WORLD_HEIGHT - 54);
}
function emit(game, x, y, color, amount = 9, strength = 1) {
  for (let i = 0; i < amount; i += 1) {
    const angle = randomBetween(game, 0, TAU), speed = randomBetween(game, 25, 145) * strength, life = randomBetween(game, .25, .7);
    game.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, radius: randomBetween(game, 1.2, 3.7), life, maxLife: life, color });
  }
  if (game.particles.length > 220) game.particles.splice(0, game.particles.length - 220);
}
function spawnRock(game) {
  const radius = randomBetween(game, 20, 39);
  const comet = game.sectorElapsed > 7 && game.random() < .27;
  game.rocks.push({
    x: game.width + radius + 12, y: randomBetween(game, 70 + radius * .3, WORLD_HEIGHT - 45 - radius * .3), radius,
    vx: (-randomBetween(game, 150, 215) - Math.min(game.elapsed * .65, 75)) * (comet ? 1.3 : 1),
    vy: randomBetween(game, -14, 14), rotation: randomBetween(game, 0, TAU), spin: randomBetween(game, -.8, .8),
    shape: randomBetween(game, 0, 100), health: radius > 32 ? 3 : radius > 26 ? 2 : 1,
    comet, sector: game.sectorIndex, removed: false,
  });
}
function spawnPickup(game, kind) {
  game.pickups.push({ kind, x: game.width + 25, y: randomBetween(game, 90, WORLD_HEIGHT - 75), radius: kind === 'star' ? 16 : 18, vx: -145, phase: randomBetween(game, 0, TAU), removed: false });
}
function spawnDrone(game) {
  const y = randomBetween(game, 95, WORLD_HEIGHT - 85);
  game.drones.push({ x: game.width + 35, y, baseY: y, radius: 25, vx: -105 - Math.min(game.elapsed * .3, 40), phase: randomBetween(game, 0, TAU), fire: 1.5, health: 3, removed: false });
}
function spawnBoss(game) {
  const maxHealth = 28 + game.sectorIndex * 9 + Math.min(game.sectorCycle * 5, 30);
  game.boss = { x: game.width + 105, y: 270, radius: 63, health: maxHealth, maxHealth, age: 0, fire: 1.8, hitFlash: 0, sector: game.sectorIndex };
  // No surprise asteroid can strike the player during the boss introduction.
  game.rocks = []; game.drones = []; game.hostileBullets = [];
  game.events.push('boss-arrives');
}
function destroyRock(game, rock) {
  if (rock.removed) return;
  rock.removed = true; game.destroyed += 1;
  emit(game, rock.x, rock.y, '#ffa17c', 11, 1.05);
  game.rings.push({ x: rock.x, y: rock.y, age: 0, duration: .35, maxRadius: rock.radius * 1.7, color: '255,166,128' });
  game.events.push('break');
}
function destroyDrone(game, drone) {
  if (drone.removed) return;
  drone.removed = true; game.dronesDestroyed += 1;
  emit(game, drone.x, drone.y, '#eaa4ff', 14, 1.2);
  game.rings.push({ x: drone.x, y: drone.y, age: 0, duration: .45, maxRadius: 65, color: '205,157,255' });
  game.events.push('break');
}
function damageBoss(game, damage) {
  const boss = game.boss;
  if (!boss || boss.health <= 0) return;
  boss.health = Math.max(0, boss.health - damage); boss.hitFlash = .09;
  if (boss.health > 0) return;
  game.bossesDefeated += 1;
  emit(game, boss.x, boss.y, '#ffe2a2', 35, 1.7);
  game.rings.push({ x: boss.x, y: boss.y, age: 0, duration: .8, maxRadius: 150, color: '255,205,158' });
  game.hostileBullets = [];
  game.events.push('boss-defeated');
  game.boss = null;
  if (game.mode === 'campaign') {
    game.victory = true; game.gameOver = true; game.events.push('victory');
  } else {
    game.sectorIndex = (game.sectorIndex + 1) % SECTORS.length;
    game.sectorCycle += 1; game.sectorElapsed = 0;
    game.timers.boss = SECTOR_FLIGHT_TIME + Math.min(game.sectorCycle * 2, 10);
    game.timers.rock = 2.5; game.timers.drone = 6;
    game.player.health = Math.min(game.player.maxHealth, game.player.health + 1);
    game.events.push('sector-change');
  }
}
export function useWave(game) {
  if (game.gameOver || game.waveCooldown > 0) return false;
  const player = game.player, reach = 150 + game.upgrades.wave * 10;
  game.waveCooldown = game.waveMax;
  player.invulnerable = Math.max(player.invulnerable, .8);
  game.rings.push({ x: player.x, y: player.y, age: 0, duration: .7, maxRadius: reach + 45, color: '130,255,242' });
  emit(game, player.x, player.y, '#a8fff1', 20, 1.3);
  for (const rock of game.rocks) if (!rock.removed && overlaps(player, rock, reach)) destroyRock(game, rock);
  for (const drone of game.drones) if (!drone.removed && overlaps(player, drone, reach)) destroyDrone(game, drone);
  for (const bullet of game.hostileBullets) if (!bullet.removed && overlaps(player, bullet, reach)) bullet.removed = true;
  if (game.boss && overlaps(player, game.boss, reach)) damageBoss(game, 5 + game.upgrades.wave * 2);
  game.score = calculateScore(game);
  return true;
}
function damagePlayer(game, source) {
  source.removed = true;
  if (game.player.invulnerable > 0 || game.gameOver) return;
  game.player.health = Math.max(0, game.player.health - 1); game.player.invulnerable = 1.6;
  emit(game, game.player.x, game.player.y, '#ffa38b', 18, 1.2);
  game.rings.push({ x: game.player.x, y: game.player.y, age: 0, duration: .4, maxRadius: 65, color: '255,150,139' });
  game.events.push('hit');
  if (game.player.health === 0) { game.gameOver = true; game.events.push('gameover'); }
}
function calculateScore(game) {
  return Math.floor(game.distance) + game.stars * 50 + game.destroyed * 20 + game.dronesDestroyed * 60 + game.bossesDefeated * 250 + game.bonus;
}
function updateBoss(game, dt) {
  const boss = game.boss;
  if (!boss) return;
  boss.age += dt; boss.hitFlash = Math.max(0, boss.hitFlash - dt);
  const desiredX = Math.max(game.width * .76, game.width - 155);
  boss.x = Math.max(desiredX, boss.x - 150 * dt);
  boss.y = 270 + Math.sin(boss.age * (.72 + boss.sector * .12)) * (110 - boss.sector * 10);
  boss.fire -= dt;
  if (boss.fire <= 0 && boss.x < game.width - 40) {
    const dx = game.player.x - boss.x, dy = game.player.y - boss.y;
    const aimed = Math.atan2(dy, dx);
    const count = boss.sector === 0 ? 3 : boss.sector === 1 ? 4 : 5;
    const spacing = boss.sector === 0 ? .18 : .15;
    for (let i = 0; i < count; i += 1) {
      const angle = aimed + (i - (count - 1) / 2) * spacing;
      const speed = 190 + boss.sector * 12;
      game.hostileBullets.push({ x: boss.x - 45, y: boss.y, radius: 7 + boss.sector, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, removed: false, sector: boss.sector });
    }
    boss.fire = Math.max(1.1, 2.15 - boss.sector * .18 - (boss.health < boss.maxHealth * .5 ? .25 : 0));
  }
}

export function updateGame(game, seconds) {
  game.events = [];
  if (game.gameOver || !Number.isFinite(seconds) || seconds <= 0) return game.events;
  const dt = Math.min(seconds, .05);
  game.elapsed += dt; game.sectorElapsed += dt;
  game.distance += dt * (20 + Math.min(game.elapsed * .12, 16));
  game.waveCooldown = Math.max(0, game.waveCooldown - dt);
  const player = game.player;
  player.invulnerable = Math.max(0, player.invulnerable - dt);
  const smoothing = 1 - Math.exp(-(11 + game.upgrades.engine * 1.5) * dt);
  player.x += (player.targetX - player.x) * smoothing; player.y += (player.targetY - player.y) * smoothing;

  if (!game.boss) {
    game.timers.boss -= dt;
    if (game.timers.boss <= 0) spawnBoss(game);
  }
  if (!game.boss) {
    game.timers.rock -= dt;
    if (game.timers.rock <= 0) { spawnRock(game); game.timers.rock += Math.max(.55, 1.3 - game.elapsed * .006) * randomBetween(game, .85, 1.18); }
    game.timers.drone -= dt;
    if (game.timers.drone <= 0) { spawnDrone(game); game.timers.drone += randomBetween(game, 7, 11); }
  }
  for (const [timer, kind, lo, hi] of [['star','star',3.4,5], ['repair','repair',20,26], ['credits','credit',10,15], ['part','part',18,24]]) {
    game.timers[timer] -= dt;
    if (game.timers[timer] <= 0) { spawnPickup(game, kind); game.timers[timer] += randomBetween(game, lo, hi); }
  }
  game.timers.shot -= dt;
  if (game.timers.shot <= 0) {
    game.bullets.push({ x: player.x + 34, y: player.y, radius: 5, vx: 560, damage: 1 + game.upgrades.weapon * .25, removed: false });
    game.timers.shot += Math.max(.16, .26 - game.upgrades.weapon * .018);
  }

  for (const rock of game.rocks) { rock.x += rock.vx * dt; rock.y += rock.vy * dt; rock.rotation += rock.spin * dt; if (rock.x < -rock.radius - 40) rock.removed = true; }
  for (const drone of game.drones) {
    drone.x += drone.vx * dt; drone.y = drone.baseY + Math.sin(game.elapsed * 2 + drone.phase) * 35; drone.fire -= dt;
    if (drone.fire <= 0 && drone.x < game.width - 30 && drone.x > player.x + 20) {
      const dx = player.x - drone.x, dy = player.y - drone.y, magnitude = Math.hypot(dx, dy) || 1;
      game.hostileBullets.push({ x: drone.x - 20, y: drone.y, radius: 7, vx: dx / magnitude * 245, vy: dy / magnitude * 245, removed: false });
      drone.fire += 2.6;
    }
    if (drone.x < -60) drone.removed = true;
  }
  updateBoss(game, dt);
  for (const bullet of game.bullets) { bullet.x += bullet.vx * dt; if (bullet.x > game.width + 30) bullet.removed = true; }
  for (const bullet of game.hostileBullets) {
    bullet.x += bullet.vx * dt; bullet.y += bullet.vy * dt;
    if (bullet.x < -30 || bullet.x > game.width + 30 || bullet.y < -30 || bullet.y > WORLD_HEIGHT + 30) bullet.removed = true;
  }
  for (const pickup of game.pickups) { pickup.x += pickup.vx * dt; pickup.phase += dt * 3; if (pickup.x < -40) pickup.removed = true; }

  for (const bullet of game.bullets) {
    if (bullet.removed) continue;
    for (const rock of game.rocks) {
      if (!rock.removed && overlaps(bullet, rock)) { bullet.removed = true; rock.health -= bullet.damage || 1; emit(game, bullet.x, bullet.y, '#ffe1bd', 4, .6); if (rock.health <= 0) destroyRock(game, rock); break; }
    }
    if (bullet.removed) continue;
    for (const drone of game.drones) {
      if (!drone.removed && overlaps(bullet, drone)) { bullet.removed = true; drone.health -= bullet.damage || 1; emit(game, bullet.x, bullet.y, '#a5f9f5', 4, .6); if (drone.health <= 0) destroyDrone(game, drone); break; }
    }
    if (!bullet.removed && game.boss && overlaps(bullet, game.boss)) {
      bullet.removed = true; emit(game, bullet.x, bullet.y, '#fff1c7', 3, .4); damageBoss(game, bullet.damage || 1);
    }
  }
  for (const rock of game.rocks) if (!rock.removed && overlaps(player, rock, -4)) damagePlayer(game, rock);
  for (const drone of game.drones) if (!drone.removed && overlaps(player, drone, -4)) damagePlayer(game, drone);
  for (const bullet of game.hostileBullets) if (!bullet.removed && overlaps(player, bullet, -3)) damagePlayer(game, bullet);
  if (game.boss && overlaps(player, game.boss, -8)) damagePlayer(game, { removed: false });
  for (const pickup of game.pickups) {
    if (pickup.removed || !overlaps(player, pickup, 5) || game.gameOver) continue;
    pickup.removed = true;
    if (pickup.kind === 'star') { game.stars += 1; emit(game, pickup.x, pickup.y, '#ffdf87', 13); game.events.push('star'); }
    else if (pickup.kind === 'credit') { game.creditsCollected += 20; emit(game, pickup.x, pickup.y, '#ffdf87', 10); game.events.push('credit'); }
    else if (pickup.kind === 'part') { game.partsCollected += 1; emit(game, pickup.x, pickup.y, '#b6eaff', 10); game.events.push('part'); }
    else {
      if (player.health < player.maxHealth) player.health += 1; else game.bonus += 50;
      emit(game, pickup.x, pickup.y, '#a3ffd1', 13); game.events.push('repair');
    }
  }
  for (const particle of game.particles) { particle.x += particle.vx * dt; particle.y += particle.vy * dt; particle.vx *= Math.pow(.12, dt); particle.vy *= Math.pow(.12, dt); particle.life -= dt; }
  for (const ring of game.rings) ring.age += dt;
  game.rocks = game.rocks.filter((item) => !item.removed); game.drones = game.drones.filter((item) => !item.removed);
  game.bullets = game.bullets.filter((item) => !item.removed); game.hostileBullets = game.hostileBullets.filter((item) => !item.removed);
  game.pickups = game.pickups.filter((item) => !item.removed); game.particles = game.particles.filter((item) => item.life > 0);
  game.rings = game.rings.filter((item) => item.age < item.duration);
  game.score = calculateScore(game);
  return game.events;
}
