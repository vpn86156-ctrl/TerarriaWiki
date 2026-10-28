import { WORLD_HEIGHT } from './engine.js';

const TAU = Math.PI * 2;
let seed = 68342;
const seeded = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const stars = Array.from({ length: 95 }, () => ({ x: seeded(), y: seeded(), size: 0.45 + seeded() * 1.55, speed: 10 + seeded() * 35, alpha: 0.2 + seeded() * 0.65, phase: seeded() * TAU }));

function cover(ctx, image, w, h) {
  const scale = Math.max(w / image.naturalWidth, h / image.naturalHeight);
  const iw = image.naturalWidth * scale;
  const ih = image.naturalHeight * scale;
  ctx.drawImage(image, (w - iw) / 2, (h - ih) / 2, iw, ih);
}

function drawSpace(ctx, game, image) {
  const w = game.width;
  const h = WORLD_HEIGHT;
  if (image?.complete && image.naturalWidth) cover(ctx, image, w, h);
  else {
    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, '#091427'); bg.addColorStop(0.6, '#080c24'); bg.addColorStop(1, '#1a1035');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  }
  ctx.fillStyle = 'rgba(3,7,24,.12)'; ctx.fillRect(0, 0, w, h);
  for (const star of stars) {
    const x = ((star.x * (w + 60) - game.elapsed * star.speed) % (w + 60) + (w + 60)) % (w + 60) - 30;
    const y = star.y * h;
    const shimmer = 0.7 + Math.sin(game.elapsed * 1.5 + star.phase) * 0.3;
    ctx.globalAlpha = star.alpha * shimmer;
    ctx.fillStyle = star.size > 1.4 ? '#abfff5' : '#dde8ff';
    ctx.beginPath(); ctx.arc(x, y, star.size, 0, TAU); ctx.fill();
    if (star.size > 1.5) { ctx.fillRect(x - star.size * 3, y - 0.35, star.size * 6, .7); }
  }
  ctx.globalAlpha = 1;
}

