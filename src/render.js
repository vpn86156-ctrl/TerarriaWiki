/* Пиксельный рендер «Заброшки». Всё рисуется в низком разрешении (270 px по высоте)
   и растягивается на экран без сглаживания — отсюда настоящий пиксельный вид. */

import { TILE, WEAPONS } from './content.js';
import { VOID, FLOOR, WALL, DOOR, EXIT, DIG_TIME } from './engine.js';

const TAU = Math.PI * 2;
const VIEW_HEIGHT = 270;

const state = {
  internalW: 480, internalH: VIEW_HEIGHT, w: 480, h: VIEW_HEIGHT, scale: 1,
  tiles: new Map(), light: null, lightCtx: null, explored: null, exploredCtx: null,
  vignette: null,
};

/* ---------- pixel sprites ----------
   Игра рисует настоящие нарисованные спрайты из public/images/sprites:
   тайлы локаций, герой, враги, боссы, реквизит и предметы. Если картинка
   не загрузилась (например, игра открыта без ассетов), рендер сам нарисует
   пиксельный резерв. */
const sprites = { images: new Map(), pending: null, ready: false };

export function loadSprites(base = './images/sprites') {
  if (typeof Image === 'undefined' || typeof fetch === 'undefined') return Promise.resolve(sprites);
  if (sprites.pending) return sprites.pending;
  sprites.pending = fetch(`${base}/manifest.json`)
    .then((response) => response.json())
    .then((manifest) => Promise.all(Object.keys(manifest).map((name) => new Promise((resolve) => {
      const image = new Image();
      image.onload = () => { sprites.images.set(name, image); resolve(); };
      image.onerror = () => resolve();
      image.src = `${base}/${manifest[name].file}`;
    }))))
    .catch(() => {})
    .then(() => {
      sprites.ready = true;
      // Кэш тайлов мог собраться до загрузки картинок — пересоберём его спрайтами.
      state.tiles.clear();
      state.vignette = null;
    });
  return sprites.pending;
}
export const spritesReady = () => sprites.ready;
export const spriteCount = () => sprites.images.size;
function sprite(name) {
  return sprites.images.get(name) || null;
}
// Рисует спрайт по центру (x, y); возвращает false, если спрайта нет.
function drawSprite(ctx, name, x, y, size, { flip = false, alpha = 1, angle = 0 } = {}) {
  const image = sprite(name);
  if (!image) return false;
  ctx.save();
  if (alpha < 1) ctx.globalAlpha = alpha;
  if (angle) {
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(angle);
    ctx.drawImage(image, Math.round(-size / 2), Math.round(-size / 2), size, size);
  } else if (flip) {
    ctx.translate(Math.round(x) + size / 2, Math.round(y) + size / 2);
    ctx.scale(-1, 1);
    ctx.drawImage(image, Math.round(-size / 2), Math.round(-size / 2), size, size);
  } else {
    ctx.drawImage(image, Math.round(x - size / 2), Math.round(y - size / 2), size, size);
  }
  ctx.restore();
  return true;
}
// Тайл 16×16: спрайт либо процедурный резерв, нарисованный палитрой локации.
function spriteTile(name, painter, palette = null) {
  const key = `sprite|${name}`;
  const cached = state.tiles.get(key);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = TILE; canvas.height = TILE;
  const context = canvas.getContext('2d');
  const image = sprite(name);
  if (image) context.drawImage(image, 0, 0, TILE, TILE);
  else painter(context, palette);
  state.tiles.set(key, canvas);
  return canvas;
}
// Чем разбавлен пол каждой локации: пятна, мусор, трещины.
// Декорации пола нарезаны из листов по шесть штук (decal-<локация>-0..5).
export const FLOOR_DECALS = {
  basement: ['decal-basement-0', 'decal-basement-1', 'decal-basement-2',
    'decal-basement-3', 'decal-basement-4', 'decal-basement-5'],
  hospital: ['decal-hospital-0', 'decal-hospital-1', 'decal-hospital-2',
    'decal-hospital-3', 'decal-hospital-4', 'decal-hospital-5'],
  factory: ['decal-factory-0', 'decal-factory-1', 'decal-factory-2',
    'decal-factory-3', 'decal-factory-4', 'decal-factory-5'],
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
function floorCanvas(palette, index, locationId) {
  return spriteTile(`floor-${locationId}-${index % 4}`, (ctx, colors) => {
    ctx.fillStyle = colors.floor[index % colors.floor.length];
    ctx.fillRect(0, 0, TILE, TILE);
    // Бетонные крапинки и пара трещин, одинаковые для каждого варианта.
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
  }, palette);
}
function wallCanvas(palette, locationId, top = false) {
  return spriteTile(`wall-${top ? 'top-' : ''}${locationId}`, (ctx, colors) => {
    ctx.fillStyle = colors.wall;
    ctx.fillRect(0, 0, TILE, TILE);
    ctx.fillStyle = colors.wallTop;
    ctx.fillRect(0, 0, TILE, 5);
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    for (let y = 6; y < TILE; y += 5) ctx.fillRect(0, y, TILE, 1);
    for (let x = 0; x < TILE; x += 8) ctx.fillRect(x, 0, 1, TILE);
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.fillRect(0, TILE - 2, TILE, 2);
  }, palette);
}

/* ---------- pixel characters ---------- */
function drawCharacter(ctx, x, y, options) {
  const { colors, scale = 1, frame = 0, facing = 0, swing = 0, flash = 0, squash = 0 } = options;
  const bob = Math.round(Math.sin(frame) * 1);
  const px = Math.round(x);
  const py = Math.round(y);
  // Готовый спрайт перекрывает процедурную фигуру: он заметно детальнее.
  const spriteName = options.sprite ? (Array.isArray(options.sprite)
    ? options.sprite[Math.abs(Math.floor(frame)) % options.sprite.length]
    : options.sprite) : null;
  if (spriteName && sprite(spriteName)) {
    const size = (options.spriteSize || 22) * scale;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.32)';
    ctx.beginPath();
    ctx.ellipse(px, py + 6 * scale, 6 * scale, 2.6 * scale, 0, 0, TAU);
    ctx.fill();
    if (flash > 0) ctx.globalAlpha = .75;
    drawSprite(ctx, spriteName, px, py + 6 * scale - size / 2 - squash, size,
      { flip: Math.cos(facing) < -.25 });
    ctx.restore();
    // Оружие рисуется поверх спрайта — в руке переднего плана.
    if (swing > 0) drawHeldWeapon(ctx, options.weapon || 'crowbar', px, py - 2 * scale, facing, swing, scale);
    return;
  }
  ctx.save();
  // Тень.
  ctx.fillStyle = 'rgba(0,0,0,.32)';
  ctx.beginPath();
  ctx.ellipse(px, py + 6 * scale, 6 * scale, 2.6 * scale, 0, 0, TAU);
  ctx.fill();
  const body = flash > 0 ? '#ffffff' : colors[1];
  const skin = flash > 0 ? '#ffffff' : colors[0];
  const dark = flash > 0 ? '#ffdddd' : colors[2] || colors[1];
  // Ноги с простым циклом ходьбы.
  const legSwing = Math.round(Math.sin(frame * 2) * 1.4);
  ctx.fillStyle = dark;
  ctx.fillRect(px - 3 * scale, py + 1 * scale - squash, 2 * scale, 4 * scale);
  ctx.fillRect(px + 1 * scale, py + 1 * scale - squash, 2 * scale, 4 * scale);
  ctx.fillRect(px - 3 * scale + legSwing, py + 4 * scale, 2 * scale, 2 * scale);
  ctx.fillRect(px + 1 * scale - legSwing, py + 4 * scale, 2 * scale, 2 * scale);
  // Торс.
  ctx.fillStyle = body;
  ctx.fillRect(px - 4 * scale, py - 4 * scale + bob - squash, 8 * scale, 6 * scale);
  ctx.fillStyle = 'rgba(255,255,255,.12)';
  ctx.fillRect(px - 4 * scale, py - 4 * scale + bob - squash, 8 * scale, 1 * scale);
  // Голова.
  ctx.fillStyle = skin;
  ctx.fillRect(px - 3 * scale, py - 9 * scale + bob - squash, 6 * scale, 5 * scale);
  ctx.fillStyle = 'rgba(0,0,0,.55)';
  ctx.fillRect(px - 3 * scale, py - 5 * scale + bob - squash, 6 * scale, 1 * scale);
  // Глаза смотрят туда, куда идёт персонаж.
  const lookX = Math.cos(facing), lookY = Math.sin(facing);
  ctx.fillStyle = '#141018';
  ctx.fillRect(px - 2 * scale + Math.round(lookX * 1.4), py - 8 * scale + bob - squash + Math.round(lookY * .8), 1 * scale, 1 * scale);
  ctx.fillRect(px + 1 * scale + Math.round(lookX * 1.4), py - 8 * scale + bob - squash + Math.round(lookY * .8), 1 * scale, 1 * scale);
  // Руки и оружие.
  const reach = 5 * scale;
  const handX = px + Math.cos(facing) * reach;
  const handY = py - 2 * scale + Math.sin(facing) * reach * .7;
  ctx.fillStyle = skin;
  ctx.fillRect(Math.round(handX) - scale, Math.round(handY) - scale, 2 * scale, 2 * scale);
  if (swing > 0) drawHeldWeapon(ctx, options.weapon || 'crowbar', handX, handY, facing, swing, scale);
  ctx.restore();
}
// Оружие в руке: спрайт с поворотом, а если спрайта нет — старая добрая линия.
function drawHeldWeapon(ctx, weapon, handX, handY, facing, swing, scale = 1) {
  const angle = facing + (.5 - swing) * 1.6;
  if (drawSprite(ctx, `weapon-${weapon}`, handX + Math.cos(angle) * 5, handY + Math.sin(angle) * 5,
    16 * scale, { angle: angle + Math.PI / 4 })) return;
  const length = (weapon === 'axe' ? 9 : weapon === 'knife' ? 5 : 8) * scale;
  ctx.save();
  ctx.strokeStyle = weapon === 'knife' ? '#dfe6ea' : weapon === 'axe' ? '#b9c2c8' : '#8d939a';
  ctx.lineWidth = 2 * scale;
  ctx.beginPath();
  ctx.moveTo(Math.round(handX), Math.round(handY));
  ctx.lineTo(Math.round(handX + Math.cos(angle) * length), Math.round(handY + Math.sin(angle) * length));
  ctx.stroke();
  if (weapon === 'axe') {
    ctx.fillStyle = '#dfe6ea';
    ctx.fillRect(Math.round(handX + Math.cos(angle) * length) - scale, Math.round(handY + Math.sin(angle) * length) - scale, 3 * scale, 3 * scale);
  }
  ctx.restore();
}

