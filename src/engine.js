// Deterministic game simulation: no DOM, timers, storage or rendering dependencies.
import { BIOMES, LEVELS, levelById } from './content.js';
export const WORLD_HEIGHT = 540;
export const MAX_HEALTH = 3;
export const WAVE_COOLDOWN = 9;
export const SECTOR_FLIGHT_TIME = 24;
export const BOSS_WARNING = 2.6;
export const BOSS_DEATH_TIME = 2.4;
export const MINI_BOSS_DELAY = 7;
const PLAYER_RADIUS = 22;
const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const randomBetween = (game, min, max) => min + game.random() * (max - min);
const overlaps = (a, b, extra = 0) => {
  const dx = a.x - b.x, dy = a.y - b.y, r = a.radius + b.radius + extra;
  return dx * dx + dy * dy < r * r;
};
const RAGE_PALETTE = ['#ffd0a2', '#ff7a4d', '#5c1f33'];
export const bossPalette = (biomeIndex) => BIOMES[clamp(Math.floor(biomeIndex), 0, BIOMES.length - 1)].palette.rock.slice(0, 3);

/* Hazard behaviour of every biome. Damage, control and movement effects live here. */
const HAZARDS = {
  plasma: { radius: 78, speed: 58, drift: 26, life: 18, damage: true },
  mine: { radius: 21, speed: 88, life: 20, arm: .9, blast: 122, health: 1 },
  frost: { radius: 70, speed: 66, drift: 18, life: 16, chill: 2.2 },
  vortex: { radius: 104, speed: 62, drift: 22, life: 15, push: 190 },
  turret: { radius: 27, speed: 52, life: 24, health: 4, fire: 2.4 },
  flare: { radius: 58, speed: 34, life: 9, warn: 1.3, active: .8, width: 62 },
  crystal: { radius: 30, speed: 48, life: 22, health: 5, fire: 3.1, warn: .7, ring: 8 },
  well: { radius: 44, speed: 44, life: 13, pull: 260, core: 46 },
};

export function createGame({ width = 960, random = Math.random, mode = 'endless', biomeIndex = 0, upgrades = {}, skin = 'classic', level = null } = {}) {
  width = Math.max(540, width);
  const levels = Object.fromEntries(['weapon', 'hull', 'engine', 'wave'].map((id) => [id, clamp(Math.floor(upgrades[id] || 0), 0, 5)]));
  const maxHealth = MAX_HEALTH + levels.hull;
  const active = typeof level === 'string' ? levelById(level) : level;
  const campaign = active ? 'campaign' : (mode === 'campaign' ? 'endless' : 'endless');
  const biome = active ? active.biomeIndex : clamp(Math.floor(biomeIndex), 0, BIOMES.length - 1);
  const bossTimer = active ? (active.kind === 'boss' ? MINI_BOSS_DELAY : Infinity) : SECTOR_FLIGHT_TIME;
  return {
    width, height: WORLD_HEIGHT, random, mode: campaign, level: active,
    biomeIndex: biome, sectorElapsed: 0, sectorCycle: 0,
    upgrades: levels, skin, elapsed: 0, levelTime: 0, distance: 0, score: 0, stars: 0,
    destroyed: 0, dronesDestroyed: 0, bossesDefeated: 0, creditsCollected: 0, partsCollected: 0, bonus: 0,
    gameOver: false, victory: false, levelComplete: false, tookDamage: false, chill: 0, settled: false,
    boss: null, finale: null, warning: 0, warningFired: false, shake: 0, flash: 0, timeScale: 1,
    player: { x: width * .22, y: 270, targetX: width * .22, targetY: 270, radius: PLAYER_RADIUS, health: maxHealth, maxHealth, invulnerable: 0, vx: 0, vy: 0 },
    waveCooldown: 0, waveMax: WAVE_COOLDOWN - levels.wave * .6,
    objective: active ? { kind: active.kind, target: active.target, progress: 0, done: false } : null,
    timers: { rock: 1.2, star: 2.6, repair: 19, drone: 14, shot: .15, boss: bossTimer, credits: 9, part: 17 },
    hazardTimers: (active ? BIOMES[biome].hazards : []).map((config) => config.every[0]),
    hazards: [],
    rocks: [], drones: [], bullets: [], hostileBullets: [], pickups: [], particles: [], rings: [], debris: [], events: [],
  };
}
export const biomeOf = (game) => BIOMES[clamp(game.biomeIndex, 0, BIOMES.length - 1)];