function drawRock(ctx, rock) {
  ctx.save();
  ctx.translate(rock.x, rock.y);
  ctx.rotate(rock.rotation);
  const r = rock.radius;
  const outline = () => {
    ctx.beginPath();
    for (let i = 0; i < 12; i += 1) {
      const a = i / 12 * TAU;
      const variance = 0.84 + (Math.sin(rock.shape * 1.2 + i * 28.13) + 1) * 0.08;
      const x = Math.cos(a) * r * variance;
      const y = Math.sin(a) * r * variance;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  };
  ctx.shadowColor = 'rgba(245,125,120,.18)'; ctx.shadowBlur = 12;
  const fill = ctx.createRadialGradient(-r * .38, -r * .43, 1, 0, 0, r * 1.1);
  fill.addColorStop(0, '#d2a38e'); fill.addColorStop(.4, '#9c6f79'); fill.addColorStop(.75, '#624b67'); fill.addColorStop(1, '#33334e');
  ctx.fillStyle = fill; outline(); ctx.fill(); ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(245,190,170,.48)'; ctx.lineWidth = 1.3; ctx.stroke();
  ctx.save(); outline(); ctx.clip();
  ctx.strokeStyle = 'rgba(57,37,58,.35)'; ctx.lineWidth = Math.max(1, r * .045);
  ctx.fillStyle = 'rgba(33,30,49,.26)';
  for (let i = 0; i < 4; i += 1) {
    const ox = Math.sin(rock.shape + i * 11.7) * r * .55;
    const oy = Math.cos(rock.shape * .7 + i * 8.9) * r * .5;
    const cr = r * (.1 + (i % 2) * .045);
    ctx.beginPath(); ctx.ellipse(ox, oy, cr * 1.4, cr, .45, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,216,183,.3)'; ctx.beginPath(); ctx.arc(ox, oy, cr * 1.2, Math.PI * 1.05, Math.PI * 1.62); ctx.stroke();
    ctx.strokeStyle = 'rgba(57,37,58,.35)';
  }
  ctx.restore(); ctx.restore();
}

function drawDrone(ctx, drone, time) {
  ctx.save(); ctx.translate(drone.x, drone.y); ctx.rotate(Math.sin(time * 2 + drone.phase) * .08);
  ctx.shadowBlur = 18; ctx.shadowColor = 'rgba(231,126,255,.35)';
  const hull = ctx.createLinearGradient(0, -20, 0, 20);
  hull.addColorStop(0, '#f3c3de'); hull.addColorStop(.4, '#9d75a5'); hull.addColorStop(1, '#473e69');
  ctx.fillStyle = hull; ctx.strokeStyle = '#f0a9bf'; ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.moveTo(-26, 0); ctx.quadraticCurveTo(-17,-12,-6,-13); ctx.quadraticCurveTo(0,-25,10,-12); ctx.quadraticCurveTo(22,-9,27,0); ctx.quadraticCurveTo(12,14,-13,11); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#263a64'; ctx.beginPath(); ctx.ellipse(4,-10,10,7,0,Math.PI,TAU); ctx.fill();
  ctx.strokeStyle = '#e3a1d0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-20,1); ctx.quadraticCurveTo(0,8,21,1); ctx.stroke();
  ctx.fillStyle = '#ffcc9b'; for (const x of [-13,0,13]) { ctx.beginPath(); ctx.arc(x, 4, 1.7, 0, TAU); ctx.fill(); }
  ctx.restore();
}

function drawPickup(ctx, pickup) {
  ctx.save(); ctx.translate(pickup.x, pickup.y); const pulse = 1 + Math.sin(pickup.phase) * .1; ctx.scale(pulse, pulse);
  if (pickup.kind === 'star') {
    ctx.shadowColor = '#ffcd68'; ctx.shadowBlur = 20; ctx.fillStyle = '#ffe6a1';
    ctx.beginPath(); ctx.moveTo(0,-19); ctx.quadraticCurveTo(3,-5,14,0); ctx.quadraticCurveTo(3,5,0,19); ctx.quadraticCurveTo(-3,5,-14,0); ctx.quadraticCurveTo(-3,-5,0,-19); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = '#fff8d8'; ctx.beginPath(); ctx.arc(0,0,3,0,TAU); ctx.fill();
  } else {
    ctx.shadowColor = '#89ffd2'; ctx.shadowBlur = 18; ctx.fillStyle = '#b0ffd8'; ctx.beginPath(); ctx.arc(0,0,15,0,TAU); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = '#17483f'; ctx.fillRect(-3,-9,6,18); ctx.fillRect(-9,-3,18,6);
  }
  ctx.restore();
}

function drawShip(ctx, player, time) {
  ctx.save();
  ctx.translate(player.x, player.y + Math.sin(time * 5) * 1.3);
  ctx.rotate(Math.max(-.15, Math.min(.15, (player.targetY - player.y) * .002)));
  if (player.invulnerable > 0 && Math.floor(player.invulnerable * 10) % 2 === 0) ctx.globalAlpha = .55;
  // Engine glow and tapered exhaust.
  const flameLength = 50 + Math.sin(time * 27) * 8;
  const flame = ctx.createLinearGradient(-27,0,-flameLength - 30,0);
  flame.addColorStop(0, 'rgba(224,255,255,1)'); flame.addColorStop(.22, 'rgba(106,255,250,.95)'); flame.addColorStop(.6, 'rgba(39,197,255,.45)'); flame.addColorStop(1, 'rgba(45,130,255,0)');
  ctx.fillStyle = flame; ctx.shadowColor = '#65f8ff'; ctx.shadowBlur = 15;
  ctx.beginPath(); ctx.moveTo(-23,-8); ctx.quadraticCurveTo(-43,-12,-flameLength-30,0); ctx.quadraticCurveTo(-43,12,-23,8); ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
  // Fins behind the hull.
  const fin = ctx.createLinearGradient(0,-26,0,26); fin.addColorStop(0,'#ffbe9c'); fin.addColorStop(.5,'#f47b6f'); fin.addColorStop(1,'#b95870');
  ctx.fillStyle = fin; ctx.strokeStyle = '#ffc6a8'; ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.moveTo(-13,-10); ctx.lineTo(-21,-25); ctx.quadraticCurveTo(-22,-29,-16,-27); ctx.lineTo(11,-13); ctx.lineTo(12,13); ctx.lineTo(-16,27); ctx.quadraticCurveTo(-22,29,-21,25); ctx.lineTo(-13,10); ctx.closePath(); ctx.fill(); ctx.stroke();
  // Engine ring and main fuselage.
  ctx.fillStyle = '#465575'; ctx.strokeStyle = '#a7e4ed'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-29,-12); ctx.lineTo(-25,-12); ctx.quadraticCurveTo(-21,-12,-21,-8); ctx.lineTo(-21,8); ctx.quadraticCurveTo(-21,12,-25,12); ctx.lineTo(-29,12); ctx.quadraticCurveTo(-33,12,-33,8); ctx.lineTo(-33,-8); ctx.quadraticCurveTo(-33,-12,-29,-12); ctx.closePath(); ctx.fill(); ctx.stroke();
  const body = ctx.createLinearGradient(0,-17,0,18); body.addColorStop(0,'#fff4eb'); body.addColorStop(.43,'#e9f7f7'); body.addColorStop(.8,'#a5bacb'); body.addColorStop(1,'#778b9e');
  ctx.fillStyle = body; ctx.strokeStyle = '#d6f5f2'; ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.moveTo(-27,-13); ctx.quadraticCurveTo(-1,-17,13,-13); ctx.quadraticCurveTo(27,-11,39,0); ctx.quadraticCurveTo(27,11,13,13); ctx.quadraticCurveTo(-1,17,-27,13); ctx.closePath(); ctx.fill(); ctx.stroke();
  // Coral nose, dark glass and small ship details.
  ctx.fillStyle = '#f48d76'; ctx.beginPath(); ctx.moveTo(25,-8); ctx.quadraticCurveTo(34,-5,39,0); ctx.quadraticCurveTo(34,5,25,8); ctx.quadraticCurveTo(27,0,25,-8); ctx.fill();
  const glass = ctx.createLinearGradient(-5,-10,11,8); glass.addColorStop(0,'#68d9e8'); glass.addColorStop(.35,'#274b69'); glass.addColorStop(1,'#0d1a36');
  ctx.fillStyle = glass; ctx.strokeStyle = '#9cd7df'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(1,0,13,7.5,0,0,TAU); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(245,255,255,.7)'; ctx.beginPath(); ctx.arc(-1,-2,5,Math.PI*1.1,Math.PI*1.65); ctx.stroke();
  ctx.fillStyle = '#f3907b'; ctx.fillRect(-22,-9,7,2); ctx.fillRect(-22,7,7,2);
  ctx.restore();
}

