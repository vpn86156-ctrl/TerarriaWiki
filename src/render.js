/* Пиксельный рендер «Заброшки». Всё рисуется в низком разрешении (270 px по высоте)
   и растягивается на экран без сглаживания — отсюда настоящий пиксельный вид. */

import { TILE, WEAPONS } from './content.js';
import { VOID, FLOOR, WALL, DOOR, EXIT } from './engine.js';

const TAU = Math.PI * 2;
const VIEW_HEIGHT = 270;

const state = {
  internalW: 480, internalH: VIEW_HEIGHT, w: 480, h: VIEW_HEIGHT, scale: 1,
  tiles: new Map(), light: null, lightCtx: null, explored: null, exploredCtx: null,
  vignette: null,
};

export function resize(canvas, ctx, width, height) {
  const ratio = Math.max(1.3, Math.min(2.6, width / height));
  state.internalH = VIEW_HEIGHT;
  state.internalW = Math.round(VIEW_HEIGHT * ratio);
  state.w = state.internalW;
  state.h = state.internalH;
  state.scale = height / VIEW_HEIGHT;
  canvas.width = state.internalW;
  canvas.height = state.internalH;
  ctx.imageSmoothingEnabled = false;
  state.light = document.createElement('canvas');
  state.light.width = state.internalW; state.light.height = state.internalH;
  state.lightCtx = state.light.getContext('2d');
  state.vignette = null;
  return state;
}
export const viewSize = () => ({ w: state.w, h: state.h });
export const pixelScale = () => state.scale;

/* ---------- procedural pixel tiles ---------- */
function tileCanvas(key, palette, painter) {
  const cached = state.tiles.get(key);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = TILE; canvas.height = TILE;
  const ctx = canvas.getContext('2d');
  painter(ctx, palette);
  state.tiles.set(key, canvas);
  return canvas;
}
function floorCanvas(palette, index) {
  return tileCanvas(`floor|${palette.floor[0]}|${index}`, palette, (ctx, colors) => {
    ctx.fillStyle = colors.floor[index % colors.floor.length];
    ctx.fillRect(0, 0, TILE, TILE);
    // Concrete speckles and a couple of cracks, deterministic per variant.
    let seed = index * 9301 + 49297;
    const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (let i = 0; i < 14; i += 1) {
      const x = Math.floor(rand() * TILE), y = Math.floor(rand() * TILE);
      ctx.fillStyle = rand() < .5 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.18)';
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.strokeStyle = 'rgba(0,0,0,.28)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(1, TILE - 1); ctx.lineTo(TILE - 2, TILE - 1);
    ctx.moveTo(TILE - 1, 1); ctx.lineTo(TILE - 1, TILE - 2);
    ctx.stroke();
  });
}
function wallCanvas(palette) {
  return tileCanvas(`wall|${palette.wall}`, palette, (ctx, colors) => {
    ctx.fillStyle = colors.wall;
    ctx.fillRect(0, 0, TILE, TILE);
    ctx.fillStyle = colors.wallTop;
    ctx.fillRect(0, 0, TILE, 5);
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    for (let y = 6; y < TILE; y += 5) ctx.fillRect(0, y, TILE, 1);
    for (let x = 0; x < TILE; x += 8) ctx.fillRect(x, 0, 1, TILE);
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.fillRect(0, TILE - 2, TILE, 2);
  });
}