export function resizeGame(game, width) {
  width = Math.max(540, width);
  const ratio = width / game.width;
  game.width = width;
  game.player.x *= ratio; game.player.targetX *= ratio;
  for (const list of [game.rocks, game.drones, game.bullets, game.hostileBullets, game.pickups, game.particles, game.rings, game.debris, game.hazards]) {
    for (const object of list) object.x *= ratio;
  }
  if (game.boss) game.boss.x *= ratio;
  if (game.finale) game.finale.x *= ratio;
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
  const config = biomeOf(game).spawn;
  const radius = randomBetween(game, 20, 39);
  const comet = game.sectorElapsed > 7 && game.random() < config.comet;
  game.rocks.push({
    x: game.width + radius + 12, y: randomBetween(game, 70 + radius * .3, WORLD_HEIGHT - 45 - radius * .3), radius,
    vx: (-randomBetween(game, 150, 215) - Math.min(game.elapsed * .65, 75)) * config.speed * (comet ? 1.25 : 1),
    vy: randomBetween(game, -14, 14), rotation: randomBetween(game, 0, TAU), spin: randomBetween(game, -.9, .9),
    shape: randomBetween(game, 0, 100), health: radius > 32 ? 3 : radius > 26 ? 2 : 1,
    comet, biome: game.biomeIndex, removed: false,
  });
}
function spawnPickup(game, kind) {
  game.pickups.push({ kind, x: game.width + 25, y: randomBetween(game, 90, WORLD_HEIGHT - 75), radius: kind === 'star' ? 17 : 19, vx: -145, phase: randomBetween(game, 0, TAU), spin: randomBetween(game, 0, TAU), removed: false });
}
function spawnDrone(game, small = false) {
  const y = randomBetween(game, 95, WORLD_HEIGHT - 85);
  game.drones.push({
    x: game.width + 35, y, baseY: y, radius: small ? 15 : 25, small,
    vx: (small ? -190 : -105) - Math.min(game.elapsed * .3, 40),
    phase: randomBetween(game, 0, TAU), fire: small ? .8 : 1.5, health: small ? 1 : 3, removed: false,
  });
}
function spawnHazard(game, config) {
  const definition = HAZARDS[config.type];
  const y = config.type === 'flare'
    ? randomBetween(game, 90, WORLD_HEIGHT - 90)
    : randomBetween(game, 90 + definition.radius * .4, WORLD_HEIGHT - 60 - definition.radius * .4);
  game.hazards.push({
    type: config.type, x: game.width + definition.radius + 20, y, baseY: y, radius: definition.radius,
    vx: -definition.speed * randomBetween(game, .9, 1.15), phase: randomBetween(game, 0, TAU),
    life: definition.life, maxLife: definition.life, state: 'idle', timer: 0, cooldown: 0,
    health: definition.health ?? 0, maxHealth: definition.health ?? 0, hitFlash: 0,
    fire: definition.fire ?? 0, removed: false, biome: game.biomeIndex,
  });
}
// Where the guardian's weak point sits right now. Hitting it while it is exposed deals bonus damage.
export function weakPointOf(boss) {
  const r = boss.radius;
  let ox = -r * .16, oy = Math.sin(boss.age * .9) * r * .1, size = 30;
  if (boss.weak === 'claw') { ox = -r * .74; oy = Math.sin(boss.age * 1.7) * r * .28; size = 24; }
  else if (boss.weak === 'eye') { ox = -r * .42; oy = -r * .3; size = 25; }
  else if (boss.weak === 'ring') { const a = boss.age * 1.15; ox = Math.cos(a) * r * .82; oy = Math.sin(a) * r * .82; size = 26; }
  return { x: boss.x + ox, y: boss.y + oy, radius: size };
}
// Health fractions at which a guardian switches to the next phase: 2 phases -> 50 %, 3 phases -> 66 % / 33 %.
export const phaseThresholds = (boss) => (boss.phaseCount >= 3 ? [.66, .33] : [.5]);
function spawnBoss(game) {
  const biome = biomeOf(game);
  const level = game.level;
  const maxHealth = level?.boss ? level.boss.health : 28 + game.biomeIndex * 9 + Math.min(game.sectorCycle * 5, 30);
  const phaseCount = level?.boss?.phases || 2;
  game.boss = {
    x: game.width + 120, y: 270, radius: level?.boss ? 62 : 70, health: maxHealth, maxHealth, age: 0, fire: 2.1,
    hitFlash: 0, biome: game.biomeIndex, phase: 1, phaseCount, phaseShift: 0, burst: 3.4, entering: 1.6, breath: 0,
    pattern: level?.boss ? level.boss.pattern : biome.pattern, name: level?.boss?.name || biome.guardian.name,
    death: level?.boss?.death || 'shatter', weak: level?.boss?.weak || 'core',
    weakOpen: 0, weakTimer: 3.4, weakFlash: 0,
    patternTimer: 3.2, charge: 0, beam: null, phasing: 0, blink: 0,
  };
  // No surprise asteroid can strike the player during the boss introduction.
  game.rocks = []; game.drones = []; game.hostileBullets = [];
  game.shake = .75; game.flash = .35; game.warning = 0;
  game.events.push('boss-arrives');
}
function destroyRock(game, rock) {
  if (rock.removed) return;
  rock.removed = true; game.destroyed += 1;
  emit(game, rock.x, rock.y, '#ffa17c', 11, 1.05);
  game.rings.push({ x: rock.x, y: rock.y, age: 0, duration: .35, maxRadius: rock.radius * 1.7, color: '255,166,128' });
  game.shake = Math.max(game.shake, .18);
  game.events.push('break');
}
function destroyDrone(game, drone) {
  if (drone.removed) return;
  drone.removed = true; game.dronesDestroyed += 1;
  emit(game, drone.x, drone.y, '#eaa4ff', 14, 1.2);
  game.rings.push({ x: drone.x, y: drone.y, age: 0, duration: .45, maxRadius: 65, color: '205,157,255' });
  game.shake = Math.max(game.shake, .22);
  game.events.push('drone-break');
}
function destroyHazard(game, hazard) {
  if (hazard.removed) return;
  hazard.removed = true; game.destroyed += 1;
  emit(game, hazard.x, hazard.y, '#bff0ff', 13, 1.1);
  game.rings.push({ x: hazard.x, y: hazard.y, age: 0, duration: .4, maxRadius: hazard.radius * 1.8, color: '150,220,255' });
  game.shake = Math.max(game.shake, .22);
  game.events.push('hazard-break');
}
// Every guardian dies in its own way: shards, slag, implosion, supernova or collapse.
const DEATH_STYLES = {
  shatter: { speed: [60, 290], pieces: 30, gravity: 30, color: ['#fff2c9', '#ffd7a0'], blast: 5, spread: 1 },
  ice: { speed: [95, 330], pieces: 34, gravity: 12, color: ['#e8fbff', '#b8ecff'], blast: 6, spread: 1.15 },
  slag: { speed: [45, 210], pieces: 28, gravity: 240, color: ['#ffb26b', '#ff7a3d'], blast: 7, spread: .8 },
  dissolve: { speed: [30, 150], pieces: 36, gravity: -18, color: ['#d9fff2', '#8bffcf'], blast: 4, spread: 1.3 },
  supernova: { speed: [140, 430], pieces: 40, gravity: 0, color: ['#fff6d8', '#ffd166'], blast: 8, spread: 1 },
  crystal: { speed: [80, 260], pieces: 32, gravity: 40, color: ['#d8c7ff', '#a27bff'], blast: 5, spread: .95 },
  collapse: { speed: [-260, -70], pieces: 34, gravity: 0, color: ['#b7a6ff', '#6fe9ff'], blast: 3, spread: .7 },
};
function beginBossDeath(game, boss) {
  const palette = bossPalette(boss.biome);
  const style = DEATH_STYLES[boss.death] || DEATH_STYLES.shatter;
  game.debris = [];
  for (let i = 0; i < style.pieces; i += 1) {
    const angle = (i / style.pieces) * TAU + randomBetween(game, -.12, .12);
    const distance = boss.radius * randomBetween(game, .2, .85);
    const speed = randomBetween(game, style.speed[0], style.speed[1]) * style.spread;
    const colors = i % 3 === 0 ? style.color : palette;
    game.debris.push({
      x: boss.x + Math.cos(angle) * distance, y: boss.y + Math.sin(angle) * distance,
      vx: Math.cos(angle) * speed + 55, vy: Math.sin(angle) * speed,
      rotation: randomBetween(game, 0, TAU), spin: randomBetween(game, -6, 6),
      size: randomBetween(game, 7, 21), life: BOSS_DEATH_TIME, maxLife: BOSS_DEATH_TIME,
      color: colors[Math.min(colors.length - 1, Math.floor(game.random() * colors.length))],
      shape: Math.floor(game.random() * 3), gravity: style.gravity,
    });
  }
  game.finale = {
    x: boss.x, y: boss.y, biome: boss.biome, radius: boss.radius, timer: BOSS_DEATH_TIME,
    next: .1, blast: 0, style: boss.death,
  };
  game.shake = 1; game.flash = .85; game.timeScale = .35;
  game.hostileBullets = [];
  emit(game, boss.x, boss.y, style.color[0], 40, 1.9);
  game.rings.push({ x: boss.x, y: boss.y, age: 0, duration: .9, maxRadius: 190, color: '255,214,158' });
  if (boss.death === 'collapse') game.rings.push({ x: boss.x, y: boss.y, age: 0, duration: 1.6, maxRadius: 30, color: '120,160,255', shrink: true });
}
function damageBoss(game, damage, point) {
  const boss = game.boss;
  if (!boss || boss.health <= 0 || boss.phasing > 0 || boss.phaseShift > 0) return;
  let amount = damage;
  if (point && boss.weakOpen > 0) {
    const spot = weakPointOf(boss);
    if (Math.hypot(point.x - spot.x, point.y - spot.y) <= spot.radius) {
      amount *= 2.4; boss.weakFlash = .18;
      game.shake = Math.max(game.shake, .3);
      emit(game, spot.x, spot.y, '#fff6d8', 12, 1.4);
      game.events.push('weak-hit');
    }
  }
  boss.health = Math.max(0, boss.health - amount); boss.hitFlash = .09;
  if (boss.health > 0) {
    const thresholds = phaseThresholds(boss);
    const next = thresholds[boss.phase - 1];
    if (next && boss.health <= boss.maxHealth * next) {
      // The guardian braces, turns invulnerable for a moment and comes back angrier.
      boss.phaseShift = 1.15;
      boss.weakOpen = 0;
      game.shake = Math.max(game.shake, .8); game.flash = Math.max(game.flash, .35);
      game.hostileBullets = [];
      emit(game, boss.x, boss.y, '#ffb27a', 26, 1.5);
      game.rings.push({ x: boss.x, y: boss.y, age: 0, duration: 1.1, maxRadius: 210, color: '255,150,110' });
      game.events.push('boss-rage');
    }
    return;
  }
  game.bossesDefeated += 1;
  beginBossDeath(game, boss);
  game.boss = null;
  game.events.push('boss-defeated');
}
function completeLevel(game) {
  if (!game.level || game.levelComplete) return;
  game.levelComplete = true;
  game.victory = true;
  game.gameOver = true;
  game.stars += 0;
  game.events.push('level-complete');
  game.events.push('victory');
}
function finishFinale(game) {
  const finale = game.finale;
  game.finale = null;
  game.timeScale = 1;
  if (game.level) {
    completeLevel(game);
    return finale;
  }
  if (game.mode === 'campaign') {
    game.victory = true; game.gameOver = true;
    game.events.push('victory');
  } else {
    game.biomeIndex = (game.biomeIndex + 1) % BIOMES.length;
    game.sectorCycle += 1; game.sectorElapsed = 0;
    game.timers.boss = SECTOR_FLIGHT_TIME + Math.min(game.sectorCycle * 2, 10);
    game.timers.rock = 2.5; game.timers.drone = 6;
    game.hazards = []; game.hazardTimers = BIOMES[game.biomeIndex].hazards.map((config) => config.every[0]);
    game.warningFired = false;
    game.player.health = Math.min(game.player.maxHealth, game.player.health + 1);
    game.events.push('sector-change');
  }
  return finale;
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
  for (const hazard of game.hazards) if (!hazard.removed && hazard.health && overlaps(player, hazard, reach)) destroyHazard(game, hazard);
  for (const bullet of game.hostileBullets) if (!bullet.removed && overlaps(player, bullet, reach)) bullet.removed = true;
  if (game.boss && overlaps(player, game.boss, reach)) damageBoss(game, 5 + game.upgrades.wave * 2, { x: player.x + 26, y: player.y });
  game.score = calculateScore(game);
  return true;
}
function damagePlayer(game, source, remove = true) {
  if (remove) source.removed = true;
  if (game.player.invulnerable > 0 || game.gameOver) return;
  game.player.health = Math.max(0, game.player.health - 1);
  game.player.invulnerable = 1.6;
  game.tookDamage = true;
  emit(game, game.player.x, game.player.y, '#ffa38b', 18, 1.2);
  game.rings.push({ x: game.player.x, y: game.player.y, age: 0, duration: .4, maxRadius: 65, color: '255,150,139' });
  game.shake = Math.max(game.shake, .6); game.flash = Math.max(game.flash, .18);
  game.events.push('hit');
  if (game.player.health === 0) { game.gameOver = true; game.shake = 1; game.events.push('gameover'); }
}
function calculateScore(game) {
  return Math.floor(game.distance) + game.stars * 50 + game.destroyed * 20 + game.dronesDestroyed * 60 + game.bossesDefeated * 250 + game.bonus;
}
export function evaluateStars(level, game) {
  if (!level || !game.levelComplete) return 0;
  if (game.level.id !== level.id) return 0;
  const healthy = game.player.health >= Math.ceil(game.player.maxHealth / 2);
  const fast = game.levelTime <= level.par * 1.25;
  let stars = 1;
  if (level.kind === 'survive' || level.kind === 'boss') {
    if (healthy) stars += 1;
    if (!game.tookDamage) stars += 1;
  } else {
    if (fast) stars += 1;
    if (!game.tookDamage && game.levelTime <= level.par) stars += 1;
  }
  return Math.min(3, stars);
}
function bossFire(game, boss, angle, speed, radius, options = {}) {
  game.hostileBullets.push({
    x: boss.x - 48, y: boss.y, radius, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
    removed: false, biome: boss.biome, homing: options.homing ? .9 : 0, chill: options.chill ? .6 : 0, gravity: options.gravity || 0,
  });
}
/* Every guardian fights differently: one signature mechanic plus a shared rage phase. */
function runBossPattern(game, boss, dt) {
  const player = game.player;
  const aimed = Math.atan2(player.y - boss.y, player.x - boss.x);
  const rage = boss.phase >= 2;
  // Attacks speed up and grow with every phase; `tempo` blends the calm value into the furious one.
  const tier = (boss.phase - 1) / Math.max(1, boss.phaseCount - 1);
  const tempo = (calm, furious) => calm - (calm - furious) * tier;
  const beats = (low, high) => Math.round(low + (high - low) * tier);
  const top = boss.phase >= boss.phaseCount;
  const expose = (seconds) => { boss.weakOpen = Math.max(boss.weakOpen, seconds); };
  boss.patternTimer -= dt;
  switch (boss.pattern) {
    case 'fan': {
      boss.fire -= dt;
      if (boss.fire <= 0) {
        const count = beats(5, 7);
        for (let i = 0; i < count; i += 1) bossFire(game, boss, aimed + (i - (count - 1) / 2) * .16, 195, 8);
        boss.fire = tempo(1.75, 1.15);
      }
      // Blink: a short telegraph, then the guardian jumps to another row.
      if (boss.blink > 0) {
        boss.blink -= dt;
        if (boss.blink <= 0) {
          boss.y = clamp(boss.y < 270 ? boss.y + 200 : boss.y - 200, 150, WORLD_HEIGHT - 150);
          boss.x = Math.min(game.width - 90, boss.x + 40);
          if (boss.phase >= 2) for (let i = 0; i < 3; i += 1) bossFire(game, boss, aimed + (i - 1) * .18, 200, 8);
          emit(game, boss.x, boss.y, '#bff6ff', 18, 1.2);
          game.events.push('boss-blink');
        }
      } else if (boss.patternTimer <= 0) {
        boss.blink = .45; boss.patternTimer = tempo(5.5, 4); expose(1.6);
        game.rings.push({ x: boss.x, y: boss.y, age: 0, duration: .45, maxRadius: 110, color: '170,240,255' });
      }
      break;
    }
    case 'slag': {
      boss.fire -= dt;
      if (boss.fire <= 0) {
        for (let i = 0; i < 3; i += 1) bossFire(game, boss, aimed + (i - 1) * .22, 175, 7);
        for (let i = 0; i < beats(2, 4); i += 1) bossFire(game, boss, aimed + randomBetween(game, -.5, .5), 120, 9, { gravity: 210 });
        boss.fire = tempo(2.05, 1.3);
      }
      break;
    }
    case 'frost': {
      boss.fire -= dt;
      if (boss.fire <= 0) {
        for (let i = 0; i < 3; i += 1) bossFire(game, boss, aimed + (i - 1) * .1, 160, 9, { chill: .7 });
        boss.fire = tempo(1.5, 1);
      }
      if (boss.patternTimer <= 0) {
        const spokes = beats(12, 18);
        for (let i = 0; i < spokes; i += 1) bossFire(game, boss, (i / spokes) * TAU + boss.age, 130, 7, { chill: .4 });
        boss.patternTimer = tempo(5, 3.4); expose(2.1);
        game.events.push('boss-frost');
      }
      break;
    }
    case 'swarm': {
      boss.fire -= dt;
      if (boss.fire <= 0) { for (let i = 0; i < 3; i += 1) bossFire(game, boss, aimed + (i - 1) * .2, 185, 7); boss.fire = tempo(1.9, 1.2); }
      if (boss.patternTimer <= 0) {
        for (let i = 0; i < beats(3, 5); i += 1) spawnDrone(game, true);
        boss.patternTimer = tempo(6, 4); expose(2.2);
        game.events.push('boss-swarm');
      }
      break;
    }
    case 'phase': {
      boss.phasing = Math.max(0, boss.phasing - dt);
      if (boss.patternTimer <= 0 && boss.phasing <= 0) {
        boss.phasing = tempo(2, 2.4);
        boss.patternTimer = tempo(7, 5);
        // The ghost invites a counter-attack: the core opens the moment it becomes solid again.
        boss.weakOpen = 0;
        boss.weakTimer = boss.phasing + .35;
        game.events.push('boss-vanish');
      }
      boss.fire -= dt;
      if (boss.fire <= 0 && boss.phasing <= 0) {
        for (let i = 0; i < beats(2, 4); i += 1) bossFire(game, boss, aimed + (i - .5) * .3, 145, 8, { homing: 1 });
        boss.fire = tempo(2.2, 1.4);
      }
      break;
    }
    case 'beam': {
      if (boss.beam) {
        boss.beam.timer -= dt;
        if (Math.abs(player.y - boss.beam.y) < 30 || (boss.beam.second != null && Math.abs(player.y - boss.beam.second) < 30)) damagePlayer(game, { removed: false }, false);
        if (boss.beam.timer <= 0) boss.beam = null;
        break;
      }
      if (boss.charge > 0) {
        boss.charge -= dt;
        if (boss.charge <= 0) {
          const y = boss.beam ? boss.beam.y : player.y;
          const row = clamp(y, 60, WORLD_HEIGHT - 60);
          boss.beam = { y: row, timer: tempo(.7, 1) };
          if (top) boss.beam.second = clamp(row + (row > 270 ? -170 : 170), 60, WORLD_HEIGHT - 60);
          expose(1.9);
          game.shake = Math.max(game.shake, .45);
          game.events.push('boss-beam');
        }
        break;
      }
      boss.fire -= dt;
      if (boss.fire <= 0) { boss.charge = tempo(1.25, .9); boss.fire = tempo(3.8, 2.6); game.events.push('boss-charge'); }
      break;
    }
    case 'lead': {
      boss.fire -= dt;
      if (boss.fire <= 0) {
        const lead = 190 + boss.biome * 6;
        const flight = Math.abs(player.x - boss.x) / lead;
        const predicted = Math.atan2(player.y + player.vy * flight - boss.y, player.x + player.vx * flight - boss.x);
        for (let i = 0; i < 3; i += 1) bossFire(game, boss, predicted + (i - 1) * .12, lead, 7);
        boss.fire = tempo(1.7, 1.1);
      }
      if (boss.patternTimer <= 0) {
        const offset = boss.age * 1.3;
        const spokes = beats(4, 6);
        for (let i = 0; i < spokes; i += 1) bossFire(game, boss, offset + (i / spokes) * TAU, 140, 8);
        boss.patternTimer = tempo(3.2, 2.2);
        expose(1.5);
      }
      break;
    }
    case 'pull': {
      const dx = boss.x - player.x, dy = boss.y - player.y;
      const distance = Math.hypot(dx, dy) || 1;
      const pull = tempo(115, 165) * dt;
      player.targetX = clamp(player.targetX + (dx / distance) * pull, 52, game.width * .64);
      player.targetY = clamp(player.targetY + (dy / distance) * pull * .7, 67, WORLD_HEIGHT - 54);
      boss.fire -= dt;
      if (boss.fire <= 0) {
        const gaps = [2, 7];
        for (let i = 0; i < 12; i += 1) {
          if (gaps.includes(i)) continue;
          if (boss.phase >= 2 && gaps.includes((i + 6) % 12) && !top) continue;
          bossFire(game, boss, (i / 12) * TAU + boss.age, 150, 8);
        }
        boss.fire = tempo(2.8, 1.9); expose(1.7);
      }
      break;
    }
    default: {
      boss.fire -= dt;
      if (boss.fire <= 0) {
        const count = boss.biome + 3;
        for (let i = 0; i < count; i += 1) bossFire(game, boss, aimed + (i - (count - 1) / 2) * .16, 190, 7);
        boss.fire = tempo(1.9, 1.1);
      }
    }
  }
}
function updateBoss(game, dt) {
  const boss = game.boss;
  if (!boss) return;
  boss.age += dt; boss.hitFlash = Math.max(0, boss.hitFlash - dt);
  boss.weakFlash = Math.max(0, boss.weakFlash - dt);
  boss.entering = Math.max(0, boss.entering - dt);
  // A phase shift is a short invulnerable telegraph: the arena holds its breath, then the fight escalates.
  if (boss.phaseShift > 0) {
    boss.phaseShift = Math.max(0, boss.phaseShift - dt);
    if (boss.phaseShift <= 0) {
      boss.phase = Math.min(boss.phaseCount, boss.phase + 1);
      boss.burst = 1.4; boss.charge = 0; boss.beam = null; boss.fire = .6;
      boss.weakOpen = 2.9; boss.weakTimer = 4.4;
      game.shake = Math.max(game.shake, .6); game.flash = Math.max(game.flash, .32);
      for (let i = 0; i < 14; i += 1) bossFire(game, boss, (i / 14) * TAU + boss.age, 175, 8);
      game.rings.push({ x: boss.x, y: boss.y, age: 0, duration: .8, maxRadius: 240, color: '255,214,158' });
      game.events.push('boss-ascend');
    }
  }
  if (boss.phaseShift > 0) return; // bracing for the next phase: the arena gets a breath
  const desiredX = Math.max(game.width * .76, game.width - 165);
  const approach = boss.phasing > 0 ? 320 : 170;
  boss.x = Math.max(desiredX, boss.x - approach * dt);
  const drift = .72 + boss.biome * .12 + (boss.phase - 1) * .3;
  if (boss.blink <= 0 && boss.pattern !== 'lead') boss.y = 270 + Math.sin(boss.age * drift) * (110 - boss.biome * 10);
  boss.breath = Math.max(0, boss.breath - dt);
  if (boss.entering > 0 || boss.x >= game.width - 40) return;
  runBossPattern(game, boss, dt);
  // Weak point cycle: it opens on its own and after every heavy attack, giving a short damage window.
  if (boss.phaseShift <= 0 && boss.entering <= 0) {
    if (boss.weakOpen > 0) boss.weakOpen = Math.max(0, boss.weakOpen - dt);
    else {
      boss.weakTimer -= dt;
      if (boss.weakTimer <= 0) { boss.weakOpen = 2.4; boss.weakTimer = Math.max(3.2, 6.4 - boss.phase * 1.1); game.events.push('weak-open'); }
    }
  }
  boss.burst -= dt;
  if (boss.phase >= 2 && boss.burst <= 0) {
    for (let i = 0; i < 10; i += 1) bossFire(game, boss, (i / 10) * TAU + boss.age, 165, 8);
    boss.burst = Math.max(1.8, 3.6 - (boss.phase - 2) * .9);
    game.shake = Math.max(game.shake, .35);
  }
}
const FINALE_STYLES = {
  shatter: { blast: 6, color: '#fff0c4', ring: '255,196,128', outward: 1 },
  ice: { blast: 7, color: '#e8fbff', ring: '150,220,255', outward: 1 },
  slag: { blast: 8, color: '#ffb26b', ring: '255,120,60', outward: .7 },
  dissolve: { blast: 5, color: '#d9fff2', ring: '139,255,207', outward: 1.25 },
  supernova: { blast: 9, color: '#fff6d8', ring: '255,209,102', outward: 1.4 },
  crystal: { blast: 6, color: '#d8c7ff', ring: '162,123,255', outward: 1 },
  collapse: { blast: 4, color: '#b7a6ff', ring: '110,160,255', outward: .35 },
};
function updateFinale(game, raw) {
  const finale = game.finale;
  const style = FINALE_STYLES[finale.style] || FINALE_STYLES.shatter;
  finale.timer -= raw;
  game.timeScale = Math.min(1, game.timeScale + raw * .75);
  finale.next -= raw;
  if (finale.next <= 0 && finale.blast < style.blast) {
    finale.blast += 1;
    const angle = game.random() * TAU;
    const distance = game.random() * finale.radius * 1.15 * style.outward;
    const x = finale.x + Math.cos(angle) * distance;
    const y = finale.y + Math.sin(angle) * distance;
    const palette = bossPalette(finale.biome);
    emit(game, x, y, finale.blast % 2 ? style.color : palette[0], 16, 1.4);
    game.rings.push({ x, y, age: 0, duration: .55, maxRadius: (55 + finale.blast * 16) * style.outward, color: style.ring });
    game.shake = Math.max(game.shake, .5);
    game.flash = Math.max(game.flash, .3);
    finale.next = .1 + finale.blast * .07;
    game.events.push('boss-blast');
  }
  if (finale.timer <= 0) {
    const palette = bossPalette(finale.biome);
    emit(game, finale.x, finale.y, palette[0], 46, 2.2);
    game.rings.push({ x: finale.x, y: finale.y, age: 0, duration: 1.1, maxRadius: 320 * style.outward, color: style.ring });
    if (finale.style === 'supernova') {
      for (let i = 0; i < 3; i += 1) game.rings.push({ x: finale.x, y: finale.y, age: -i * .12, duration: 1.3, maxRadius: 420, color: '255,240,190' });
    }
    if (finale.style === 'collapse') game.rings.push({ x: finale.x, y: finale.y, age: 0, duration: .9, maxRadius: 40, color: '80,120,255', shrink: true });
    game.flash = 1; game.shake = 1;
    finishFinale(game);
  }
}
/* ---------- hazards ---------- */
function updateHazards(game, dt) {
  const player = game.player;
  const configs = biomeOf(game).hazards;
  for (let index = 0; index < configs.length; index += 1) {
    const config = configs[index];
    const count = game.hazards.filter((hazard) => hazard.type === config.type && !hazard.removed).length;
    game.hazardTimers[index] -= dt;
    if (game.hazardTimers[index] <= 0) {
      game.hazardTimers[index] = randomBetween(game, config.every[0], config.every[1]);
      if (count < config.limit && !game.boss && !game.finale) spawnHazard(game, config);
    }
  }
  let insideFrost = false;
  for (const hazard of game.hazards) {
    if (hazard.removed) continue;
    const definition = HAZARDS[hazard.type];
    hazard.life -= dt;
    hazard.phase += dt;
    hazard.hitFlash = Math.max(0, hazard.hitFlash - dt);
    hazard.cooldown = Math.max(0, hazard.cooldown - dt);
    hazard.x += hazard.vx * dt;
    if (hazard.life <= 0 || hazard.x < -hazard.radius - 60) { hazard.removed = true; continue; }
    const distance = Math.hypot(player.x - hazard.x, player.y - hazard.y);
    switch (hazard.type) {
      case 'plasma':
        hazard.y = hazard.baseY + Math.sin(hazard.phase * .8) * definition.drift;
        if (distance < hazard.radius * .8 + player.radius * .4 && hazard.cooldown <= 0) {
          hazard.cooldown = 1.2;
          damagePlayer(game, { removed: false }, false);
        }
        break;
      case 'mine':
        hazard.y = hazard.baseY + Math.sin(hazard.phase * 1.4) * 14;
        if (hazard.state === 'idle' && distance < 165) { hazard.state = 'arming'; hazard.timer = definition.arm; game.events.push('mine-arm'); }
        else if (hazard.state === 'arming') {
          hazard.timer -= dt;
          if (hazard.timer <= 0) {
            hazard.state = 'blast'; hazard.timer = .35;
            emit(game, hazard.x, hazard.y, '#ffb27a', 26, 1.5);
            game.rings.push({ x: hazard.x, y: hazard.y, age: 0, duration: .45, maxRadius: definition.blast, color: '255,150,110' });
            game.shake = Math.max(game.shake, .5);
            game.events.push('mine-blast');
            if (Math.hypot(player.x - hazard.x, player.y - hazard.y) < definition.blast) damagePlayer(game, { removed: false }, false);
          }
        } else if (hazard.state === 'blast') { hazard.timer -= dt; if (hazard.timer <= 0) hazard.removed = true; }
        break;
      case 'frost':
        hazard.y = hazard.baseY + Math.sin(hazard.phase * .6) * definition.drift;
        if (distance < hazard.radius) {
          insideFrost = true;
          game.chill = Math.min(1.2, game.chill + dt / definition.chill);
          if (game.chill >= 1 && hazard.cooldown <= 0) {
            game.chill = 0; hazard.cooldown = 1.4;
            emit(game, player.x, player.y, '#b8ecff', 16, 1.1);
            damagePlayer(game, { removed: false }, false);
          }
        }
        break;
      case 'vortex':
        hazard.y = hazard.baseY + Math.sin(hazard.phase * .7) * definition.drift;
        if (distance < hazard.radius) {
          const angle = Math.atan2(hazard.y - player.y, hazard.x - player.x);
          player.targetX = clamp(player.targetX + Math.cos(angle) * definition.push * dt, 52, game.width * .64);
          player.targetY = clamp(player.targetY + Math.sin(angle) * definition.push * dt * .7, 67, WORLD_HEIGHT - 54);
        }
        break;
      case 'turret':
        hazard.y = hazard.baseY + Math.sin(hazard.phase * .5) * 26;
        hazard.fire -= dt;
        if (hazard.fire <= 0 && hazard.x < game.width - 20 && hazard.x > player.x) {
          const dx = player.x - hazard.x, dy = player.y - hazard.y, magnitude = Math.hypot(dx, dy) || 1;
          game.hostileBullets.push({ x: hazard.x - 18, y: hazard.y, radius: 7, vx: dx / magnitude * 250, vy: dy / magnitude * 250, removed: false, biome: game.biomeIndex });
          hazard.fire = definition.fire;
        }
        break;
      case 'flare':
        if (hazard.state === 'idle') { hazard.state = 'warn'; hazard.timer = definition.warn; game.events.push('flare-warn'); }
        else if (hazard.state === 'warn') {
          hazard.timer -= dt;
          if (hazard.timer <= 0) { hazard.state = 'fire'; hazard.timer = definition.active; game.shake = Math.max(game.shake, .35); game.events.push('flare-fire'); }
        } else {
          hazard.timer -= dt;
          if (Math.abs(player.x - hazard.x) < definition.width * .5 + player.radius * .5 && hazard.cooldown <= 0) {
            hazard.cooldown = 1.1;
            damagePlayer(game, { removed: false }, false);
          }
          if (hazard.timer <= 0) hazard.removed = true;
        }
        break;
      case 'crystal':
        hazard.y = hazard.baseY + Math.sin(hazard.phase * .9) * 20;
        hazard.fire -= dt;
        if (hazard.state === 'idle' && hazard.fire <= 0 && hazard.x < game.width - 40) { hazard.state = 'warn'; hazard.timer = definition.warn; }
        else if (hazard.state === 'warn') {
          hazard.timer -= dt;
          if (hazard.timer <= 0) {
            hazard.state = 'idle'; hazard.fire = definition.fire;
            for (let i = 0; i < definition.ring; i += 1) {
              const angle = (i / definition.ring) * TAU + hazard.phase;
              game.hostileBullets.push({ x: hazard.x, y: hazard.y, radius: 7, vx: Math.cos(angle) * 165, vy: Math.sin(angle) * 165, removed: false, biome: game.biomeIndex });
            }
            game.rings.push({ x: hazard.x, y: hazard.y, age: 0, duration: .4, maxRadius: 70, color: '186,160,255' });
            game.events.push('crystal-pulse');
          }
        }
        break;
      case 'well': {
        hazard.y = hazard.baseY + Math.sin(hazard.phase * .5) * 30;
        const angle = Math.atan2(hazard.y - player.y, hazard.x - player.x);
        const pull = definition.pull * dt * Math.max(.25, 1 - distance / 520);
        player.targetX = clamp(player.targetX + Math.cos(angle) * pull, 52, game.width * .64);
        player.targetY = clamp(player.targetY + Math.sin(angle) * pull * .8, 67, WORLD_HEIGHT - 54);
        if (distance < definition.core && hazard.cooldown <= 0) {
          hazard.cooldown = 1.3;
          damagePlayer(game, { removed: false }, false);
        }
        break;
      }
      default: break;
    }
  }
  game.chill = Math.max(0, game.chill - (insideFrost ? 0 : dt * .55));
  game.hazards = game.hazards.filter((hazard) => !hazard.removed);
}
function updateObjective(game) {
  const objective = game.objective;
  if (!objective || objective.done) return;
  if (objective.kind === 'survive') objective.progress = game.levelTime;
  else if (objective.kind === 'clear') objective.progress = game.destroyed + game.dronesDestroyed;
  else if (objective.kind === 'collect') objective.progress = game.stars;
  else objective.progress = game.bossesDefeated;
  if (objective.progress >= objective.target) {
    objective.done = true;
    completeLevel(game);
  }
}

