import { WORLD_HEIGHT } from './engine.js';
import { SKINS } from './content.js';
import { bossPalette } from './engine.js';

const TAU = Math.PI * 2;
const lcg = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

/* ---------- deterministic per-sector backdrop layers ---------- */
const fields = new Map();
function buildField(sector) {
  const random = lcg(9173 + sector * 7919);
  const stars = [];
  for (const [count, min, max, size] of [[96, 5, 18, .7], [46, 46, 92, 1.5]]) {
    for (let i = 0; i < count; i += 1) {
      stars.push({ x: random(), y: random(), size: size * (.6 + random() * .8), speed: min + random() * (max - min), alpha: .22 + random() * .62, phase: random() * TAU, layer: size });
    }
  }
  const clouds = Array.from({ length: 4 }, () => ({
    x: random(), y: random(), radius: 110 + random() * 90, speed: 3 + random() * 9,
    alpha: .05 + random() * .07, phase: random() * TAU,
  }));
  const motes = Array.from({ length: sector === 2 ? 30 : sector === 1 ? 26 : 22 }, () => ({
    x: random(), y: random(), size: 1.6 + random() * (sector === 1 ? 4.6 : 3.2),
    speed: 26 + random() * 78, phase: random() * TAU, spin: (random() - .5) * 2.4, drift: (random() - .5) * 26,
  }));
  const silhouettes = Array.from({ length: 5 }, () => ({
    x: random(), y: random(), radius: 9 + random() * 26, speed: 34 + random() * 46, phase: random() * TAU, shape: random() * 100,
  }));
  return { stars, clouds, motes, silhouettes };
}
const field = (sector) => {
  if (!fields.has(sector)) fields.set(sector, buildField(sector));
  return fields.get(sector);
};
// The starfield is static: it is painted once per sector/size and then only blitted with an offset.
const layers = new Map();
function starLayer(sector, index, w, h) {
  const key = `${sector}|${index}|${Math.round(w)}|${Math.round(h)}`;
  let canvas = layers.get(key);
  if (canvas) return canvas;
  canvas = document.createElement('canvas');
  canvas.width = Math.ceil(w + 80); canvas.height = Math.ceil(h);
  const painter = canvas.getContext('2d');
  const { stars } = field(sector);
  const [, , , baseSize] = [[0, 0, 0, .7], [0, 0, 0, 1.2], [0, 0, 0, 1.9]][index];
  for (const star of stars) {
    if (star.layer !== baseSize) continue;
    painter.globalAlpha = star.alpha;
    painter.fillStyle = star.size > 1.5 ? '#b7fff6' : '#e2ecff';
    painter.beginPath();
    painter.arc(star.x * canvas.width, star.y * h, star.size, 0, TAU);
    painter.fill();
  }
  if (layers.size > 12) layers.clear();
  layers.set(key, canvas);
  return canvas;
}
const SECTOR_TINT = ['rgba(120,240,235,', 'rgba(150,205,255,', 'rgba(255,150,96,'];

// Radial glow sprites are drawn once and blitted, which keeps the frame free of gradient allocations.
const spriteCache = new Map();
function glowSprite(color, size = 64, core = .55) {
  const key = `${color}|${size}|${core}`;
  let sprite = spriteCache.get(key);
  if (sprite) return sprite;
  sprite = document.createElement('canvas');
  sprite.width = sprite.height = size * 2;
  const painter = sprite.getContext('2d');
  const gradient = painter.createRadialGradient(size, size, 0, size, size, size);
  gradient.addColorStop(0, color);
  gradient.addColorStop(core, color.replace(/[\d.]+\)$/, '0.35)'));
  gradient.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'));
  painter.fillStyle = gradient;
  painter.fillRect(0, 0, size * 2, size * 2);
  spriteCache.set(key, sprite);
  return sprite;
}
function blit(ctx, sprite, x, y, size, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.drawImage(sprite, x - size, y - size, size * 2, size * 2);
  ctx.globalAlpha = 1;
}

// The backdrop image is scaled once per size; every frame only blits the cached copy.
const backdrops = new Map();
function cover(ctx, image, w, h, phase) {
  if (!image?.complete || !image.naturalWidth) return false;
  const key = `${image.src}|${Math.round(w)}|${Math.round(h)}`;
  let cached = backdrops.get(key);
  if (!cached) {
    cached = document.createElement('canvas');
    cached.width = Math.ceil(w); cached.height = Math.ceil(h);
    const painter = cached.getContext('2d');
    const scale = Math.max(w / image.naturalWidth, h / image.naturalHeight) * 1.05;
    const iw = image.naturalWidth * scale, ih = image.naturalHeight * scale;
    painter.drawImage(image, (w - iw) / 2, (h - ih) / 2, iw, ih);
    if (backdrops.size > 6) backdrops.clear();
    backdrops.set(key, cached);
  }
  const zoom = 1 + Math.sin(phase * .16) * .01;
  ctx.drawImage(cached, -(w * (zoom - 1)) / 2, -(h * (zoom - 1)) / 2, w * zoom, h * zoom);
  return true;
}