export function renderGame(ctx, game, image) {
  const w = game.width;
  const h = WORLD_HEIGHT;
  ctx.clearRect(0, 0, w, h);
  drawSpace(ctx, game, image);
  for (const ring of game.rings) {
    const progress = Math.min(1, ring.age / ring.duration);
    ctx.strokeStyle = `rgba(${ring.color},${(1 - progress) * .75})`;
    ctx.lineWidth = 2 + (1 - progress) * 4;
    ctx.beginPath(); ctx.arc(ring.x, ring.y, ring.maxRadius * progress, 0, TAU); ctx.stroke();
  }
  for (const pickup of game.pickups) if (!pickup.removed) drawPickup(ctx, pickup);
  for (const rock of game.rocks) if (!rock.removed) drawRock(ctx, rock);
  for (const drone of game.drones) if (!drone.removed) drawDrone(ctx, drone, game.elapsed);
  ctx.save();
  ctx.shadowColor = '#62f3ff'; ctx.shadowBlur = 12; ctx.fillStyle = '#b7ffff';
  for (const bullet of game.bullets) if (!bullet.removed) { ctx.beginPath(); ctx.ellipse(bullet.x, bullet.y, 10, 2.5, 0, 0, TAU); ctx.fill(); }
  ctx.shadowColor = '#ff917c'; ctx.fillStyle = '#ffc0a1';
  for (const bullet of game.hostileBullets) if (!bullet.removed) { ctx.beginPath(); ctx.arc(bullet.x, bullet.y, bullet.radius, 0, TAU); ctx.fill(); }
  ctx.restore();
  drawShip(ctx, game.player, game.elapsed);
  for (const particle of game.particles) {
    ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
    ctx.fillStyle = particle.color; ctx.beginPath(); ctx.arc(particle.x, particle.y, particle.radius, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
