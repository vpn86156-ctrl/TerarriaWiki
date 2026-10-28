import '@fontsource/manrope/cyrillic-400.css';
import '@fontsource/manrope/latin-400.css';
import '@fontsource/manrope/cyrillic-500.css';
import '@fontsource/manrope/latin-500.css';
import '@fontsource/manrope/cyrillic-700.css';
import '@fontsource/manrope/latin-700.css';
import '@fontsource/manrope/cyrillic-800.css';
import '@fontsource/manrope/latin-800.css';
import '@fontsource/russo-one/cyrillic-400.css';
import '@fontsource/russo-one/latin-400.css';
import './style.css';
import { createGame, resizeGame, setTarget, updateGame, useWave, WORLD_HEIGHT, MAX_HEALTH, WAVE_COOLDOWN } from './engine.js';
import { renderGame } from './render.js';
import { GameAudio } from './audio.js';

const $ = (id) => document.getElementById(id);
const canvas = $('game-canvas');
const ctx = canvas.getContext('2d', { alpha: false });
const screens = {
  home: $('home-screen'), hud: $('game-hud'), tutorial: $('tutorial-overlay'),
  pause: $('pause-overlay'), result: $('result-overlay'),
};
const background = new Image();
background.src = `${import.meta.env.BASE_URL}images/space-background.webp`;
const STORAGE_KEY = 'kosmopilot.v1';
const initial = { best: 0, sound: true, tutorialSeen: false };
let settings;
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  settings = { best: Number.isFinite(saved.best) ? Math.max(0, Math.floor(saved.best)) : 0, sound: saved.sound !== false, tutorialSeen: saved.tutorialSeen === true };
} catch { settings = { ...initial }; }
const save = () => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch { /* Private mode or storage unavailable: the game still works. */ } };
const audio = new GameAudio(settings.sound);
const number = new Intl.NumberFormat('ru-RU');
const sounds = [...document.querySelectorAll('.sound-button')];
let mode = 'home';
let game = null;
let frame = 0;
let lastTime = 0;
let viewportWidth = 0;
let viewportHeight = 0;
let pixelRatio = 1;
let worldScale = 1;
let dragging = null;
const keys = new Set();
const portraitQuery = window.matchMedia('(orientation: portrait)');
const isPortrait = () => portraitQuery.matches;