function drawBackdrop(ctx, game, image) {
  const w = game.width, h = WORLD_HEIGHT;
  const sector = game.sectorIndex;
  const heat = game.boss ? 1 : game.warning > 0 ? game.warning / 2.6 : 0;
  const speed = 1 + heat * .8;
  const { clouds, motes, silhouettes } = field(sector);
  if (!cover(ctx, image, w, h, game.elapsed)) {
    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, '#091427'); bg.addColorStop(.6, '#080c24'); bg.addColorStop(1, '#1a1035');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  }
  // Drifting nebula clouds give the still image depth.
  for (const cloud of clouds) {
    const span = w + 620;
    const x = ((cloud.x * span - game.elapsed * cloud.speed * speed) % span + span) % span - 310;
    const y = cloud.y * h + Math.sin(game.elapsed * .12 + cloud.phase) * 16;
    const pulse = (cloud.alpha / .12) * (.7 + Math.sin(game.elapsed * .5 + cloud.phase) * .3) * (1 + heat * .5);
    blit(ctx, glowSprite(`${SECTOR_TINT[sector]}.16)`, Math.ceil(cloud.radius)), x, y, cloud.radius, Math.max(0, Math.min(1, pulse)));
  }
  // Parallax silhouettes.
  for (const shape of silhouettes) {
    const span = w + 200;
    const x = ((shape.x * span - game.elapsed * shape.speed * speed) % span + span) % span - 100;
    const y = shape.y * h;
    ctx.fillStyle = `rgba(6,10,26,${.5 + heat * .2})`;
    ctx.beginPath();
    for (let i = 0; i < 9; i += 1) {
      const a = i / 9 * TAU;
      const variance = .8 + (Math.sin(shape.shape + i * 3.7) + 1) * .12;
      const px = x + Math.cos(a) * shape.radius * variance, py = y + Math.sin(a) * shape.radius * variance;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill();
  }
  // Two cached parallax star layers; the near one streaks during a boss fight.
  for (let index = 0; index < 2; index += 1) {
    const layer = starLayer(sector, index, w, h);
    const rates = [12, 62];
    const span = layer.width;
    const offset = ((game.elapsed * rates[index] * speed) % span + span) % span;
    ctx.globalAlpha = Math.min(1, .85 + heat * .15);
    ctx.drawImage(layer, -offset, 0);
    ctx.drawImage(layer, span - offset, 0);
    ctx.globalAlpha = 1;
    if (index === 1) {
      ctx.fillStyle = `rgba(200,240,255,${(.06 + heat * .1).toFixed(3)})`;
      for (let i = 0; i < 6; i += 1) {
        const y = ((i * 97 + Math.sin(game.elapsed * .3 + i) * 20) % h + h) % h;
        const length = 60 + heat * 90;
        const x = ((i * 313 - game.elapsed * (240 + heat * 220)) % (w + length) + (w + length)) % (w + length);
        ctx.fillRect(x, y, length, 1.4);
      }
    }
  }
  // Sector character: drifting ice shards, rising embers or cold dust.
  const ember = glowSprite('rgba(255,170,90,.95)', 16, .35);
  for (const mote of motes) {
    const span = w + 120;
    const x = ((mote.x * span - game.elapsed * mote.speed * speed) % span + span) % span - 60;
    const drift = Math.sin(game.elapsed * .8 + mote.phase) * mote.drift;
    const y = (mote.y * h + drift + (sector === 2 ? -((game.elapsed * 26) % h) : 0) + h) % h;
    const alpha = .35 + Math.sin(game.elapsed * 1.6 + mote.phase) * .25;
    if (sector === 1) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(game.elapsed * mote.spin + mote.phase);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgba(196,238,255,.85)';
      ctx.beginPath(); ctx.moveTo(0, -mote.size * 2); ctx.lineTo(mote.size, 0); ctx.lineTo(0, mote.size * 2); ctx.lineTo(-mote.size, 0); ctx.closePath(); ctx.fill();
      ctx.restore();
    } else if (sector === 2) {
      blit(ctx, ember, x, y, mote.size * 5, alpha * .8);
    } else {
      ctx.globalAlpha = alpha * .7;
      ctx.fillStyle = 'rgba(178,214,255,.75)';
      ctx.beginPath(); ctx.arc(x, y, mote.size * .7, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
  // Occasional storm flash during a boss fight.
  if (game.boss) {
    const bolt = Math.max(0, Math.sin(game.elapsed * 1.35) - .93) * 12;
    if (bolt > .4) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = `${SECTOR_TINT[sector]}${(Math.min(.2, bolt * .03)).toFixed(3)})`;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = `rgba(255,255,255,${Math.min(.5, bolt * .08).toFixed(3)})`;
      ctx.lineWidth = 1.6;
      const y0 = (Math.sin(game.elapsed * 3.1) * .5 + .5) * h * .5;
      ctx.beginPath(); ctx.moveTo(w, y0);
      for (let i = 1; i <= 6; i += 1) ctx.lineTo(w - (w * .16) * i, y0 + Math.sin(game.elapsed * 12 + i * 2.3) * 26);
      ctx.stroke();
      ctx.restore();
    }
  }
}

const vignettes = new Map();
function vignette(kind, w, h) {
  const key = `${kind}|${Math.round(w)}|${Math.round(h)}`;
  let cached = vignettes.get(key);
  if (cached) return cached;
  cached = document.createElement('canvas');
  cached.width = Math.ceil(w); cached.height = Math.ceil(h);
  const painter = cached.getContext('2d');
  const gradient = painter.createRadialGradient(w * .5, h * .5, Math.min(w, h) * .28, w * .5, h * .5, Math.max(w, h) * .72);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, kind === 'danger' ? 'rgba(56,4,12,.9)' : 'rgba(2,4,16,.62)');
  painter.fillStyle = gradient;
  painter.fillRect(0, 0, w, h);
  if (kind === 'danger') {
    const warning = painter.createLinearGradient(0, 0, 0, h);
    warning.addColorStop(0, 'rgba(255,72,72,.16)'); warning.addColorStop(.5, 'rgba(255,72,72,0)'); warning.addColorStop(1, 'rgba(255,72,72,.16)');
    painter.fillStyle = warning; painter.fillRect(0, 0, w, h);
  }
  if (vignettes.size > 8) vignettes.clear();
  vignettes.set(key, cached);
  return cached;
}
function drawVignette(ctx, game) {
  const w = game.width, h = WORLD_HEIGHT;
  const danger = game.boss ? .55 + Math.sin(game.elapsed * 3.4) * .12 : game.warning > 0 ? (1 - game.warning / 2.6) * .5 : 0;
  ctx.drawImage(vignette('calm', w, h), 0, 0);
  if (danger > 0) {
    ctx.globalAlpha = Math.min(1, danger);
    ctx.drawImage(vignette('danger', w, h), 0, 0);
    ctx.globalAlpha = 1;
  }
}