export function updateGame(game, seconds) {
  game.events = [];
  if (game.gameOver || !Number.isFinite(seconds) || seconds <= 0) return game.events;
  const raw = Math.min(seconds, .05);
  const dt = raw * (game.finale ? game.timeScale : 1);
  game.elapsed += dt; game.sectorElapsed += dt;
  if (game.level) game.levelTime += dt;
  game.distance += dt * (20 + Math.min(game.elapsed * .12, 16));
  game.waveCooldown = Math.max(0, game.waveCooldown - dt);
  game.shake = Math.max(0, game.shake - raw * 2.4);
  game.flash = Math.max(0, game.flash - raw * 2.8);
  const player = game.player;
  player.invulnerable = Math.max(0, player.invulnerable - dt);
  const previousX = player.x, previousY = player.y;
  const chill = game.chill > .35 ? 1 - Math.min(.6, (game.chill - .35) * .9) : 1;
  const smoothing = (1 - Math.exp(-(11 + game.upgrades.engine * 1.5) * dt)) * chill;
  player.x += (player.targetX - player.x) * smoothing; player.y += (player.targetY - player.y) * smoothing;
  player.vx = dt > 0 ? (player.x - previousX) / dt : 0;
  player.vy = dt > 0 ? (player.y - previousY) / dt : 0;

  // Objective levels have no guardian at all; only boss levels and endless runs count down to one.
  if (!game.boss && !game.finale && Number.isFinite(game.timers.boss)) {
    game.timers.boss -= dt;
    game.warning = clamp(game.timers.boss, 0, BOSS_WARNING);
    if (game.timers.boss <= BOSS_WARNING && !game.warningFired) {
      game.warningFired = true;
      game.shake = Math.max(game.shake, .3);
      game.events.push('boss-warning');
    }
    if (game.timers.boss <= 0) spawnBoss(game);
  }
  if (!game.boss && !game.finale) {
    game.timers.rock -= dt;
    if (game.timers.rock <= 0 && game.timers.boss > 1.8) {
      spawnRock(game);
      game.timers.rock += Math.max(.55, 1.3 - game.elapsed * .006) * randomBetween(game, .85, 1.18);
    }
    game.timers.drone -= dt;
    if (game.timers.drone <= 0 && game.timers.boss > 3.4) { spawnDrone(game); game.timers.drone += randomBetween(game, biomeOf(game).spawn.drone[0], biomeOf(game).spawn.drone[1]); }
  }
  if (game.level) updateHazards(game, dt);
  if (!game.finale) {
    for (const [timer, kind, lo, hi] of [['star', 'star', 3.4, 5], ['repair', 'repair', 20, 26], ['credits', 'credit', 10, 15], ['part', 'part', 18, 24]]) {
      game.timers[timer] -= dt;
      if (game.timers[timer] <= 0) { spawnPickup(game, kind); game.timers[timer] += randomBetween(game, lo, hi); }
    }
  }
  game.timers.shot -= dt;
  if (game.timers.shot <= 0 && !game.finale) {
    game.bullets.push({ x: player.x + 34, y: player.y, radius: 5, vx: 560, damage: 1 + game.upgrades.weapon * .25, removed: false });
    game.timers.shot += Math.max(.16, .26 - game.upgrades.weapon * .018);
    game.events.push('shot');
  }

  for (const rock of game.rocks) { rock.x += rock.vx * dt; rock.y += rock.vy * dt; rock.rotation += rock.spin * dt; if (rock.x < -rock.radius - 40) rock.removed = true; }
  for (const drone of game.drones) {
    drone.x += drone.vx * dt; drone.y = drone.baseY + Math.sin(game.elapsed * (drone.small ? 3.4 : 2) + drone.phase) * (drone.small ? 22 : 35); drone.fire -= dt;
    if (drone.fire <= 0 && drone.x < game.width - 30 && drone.x > player.x + 20) {
      const dx = player.x - drone.x, dy = player.y - drone.y, magnitude = Math.hypot(dx, dy) || 1;
      game.hostileBullets.push({ x: drone.x - 20, y: drone.y, radius: 7, vx: dx / magnitude * 245, vy: dy / magnitude * 245, removed: false, biome: game.biomeIndex });
      drone.fire += drone.small ? 3.4 : 2.6;
    }
    if (drone.x < -60) drone.removed = true;
  }
  updateBoss(game, dt);
  for (const bullet of game.bullets) { bullet.x += bullet.vx * dt; if (bullet.x > game.width + 30) bullet.removed = true; }
  for (const bullet of game.hostileBullets) {
    if (bullet.homing) {
      const dx = player.x - bullet.x, dy = player.y - bullet.y, magnitude = Math.hypot(dx, dy) || 1;
      const speed = Math.hypot(bullet.vx, bullet.vy) || 1;
      const turn = Math.min(1, bullet.homing * dt);
      bullet.vx += (dx / magnitude * speed - bullet.vx) * turn;
      bullet.vy += (dy / magnitude * speed - bullet.vy) * turn;
    }
    if (bullet.gravity) bullet.vy += bullet.gravity * dt;
    bullet.x += bullet.vx * dt; bullet.y += bullet.vy * dt;
    if (bullet.x < -30 || bullet.x > game.width + 30 || bullet.y < -30 || bullet.y > WORLD_HEIGHT + 30) bullet.removed = true;
  }
  for (const pickup of game.pickups) { pickup.x += pickup.vx * dt; pickup.phase += dt * 3; pickup.spin += dt * 1.6; if (pickup.x < -40) pickup.removed = true; }
  for (const piece of game.debris) {
    // Each guardian's debris behaves differently: slag drips down, gas drifts up, a collapse falls inward.
    piece.x += piece.vx * dt; piece.y += piece.vy * dt; piece.vy += (piece.gravity ?? 42) * dt;
    const drag = (piece.gravity ?? 42) < 0 ? .8 : .55;
    piece.vx *= Math.pow(drag, dt); piece.vy *= Math.pow(.65, dt);
    piece.rotation += piece.spin * dt; piece.life -= raw;
  }

  for (const bullet of game.bullets) {
    if (bullet.removed) continue;
    for (const rock of game.rocks) {
      if (!rock.removed && overlaps(bullet, rock)) { bullet.removed = true; rock.health -= bullet.damage || 1; emit(game, bullet.x, bullet.y, '#ffe1bd', 4, .6); if (rock.health <= 0) destroyRock(game, rock); break; }
    }
    if (bullet.removed) continue;
    for (const drone of game.drones) {
      if (!drone.removed && overlaps(bullet, drone)) { bullet.removed = true; drone.health -= bullet.damage || 1; emit(game, bullet.x, bullet.y, '#a5f9f5', 4, .6); if (drone.health <= 0) destroyDrone(game, drone); break; }
    }
    if (bullet.removed) continue;
    for (const hazard of game.hazards) {
      if (!hazard.removed && hazard.health > 0 && overlaps(bullet, hazard)) {
        bullet.removed = true; hazard.health -= bullet.damage || 1; hazard.hitFlash = .12;
        emit(game, bullet.x, bullet.y, '#bff0ff', 4, .6);
        if (hazard.health <= 0) destroyHazard(game, hazard);
        break;
      }
    }
    if (!bullet.removed && game.boss && overlaps(bullet, game.boss)) {
      bullet.removed = true; emit(game, bullet.x, bullet.y, '#fff1c7', 3, .4);
      damageBoss(game, bullet.damage || 1, { x: bullet.x, y: bullet.y });
    }
  }
  if (!game.finale) {
    for (const rock of game.rocks) if (!rock.removed && overlaps(player, rock, -4)) damagePlayer(game, rock);
    for (const drone of game.drones) if (!drone.removed && overlaps(player, drone, -4)) damagePlayer(game, drone);
    for (const bullet of game.hostileBullets) {
      if (bullet.removed || !overlaps(player, bullet, -3)) continue;
      bullet.removed = true;
      if (bullet.chill) { game.chill = Math.min(1.2, game.chill + bullet.chill); emit(game, player.x, player.y, '#b8ecff', 12, .9); game.events.push('chill'); }
      damagePlayer(game, bullet);
    }
    if (game.boss && overlaps(player, game.boss, -8)) damagePlayer(game, { removed: false }, false);
  } else {
    player.invulnerable = Math.max(player.invulnerable, .4);
  }
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
  if (game.finale) updateFinale(game, raw);
  else if (game.level) updateObjective(game);
  game.rocks = game.rocks.filter((item) => !item.removed); game.drones = game.drones.filter((item) => !item.removed);
  game.bullets = game.bullets.filter((item) => !item.removed); game.hostileBullets = game.hostileBullets.filter((item) => !item.removed);
  game.pickups = game.pickups.filter((item) => !item.removed); game.particles = game.particles.filter((item) => item.life > 0);
  game.rings = game.rings.filter((item) => item.age < item.duration); game.debris = game.debris.filter((item) => item.life > 0);
  game.score = calculateScore(game);
  return game.events;
}
