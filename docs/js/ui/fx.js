/* Эффекты: пепел, числа урона, вспышки, тосты, тряска. */
import { rnd, rndi } from '../core/rng.js';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- пепел на фоне ---------- */
let ash = null;
export function initAsh(){
  const cv = document.getElementById('ash-canvas');
  if(!cv || reduceMotion) return;
  const ctx = cv.getContext('2d');
  let w = 0, h = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
  const count = window.innerWidth < 700 ? 26 : 58;
  const parts = [];

  function resize(){
    w = cv.clientWidth; h = cv.clientHeight;
    cv.width = Math.floor(w * dpr); cv.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  for(let i = 0; i < count; i++){
    parts.push({ x: rnd(0, w), y: rnd(0, h), r: rnd(0.6, 2.1), vy: rnd(4, 16), vx: rnd(-6, 6), a: rnd(0.12, 0.5), p: rnd(0, 6.28) });
  }

  let last = performance.now();
  function frame(now){
    const dt = Math.min((now - last) / 1000, 0.05); last = now;
    ctx.clearRect(0, 0, w, h);
    for(const p of parts){
      p.y += p.vy * dt;
      p.x += (p.vx + Math.sin(now / 1400 + p.p) * 8) * dt;
      if(p.y > h + 6){ p.y = -6; p.x = rnd(0, w); }
      if(p.x < -8) p.x = w + 8;
      if(p.x > w + 8) p.x = -8;
      ctx.beginPath();
      ctx.fillStyle = `rgba(214,206,190,${p.a})`;
      ctx.arc(p.x, p.y, p.r, 0, 6.2832);
      ctx.fill();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  ash = { ctx, parts };
}

/* ---------- число урона ---------- */
export function damageNumber(x, y, dmg, isCrit){
  const layer = document.getElementById('fx-layer');
  if(!layer) return;
  const el = document.createElement('div');
  el.className = 'dmg ' + (isCrit ? 'crit' : 'norm');
  el.textContent = (isCrit ? '✦ ' : '') + dmg.toLocaleString('ru-RU');
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  layer.appendChild(el);
  setTimeout(() => el.remove(), reduceMotion ? 200 : 1100);

  if(isCrit){
    const ring = document.createElement('div');
    ring.className = 'crit-ring';
    ring.style.left = x + 'px';
    ring.style.top = y + 'px';
    layer.appendChild(ring);
    setTimeout(() => ring.remove(), 600);
  }
}

/** Случайная точка внутри прямоугольника портрета босса. */
export function hitPoint(el){
  if(!el) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width * rnd(0.32, 0.68), y: r.top + r.height * rnd(0.24, 0.6) };
}

/* ---------- тряска ---------- */
export function shake(el, power = 8){
  if(!el || reduceMotion) return;
  const a = -power, b = power * 0.7, c = -power * 0.4, d = power * 0.2;
  el.animate([
    { transform: 'translate(0px, 0px)' },
    { transform: 'translate(' + a + 'px, ' + (power * 0.5) + 'px)' },
    { transform: 'translate(' + b + 'px, ' + c + 'px)' },
    { transform: 'translate(' + (-power * 0.4) + 'px, ' + d + 'px)' },
    { transform: 'translate(0px, 0px)' }
  ], { duration: 240, easing: 'ease-out' });
}

/* ---------- тосты ---------- */
export function toast(text, kind = ''){
  const box = document.getElementById('toasts');
  if(!box) return;
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.innerHTML = text;
  box.appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 320);
  }, 2600);
}

/* ---------- оверлеи ---------- */
export function openOverlay(el, html){
  el.innerHTML = html;
  el.hidden = false;
}
export function closeOverlay(el){
  el.hidden = true;
  el.innerHTML = '';
}

/* ---------- вспышка на портрете ---------- */
export function flash(el){
  if(!el) return;
  let f = el.querySelector('.flash');
  if(!f){
    f = document.createElement('div');
    f.className = 'flash';
    el.appendChild(f);
  }
  f.classList.remove('on');
  void f.offsetWidth;
  f.classList.add('on');
}

/* ---------- частицы разлётающиеся при смерти босса ---------- */
export function burstParticles(x, y, color = '201,164,106', n = 26){
  const layer = document.getElementById('fx-layer');
  if(!layer || reduceMotion) return;
  for(let i = 0; i < n; i++){
    const p = document.createElement('i');
    const size = rnd(3, 8);
    const ang = rnd(0, Math.PI * 2);
    const dist = rnd(40, 180);
    p.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${size}px;height:${size}px;
      border-radius:50%;background:rgba(${color},${rnd(0.5,1)});
      box-shadow:0 0 ${size * 2}px rgba(${color},.8);
      transition:transform .9s cubic-bezier(.2,.7,.3,1), opacity .9s ease-out;
      transform:translate(-50%,-50%) scale(1);opacity:1;`;
    layer.appendChild(p);
    requestAnimationFrame(() => {
      p.style.transform = `translate(${Math.cos(ang) * dist - 50}%, ${Math.sin(ang) * dist - 50}%) scale(0)`;
      p.style.opacity = '0';
    });
    setTimeout(() => p.remove(), 1000);
  }
}
export const motionOff = reduceMotion;