function soundUI() {
  for (const button of sounds) {
    button.dataset.muted = String(!settings.sound);
    button.setAttribute('aria-label', settings.sound ? 'Выключить звук' : 'Включить звук');
    button.setAttribute('aria-pressed', String(settings.sound));
  }
}
function showMode(next) {
  mode = next;
  screens.home.hidden = !['home', 'tutorial'].includes(mode);
  screens.hud.hidden = !['playing', 'pause', 'result'].includes(mode);
  screens.tutorial.hidden = mode !== 'tutorial';
  screens.pause.hidden = mode !== 'pause';
  screens.result.hidden = mode !== 'result';
  if (mode === 'home') $('home-best').textContent = number.format(settings.best);
}
function resize() {
  const rect = canvas.getBoundingClientRect();
  viewportWidth = rect.width || window.innerWidth;
  viewportHeight = rect.height || window.innerHeight;
  pixelRatio = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  canvas.width = Math.max(1, Math.round(viewportWidth * pixelRatio));
  canvas.height = Math.max(1, Math.round(viewportHeight * pixelRatio));
  worldScale = viewportHeight / WORLD_HEIGHT;
  ctx.setTransform(worldScale * pixelRatio, 0, 0, worldScale * pixelRatio, 0, 0);
  if (game) {
    resizeGame(game, viewportWidth / worldScale);
    renderGame(ctx, game, background);
  }
  if (isPortrait() && mode === 'playing') pauseGame();
}
function updateHUD() {
  if (!game) return;
  $('score-value').textContent = number.format(game.score);
  $('stars-value').textContent = number.format(game.stars);
  const health = $('health-indicator');
  health.setAttribute('aria-label', `Корпус: ${game.player.health} из ${MAX_HEALTH}`);
  [...health.children].forEach((pip, index) => pip.classList.toggle('empty', index >= game.player.health));
  const ready = game.waveCooldown <= 0;
  const remaining = Math.ceil(game.waveCooldown);
  const pulse = $('pulse-button');
  pulse.disabled = !ready;
  pulse.style.setProperty('--progress', `${Math.round((1 - game.waveCooldown / WAVE_COOLDOWN) * 100)}%`);
  pulse.setAttribute('aria-label', ready ? 'Волна готова' : `Волна: осталось ${remaining} сек.`);
  $('pulse-label').textContent = ready ? 'ГОТОВА' : `${remaining} СЕК`;
  $('first-flight-tip').classList.toggle('fade', game.elapsed > 6 || dragging !== null);
  $('control-hint').classList.toggle('dimmed', game.elapsed > 10 || dragging !== null);
}
function startGame() {
  if (isPortrait()) return;
  settings.tutorialSeen = true; save(); audio.unlock();
  keys.clear(); dragging = null;
  game = createGame({ width: viewportWidth / worldScale });
  showMode('playing'); updateHUD(); renderGame(ctx, game, background);
  lastTime = performance.now(); cancelAnimationFrame(frame); frame = requestAnimationFrame(loop);
}
function keyboardMovement(dt) {
  const horizontal = Number(keys.has('ArrowRight') || keys.has('KeyD')) - Number(keys.has('ArrowLeft') || keys.has('KeyA'));
  const vertical = Number(keys.has('ArrowDown') || keys.has('KeyS')) - Number(keys.has('ArrowUp') || keys.has('KeyW'));
  if (horizontal || vertical) {
    const normal = horizontal && vertical ? Math.SQRT1_2 : 1;
    setTarget(game, game.player.targetX + horizontal * 360 * dt * normal, game.player.targetY + vertical * 360 * dt * normal);
  }
}
function loop(now) {
  if (mode !== 'playing' || !game) return;
  const dt = Math.min(.05, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;
  keyboardMovement(dt);
  const events = updateGame(game, dt);
  for (const event of events) audio.play(event);
  updateHUD(); renderGame(ctx, game, background);
  if (game.gameOver) { finishGame(); return; }
  frame = requestAnimationFrame(loop);
}
function pauseGame() {
  if (mode !== 'playing') return;
  cancelAnimationFrame(frame); keys.clear(); dragging = null; audio.suspend();
  showMode('pause');
}
function resumeGame() {
  if (mode !== 'pause' || isPortrait()) return;
  audio.unlock(); showMode('playing'); lastTime = performance.now(); frame = requestAnimationFrame(loop);
}
function finishGame() {
  if (!game) return;
  cancelAnimationFrame(frame); keys.clear(); dragging = null; audio.suspend();
  const newRecord = game.score > settings.best;
  if (newRecord) { settings.best = game.score; save(); }
  $('result-score').textContent = number.format(game.score);
  $('result-distance').textContent = `${number.format(Math.floor(game.distance))} м`;
  $('result-stars').textContent = number.format(game.stars);
  $('result-best').textContent = number.format(settings.best);
  $('new-record').hidden = !newRecord;
  updateHUD(); showMode('result');
}
function returnHome() {
  cancelAnimationFrame(frame); keys.clear(); dragging = null; game = null; audio.suspend(); showMode('home');
}
function activateWave() {
  if (mode !== 'playing' || !game) return;
  if (useWave(game)) { audio.play('wave'); updateHUD(); renderGame(ctx, game, background); }
}

$('start-button').addEventListener('click', () => { if (settings.tutorialSeen) startGame(); else showMode('tutorial'); });
$('help-button').addEventListener('click', () => showMode('tutorial'));
$('tutorial-close').addEventListener('click', () => showMode('home'));
$('tutorial-start').addEventListener('click', startGame);
$('pause-button').addEventListener('click', pauseGame);
$('resume-button').addEventListener('click', resumeGame);
$('end-button').addEventListener('click', finishGame);
$('retry-button').addEventListener('click', startGame);
$('menu-button').addEventListener('click', returnHome);
// Mobile browsers do not always synthesize a click for a second finger. Activate
// on touch/pen down; the click handler remains for mouse, keyboard and accessibility.
$('pulse-button').addEventListener('pointerdown', (event) => {
  if (event.pointerType !== 'mouse') { event.preventDefault(); activateWave(); }
});
$('pulse-button').addEventListener('click', activateWave);
for (const button of sounds) button.addEventListener('click', () => { settings.sound = !settings.sound; audio.setEnabled(settings.sound); save(); soundUI(); });

canvas.addEventListener('pointerdown', (event) => {
  if (mode !== 'playing' || dragging || event.clientX > viewportWidth * .72) return;
  event.preventDefault();
  dragging = { id: event.pointerId, x: event.clientX, y: event.clientY, targetX: game.player.targetX, targetY: game.player.targetY };
  try { canvas.setPointerCapture(event.pointerId); } catch { /* The drag still works within the canvas. */ }
  updateHUD();
});
canvas.addEventListener('pointermove', (event) => {
  if (mode !== 'playing' || !dragging || event.pointerId !== dragging.id) return;
  event.preventDefault();
  setTarget(game, dragging.targetX + (event.clientX - dragging.x) / worldScale, dragging.targetY + (event.clientY - dragging.y) / worldScale);
});
function stopDragging(event) {
  if (!dragging || event.pointerId !== dragging.id) return;
  dragging = null;
  try { if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId); } catch { /* Already released. */ }
}
canvas.addEventListener('pointerup', stopDragging);
canvas.addEventListener('pointercancel', stopDragging);
canvas.addEventListener('lostpointercapture', stopDragging);
window.addEventListener('keydown', (event) => {
  if (event.code === 'Escape' || event.code === 'Backspace') { if (!event.repeat) window.__cosmoBack(); event.preventDefault(); return; }
  if (mode !== 'playing') return;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(event.code)) { keys.add(event.code); event.preventDefault(); }
  if (event.code === 'Space') { if (!event.repeat) activateWave(); event.preventDefault(); }
});
window.addEventListener('keyup', (event) => keys.delete(event.code));
window.addEventListener('resize', resize);
portraitQuery.addEventListener('change', (event) => { if (event.matches && mode === 'playing') pauseGame(); });
window.addEventListener('blur', () => { if (mode === 'playing') pauseGame(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'playing') pauseGame(); });
window.addEventListener('cosmopilot:background', () => { if (mode === 'playing') pauseGame(); else audio.suspend(); });
window.__cosmoBack = () => {
  if (mode === 'playing') { pauseGame(); return true; }
  if (mode === 'pause') { resumeGame(); return true; }
  if (mode === 'tutorial') { showMode('home'); return true; }
  if (mode === 'result') { returnHome(); return true; }
  return false;
};
background.addEventListener('load', () => { if (game) renderGame(ctx, game, background); });
soundUI(); showMode('home'); resize();
