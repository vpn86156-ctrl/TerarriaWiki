// The simulation is independent of the DOM, the renderer, and frame rate.
export const WORLD_HEIGHT = 540;
export const MAX_HEALTH = 3;
export const WAVE_COOLDOWN = 9;
const PLAYER_RADIUS = 22;
const TAU = Math.PI * 2;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const randomBetween = (game, min, max) => min + game.random() * (max - min);
const overlaps = (a, b, extra = 0) => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const r = a.radius + b.radius + extra;
  return dx * dx + dy * dy < r * r;
};

export function createGame({ width = 960, random = Math.random } = {}) {
  width = Math.max(540, width);
  return {
    width,
    height: WORLD_HEIGHT,
    random,
    elapsed: 0,
    distance: 0,
    score: 0,
    stars: 0,
    destroyed: 0,
    dronesDestroyed: 0,
    bonus: 0,
    gameOver: false,
    player: { x: width * 0.22, y: 270, targetX: width * 0.22, targetY: 270, radius: PLAYER_RADIUS, health: MAX_HEALTH, invulnerable: 0 },
    waveCooldown: 0,
    timers: { rock: 1.2, star: 2.6, repair: 19, drone: 14, shot: 0.15 },
    rocks: [],
    drones: [],
    bullets: [],
    hostileBullets: [],
    pickups: [],
    particles: [],
    rings: [],
    events: [],
  };
}

export function resizeGame(game, width) {
  width = Math.max(540, width);
  const ratio = width / game.width;
  game.width = width;
  game.player.x *= ratio;
  game.player.targetX *= ratio;
  for (const list of [game.rocks, game.drones, game.bullets, game.hostileBullets, game.pickups, game.particles, game.rings]) {
    for (const object of list) object.x *= ratio;
  }
  setTarget(game, game.player.targetX, game.player.targetY);
  game.player.x = clamp(game.player.x, 52, Math.max(52, width * 0.64));
}

export function setTarget(game, x, y) {
  game.player.targetX = clamp(x, 52, Math.max(52, game.width * 0.64));
  game.player.targetY = clamp(y, 67, WORLD_HEIGHT - 54);
}

function emit(game, x, y, color, amount = 9, strength = 1) {
  for (let i = 0; i < amount; i += 1) {
    const angle = randomBetween(game, 0, TAU);
    const speed = randomBetween(game, 25, 145) * strength;
    const life = randomBetween(game, 0.25, 0.7);
    game.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, radius: randomBetween(game, 1.2, 3.7), life, maxLife: life, color });
  }
  if (game.particles.length > 220) game.particles.splice(0, game.particles.length - 220);
}

function spawnRock(game) {
  const radius = randomBetween(game, 20, 39);
  game.rocks.push({
    x: game.width + radius + 12,
    y: randomBetween(game, 70 + radius * 0.3, WORLD_HEIGHT - 45 - radius * 0.3),
    radius,
    vx: -randomBetween(game, 155, 225) - Math.min(game.elapsed * 0.8, 95),
    vy: randomBetween(game, -14, 14),
    rotation: randomBetween(game, 0, TAU),
    spin: randomBetween(game, -0.8, 0.8),
    shape: randomBetween(game, 0, 100),
    health: radius > 32 ? 3 : radius > 26 ? 2 : 1,
    removed: false,
  });
}

function spawnPickup(game, kind) {
  game.pickups.push({ kind, x: game.width + 25, y: randomBetween(game, 90, WORLD_HEIGHT - 75), radius: kind === 'star' ? 16 : 18, vx: -145, phase: randomBetween(game, 0, TAU), removed: false });
}

function spawnDrone(game) {
  const y = randomBetween(game, 95, WORLD_HEIGHT - 85);
  game.drones.push({ x: game.width + 35, y, baseY: y, radius: 25, vx: -105 - Math.min(game.elapsed * 0.3, 40), phase: randomBetween(game, 0, TAU), fire: 1.5, health: 3, removed: false });
}