/* ---------- entities ---------- */
function drawRock(ctx, rock, time) {
  ctx.save();
  ctx.translate(rock.x, rock.y);
  if (rock.comet) {
    const trail = ctx.createLinearGradient(0, 0, rock.radius * 3.6, 0);
    const color = rock.sector === 1 ? '150,220,255' : rock.sector === 2 ? '255,140,80' : '150,236,247';
    trail.addColorStop(0, `rgba(${color},.65)`); trail.addColorStop(.45, `rgba(${color},.22)`); trail.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = trail;
    ctx.beginPath(); ctx.moveTo(0, -rock.radius * .75); ctx.quadraticCurveTo(rock.radius * 2, 0, rock.radius * 3.6, 0); ctx.quadraticCurveTo(rock.radius * 2, 0, 0, rock.radius * .75); ctx.fill();
  }
  ctx.rotate(rock.rotation);
  const r = rock.radius;
  const outline = () => {
    ctx.beginPath();
    for (let i = 0; i < 12; i += 1) {
      const a = i / 12 * TAU;
      const variance = .84 + (Math.sin(rock.shape * 1.2 + i * 28.13) + 1) * .08;
      const x = Math.cos(a) * r * variance, y = Math.sin(a) * r * variance;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  };
  if (rock.comet) { ctx.shadowColor = 'rgba(150,235,255,.6)'; ctx.shadowBlur = 18; }
  const fill = ctx.createRadialGradient(-r * .38, -r * .43, 1, 0, 0, r * 1.1);
  if (rock.sector === 1) { fill.addColorStop(0, '#e6fbff'); fill.addColorStop(.4, '#7caec7'); fill.addColorStop(.75, '#4b6e93'); fill.addColorStop(1, '#283854'); }
  else if (rock.sector === 2) { fill.addColorStop(0, '#ffd2b0'); fill.addColorStop(.4, '#a65e58'); fill.addColorStop(.75, '#613d4b'); fill.addColorStop(1, '#332935'); }
  else { fill.addColorStop(0, '#d2a38e'); fill.addColorStop(.4, '#9c6f79'); fill.addColorStop(.75, '#624b67'); fill.addColorStop(1, '#33334e'); }
  ctx.fillStyle = fill; outline(); ctx.fill(); ctx.shadowBlur = 0;
  ctx.strokeStyle = rock.comet ? 'rgba(210,245,255,.7)' : 'rgba(245,190,170,.48)'; ctx.lineWidth = 1.3; ctx.stroke();
  ctx.save(); outline(); ctx.clip();
  ctx.strokeStyle = 'rgba(57,37,58,.35)'; ctx.lineWidth = Math.max(1, r * .045);
  ctx.fillStyle = 'rgba(33,30,49,.26)';
  for (let i = 0; i < 4; i += 1) {
    const ox = Math.sin(rock.shape + i * 11.7) * r * .55, oy = Math.cos(rock.shape * .7 + i * 8.9) * r * .5;
    const cr = r * (.1 + (i % 2) * .045);
    ctx.beginPath(); ctx.ellipse(ox, oy, cr * 1.4, cr, .45, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,216,183,.3)'; ctx.beginPath(); ctx.arc(ox, oy, cr * 1.2, Math.PI * 1.05, Math.PI * 1.62); ctx.stroke();
    ctx.strokeStyle = 'rgba(57,37,58,.35)';
  }
  if (rock.comet) {
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    ctx.beginPath(); ctx.ellipse(-r * .35, -r * .35, r * .22, r * .12, -.6, 0, TAU); ctx.fill();
  }
  ctx.restore(); ctx.restore();
}

function drawDrone(ctx, drone, time) {
  ctx.save(); ctx.translate(drone.x, drone.y); ctx.rotate(Math.sin(time * 2 + drone.phase) * .1);
  const charge = Math.max(0, 1 - Math.max(0, drone.fire) * 1.4);
  ctx.shadowBlur = 20 + charge * 16; ctx.shadowColor = `rgba(255,120,220,${.35 + charge * .4})`;
  const hull = ctx.createLinearGradient(0, -20, 0, 20);
  hull.addColorStop(0, '#f9d3e8'); hull.addColorStop(.4, '#9d75a5'); hull.addColorStop(1, '#3d3560');
  ctx.fillStyle = hull; ctx.strokeStyle = '#f0a9bf'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(-26, 0); ctx.quadraticCurveTo(-17,-12,-6,-13); ctx.quadraticCurveTo(0,-25,10,-12); ctx.quadraticCurveTo(22,-9,27,0); ctx.quadraticCurveTo(12,14,-13,11); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#263a64'; ctx.beginPath(); ctx.ellipse(4,-10,10,7,0,Math.PI,TAU); ctx.fill();
  ctx.strokeStyle = '#e3a1d0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-20,1); ctx.quadraticCurveTo(0,8,21,1); ctx.stroke();
  ctx.fillStyle = charge > .2 ? '#fff2b0' : '#ffcc9b';
  ctx.shadowColor = '#ffb0f0'; ctx.shadowBlur = 6 + charge * 14;
  for (const x of [-13, 0, 13]) { ctx.beginPath(); ctx.arc(x, 4, 1.8 + charge, 0, TAU); ctx.fill(); }
  ctx.restore();
}

function drawPickup(ctx, pickup) {
  ctx.save(); ctx.translate(pickup.x, pickup.y);
  const pulse = 1 + Math.sin(pickup.phase) * .09; ctx.scale(pulse, pulse);
  const halo = ctx.createRadialGradient(0, 0, 2, 0, 0, 30);
  if (pickup.kind === 'star') {
    halo.addColorStop(0, 'rgba(255,205,104,.5)'); halo.addColorStop(1, 'rgba(255,205,104,0)');
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(0, 0, 30, 0, TAU); ctx.fill();
    ctx.save(); ctx.rotate(Math.sin(pickup.phase * .6) * .12);
    ctx.shadowColor = '#ffcd68'; ctx.shadowBlur = 22;
    const gold = ctx.createLinearGradient(0, -19, 0, 19);
    gold.addColorStop(0, '#fff6d2'); gold.addColorStop(.5, '#ffd777'); gold.addColorStop(1, '#f0a63f');
    ctx.fillStyle = gold;
    ctx.beginPath(); ctx.moveTo(0,-19); ctx.quadraticCurveTo(3,-5,14,0); ctx.quadraticCurveTo(3,5,0,19); ctx.quadraticCurveTo(-3,5,-14,0); ctx.quadraticCurveTo(-3,-5,0,-19); ctx.fill();
    ctx.shadowBlur = 0; ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#fffdf2'; ctx.beginPath(); ctx.arc(0,0,3.2,0,TAU); ctx.fill();
    ctx.restore();
    const spark = Math.abs(Math.sin(pickup.phase * 1.3));
    ctx.strokeStyle = `rgba(255,255,255,${(.25 + spark * .5).toFixed(2)})`; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(0,-24*spark); ctx.lineTo(0,24*spark); ctx.moveTo(-24*spark,0); ctx.lineTo(24*spark,0); ctx.stroke();
  } else if (pickup.kind === 'repair') {
    halo.addColorStop(0, 'rgba(120,255,205,.45)'); halo.addColorStop(1, 'rgba(120,255,205,0)');
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(0, 0, 30, 0, TAU); ctx.fill();
    ctx.shadowColor = '#89ffd2'; ctx.shadowBlur = 20;
    ctx.fillStyle = '#d6ffe9'; ctx.beginPath(); ctx.arc(0,0,15,0,TAU); ctx.fill();
    ctx.shadowBlur = 0;
    const cross = ctx.createLinearGradient(0, -10, 0, 10);
    cross.addColorStop(0, '#1fa87c'); cross.addColorStop(1, '#0d6e58');
    ctx.fillStyle = cross;
    ctx.beginPath(); ctx.moveTo(-3.5,-10); ctx.lineTo(3.5,-10); ctx.lineTo(3.5,-3.5); ctx.lineTo(10,-3.5); ctx.lineTo(10,3.5); ctx.lineTo(3.5,3.5); ctx.lineTo(3.5,10); ctx.lineTo(-3.5,10); ctx.lineTo(-3.5,3.5); ctx.lineTo(-10,3.5); ctx.lineTo(-10,-3.5); ctx.lineTo(-3.5,-3.5); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(160,255,220,.8)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(0, 0, 19 + Math.sin(pickup.phase) * 2, 0, TAU); ctx.stroke();
  } else if (pickup.kind === 'credit') {
    halo.addColorStop(0, 'rgba(255,200,90,.5)'); halo.addColorStop(1, 'rgba(255,200,90,0)');
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(0, 0, 30, 0, TAU); ctx.fill();
    const spin = Math.abs(Math.cos(pickup.spin));
    ctx.save(); ctx.scale(.25 + spin * .75, 1);
    ctx.shadowColor = '#ffcc71'; ctx.shadowBlur = 18;
    const coin = ctx.createLinearGradient(-15, -15, 15, 15);
    coin.addColorStop(0, '#fff3c4'); coin.addColorStop(.45, '#ffd166'); coin.addColorStop(1, '#c98a26');
    ctx.fillStyle = coin; ctx.beginPath(); ctx.arc(0,0,15,0,TAU); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(140,86,20,.85)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0,0,10,0,TAU); ctx.stroke();
    ctx.fillStyle = '#7d4d13'; ctx.font = 'bold 14px "Russo One", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('◈', 0, 1);
    ctx.restore();
    if (spin > .92) {
      ctx.strokeStyle = `rgba(255,255,255,${((spin - .92) * 8).toFixed(2)})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(16, 0); ctx.stroke();
    }
  } else {
    halo.addColorStop(0, 'rgba(140,232,255,.5)'); halo.addColorStop(1, 'rgba(140,232,255,0)');
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(0, 0, 30, 0, TAU); ctx.fill();
    ctx.save(); ctx.rotate(pickup.spin * .8);
    ctx.shadowColor = '#90e8ff'; ctx.shadowBlur = 18;
    const bolt = ctx.createLinearGradient(-15, -15, 15, 15);
    bolt.addColorStop(0, '#eafcff'); bolt.addColorStop(.5, '#8fdcf5'); bolt.addColorStop(1, '#3d84a8');
    ctx.fillStyle = bolt;
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) { const a = i * TAU / 6 - Math.PI / 2; const r = i === 0 ? 17 : 15; const x = Math.cos(a) * r, y = Math.sin(a) * r; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = '#12455f'; ctx.beginPath(); ctx.arc(0,0,5.5,0,TAU); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

/* ---------- boss ---------- */
function drawBoss(ctx, game) {
  const boss = game.boss;
  const palette = bossPalette(boss.sector);
  const rage = boss.phase === 2;
  const hot = rage ? ['#ffd0a2', '#ff7a4d', '#5c1f33'] : palette;
  const enter = boss.entering > 0 ? 1 - boss.entering / 1.6 : 1;
  const scale = .55 + enter * .45;
  const pulse = 1 + Math.sin(boss.age * (rage ? 5.2 : 2.6)) * (rage ? .07 : .04);
  ctx.save();
  ctx.translate(boss.x, boss.y);
  if (boss.entering > 0) ctx.globalAlpha = Math.min(1, enter * 1.6);
  // Aura.
  const aura = ctx.createRadialGradient(0, 0, boss.radius * .3, 0, 0, boss.radius * (2.1 + Math.sin(boss.age * 3) * .12));
  aura.addColorStop(0, `${rage ? 'rgba(255,110,70,.42)' : 'rgba(120,220,255,.28)'}`);
  aura.addColorStop(.55, `${rage ? 'rgba(220,60,60,.16)' : 'rgba(90,170,255,.12)'}`);
  aura.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = aura;
  ctx.beginPath(); ctx.arc(0, 0, boss.radius * 2.3, 0, TAU); ctx.fill();
  ctx.scale(scale * pulse, scale * pulse);
  // Counter-rotating halo rings with spikes.
  ctx.save();
  ctx.rotate(boss.age * (rage ? .55 : .22));
  ctx.strokeStyle = hot[1]; ctx.lineWidth = 3.4;
  ctx.shadowColor = hot[0]; ctx.shadowBlur = 16;
  ctx.beginPath(); ctx.arc(0, 0, 74, 0, TAU); ctx.stroke();
  for (let i = 0; i < 12; i += 1) {
    const a = i * TAU / 12;
    ctx.save(); ctx.rotate(a);
    ctx.fillStyle = hot[1];
    ctx.beginPath(); ctx.moveTo(56, -9); ctx.lineTo(96, 0); ctx.lineTo(56, 9); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = hot[0]; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
  ctx.save();
  ctx.rotate(-boss.age * (rage ? .85 : .38));
  ctx.strokeStyle = `${rage ? 'rgba(255,190,150,.75)' : 'rgba(190,245,255,.6)'}`;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, 58, 0, TAU); ctx.stroke();
  for (let i = 0; i < 8; i += 1) {
    const a = i * TAU / 8;
    ctx.save(); ctx.rotate(a); ctx.translate(58, 0);
    ctx.fillStyle = rage ? '#ffb08a' : '#a9f4ff';
    ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(9, 0); ctx.lineTo(0, 5); ctx.lineTo(-9, 0); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
  // Armored core with claws.
  ctx.shadowColor = rage ? 'rgba(255,90,60,.8)' : 'rgba(120,220,255,.5)'; ctx.shadowBlur = 30;
  const armor = ctx.createLinearGradient(-78, -56, 66, 60);
  armor.addColorStop(0, hot[0]); armor.addColorStop(.34, hot[1]); armor.addColorStop(1, hot[2]);
  ctx.fillStyle = armor; ctx.strokeStyle = hot[0]; ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.moveTo(-86, 0); ctx.lineTo(-56, -42); ctx.lineTo(-16, -60); ctx.lineTo(38, -52); ctx.lineTo(74, -28);
  ctx.lineTo(74, 28); ctx.lineTo(38, 52); ctx.lineTo(-16, 60); ctx.lineTo(-56, 42);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0;
  // Front claws reaching toward the player.
  ctx.fillStyle = hot[2]; ctx.strokeStyle = hot[1]; ctx.lineWidth = 2;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(-58, side * 20);
    ctx.quadraticCurveTo(-92, side * 34, -104, side * 10);
    ctx.quadraticCurveTo(-88, side * 24, -66, side * 12);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  // Armor plates and cracks that grow as health drops.
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-86, 0); ctx.lineTo(-56, -42); ctx.lineTo(-16, -60); ctx.lineTo(38, -52); ctx.lineTo(74, -28);
  ctx.lineTo(74, 28); ctx.lineTo(38, 52); ctx.lineTo(-16, 60); ctx.lineTo(-56, 42);
  ctx.closePath(); ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,.16)'; ctx.lineWidth = 2;
  for (let i = -2; i <= 2; i += 1) {
    ctx.beginPath(); ctx.moveTo(-70, i * 22); ctx.lineTo(60, i * 22 - 6); ctx.stroke();
  }
  const damage = 1 - boss.health / boss.maxHealth;
  if (damage > .12) {
    ctx.strokeStyle = rage ? `rgba(255,${160 + Math.sin(boss.age * 9) * 60},90,.9)` : 'rgba(255,140,110,.7)';
    ctx.lineWidth = 2.4;
    const cracks = Math.min(6, Math.floor(damage * 8));
    for (let i = 0; i < cracks; i += 1) {
      const a = (i / 6) * TAU + .4;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * 12, Math.sin(a) * 12);
      let x = Math.cos(a) * 12, y = Math.sin(a) * 12;
      for (let step = 0; step < 3; step += 1) {
        x += Math.cos(a + Math.sin(i * 3.1 + step) * .8) * 20;
        y += Math.sin(a + Math.cos(i * 2.3 + step) * .8) * 20;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.fillStyle = rage ? 'rgba(255,120,60,.35)' : 'rgba(255,90,60,.22)';
    ctx.beginPath(); ctx.arc(0, 0, 30 * damage, 0, TAU); ctx.fill();
  }
  ctx.restore();
  // The eye follows the player.
  const dx = game.player.x - boss.x, dy = game.player.y - boss.y;
  const distance = Math.hypot(dx, dy) || 1;
  const eye = Math.min(1, 26 / distance);
  ctx.shadowColor = rage ? '#ff5a3c' : '#7ff0ff'; ctx.shadowBlur = 26;
  ctx.fillStyle = hot[2];
  ctx.beginPath(); ctx.ellipse(-6, 0, 40, 30, 0, 0, TAU); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = hot[0]; ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.ellipse(-6, 0, 31, 22, 0, 0, TAU); ctx.stroke();
  const iris = ctx.createRadialGradient(-6 + dx / distance * 10 * eye, dy / distance * 8 * eye, 1, -6, 0, 16);
  iris.addColorStop(0, rage ? '#fff3c0' : '#ffffff');
  iris.addColorStop(.45, rage ? '#ff8a4a' : hot[0]);
  iris.addColorStop(1, rage ? '#8c1f18' : '#123a52');
  ctx.fillStyle = boss.hitFlash > 0 ? '#ffffff' : iris;
  ctx.shadowColor = rage ? '#ff7a3c' : hot[0]; ctx.shadowBlur = 24;
  ctx.beginPath(); ctx.ellipse(-6 + dx / distance * 10 * eye, dy / distance * 8 * eye, 15, 13, 0, 0, TAU); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#12060a';
  const slit = rage ? 5.5 : 8;
  ctx.beginPath(); ctx.ellipse(-6 + dx / distance * 12 * eye, dy / distance * 9 * eye, 4.6, slit, 0, 0, TAU); ctx.fill();
  ctx.restore();
}

function drawDebris(ctx, game) {
  for (const piece of game.debris) {
    const fade = Math.max(0, Math.min(1, piece.life / piece.maxLife));
    ctx.save();
    ctx.translate(piece.x, piece.y);
    ctx.rotate(piece.rotation);
    ctx.globalAlpha = fade;
    ctx.shadowColor = piece.color; ctx.shadowBlur = 14 * fade;
    ctx.fillStyle = piece.color;
    ctx.beginPath();
    if (piece.shape === 0) {
      ctx.moveTo(-piece.size, -piece.size * .6); ctx.lineTo(piece.size * .8, -piece.size); ctx.lineTo(piece.size, piece.size * .7); ctx.lineTo(-piece.size * .6, piece.size * .5);
    } else if (piece.shape === 1) {
      ctx.moveTo(0, -piece.size); ctx.lineTo(piece.size * .9, piece.size * .6); ctx.lineTo(-piece.size * .9, piece.size * .6);
    } else {
      ctx.moveTo(-piece.size * .8, 0); ctx.lineTo(0, -piece.size * .9); ctx.lineTo(piece.size * .8, 0); ctx.lineTo(0, piece.size * .9);
    }
    ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = `rgba(255,236,196,${(.35 * fade).toFixed(2)})`; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

/* ---------- ship ---------- */
function drawShip(ctx, game) {
  const player = game.player;
  const time = game.elapsed;
  const skin = SKINS.find((item) => item.id === game.skin) || SKINS[0];
  ctx.save();
  ctx.translate(player.x, player.y + Math.sin(time * 5) * 1.4);
  ctx.rotate(Math.max(-.18, Math.min(.18, (player.targetY - player.y) * .0022)));
  if (player.invulnerable > 0 && Math.floor(player.invulnerable * 12) % 2 === 0) ctx.globalAlpha = .6;
  // Engine flame with a hot core.
  const flameLength = 54 + Math.sin(time * 28) * 10;
  const flame = ctx.createLinearGradient(-26, 0, -flameLength - 34, 0);
  flame.addColorStop(0, 'rgba(255,255,255,1)'); flame.addColorStop(.18, 'rgba(160,255,252,.95)');
  flame.addColorStop(.5, 'rgba(60,205,255,.55)'); flame.addColorStop(1, 'rgba(45,120,255,0)');
  ctx.fillStyle = flame; ctx.shadowColor = '#6ffbff'; ctx.shadowBlur = 20;
  ctx.beginPath(); ctx.moveTo(-24,-9); ctx.quadraticCurveTo(-46,-13,-flameLength-34,0); ctx.quadraticCurveTo(-46,13,-24,9); ctx.closePath(); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,.9)';
  ctx.beginPath(); ctx.moveTo(-25,-4); ctx.quadraticCurveTo(-40,-5,-flameLength*.55,0); ctx.quadraticCurveTo(-40,5,-25,4); ctx.closePath(); ctx.fill();
  // Wings.
  const fin = ctx.createLinearGradient(0,-28,0,28);
  fin.addColorStop(0, skin.light); fin.addColorStop(.5, skin.fin); fin.addColorStop(1, '#443a63');
  ctx.fillStyle = fin; ctx.strokeStyle = skin.light; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(-13,-10); ctx.lineTo(-23,-27); ctx.quadraticCurveTo(-25,-32,-17,-29); ctx.lineTo(12,-14);
  ctx.lineTo(13,14); ctx.lineTo(-17,29); ctx.quadraticCurveTo(-25,32,-23,27); ctx.lineTo(-13,10); ctx.closePath(); ctx.fill(); ctx.stroke();
  // Engine block.
  ctx.fillStyle = '#465575'; ctx.strokeStyle = '#a7e4ed'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-30,-12); ctx.lineTo(-25,-12); ctx.quadraticCurveTo(-21,-12,-21,-8); ctx.lineTo(-21,8); ctx.quadraticCurveTo(-21,12,-25,12); ctx.lineTo(-30,12); ctx.quadraticCurveTo(-34,12,-34,8); ctx.lineTo(-34,-8); ctx.quadraticCurveTo(-34,-12,-30,-12); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(120,240,255,.75)'; ctx.beginPath(); ctx.ellipse(-32,0,3,7,0,0,TAU); ctx.fill();
  // Hull.
  const body = ctx.createLinearGradient(0,-18,0,19);
  body.addColorStop(0, skin.hull); body.addColorStop(.42, '#f2fbfb'); body.addColorStop(.78, '#a8becf'); body.addColorStop(1, '#71879b');
  ctx.fillStyle = body; ctx.strokeStyle = '#ddf8f4'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(-28,-13); ctx.quadraticCurveTo(-1,-18,14,-13); ctx.quadraticCurveTo(29,-11,41,0); ctx.quadraticCurveTo(29,11,14,13); ctx.quadraticCurveTo(-1,18,-28,13); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = skin.fin; ctx.beginPath(); ctx.moveTo(26,-8); ctx.quadraticCurveTo(36,-5,41,0); ctx.quadraticCurveTo(36,5,26,8); ctx.quadraticCurveTo(28,0,26,-8); ctx.fill();
  // Cockpit.
  const glass = ctx.createLinearGradient(-6,-11,12,9);
  glass.addColorStop(0, '#8be9f5'); glass.addColorStop(.32, skin.glass); glass.addColorStop(1, '#0b1730');
  ctx.fillStyle = glass; ctx.strokeStyle = '#a9e2ea'; ctx.lineWidth = 1.1;
  ctx.beginPath(); ctx.ellipse(1,0,14,8,0,0,TAU); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.arc(-1,-2.5,5.5,Math.PI*1.08,Math.PI*1.68); ctx.stroke();
  ctx.fillStyle = skin.fin; ctx.fillRect(-23,-10,8,2.4); ctx.fillRect(-23,7.6,8,2.4);
  // Damage smoke on the last hull point.
  if (player.health === 1) {
    ctx.fillStyle = `rgba(120,120,140,${.25 + Math.sin(time * 9) * .12})`;
    for (let i = 0; i < 3; i += 1) {
      const t = (time * 1.6 + i * .33) % 1;
      ctx.beginPath(); ctx.arc(-14 - t * 34, Math.sin(time * 6 + i) * 5, 3 + t * 9, 0, TAU); ctx.fill();
    }
  }
  ctx.restore();
  // Shield bubble while protected.
  if (player.invulnerable > 0) {
    ctx.save();
    ctx.translate(player.x, player.y);
    const strength = Math.min(1, player.invulnerable);
    ctx.strokeStyle = `rgba(150,250,255,${(.35 * strength).toFixed(2)})`;
    ctx.lineWidth = 2;
    ctx.shadowColor = '#7ff0ff'; ctx.shadowBlur = 16;
    ctx.beginPath(); ctx.arc(0, 0, 34 + Math.sin(time * 12) * 2, 0, TAU); ctx.stroke();
    ctx.globalAlpha = .5 * strength;
    for (let i = 0; i < 6; i += 1) {
      const a = i * TAU / 6 + time * .8;
      ctx.beginPath(); ctx.arc(Math.cos(a) * 34, Math.sin(a) * 34, 2.4, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
}

/* ---------- main entry ---------- */
export function renderGame(ctx, game, image) {
  const w = game.width;
  const h = WORLD_HEIGHT;
  ctx.clearRect(0, 0, w, h);
  const shake = game.shake;
  ctx.save();
  if (shake > 0) {
    const amount = shake * shake * 9;
    ctx.translate(Math.sin(game.elapsed * 97) * amount, Math.cos(game.elapsed * 83) * amount);
  }
  drawBackdrop(ctx, game, image);
  for (const ring of game.rings) {
    const progress = Math.min(1, ring.age / ring.duration);
    ctx.strokeStyle = `rgba(${ring.color},${((1 - progress) * .8).toFixed(3)})`;
    ctx.lineWidth = 2 + (1 - progress) * 5;
    ctx.beginPath(); ctx.arc(ring.x, ring.y, ring.maxRadius * progress, 0, TAU); ctx.stroke();
    if (ring.maxRadius > 140) {
      ctx.strokeStyle = `rgba(${ring.color},${((1 - progress) * .3).toFixed(3)})`;
      ctx.lineWidth = 1 + (1 - progress) * 2;
      ctx.beginPath(); ctx.arc(ring.x, ring.y, ring.maxRadius * progress * .7, 0, TAU); ctx.stroke();
    }
  }
  for (const pickup of game.pickups) if (!pickup.removed) drawPickup(ctx, pickup);
  for (const rock of game.rocks) if (!rock.removed) drawRock(ctx, rock, game.elapsed);
  for (const drone of game.drones) if (!drone.removed) drawDrone(ctx, drone, game.elapsed);
  if (game.boss) drawBoss(ctx, game);
  drawDebris(ctx, game);
  const shotGlow = glowSprite('rgba(150,245,255,.9)', 20, .4);
  const hostileGlow = [glowSprite('rgba(255,140,190,.9)', 20, .4), glowSprite('rgba(200,230,255,.9)', 20, .4), glowSprite('rgba(255,160,100,.9)', 20, .4)];
  for (const bullet of game.bullets) {
    if (bullet.removed) continue;
    blit(ctx, shotGlow, bullet.x - 12, bullet.y, 22, .75);
    ctx.fillStyle = 'rgba(190,255,250,.75)';
    ctx.fillRect(bullet.x - 34, bullet.y - 1.4, 36, 2.8);
    ctx.fillStyle = '#e8ffff';
    ctx.beginPath(); ctx.ellipse(bullet.x, bullet.y, 9, 3, 0, 0, TAU); ctx.fill();
  }
  for (const bullet of game.hostileBullets) {
    if (bullet.removed) continue;
    blit(ctx, hostileGlow[bullet.sector ?? 0], bullet.x, bullet.y, bullet.radius * 2.8, .9);
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(bullet.x, bullet.y, bullet.radius * .55, 0, TAU); ctx.fill();
  }
  if (!game.gameOver || game.victory) drawShip(ctx, game);
  for (const particle of game.particles) {
    ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
    ctx.fillStyle = particle.color;
    ctx.beginPath(); ctx.arc(particle.x, particle.y, particle.radius, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  drawVignette(ctx, game);
  if (game.flash > 0) {
    ctx.fillStyle = `rgba(255,246,225,${Math.min(.75, game.flash * .5).toFixed(3)})`;
    ctx.fillRect(0, 0, w, h);
  }
}