/* ---------- pixel characters ---------- */
function drawCharacter(ctx, x, y, options) {
  const { colors, scale = 1, frame = 0, facing = 0, swing = 0, flash = 0, squash = 0 } = options;
  const bob = Math.round(Math.sin(frame) * 1);
  const px = Math.round(x);
  const py = Math.round(y);
  ctx.save();
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,.32)';
  ctx.beginPath();
  ctx.ellipse(px, py + 6 * scale, 6 * scale, 2.6 * scale, 0, 0, TAU);
  ctx.fill();
  const body = flash > 0 ? '#ffffff' : colors[1];
  const skin = flash > 0 ? '#ffffff' : colors[0];
  const dark = flash > 0 ? '#ffdddd' : colors[2] || colors[1];
  // Legs with a small walk cycle.
  const legSwing = Math.round(Math.sin(frame * 2) * 1.4);
  ctx.fillStyle = dark;
  ctx.fillRect(px - 3 * scale, py + 1 * scale - squash, 2 * scale, 4 * scale);
  ctx.fillRect(px + 1 * scale, py + 1 * scale - squash, 2 * scale, 4 * scale);
  ctx.fillRect(px - 3 * scale + legSwing, py + 4 * scale, 2 * scale, 2 * scale);
  ctx.fillRect(px + 1 * scale - legSwing, py + 4 * scale, 2 * scale, 2 * scale);
  // Torso.
  ctx.fillStyle = body;
  ctx.fillRect(px - 4 * scale, py - 4 * scale + bob - squash, 8 * scale, 6 * scale);
  ctx.fillStyle = 'rgba(255,255,255,.12)';
  ctx.fillRect(px - 4 * scale, py - 4 * scale + bob - squash, 8 * scale, 1 * scale);
  // Head.
  ctx.fillStyle = skin;
  ctx.fillRect(px - 3 * scale, py - 9 * scale + bob - squash, 6 * scale, 5 * scale);
  ctx.fillStyle = 'rgba(0,0,0,.55)';
  ctx.fillRect(px - 3 * scale, py - 5 * scale + bob - squash, 6 * scale, 1 * scale);
  // Eyes look where the character is heading.
  const lookX = Math.cos(facing), lookY = Math.sin(facing);
  ctx.fillStyle = '#141018';
  ctx.fillRect(px - 2 * scale + Math.round(lookX * 1.4), py - 8 * scale + bob - squash + Math.round(lookY * .8), 1 * scale, 1 * scale);
  ctx.fillRect(px + 1 * scale + Math.round(lookX * 1.4), py - 8 * scale + bob - squash + Math.round(lookY * .8), 1 * scale, 1 * scale);
  // Arms and weapon.
  const reach = 5 * scale;
  const handX = px + Math.cos(facing) * reach;
  const handY = py - 2 * scale + Math.sin(facing) * reach * .7;
  ctx.fillStyle = skin;
  ctx.fillRect(Math.round(handX) - scale, Math.round(handY) - scale, 2 * scale, 2 * scale);
  if (swing > 0) {
    const weapon = options.weapon || 'crowbar';
    const length = (weapon === 'axe' ? 9 : weapon === 'knife' ? 5 : 8) * scale;
    const angle = facing + (0.5 - swing) * 1.6;
    ctx.strokeStyle = weapon === 'knife' ? '#dfe6ea' : weapon === 'axe' ? '#b9c2c8' : '#8d939a';
    ctx.lineWidth = weapon === 'crowbar' ? 2 * scale : 2 * scale;
    ctx.beginPath();
    ctx.moveTo(Math.round(handX), Math.round(handY));
    ctx.lineTo(Math.round(handX + Math.cos(angle) * length), Math.round(handY + Math.sin(angle) * length));
    ctx.stroke();
    if (weapon === 'axe') {
      ctx.fillStyle = '#dfe6ea';
      ctx.fillRect(Math.round(handX + Math.cos(angle) * length) - scale, Math.round(handY + Math.sin(angle) * length) - scale, 3 * scale, 3 * scale);
    }
  }
  ctx.restore();
}

/* ---------- props and pickups ---------- */
function drawProp(ctx, prop, palette) {
  if (prop.broken) {
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.fillRect(Math.round(prop.x) - 6, Math.round(prop.y) - 2, 12, 4);
    return;
  }
  const x = Math.round(prop.x), y = Math.round(prop.y);
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  ctx.fillRect(x - 7, y + 4, 14, 3);
  if (prop.kind === 'barrel') {
    ctx.fillStyle = palette.props[0];
    ctx.fillRect(x - 5, y - 7, 10, 12);
    ctx.fillStyle = palette.props[1];
    ctx.fillRect(x - 5, y - 7, 10, 2);
    ctx.fillRect(x - 5, y - 1, 10, 2);
    ctx.fillStyle = 'rgba(255,255,255,.14)';
    ctx.fillRect(x - 4, y - 6, 2, 10);
  } else {
    ctx.fillStyle = palette.props[0];
    ctx.fillRect(x - 7, y - 8, 14, 13);
    ctx.fillStyle = palette.props[1];
    ctx.fillRect(x - 7, y - 8, 14, 2);
    ctx.fillRect(x - 7, y + 3, 14, 2);
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.fillRect(x - 1, y - 8, 2, 13);
  }
}
function drawPickup(ctx, pickup, time) {
  const x = Math.round(pickup.x), y = Math.round(pickup.y) + Math.round(Math.sin(pickup.bob) * 1.5);
  ctx.fillStyle = 'rgba(0,0,0,.28)';
  ctx.fillRect(x - 3, y + 4, 6, 2);
  if (pickup.kind === 'coin') {
    ctx.fillStyle = '#ffd76a';
    ctx.fillRect(x - 2, y - 3, 4, 5);
    ctx.fillStyle = '#b98c1f';
    ctx.fillRect(x - 2, y + 1, 4, 1);
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    ctx.fillRect(x - 1, y - 2, 1, 1);
  } else if (pickup.kind === 'key') {
    ctx.fillStyle = '#ffe9b0';
    ctx.fillRect(x - 4, y - 2, 5, 3);
    ctx.fillRect(x + 1, y - 1, 3, 1);
    ctx.fillStyle = '#c8a24a';
    ctx.fillRect(x - 4, y - 2, 1, 3);
  } else if (pickup.kind === 'ammo') {
    ctx.fillStyle = '#cfe6ff';
    ctx.fillRect(x - 3, y - 3, 6, 6);
    ctx.fillStyle = '#6d8ba8';
    ctx.fillRect(x - 3, y - 3, 6, 1);
  } else if (pickup.kind === 'medkit') {
    ctx.fillStyle = '#f2f6f4';
    ctx.fillRect(x - 4, y - 3, 8, 6);
    ctx.fillStyle = '#c9433f';
    ctx.fillRect(x - 1, y - 2, 2, 4);
    ctx.fillRect(x - 3, y - 1, 6, 2);
  }
}