/* ---------- props and pickups ---------- */
const PROP_SPRITE = {
  crate: 'prop-crate', barrel: 'prop-barrel', box: 'prop-box',
  locker: 'prop-locker', tyres: 'prop-tyres',
};
function drawProp(ctx, prop, palette) {
  if (prop.broken) {
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.fillRect(Math.round(prop.x) - 6, Math.round(prop.y) - 2, 12, 4);
    return;
  }
  const x = Math.round(prop.x), y = Math.round(prop.y);
  const spriteName = PROP_SPRITE[prop.kind] || 'prop-crate';
  // Покрышки ниже ящика, поэтому сажаем их чуть ближе к земле.
  const lift = prop.kind === 'tyres' ? 1 : 3;
  if (drawSprite(ctx, spriteName, x, y - lift, 22, { flip: Math.floor(prop.x) % 2 === 0 })) return;
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  ctx.fillRect(x - 7, y + 4, 14, 3);
  if (prop.kind === 'tyres') {
    ctx.fillStyle = '#22242a';
    ctx.fillRect(x - 8, y - 4, 16, 9);
    ctx.fillStyle = '#33363d';
    ctx.fillRect(x - 6, y - 3, 12, 7);
    ctx.fillStyle = '#141519';
    ctx.fillRect(x - 4, y - 1, 8, 4);
  } else if (prop.kind === 'locker') {
    ctx.fillStyle = '#6d7a80';
    ctx.fillRect(x - 6, y - 11, 12, 16);
    ctx.fillStyle = '#8b989e';
    ctx.fillRect(x - 5, y - 10, 10, 14);
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.fillRect(x - 1, y - 10, 1, 14);
  } else if (prop.kind === 'box') {
    ctx.fillStyle = palette.props[0];
    ctx.fillRect(x - 6, y - 6, 12, 11);
    ctx.fillStyle = 'rgba(255,255,255,.1)';
    ctx.fillRect(x - 6, y - 6, 12, 2);
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.fillRect(x - 1, y - 6, 2, 11);
  } else if (prop.kind === 'barrel') {
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
const PICKUP_SPRITE = { coin: 'item-coin', key: 'item-key', ammo: 'item-ammo', medkit: 'item-medkit' };
function drawPickup(ctx, pickup, time) {
  const x = Math.round(pickup.x), y = Math.round(pickup.y) + Math.round(Math.sin(pickup.bob) * 1.5);
  const spriteName = PICKUP_SPRITE[pickup.kind];
  if (spriteName && drawSprite(ctx, spriteName, x, y - 2, 13)) return;
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
  // Запомненные комнаты остаются слабо видимыми.
  ctx.globalCompositeOperation = 'destination-out';
  ctx.globalAlpha = .42;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(state.explored, -camera.x, -camera.y, game.level.w * TILE, game.level.h * TILE);
  ctx.globalAlpha = 1;
  // Прорезаем темноту вокруг каждого источника света.
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
  // Факелы локации слегка мерцают.
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
  const locationId = game.location.id;
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

  // Пол.
  for (let ty = minY; ty <= maxY; ty += 1) {
    for (let tx = minX; tx <= maxX; tx += 1) {
      const tile = level.grid[ty * level.w + tx];
      if (tile === VOID) continue;
      const variant = (tx * 7 + ty * 13) % 4;
      ctx.drawImage(floorCanvas(palette, variant, locationId), tx * TILE - camera.x, ty * TILE - camera.y);
      // Пол разбавлен пятнами и мусором, чтобы не выглядеть однотонным.
      const decals = FLOOR_DECALS[locationId];
      if (decals) {
        const hash = ((tx * 73856093) ^ (ty * 19349663)) >>> 0;
        if (hash % 100 < 18) {
          const name = decals[(hash >>> 7) % decals.length];
          if (sprite(name)) ctx.drawImage(spriteTile(name, () => {}), tx * TILE - camera.x, ty * TILE - camera.y);
        }
      }
    }
  }
  // Пятна крови и гари — под всем остальным.
  for (const decal of game.decals) {
    ctx.globalAlpha = decal.a;
    ctx.fillStyle = decal.color;
    ctx.beginPath();
    ctx.ellipse(decal.x - camera.x, decal.y - camera.y, decal.r, decal.r * .7, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  // Отметка выхода.
  const exitPulse = .5 + Math.sin(game.time * 3) * .2;
  ctx.fillStyle = `rgba(255,210,120,${(.25 + exitPulse * .3).toFixed(2)})`;
  ctx.fillRect(level.exit.x - 9 - camera.x, level.exit.y - 9 - camera.y, 18, 18);
  if (!drawSprite(ctx, `exit-${locationId}`, level.exit.x - camera.x, level.exit.y - camera.y, 18)) {
    ctx.fillStyle = '#ffd27a';
    ctx.fillRect(level.exit.x - 7 - camera.x, level.exit.y - 7 - camera.y, 14, 14);
    ctx.fillStyle = palette.shadow;
    for (let i = 0; i < 4; i += 1) ctx.fillRect(level.exit.x - 5 - camera.x + i * 3, level.exit.y - 5 - camera.y + i * 4, 2, 3);
  }
  // Запертая дверь.
  if (!game.doorOpen) {
    const dx = level.door.x * TILE - camera.x, dy = level.door.y * TILE - camera.y;
    const doorDrawn = drawSprite(ctx, `door-${locationId}`, dx + TILE / 2, dy + TILE / 2, TILE);
    if (!doorDrawn) {
      ctx.fillStyle = '#6b4a2a';
      ctx.fillRect(dx, dy, TILE, TILE);
      ctx.fillStyle = '#8a6438';
      ctx.fillRect(dx + 1, dy + 1, TILE - 2, TILE - 2);
    }
    ctx.fillStyle = '#ffd76a';
    ctx.fillRect(dx + 6, dy + 7, 4, 4);
  }

  // Реквизит, предметы и персонажи сортируются по Y, чтобы перекрытия выглядели верно.
  const drawables = [];
  for (const prop of level.props) drawables.push({ y: prop.y, kind: 'prop', item: prop });
  for (const pickup of level.pickups) drawables.push({ y: pickup.y, kind: 'pickup', item: pickup });
  for (const enemy of level.enemies) drawables.push({ y: enemy.y, kind: 'enemy', item: enemy });
  if (level.boss && !level.boss.dead) drawables.push({ y: level.boss.y, kind: 'boss', item: level.boss });
  drawables.push({ y: player.y, kind: 'player', item: player });
  drawables.sort((a, b) => a.y - b.y);

  // Стены рисуются после пола, но перед теми, кто стоит рядом с ними.
  const wallTile = wallCanvas(palette, locationId, false);
  const wallTopTile = wallCanvas(palette, locationId, true);
  for (let ty = minY; ty <= maxY; ty += 1) {
    for (let tx = minX; tx <= maxX; tx += 1) {
      if (level.grid[ty * level.w + tx] !== WALL) continue;
      // Стена, под которой нет другой стены, получает верхнюю грань.
      const above = ty > 0 ? level.grid[(ty - 1) * level.w + tx] : VOID;
      ctx.drawImage(above === WALL ? wallTile : wallTopTile, tx * TILE - camera.x, ty * TILE - camera.y);
    }
  }
  // Факелы горят на стенах.
  for (const torch of level.torches) {
    const x = torch.x - camera.x, y = torch.y - camera.y;
    if (x < -20 || y < -20 || x > w + 20 || y > h + 20) continue;
    if (!drawSprite(ctx, 'prop-torch', x, y - 3, 16)) {
      ctx.fillStyle = '#3a2a1c';
      ctx.fillRect(Math.round(x) - 1, Math.round(y) - 2, 2, 6);
    }
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
      const lookX = Math.cos(player.facing), lookY = Math.sin(player.facing);
      const direction = lookX < -.35 ? 'left' : lookX > .35 ? 'right' : lookY > 0 ? 'down' : 'up';
      // Отдача: корпус слегка уходит назад в момент выстрела.
      const kick = (player.recoil || 0) * 2.6;
      const px = player.x - camera.x - lookX * kick;
      const py = player.y - camera.y - lookY * kick * .6;
      drawCharacter(ctx, px, py, {
        colors: player.hurt > 0 ? ['#ffdcdc', '#c9433f', '#7a2020'] : ['#f2c9a0', '#3f6fa8', '#2a3f52'],
        scale: 1, frame: player.moving ? player.walk : Math.sin(game.time * 2) * .4,
        facing: player.facing, swing, weapon: player.melee, flash: 0,
        sprite: `hero-${direction}`, spriteSize: 24,
      });
      // Дуга удара холодным оружием.
      if (player.swing) {
        ctx.save();
        ctx.globalAlpha = .32 * (1 - swing * .7);
        ctx.fillStyle = '#fff3cd';
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.arc(px, py, 25, player.swing.angle - 1.1 + swing * 2.2, player.swing.angle + .15 + swing * 2.2);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      // Оружие во второй руке.
      if (player.gun) {
        const gx = player.x - camera.x + Math.cos(player.facing) * 5;
        const gy = player.y - camera.y - 1 + Math.sin(player.facing) * 3;
        if (!drawSprite(ctx, `weapon-${player.gun}`, gx, gy, 13,
          { flip: lookX < -.2, angle: lookY > .5 ? Math.PI : 0 })) {
          ctx.fillStyle = '#2f3338';
          ctx.fillRect(Math.round(gx) - 1, Math.round(gy) - 1, player.gun === 'shotgun' ? 7 : 5, 2);
        }
        // Вспышка из ствола.
        if ((player.muzzle || 0) > 0) {
          const mx = px + Math.cos(player.facing) * 13, my = py - 1 + Math.sin(player.facing) * 6;
          const size = 5 + player.muzzle * 46;
          const grd = ctx.createRadialGradient(mx, my, 0, mx, my, size);
          grd.addColorStop(0, 'rgba(255,246,214,.95)');
          grd.addColorStop(.45, 'rgba(255,186,92,.7)');
          grd.addColorStop(1, 'rgba(255,120,40,0)');
          ctx.fillStyle = grd;
          ctx.beginPath();
          ctx.arc(mx, my, size, 0, TAU);
          ctx.fill();
          ctx.strokeStyle = 'rgba(255,224,160,.85)';
          ctx.lineWidth = 1.2;
          for (let i = -1; i <= 1; i += 1) {
            const a = player.facing + i * .32;
            ctx.beginPath();
            ctx.moveTo(mx, my);
            ctx.lineTo(mx + Math.cos(a) * size * 1.6, my + Math.sin(a) * size * 1.6);
            ctx.stroke();
          }
        }
      }
    } else if (entry.kind === 'enemy') {
      // Зарытый мертвец не виден, пока не начнёт вылезать.
      if (item.buried) continue;
      const digging = item.emerge > 0;
      if (digging) {
        // Вылезает из-под земли: видно только верхнюю часть, из-под низа летит грунт.
        const progress = Math.min(1, 1 - item.emerge / DIG_TIME);
        ctx.save();
        ctx.beginPath();
        ctx.rect(item.x - camera.x - 16, item.y - camera.y - 20, 32, 20 + 14 * progress);
        ctx.clip();
        ctx.translate(0, (1 - progress) * 14);
        drawCharacter(ctx, item.x - camera.x, item.y - camera.y, {
          colors: item.color, scale: 1,
          frame: game.time * 22, facing: item.facing, swing: 0,
          weapon: 'crowbar', flash: item.flash,
          sprite: `enemy-${item.type}`, spriteSize: 24,
        });
        ctx.restore();
        // Края ямы и комья земли.
        ctx.fillStyle = 'rgba(40,32,22,.85)';
        ctx.beginPath();
        ctx.ellipse(item.x - camera.x, item.y - camera.y + 6, 9, 3.2, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#6b563a';
        for (let i = 0; i < 3; i += 1) {
          const a = game.time * 3 + i * 2.1;
          ctx.fillRect(Math.round(item.x - camera.x + Math.cos(a) * 10) - 1,
            Math.round(item.y - camera.y + 2 - Math.abs(Math.sin(a)) * 8) - 1, 2, 2);
        }
        continue;
      }
      drawCharacter(ctx, item.x - camera.x, item.y - camera.y, {
        colors: item.color, scale: 1,
        frame: Math.hypot(item.vx, item.vy) > 5 ? game.time * 8 + item.x : Math.sin(game.time * 2 + item.x) * .5,
        facing: item.facing, swing: item.windup > 0 ? 1 - item.windup / .35 : 0,
        weapon: 'crowbar', flash: item.flash,
        sprite: `enemy-${item.type}`, spriteSize: 24,
      });
      if (item.windup > 0) {
        ctx.strokeStyle = 'rgba(255,90,90,.8)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(item.x - camera.x, item.y - camera.y, 11, 0, TAU * (1 - item.windup / .35));
        ctx.stroke();
      }
      // Полоса здоровья над ранеными врагами.
      if (item.health < item.maxHealth) {
        const ratio = Math.max(0, item.health / item.maxHealth);
        ctx.fillStyle = 'rgba(0,0,0,.6)';
        ctx.fillRect(Math.round(item.x - camera.x) - 7, Math.round(item.y - camera.y) - 14, 14, 2);
        ctx.fillStyle = '#c9433f';
        ctx.fillRect(Math.round(item.x - camera.x) - 7, Math.round(item.y - camera.y) - 14, 14 * ratio, 2);
      }
    } else if (entry.kind === 'boss') {
      const boss = item;
      const bx = boss.x - camera.x, by = boss.y - camera.y;

      // Ярость: багровое сияние и жар из-под ног.
      if (boss.mode === 'rage' && boss.rageGlow > 0) {
        const glow = (.22 + Math.sin(game.time * 6) * .1) * boss.rageGlow;
        const grd = ctx.createRadialGradient(bx, by, 4, bx, by, boss.radius + 30);
        grd.addColorStop(0, `rgba(255,72,40,${glow.toFixed(3)})`);
        grd.addColorStop(1, 'rgba(255,72,40,0)');
        ctx.fillStyle = grd;
        ctx.fillRect(bx - boss.radius - 32, by - boss.radius - 32, (boss.radius + 32) * 2, (boss.radius + 32) * 2);
      }

      // Телеграф: заранее показываем, куда и чем ударит босс.
      const tele = boss.telegraph;
      if (tele) {
        const progress = Math.min(1, tele.t / Math.max(.01, tele.max));
        const alpha = .22 + progress * .5;
        ctx.save();
        ctx.lineWidth = 2;
        const weak = tele.weak;
        const red = Math.round(150 - progress * 70);
        const green = Math.round(90 - progress * 20);
        ctx.strokeStyle = weak ? `rgba(150,165,190,${alpha.toFixed(2)})`
          : `rgba(255,${red},${green},${alpha.toFixed(2)})`;
        ctx.fillStyle = weak ? `rgba(150,165,190,${(alpha * .14).toFixed(2)})`
          : `rgba(255,120,60,${(alpha * .16).toFixed(2)})`;
        if (tele.kind === 'charge') {
          const len = tele.radius * 1.7;
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.lineTo(bx + Math.cos(tele.angle) * len, by + Math.sin(tele.angle) * len);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(bx + Math.cos(tele.angle) * len, by + Math.sin(tele.angle) * len);
          ctx.lineTo(bx + Math.cos(tele.angle + 2.5) * 8 + Math.cos(tele.angle) * len, by + Math.sin(tele.angle + 2.5) * 8 + Math.sin(tele.angle) * len);
          ctx.lineTo(bx + Math.cos(tele.angle - 2.5) * 8 + Math.cos(tele.angle) * len, by + Math.sin(tele.angle - 2.5) * 8 + Math.sin(tele.angle) * len);
          ctx.closePath();
          ctx.fill();
        } else if (tele.kind === 'flame') {
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.arc(bx, by, tele.radius, tele.angle - .55, tele.angle + .55);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        } else if (tele.kind === 'chain') {
          ctx.setLineDash([5, 4]);
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.lineTo(bx + Math.cos(tele.angle) * tele.radius, by + Math.sin(tele.angle) * tele.radius);
          ctx.stroke();
          ctx.setLineDash([]);
        } else {
          ctx.beginPath();
          ctx.arc(bx, by, tele.radius, -Math.PI / 2, -Math.PI / 2 + TAU * progress);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(bx, by, tele.radius, 0, TAU);
          ctx.fill();
        }
        ctx.restore();
      }

      // Цепь-крюк: летит вперёд и тянет игрока назад.
      if (boss.chain) {
        const chain = boss.chain;
        const tipX = bx + Math.cos(chain.angle) * chain.length;
        const tipY = by + Math.sin(chain.angle) * chain.length;
        ctx.save();
        ctx.strokeStyle = '#a9b0b8';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(tipX, tipY);
        ctx.stroke();
        ctx.strokeStyle = '#6c747c';
        ctx.lineWidth = .8;
        for (let i = 1; i * 7 < chain.length; i += 1) {
          const lx = bx + Math.cos(chain.angle) * i * 7, ly = by + Math.sin(chain.angle) * i * 7;
          ctx.beginPath();
          ctx.arc(lx, ly, 1.6, 0, TAU);
          ctx.stroke();
        }
        ctx.fillStyle = '#cfd6dd';
        ctx.beginPath();
        ctx.arc(tipX, tipY, 3, 0, TAU);
        ctx.fill();
        ctx.restore();
      }

      // Замах: босс надувается перед ударом.
      const winding = boss.windup > 0;
      const pulse = winding ? 1 + Math.sin(game.time * 34) * .07 : 1;
      drawCharacter(ctx, bx, by, {
        colors: boss.palette, scale: boss.scale * pulse,
        frame: game.time * 4, facing: boss.facing,
        swing: winding ? 1 : 0, weapon: 'axe', flash: boss.flash,
        sprite: `boss-${boss.id}`, spriteSize: 46,
      });
      const ratio = Math.max(0, boss.health / boss.maxHealth);
      const barX = Math.round(bx) - 20, barY = Math.round(by) - (boss.mode === 'rage' ? 30 : 26);
      ctx.fillStyle = 'rgba(0,0,0,.65)';
      ctx.fillRect(barX, barY, 40, 4);
      ctx.fillStyle = boss.mode === 'rage' ? '#ff3a2a' : '#e0523f';
      ctx.fillRect(barX, barY, 40 * ratio, 4);
      ctx.fillStyle = 'rgba(255,255,255,.25)';
      ctx.fillRect(barX, barY, 40 * ratio, 1);
      // Метки границ фаз — видно, когда босс озвереет.
      ctx.fillStyle = 'rgba(255,255,255,.45)';
      ctx.fillRect(barX + 40 * .33, barY, 1, 4);
      ctx.fillRect(barX + 40 * .66, barY, 1, 4);
      if (boss.mode === 'rage') {
        ctx.fillStyle = `rgba(255,90,70,${(.6 + Math.sin(game.time * 8) * .35).toFixed(2)})`;
        ctx.font = '5px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('ЯРОСТЬ', bx, barY - 2);
        ctx.textAlign = 'left';
      }
    }
  }

  // Гранаты, пули, частицы.
  for (const grenade of game.grenades) {
    const x = Math.round(grenade.x - camera.x), y = Math.round(grenade.y - camera.y);
    if (!drawSprite(ctx, 'item-grenade', x, y - 2, 11, { angle: grenade.spin })) {
      ctx.fillStyle = '#3f5c38';
      ctx.fillRect(x - 2, y - 3, 4, 6);
    }
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

  // Свет и виньетка.
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

  // Всплывающие надписи.
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