function destroyRock(game, rock) {
  if (rock.removed) return;
  rock.removed = true;
  game.destroyed += 1;
  emit(game, rock.x, rock.y, '#ffa17c', 11, 1.05);
  game.rings.push({ x: rock.x, y: rock.y, age: 0, duration: 0.35, maxRadius: rock.radius * 1.7, color: '255,166,128' });
  game.events.push('break');
}

function destroyDrone(game, drone) {
  if (drone.removed) return;
  drone.removed = true;
  game.dronesDestroyed += 1;
  emit(game, drone.x, drone.y, '#eaa4ff', 14, 1.2);
  game.rings.push({ x: drone.x, y: drone.y, age: 0, duration: 0.45, maxRadius: 65, color: '205,157,255' });
  game.events.push('break');
}

export function useWave(game) {
  if (game.gameOver || game.waveCooldown > 0) return false;
  const player = game.player;
  game.waveCooldown = WAVE_COOLDOWN;
  player.invulnerable = Math.max(player.invulnerable, 0.8);
  game.rings.push({ x: player.x, y: player.y, age: 0, duration: 0.7, maxRadius: 195, color: '130,255,242' });
  emit(game, player.x, player.y, '#a8fff1', 20, 1.3);
  for (const rock of game.rocks) if (!rock.removed && overlaps(player, rock, 150)) destroyRock(game, rock);
  for (const drone of game.drones) if (!drone.removed && overlaps(player, drone, 150)) destroyDrone(game, drone);
  for (const bullet of game.hostileBullets) if (!bullet.removed && overlaps(player, bullet, 150)) bullet.removed = true;
  game.score = calculateScore(game);
  return true;
}

function damagePlayer(game, source) {
  source.removed = true;
  if (game.player.invulnerable > 0 || game.gameOver) return;
  game.player.health = Math.max(0, game.player.health - 1);
  game.player.invulnerable = 1.6;
  emit(game, game.player.x, game.player.y, '#ffa38b', 18, 1.2);
  game.rings.push({ x: game.player.x, y: game.player.y, age: 0, duration: 0.4, maxRadius: 65, color: '255,150,139' });
  game.events.push('hit');
  if (game.player.health === 0) {
    game.gameOver = true;
    game.events.push('gameover');
  }
}

function calculateScore(game) {
  return Math.floor(game.distance) + game.stars * 50 + game.destroyed * 20 + game.dronesDestroyed * 60 + game.bonus;
}