/* ---------- lighting ---------- */
function ensureExplored(game) {
  const { w, h } = game.level;
  if (!state.explored || state.explored.width !== w || state.explored.height !== h) {
    state.explored = document.createElement('canvas');
    state.explored.width = w; state.explored.height = h;
    state.exploredCtx = state.explored.getContext('2d');
    state.exploredCtx.fillStyle = '#000';
    state.exploredCtx.fillRect(0, 0, w, h);
  }
  return state.exploredCtx;
}
function markExplored(game, camera) {
  const ctx = ensureExplored(game);
  const px = Math.floor(game.player.x / TILE), py = Math.floor(game.player.y / TILE);
  ctx.fillStyle = '#fff';
  const r = 4;
  for (let y = py - r; y <= py + r; y += 1) {
    for (let x = px - r; x <= px + r; x += 1) {
      if (x < 0 || y < 0 || x >= game.level.w || y >= game.level.h) continue;
      if ((x - px) ** 2 + (y - py) ** 2 > r * r) continue;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  for (const torch of game.level.torches) {
    const tx = Math.floor(torch.x / TILE), ty = Math.floor(torch.y / TILE);
    if (Math.abs(tx - px) + Math.abs(ty - py) < 12) ctx.fillRect(tx, ty, 1, 1);
  }
}
function drawLighting(game, camera, palette) {
  const ctx = state.lightCtx;
  const { w, h } = state;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = palette.fog;
  ctx.globalAlpha = .96;
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 1;
  // Remembered rooms stay faintly visible.
  ctx.globalCompositeOperation = 'destination-out';
  ctx.globalAlpha = .42;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(state.explored, -camera.x, -camera.y, game.level.w * TILE, game.level.h * TILE);
  ctx.globalAlpha = 1;
  // Punch holes for every light source.
  const punch = (x, y, radius, intensity = 1) => {
    if (radius <= 0) return;
    const sx = x - camera.x, sy = y - camera.y;
    if (sx < -radius || sy < -radius || sx > w + radius || sy > h + radius) return;
    const gradient = ctx.createRadialGradient(sx, sy, 0, sx, sy, radius);
    gradient.addColorStop(0, `rgba(0,0,0,${intensity})`);
    gradient.addColorStop(.55, `rgba(0,0,0,${intensity * .7})`);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(sx, sy, radius, 0, TAU);
    ctx.fill();
  };
  punch(game.player.x, game.player.y, 96, 1);
  // The torch of the location flickers slightly.
  for (const torch of game.level.torches) {
    const flicker = 1 + Math.sin(game.time * 7 + torch.phase) * .08;
    punch(torch.x, torch.y, 74 * flicker, .92);
  }
  for (const lamp of game.lights) {
    const life = Math.max(0, lamp.life / lamp.maxLife);
    punch(lamp.x, lamp.y, lamp.radius * (.5 + life * .5), Math.min(1, lamp.intensity * life));
  }
  for (const bullet of game.bullets) punch(bullet.x, bullet.y, 18, .5);
  if (game.level.boss && !game.level.boss.dead) punch(game.level.boss.x, game.level.boss.y, 60, .7);
  ctx.globalCompositeOperation = 'source-over';
  return state.light;
}

/* ---------- main render ---------- */
export function renderGame(ctx, game, options = {}) {
  const { w, h } = state;
  const palette = game.location.palette;
  const level = game.level;
  const player = game.player;
  const camera = {
    x: Math.round(Math.max(0, Math.min(level.w * TILE - w, player.x - w / 2 + (player.vx || 0) * .1))),
    y: Math.round(Math.max(0, Math.min(level.h * TILE - h, player.y - h / 2 + (player.vy || 0) * .1))),
  };
  if (game.shake > 0) {
    const power = game.shake * 4;
    camera.x += Math.round((Math.random() - .5) * power);
    camera.y += Math.round((Math.random() - .5) * power);
  }
  markExplored(game, camera);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = palette.shadow;
  ctx.fillRect(0, 0, w, h);

  const minX = Math.max(0, Math.floor(camera.x / TILE));
  const maxX = Math.min(level.w - 1, Math.ceil((camera.x + w) / TILE));
  const minY = Math.max(0, Math.floor(camera.y / TILE));
  const maxY = Math.min(level.h - 1, Math.ceil((camera.y + h) / TILE));

  // Floors.
  for (let ty = minY; ty <= maxY; ty += 1) {
    for (let tx = minX; tx <= maxX; tx += 1) {
      const tile = level.grid[ty * level.w + tx];
      if (tile === VOID) continue;
      const variant = (tx * 7 + ty * 13) % 4;
      ctx.drawImage(floorCanvas(palette, variant), tx * TILE - camera.x, ty * TILE - camera.y);
    }
  }
  // Blood and burn decals under everything else.
  for (const decal of game.decals) {
    ctx.globalAlpha = decal.a;
    ctx.fillStyle = decal.color;
    ctx.beginPath();
    ctx.ellipse(decal.x - camera.x, decal.y - camera.y, decal.r, decal.r * .7, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  // Exit marker.
  const exitPulse = .5 + Math.sin(game.time * 3) * .2;
  ctx.fillStyle = `rgba(255,210,120,${(.25 + exitPulse * .3).toFixed(2)})`;
  ctx.fillRect(level.exit.x - 9 - camera.x, level.exit.y - 9 - camera.y, 18, 18);
  ctx.fillStyle = '#ffd27a';
  ctx.fillRect(level.exit.x - 7 - camera.x, level.exit.y - 7 - camera.y, 14, 14);
  ctx.fillStyle = palette.shadow;
  for (let i = 0; i < 4; i += 1) ctx.fillRect(level.exit.x - 5 - camera.x + i * 3, level.exit.y - 5 - camera.y + i * 4, 2, 3);
  // Locked door.
  if (!game.doorOpen) {
    const dx = level.door.x * TILE - camera.x, dy = level.door.y * TILE - camera.y;
    ctx.fillStyle = '#6b4a2a';
    ctx.fillRect(dx, dy, TILE, TILE);
    ctx.fillStyle = '#8a6438';
    ctx.fillRect(dx + 1, dy + 1, TILE - 2, TILE - 2);
    ctx.fillStyle = '#ffd76a';
    ctx.fillRect(dx + 6, dy + 7, 4, 4);
  }

  // Props, pickups, actors sorted by their y so overlaps look right.
  const drawables = [];
  for (const prop of level.props) drawables.push({ y: prop.y, kind: 'prop', item: prop });
  for (const pickup of level.pickups) drawables.push({ y: pickup.y, kind: 'pickup', item: pickup });
  for (const enemy of level.enemies) drawables.push({ y: enemy.y, kind: 'enemy', item: enemy });
  if (level.boss && !level.boss.dead) drawables.push({ y: level.boss.y, kind: 'boss', item: level.boss });
  drawables.push({ y: player.y, kind: 'player', item: player });
  drawables.sort((a, b) => a.y - b.y);

  // Walls are drawn after the floor but before the actors that stand in front of them.
  const wallTile = wallCanvas(palette);
  for (let ty = minY; ty <= maxY; ty += 1) {
    for (let tx = minX; tx <= maxX; tx += 1) {
      if (level.grid[ty * level.w + tx] !== WALL) continue;
      ctx.drawImage(wallTile, tx * TILE - camera.x, ty * TILE - camera.y);
    }
  }
  // Torches burn on the walls.
  for (const torch of level.torches) {
    const x = torch.x - camera.x, y = torch.y - camera.y;
    if (x < -20 || y < -20 || x > w + 20 || y > h + 20) continue;
    ctx.fillStyle = '#3a2a1c';
    ctx.fillRect(Math.round(x) - 1, Math.round(y) - 2, 2, 6);
    const flame = 3 + Math.sin(game.time * 9 + torch.phase) * 1.2;
    ctx.fillStyle = palette.torch;
    ctx.fillRect(Math.round(x) - 2, Math.round(y) - 4 - flame, 4, flame + 2);
    ctx.fillStyle = '#fff0b8';
    ctx.fillRect(Math.round(x) - 1, Math.round(y) - 3 - flame, 2, Math.max(1, flame));
  }

  for (const entry of drawables) {
    const item = entry.item;
    if (entry.kind === 'prop') drawProp(ctx, { ...item, x: item.x - camera.x, y: item.y - camera.y }, palette);
    else if (entry.kind === 'pickup') drawPickup(ctx, { ...item, x: item.x - camera.x, y: item.y - camera.y }, game.time);
    else if (entry.kind === 'player') {
      const swing = player.swing ? 1 - player.swing.timer / player.swing.max : 0;
      if (player.invulnerable > 0 && Math.floor(game.time * 20) % 2 === 0) continue;
      drawCharacter(ctx, player.x - camera.x, player.y - camera.y, {
        colors: player.hurt > 0 ? ['#ffdcdc', '#c9433f', '#7a2020'] : ['#f2c9a0', '#3f6fa8', '#2a3f52'],
        scale: 1, frame: player.moving ? player.walk : Math.sin(game.time * 2) * .4,
        facing: player.facing, swing, weapon: player.melee, flash: 0,
      });
      // The gun in the second hand.
      if (player.gun) {
        const gx = player.x - camera.x + Math.cos(player.facing) * 5;
        const gy = player.y - camera.y - 1 + Math.sin(player.facing) * 3;
        ctx.fillStyle = '#2f3338';
        ctx.fillRect(Math.round(gx) - 1, Math.round(gy) - 1, player.gun === 'shotgun' ? 7 : 5, 2);
      }
    } else if (entry.kind === 'enemy') {
      drawCharacter(ctx, item.x - camera.x, item.y - camera.y, {
        colors: item.color, scale: 1,
        frame: Math.hypot(item.vx, item.vy) > 5 ? game.time * 8 + item.x : Math.sin(game.time * 2 + item.x) * .5,
        facing: item.facing, swing: item.windup > 0 ? 1 - item.windup / .35 : 0,
        weapon: 'crowbar', flash: item.flash,
      });
      if (item.windup > 0) {
        ctx.strokeStyle = 'rgba(255,90,90,.8)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(item.x - camera.x, item.y - camera.y, 11, 0, TAU * (1 - item.windup / .35));
        ctx.stroke();
      }
      // Health bar over damaged enemies.
      if (item.health < item.maxHealth) {
        const ratio = Math.max(0, item.health / item.maxHealth);
        ctx.fillStyle = 'rgba(0,0,0,.6)';
        ctx.fillRect(Math.round(item.x - camera.x) - 7, Math.round(item.y - camera.y) - 14, 14, 2);
        ctx.fillStyle = '#c9433f';
        ctx.fillRect(Math.round(item.x - camera.x) - 7, Math.round(item.y - camera.y) - 14, 14 * ratio, 2);
      }
    } else if (entry.kind === 'boss') {
      const boss = item;
      if (boss.windup > 0) {
        ctx.strokeStyle = `rgba(255,120,90,${(.4 + Math.sin(game.time * 30) * .3).toFixed(2)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(boss.x - camera.x, boss.y - camera.y, boss.radius + 8, 0, TAU);
        ctx.stroke();
      }
      drawCharacter(ctx, boss.x - camera.x, boss.y - camera.y, {
        colors: boss.palette, scale: boss.scale,
        frame: game.time * 4, facing: boss.facing,
        swing: boss.windup > 0 ? 1 : 0, weapon: 'axe', flash: boss.flash,
      });
      const ratio = Math.max(0, boss.health / boss.maxHealth);
      ctx.fillStyle = 'rgba(0,0,0,.65)';
      ctx.fillRect(Math.round(boss.x - camera.x) - 20, Math.round(boss.y - camera.y) - 26, 40, 4);
      ctx.fillStyle = '#e0523f';
      ctx.fillRect(Math.round(boss.x - camera.x) - 20, Math.round(boss.y - camera.y) - 26, 40 * ratio, 4);
      ctx.fillStyle = 'rgba(255,255,255,.25)';
      ctx.fillRect(Math.round(boss.x - camera.x) - 20, Math.round(boss.y - camera.y) - 26, 40 * ratio, 1);
    }
  }

  // Grenades, bullets, particles.
  for (const grenade of game.grenades) {
    const x = Math.round(grenade.x - camera.x), y = Math.round(grenade.y - camera.y);
    ctx.fillStyle = '#3f5c38';
    ctx.fillRect(x - 2, y - 3, 4, 6);
    ctx.fillStyle = Math.floor(grenade.fuse * 8) % 2 ? '#ff6b6b' : '#7a2020';
    ctx.fillRect(x - 1, y - 4, 2, 2);
  }
  for (const bullet of game.bullets) {
    ctx.fillStyle = bullet.color;
    const x = Math.round(bullet.x - camera.x), y = Math.round(bullet.y - camera.y);
    ctx.fillRect(x - 1, y - 1, bullet.friendly ? 4 : 3, 2);
  }
  for (const particle of game.particles) {
    const life = Math.max(0, particle.life / particle.maxLife);
    ctx.globalAlpha = life;
    ctx.fillStyle = particle.color;
    ctx.fillRect(Math.round(particle.x - camera.x), Math.round(particle.y - camera.y), Math.max(1, particle.size), Math.max(1, particle.size));
    ctx.globalAlpha = 1;
  }

  // Lighting and vignette.
  ctx.drawImage(drawLighting(game, camera, palette), 0, 0);
  if (game.flash > 0) {
    ctx.fillStyle = `rgba(255,220,190,${(game.flash * .5).toFixed(2)})`;
    ctx.fillRect(0, 0, w, h);
  }
  if (!state.vignette) {
    state.vignette = document.createElement('canvas');
    state.vignette.width = w; state.vignette.height = h;
    const vctx = state.vignette.getContext('2d');
    const gradient = vctx.createRadialGradient(w / 2, h / 2, h * .3, w / 2, h / 2, h * .95);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, 'rgba(0,0,0,.55)');
    vctx.fillStyle = gradient;
    vctx.fillRect(0, 0, w, h);
  }
  ctx.drawImage(state.vignette, 0, 0);

  // Floating words.
  ctx.font = '8px "Russo One", monospace';
  ctx.textAlign = 'center';
  for (const text of game.texts) {
    ctx.globalAlpha = Math.max(0, Math.min(1, text.life / text.maxLife));
    ctx.fillStyle = 'rgba(0,0,0,.7)';
    ctx.fillText(text.text, Math.round(text.x - camera.x) + 1, Math.round(text.y - camera.y) + 1);
    ctx.fillStyle = text.color;
    ctx.fillText(text.text, Math.round(text.x - camera.x), Math.round(text.y - camera.y));
    ctx.globalAlpha = 1;
  }
  ctx.textAlign = 'left';
  return camera;
}

/* A small top-down minimap of what has already been seen. */
export function renderMinimap(ctx, game, x, y, size) {
  const level = game.level;
  const scale = size / Math.max(level.w, level.h);
  ctx.fillStyle = 'rgba(6,8,12,.72)';
  ctx.fillRect(x, y, size, size);
  ctx.strokeStyle = 'rgba(255,214,138,.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + .5, y + .5, size - 1, size - 1);
  for (let ty = 0; ty < level.h; ty += 1) {
    for (let tx = 0; tx < level.w; tx += 1) {
      const tile = level.grid[ty * level.w + tx];
      if (tile === VOID) continue;
      ctx.fillStyle = tile === WALL ? 'rgba(120,130,150,.5)' : 'rgba(190,205,225,.22)';
      ctx.fillRect(x + tx * scale, y + ty * scale, Math.max(1, scale), Math.max(1, scale));
    }
  }
  ctx.fillStyle = '#ffd27a';
  ctx.fillRect(x + (level.exit.x / TILE) * scale - 1, y + (level.exit.y / TILE) * scale - 1, 3, 3);
  ctx.fillStyle = '#7ce0d0';
  ctx.fillRect(x + (game.player.x / TILE) * scale - 1, y + (game.player.y / TILE) * scale - 1, 3, 3);
  for (const enemy of level.enemies) {
    ctx.fillStyle = '#e0523f';
    ctx.fillRect(x + (enemy.x / TILE) * scale - 1, y + (enemy.y / TILE) * scale - 1, 2, 2);
  }
}