export function updateGame(game, seconds) {
  game.events = [];
  if (game.gameOver || !Number.isFinite(seconds) || seconds <= 0) return game.events;
  // Avoid a suspended app advancing minutes in a single frame.
  const dt = Math.min(seconds, 0.05);
  game.elapsed += dt;
  game.distance += dt * (20 + Math.min(game.elapsed * 0.12, 16));
  game.waveCooldown = Math.max(0, game.waveCooldown - dt);
  const player = game.player;
  player.invulnerable = Math.max(0, player.invulnerable - dt);
  const smoothing = 1 - Math.exp(-11 * dt);
  player.x += (player.targetX - player.x) * smoothing;
  player.y += (player.targetY - player.y) * smoothing;

  game.timers.rock -= dt;
  if (game.timers.rock <= 0) {
    spawnRock(game);
    game.timers.rock += Math.max(0.5, 1.25 - game.elapsed * 0.009) * randomBetween(game, 0.85, 1.18);
  }
  game.timers.star -= dt;
  if (game.timers.star <= 0) { spawnPickup(game, 'star'); game.timers.star += randomBetween(game, 3.4, 5.0); }
  game.timers.repair -= dt;
  if (game.timers.repair <= 0) { spawnPickup(game, 'repair'); game.timers.repair += randomBetween(game, 20, 26); }
  game.timers.drone -= dt;
  if (game.timers.drone <= 0) { spawnDrone(game); game.timers.drone += randomBetween(game, 7, 11); }
  game.timers.shot -= dt;
  if (game.timers.shot <= 0) {
    game.bullets.push({ x: player.x + 34, y: player.y, radius: 5, vx: 560, removed: false });
    game.timers.shot += 0.26;
  }

  for (const rock of game.rocks) {
    rock.x += rock.vx * dt;
    rock.y += rock.vy * dt;
    rock.rotation += rock.spin * dt;
    if (rock.x < -rock.radius - 40) rock.removed = true;
  }
  for (const drone of game.drones) {
    drone.x += drone.vx * dt;
    drone.y = drone.baseY + Math.sin(game.elapsed * 2 + drone.phase) * 35;
    drone.fire -= dt;
    if (drone.fire <= 0 && drone.x < game.width - 30 && drone.x > player.x + 20) {
      const dx = player.x - drone.x;
      const dy = player.y - drone.y;
      const magnitude = Math.hypot(dx, dy) || 1;
      game.hostileBullets.push({ x: drone.x - 20, y: drone.y, radius: 7, vx: dx / magnitude * 245, vy: dy / magnitude * 245, removed: false });
      drone.fire += 2.6;
    }
    if (drone.x < -60) drone.removed = true;
  }
  for (const bullet of game.bullets) { bullet.x += bullet.vx * dt; if (bullet.x > game.width + 30) bullet.removed = true; }
  for (const bullet of game.hostileBullets) {
    bullet.x += bullet.vx * dt; bullet.y += bullet.vy * dt;
    if (bullet.x < -30 || bullet.x > game.width + 30 || bullet.y < -30 || bullet.y > WORLD_HEIGHT + 30) bullet.removed = true;
  }
  for (const pickup of game.pickups) { pickup.x += pickup.vx * dt; pickup.phase += dt * 3; if (pickup.x < -40) pickup.removed = true; }

  for (const bullet of game.bullets) {
    if (bullet.removed) continue;
    for (const rock of game.rocks) {
      if (!rock.removed && overlaps(bullet, rock)) {
        bullet.removed = true; rock.health -= 1;
        emit(game, bullet.x, bullet.y, '#ffe1bd', 4, 0.6);
        if (rock.health <= 0) destroyRock(game, rock);
        break;
      }
    }
    if (bullet.removed) continue;
    for (const drone of game.drones) {
      if (!drone.removed && overlaps(bullet, drone)) {
        bullet.removed = true; drone.health -= 1;
        emit(game, bullet.x, bullet.y, '#a5f9f5', 4, 0.6);
        if (drone.health <= 0) destroyDrone(game, drone);
        break;
      }
    }
  }
  for (const rock of game.rocks) if (!rock.removed && overlaps(player, rock, -4)) damagePlayer(game, rock);
  for (const drone of game.drones) if (!drone.removed && overlaps(player, drone, -4)) damagePlayer(game, drone);
  for (const bullet of game.hostileBullets) if (!bullet.removed && overlaps(player, bullet, -3)) damagePlayer(game, bullet);
  for (const pickup of game.pickups) {
    if (pickup.removed || !overlaps(player, pickup, 5) || game.gameOver) continue;
    pickup.removed = true;
    if (pickup.kind === 'star') { game.stars += 1; emit(game, pickup.x, pickup.y, '#ffdf87', 13); game.events.push('star'); }
    else {
      if (player.health < MAX_HEALTH) player.health += 1; else game.bonus += 50;
      emit(game, pickup.x, pickup.y, '#a3ffd1', 13); game.events.push('repair');
    }
  }

  for (const particle of game.particles) {
    particle.x += particle.vx * dt; particle.y += particle.vy * dt;
    particle.vx *= Math.pow(0.12, dt); particle.vy *= Math.pow(0.12, dt); particle.life -= dt;
  }
  for (const ring of game.rings) ring.age += dt;
  game.rocks = game.rocks.filter((item) => !item.removed);
  game.drones = game.drones.filter((item) => !item.removed);
  game.bullets = game.bullets.filter((item) => !item.removed);
  game.hostileBullets = game.hostileBullets.filter((item) => !item.removed);
  game.pickups = game.pickups.filter((item) => !item.removed);
  game.particles = game.particles.filter((item) => item.life > 0);
  game.rings = game.rings.filter((item) => item.age < item.duration);
  game.score = calculateScore(game);
  return game.events;
}
