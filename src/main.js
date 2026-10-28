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
import { createGame, resizeGame, setTarget, updateGame, useWave, WORLD_HEIGHT, SECTOR_FLIGHT_TIME } from './engine.js';
import { CASES, MAX_UPGRADE, MISSIONS, SECTORS, SKINS, UPGRADES } from './content.js';
import { claimMission, exportProgress, importProgress, missionValue, newProgress, normalizeProgress, openCase, purchaseUpgrade, settleFlight, STORAGE_KEY, upgradeCost } from './progress.js';
import { renderGame } from './render.js';
import { GameAudio } from './audio.js';

const $ = (id) => document.getElementById(id);
const canvas = $('game-canvas');
const ctx = canvas.getContext('2d', { alpha: false });
const screens = {
  home: $('home-screen'), hud: $('game-hud'), tutorial: $('tutorial-overlay'),
  pause: $('pause-overlay'), result: $('result-overlay'), flight: $('flight-overlay'),
  hub: $('hub-overlay'), case: $('case-overlay'), import: $('import-overlay'),
};
const images = new Map();
function sectorImage(file) {
  if (!images.has(file)) {
    const image = new Image();
    image.src = `${import.meta.env.BASE_URL}images/${file}`;
    images.set(file, image);
  }
  return images.get(file);
}
let progress;
try { progress = normalizeProgress(JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')); } catch { progress = newProgress(); }
if (progress === null) progress = newProgress();
const save = () => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(progress)); } catch { /* Storage unavailable: the game keeps working for this session. */ } };
const audio = new GameAudio(progress.sound, progress.music);
const number = new Intl.NumberFormat('ru-RU');
const sounds = [...document.querySelectorAll('.sound-button')];
const musicButtons = [...document.querySelectorAll('.music-button')];

let mode = 'home';
let game = null;
let frame = 0;
let lastTime = 0;
let viewportWidth = 0, viewportHeight = 0, pixelRatio = 1, worldScale = 1;
let dragging = null;
let planned = { mode: 'campaign', sectorIndex: 0 };
let hubTab = 'upgrades';
let announcementTimer = 0;
const keys = new Set();
const portraitQuery = window.matchMedia('(orientation: portrait)');
const isPortrait = () => portraitQuery.matches;

function soundUI() {
  for (const button of sounds) {
    button.dataset.muted = String(!progress.sound);
    button.setAttribute('aria-label', progress.sound ? 'Выключить звук' : 'Включить звук');
    button.setAttribute('aria-pressed', String(progress.sound));
  }
  for (const button of musicButtons) {
    button.dataset.muted = String(!progress.music);
    button.setAttribute('aria-label', progress.music ? 'Выключить музыку' : 'Включить музыку');
    button.setAttribute('aria-pressed', String(progress.music));
  }
}
function homeUI() {
  $('home-best').textContent = number.format(progress.best);
  $('home-credits').textContent = number.format(progress.credits);
  $('hub-credits').textContent = number.format(progress.credits);
  $('hub-parts').textContent = number.format(progress.parts);
}
function showMode(next) {
  mode = next;
  screens.home.hidden = !['home', 'tutorial'].includes(mode);
  screens.hud.hidden = !['playing', 'pause', 'result'].includes(mode);
  for (const [key, element] of Object.entries(screens)) {
    if (['home', 'hud'].includes(key)) continue;
    element.hidden = mode !== key;
  }
  if (mode === 'home') { homeUI(); $('hub-message').hidden = true; }
}
function announce(text, duration = 2.4) {
  const element = $('announcement');
  element.textContent = text;
  element.hidden = false;
  element.classList.remove('show');
  void element.offsetWidth;
  element.classList.add('show');
  clearTimeout(announcementTimer);
  announcementTimer = setTimeout(() => { element.classList.remove('show'); element.hidden = true; }, duration * 1000);
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
  if (game) { resizeGame(game, viewportWidth / worldScale); renderGame(ctx, game, sectorImage(SECTORS[game.sectorIndex].image)); }
  if (isPortrait() && mode === 'playing') pauseGame();
}
function updateHUD() {
  if (!game) return;
  const sector = SECTORS[game.sectorIndex];
  $('score-value').textContent = number.format(game.score);
  $('stars-value').textContent = number.format(game.stars);
  $('sector-name').textContent = sector.short;
  const cycle = SECTOR_FLIGHT_TIME + Math.min(game.sectorCycle * 2, 10);
  $('sector-fill').style.width = `${Math.max(0, Math.min(1, 1 - game.timers.boss / cycle)) * 100}%`;
  $('sector-progress').textContent = game.boss ? 'БОЙ СО СТРАЖЕМ' : `ДО БОССА ${Math.max(0, Math.ceil(game.timers.boss))} СЕК`;
  const health = $('health-indicator');
  const maxHealth = game.player.maxHealth;
  if (health.children.length !== maxHealth) {
    health.replaceChildren(...Array.from({ length: maxHealth }, () => document.createElement('span')));
  }
  health.setAttribute('aria-label', `Корпус: ${game.player.health} из ${maxHealth}`);
  [...health.children].forEach((pip, index) => pip.classList.toggle('empty', index >= game.player.health));
  const ready = game.waveCooldown <= 0;
  const remaining = Math.ceil(game.waveCooldown);
  const pulse = $('pulse-button');
  pulse.disabled = !ready;
  pulse.style.setProperty('--progress', `${Math.round((1 - game.waveCooldown / game.waveMax) * 100)}%`);
  pulse.setAttribute('aria-label', ready ? 'Волна готова' : `Волна: осталось ${remaining} сек.`);
  $('pulse-label').textContent = ready ? 'ГОТОВА' : `${remaining} СЕК`;
  const bossStatus = $('boss-status');
  bossStatus.hidden = !game.boss;
  if (game.boss) {
    $('boss-name').textContent = sector.boss;
    $('boss-health').style.width = `${Math.max(0, (game.boss.health / game.boss.maxHealth) * 100)}%`;
    $('boss-phase').hidden = game.boss.phase !== 2;
  }
  $('first-flight-tip').classList.toggle('fade', game.elapsed > 6 || dragging !== null);
  $('control-hint').classList.toggle('dimmed', game.elapsed > 10 || dragging !== null);
}

/* ---------- flight planning ---------- */
function renderFlight() {
  $('mode-campaign').classList.toggle('active', planned.mode === 'campaign');
  $('mode-endless').classList.toggle('active', planned.mode === 'endless');
  const grid = $('sector-grid');
  grid.replaceChildren(...SECTORS.map((sector, index) => {
    const locked = planned.mode === 'campaign' && index >= progress.unlockedSectors;
    const done = progress.completedSectors.includes(sector.id);
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `sector-card accent-${sector.accent}${locked ? ' locked' : ''}${planned.sectorIndex === index ? ' selected' : ''}`;
    card.innerHTML = `
      <span class="sector-art" style="background-image:url('${import.meta.env.BASE_URL}images/${sector.image}')"></span>
      <span class="sector-meta"><span class="sector-sub">${sector.subtitle}</span><strong>${sector.name}</strong><small>${sector.description}</small></span>
      <span class="sector-flag">${done ? '✦ ПРОЙДЕН' : locked ? '🔒 ЗАКРЫТ' : 'БОСС: ' + sector.boss}</span>`;
    if (!locked) card.addEventListener('click', () => { planned.sectorIndex = index; renderFlight(); });
    else card.disabled = true;
    return card;
  }));
  const sector = SECTORS[planned.sectorIndex];
  $('flight-note').textContent = planned.mode === 'campaign'
    ? (progress.completedSectors.includes(sector.id) ? `Сектор «${sector.name}» уже пройден. Можно пролететь снова.` : `Победи «${sector.boss}», чтобы открыть следующий сектор.`)
    : 'Бесконечный полёт: сектора сменяются после каждого стража, награды растут.';
  $('launch-button').disabled = planned.mode === 'campaign' && planned.sectorIndex >= progress.unlockedSectors;
}

/* ---------- hub: upgrades, ships, cases, missions, backup ---------- */
function hubMessage(text, positive = true) {
  const element = $('hub-message');
  element.textContent = text;
  element.dataset.tone = positive ? 'good' : 'warn';
  element.hidden = false;
}
function renderHub() {
  homeUI();
  for (const button of document.querySelectorAll('[data-hub-tab]')) button.classList.toggle('active', button.dataset.hubTab === hubTab);
  const content = $('hub-content');
  if (hubTab === 'upgrades') {
    content.replaceChildren(...UPGRADES.map((upgrade) => {
      const cost = upgradeCost(progress, upgrade.id);
      const card = document.createElement('article');
      card.className = `hub-card upgrade-card color-${upgrade.color}`;
      const level = document.createElement('div');
      level.className = 'card-level';
      for (let i = 0; i < MAX_UPGRADE; i += 1) level.append(Object.assign(document.createElement('i'), { className: i < cost.level ? 'on' : '' }));
      level.append(Object.assign(document.createElement('b'), { textContent: cost.maxed ? 'МАКС' : `${cost.level}/${MAX_UPGRADE}` }));
      const info = document.createElement('div');
      info.className = 'card-info';
      info.innerHTML = `<span class="card-icon">${upgrade.icon}</span><div><h3>${upgrade.name}</h3><p>${upgrade.description}</p></div>`;
      const buy = document.createElement('button');
      buy.type = 'button';
      buy.className = 'card-buy';
      buy.textContent = cost.maxed ? 'МАКСИМУМ' : `◈ ${cost.credits} · ⬡ ${cost.parts}`;
      buy.disabled = cost.maxed || progress.credits < cost.credits || progress.parts < cost.parts;
      buy.addEventListener('click', () => {
        if (purchaseUpgrade(progress, upgrade.id)) { save(); audio.play('victory'); hubMessage(`${upgrade.name}: уровень ${progress.upgrades[upgrade.id]}.`); renderHub(); }
        else hubMessage('Не хватает кредитов или деталей.', false);
      });
      card.append(level, info, buy);
      return card;
    }));
  } else if (hubTab === 'ships') {
    content.replaceChildren(...SKINS.map((skin) => {
      const owned = progress.ownedSkins.includes(skin.id);
      const active = progress.selectedSkin === skin.id;
      const card = document.createElement('article');
      card.className = `hub-card ship-card${owned ? '' : ' locked'}${active ? ' selected' : ''}`;
      card.innerHTML = `<span class="ship-preview" style="--fin:${skin.fin};--light:${skin.light};--hull:${skin.hull}"><i></i></span>
        <div class="card-info"><h3>${skin.name}</h3><p>${owned ? skin.description : 'Открывается в кейсе'}</p></div>`;
      const action = document.createElement('button');
      action.type = 'button';
      action.className = 'card-buy';
      action.textContent = active ? 'ВЫБРАН' : owned ? 'ВЫБРАТЬ' : '🔒 НЕТ';
      action.disabled = !owned || active;
      action.addEventListener('click', () => { progress.selectedSkin = skin.id; save(); renderHub(); });
      card.append(action);
      return card;
    }));
  } else if (hubTab === 'shop') {
    content.replaceChildren(...CASES.map((box) => {
      const card = document.createElement('article');
      card.className = `hub-card case-card color-${box.color}`;
      card.innerHTML = `<span class="case-glyph">✦</span><div class="card-info"><h3>${box.name}</h3><p>${box.caption}</p><small>Детали и облики кораблей</small></div>`;
      const buy = document.createElement('button');
      buy.type = 'button';
      buy.className = 'card-buy';
      buy.textContent = `◈ ${box.price}`;
      buy.disabled = progress.credits < box.price;
      buy.addEventListener('click', () => {
        const reward = openCase(progress, box.id);
        if (!reward) { hubMessage('Не хватает кредитов.', false); return; }
        save(); audio.play('victory'); renderHub(); showCaseReward(reward);
      });
      card.append(buy);
      return card;
    }));
  } else if (hubTab === 'missions') {
    content.replaceChildren(...MISSIONS.map((mission) => {
      const value = missionValue(progress, mission);
      const done = progress.claimed.includes(mission.id);
      const complete = value >= mission.target;
      const card = document.createElement('article');
      card.className = `hub-card mission-card${done ? ' done' : ''}`;
      card.innerHTML = `<span class="card-icon">${mission.icon}</span><div class="card-info"><h3>${mission.name}</h3><p>${mission.description}</p>
        <div class="mission-track"><i style="width:${Math.min(100, (value / mission.target) * 100)}%"></i></div><small>${Math.min(value, mission.target)} / ${mission.target}</small></div>`;
      const action = document.createElement('button');
      action.type = 'button';
      action.className = 'card-buy';
      action.textContent = done ? 'ПОЛУЧЕНО' : complete ? 'ЗАБРАТЬ' : 'В ПУТИ';
      action.disabled = done || !complete;
      action.addEventListener('click', () => {
        if (claimMission(progress, mission.id)) { save(); audio.play('victory'); hubMessage(`Награда получена: ◈${mission.credits} · ⬡${mission.parts}.`); renderHub(); }
      });
      card.append(action);
      return card;
    }));
  } else {
    const card = document.createElement('article');
    card.className = 'hub-card backup-card';
    card.innerHTML = `<div class="card-info"><h3>СОХРАНИТЬ ПРОГРЕСС</h3><p>Скопируй код в надёжное место. Он восстанавливает корабли, улучшения, кредиты и рекорд.</p>
      <p class="backup-note">Бесплатные игровые деньги и награды. Покупок за реальные деньги в игре нет.</p>
      <textarea id="backup-code" readonly rows="3"></textarea></div>`;
    const copyButton = document.createElement('button');
    copyButton.type = 'button';
    copyButton.className = 'card-buy';
    copyButton.textContent = 'СКОПИРОВАТЬ КОД';
    copyButton.addEventListener('click', async () => {
      const field = $('backup-code');
      field.select();
      try {
        if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(field.value);
        else document.execCommand?.('copy');
        hubMessage('Код скопирован. Храни его отдельно от игры.');
      } catch { hubMessage('Скопируй код вручную — буфер недоступен.', false); }
    });
    const restoreButton = document.createElement('button');
    restoreButton.type = 'button';
    restoreButton.className = 'card-buy';
    restoreButton.textContent = 'ВОССТАНОВИТЬ';
    restoreButton.addEventListener('click', () => {
      const field = document.createElement('textarea');
      field.rows = 3;
      field.placeholder = 'ВСТАВЬ КОД РЕЗЕРВНОЙ КОПИИ';
      field.id = 'restore-input';
      const wrap = document.createElement('label');
      wrap.className = 'restore-wrap';
      wrap.append(Object.assign(document.createElement('span'), { textContent: 'КОД РЕЗЕРВНОЙ КОПИИ' }), field);
      card.querySelector('.card-info').append(wrap);
      wrap.scrollIntoView({ block: 'nearest' });
      field.focus();
      field.addEventListener('change', () => {
        const restored = importProgress(field.value);
        if (!restored) { hubMessage('Код не подошёл. Проверь, что он скопирован целиком.', false); return; }
        pendingRestore = restored;
        screens.import.hidden = false;
      });
    });
    card.append(copyButton, restoreButton);
    content.replaceChildren(card);
    $('backup-code').value = exportProgress(progress);
  }
}
let pendingRestore = null;
function showCaseReward(reward) {
  $('case-reward').innerHTML = reward.kind === 'skin'
    ? `<b class="reward-title">${reward.label}</b><span class="reward-note">Новый облик доступен в ангаре — раздел «КОРАБЛИ».</span>`
    : `<b class="reward-title">${reward.label}</b><span class="reward-note">${reward.kind === 'duplicate' ? 'Облик уже был в ангаре.' : 'Детали нужны для улучшений.'}</span>`;
  screens.case.hidden = false;
}

/* ---------- flight lifecycle ---------- */
function startGame() {
  if (isPortrait()) return;
  if (planned.mode === 'campaign' && planned.sectorIndex >= progress.unlockedSectors) return;
  progress.tutorialSeen = true; save(); audio.unlock();
  keys.clear(); dragging = null;
  game = createGame({
    width: viewportWidth / worldScale, mode: planned.mode, sectorIndex: planned.sectorIndex,
    upgrades: progress.upgrades, skin: progress.selectedSkin,
  });
  showMode('playing'); updateHUD(); audio.setMode('calm'); audio.startMusic();
  if (planned.mode === 'campaign') announce(`${SECTORS[game.sectorIndex].name} · страж: ${SECTORS[game.sectorIndex].boss}`, 3);
  renderGame(ctx, game, sectorImage(SECTORS[game.sectorIndex].image));
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
const ANNOUNCEMENTS = {
  'boss-warning': () => 'ОПАСНОСТЬ: СТРАЖ БЛИЗКО',
  'boss-arrives': (game) => `СТРАЖ СЕКТОРА: ${SECTORS[game.sectorIndex].boss}`,
  'boss-rage': () => 'СТРАЖ В ЯРОСТИ!',
  'boss-defeated': () => 'СТРАЖ РАСПАДАЕТСЯ!',
  victory: () => 'СЕКТОР ЗАЧИЩЕН!',
  'sector-change': (game) => `КУРС: ${SECTORS[game.sectorIndex].name}`,
};
const MUSIC_SWITCH = { 'boss-warning': 'boss', 'boss-arrives': 'boss', 'boss-defeated': 'calm', 'sector-change': 'calm' };
function loop(now) {
  if (mode !== 'playing' || !game) return;
  const dt = Math.min(.05, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;
  keyboardMovement(dt);
  const events = updateGame(game, dt);
  for (const event of events) {
    audio.play(event);
    if (ANNOUNCEMENTS[event]) announce(ANNOUNCEMENTS[event](game), 2.2);
    if (MUSIC_SWITCH[event]) audio.setMode(MUSIC_SWITCH[event]);
  }
  updateHUD(); renderGame(ctx, game, sectorImage(SECTORS[game.sectorIndex].image));
  if (game.gameOver) { finishGame(); return; }
  frame = requestAnimationFrame(loop);
}
function pauseGame() {
  if (mode !== 'playing') return;
  cancelAnimationFrame(frame); keys.clear(); dragging = null; audio.stopMusic(); audio.suspend();
  showMode('pause');
}
function resumeGame() {
  if (mode !== 'pause' || isPortrait()) return;
  audio.unlock(); audio.startMusic(); showMode('playing'); lastTime = performance.now(); frame = requestAnimationFrame(loop);
}
function finishGame() {
  if (!game) return;
  cancelAnimationFrame(frame); keys.clear(); dragging = null; audio.stopMusic(); audio.suspend();
  const outcome = settleFlight(progress, game) || { credits: 0, parts: 0, newRecord: false, isFirstClear: false };
  save();
  const title = $('result-title');
  if (game.victory) title.innerHTML = 'СТРАЖ<br />ПОВЕРЖЕН!';
  else title.innerHTML = 'ОТЛИЧНЫЙ<br />ПОЛЁТ!';
  $('result-score').textContent = number.format(game.score);
  $('result-distance').textContent = `${number.format(Math.floor(game.distance))} м`;
  $('result-stars').textContent = number.format(game.stars);
  $('result-bosses').textContent = number.format(game.bossesDefeated);
  $('result-best').textContent = number.format(progress.best);
  $('result-credits').textContent = number.format(outcome.credits);
  $('result-parts').textContent = number.format(outcome.parts);
  $('new-record').hidden = !outcome.newRecord;
  $('result-unlock').hidden = !outcome.isFirstClear;
  updateHUD(); showMode('result');
  if (game.victory) audio.play('victory');
}
function returnHome() {
  cancelAnimationFrame(frame); keys.clear(); dragging = null; game = null; audio.stopMusic(); audio.suspend();
  showMode('home');
}
function activateWave() {
  if (mode !== 'playing' || !game) return;
  if (useWave(game)) { audio.play('wave'); updateHUD(); renderGame(ctx, game, sectorImage(SECTORS[game.sectorIndex].image)); }
}

/* ---------- intro ---------- */
// The launch cinematic plays every time the game is opened; any tap skips it.
function playIntro() {
  const intro = $('intro');
  intro.hidden = false;
  let closed = false;
  const finish = () => {
    if (closed) return;
    closed = true;
    clearTimeout(timer);
    intro.classList.add('skip');
    setTimeout(() => { intro.hidden = true; intro.classList.remove('skip'); }, 420);
  };
  const timer = setTimeout(finish, 3600);
  intro.addEventListener('click', finish, { once: true });
  $('intro-skip').addEventListener('click', finish, { once: true });
  window.__cosmoSkipIntro = finish;
}

/* ---------- wiring ---------- */
$('start-button').addEventListener('click', () => { if (progress.tutorialSeen) { renderFlight(); showMode('flight'); } else showMode('tutorial'); });
$('help-button').addEventListener('click', () => showMode('tutorial'));
$('tutorial-close').addEventListener('click', () => showMode('home'));
$('tutorial-start').addEventListener('click', () => { progress.tutorialSeen = true; save(); renderFlight(); showMode('flight'); });
$('hangar-button').addEventListener('click', () => { hubTab = 'upgrades'; renderHub(); showMode('hub'); });
$('shop-button').addEventListener('click', () => { hubTab = 'shop'; renderHub(); showMode('hub'); });
$('missions-button').addEventListener('click', () => { hubTab = 'missions'; renderHub(); showMode('hub'); });
$('hub-close').addEventListener('click', () => showMode('home'));
for (const button of document.querySelectorAll('[data-hub-tab]')) button.addEventListener('click', () => { hubTab = button.dataset.hubTab; renderHub(); });
$('flight-close').addEventListener('click', () => showMode('home'));
$('mode-campaign').addEventListener('click', () => { planned.mode = 'campaign'; planned.sectorIndex = Math.min(planned.sectorIndex, progress.unlockedSectors - 1); renderFlight(); });
$('mode-endless').addEventListener('click', () => { planned.mode = 'endless'; renderFlight(); });
$('launch-button').addEventListener('click', startGame);
$('case-close').addEventListener('click', () => { screens.case.hidden = true; });
$('import-cancel').addEventListener('click', () => { pendingRestore = null; screens.import.hidden = true; });
$('import-confirm').addEventListener('click', () => {
  if (pendingRestore) { progress = pendingRestore; save(); soundUI(); renderHub(); hubMessage('Прогресс восстановлен из кода.'); }
  pendingRestore = null; screens.import.hidden = true;
});
$('pause-button').addEventListener('click', pauseGame);
$('resume-button').addEventListener('click', resumeGame);
$('end-button').addEventListener('click', finishGame);
$('retry-button').addEventListener('click', () => { renderFlight(); showMode('flight'); });
$('menu-button').addEventListener('click', returnHome);
// Mobile browsers do not always synthesize a click for a second finger: activate on touch/pen down.
$('pulse-button').addEventListener('pointerdown', (event) => { if (event.pointerType !== 'mouse') { event.preventDefault(); activateWave(); } });
$('pulse-button').addEventListener('click', activateWave);
for (const button of sounds) button.addEventListener('click', () => { progress.sound = !progress.sound; audio.setEnabled(progress.sound); save(); soundUI(); if (progress.sound) audio.play('ui'); });
for (const button of musicButtons) button.addEventListener('click', () => {
  progress.music = !progress.music; audio.setMusicEnabled(progress.music); save(); soundUI();
  if (progress.music && mode === 'playing') { audio.unlock(); audio.startMusic(); }
});
for (const button of document.querySelectorAll('.button, .home-nav button, .card-buy, .mode-tabs button, .hub-tabs button, .sector-card')) {
  button.addEventListener('click', () => audio.play('ui'));
}
for (const button of document.querySelectorAll('.card-buy')) button.addEventListener('click', () => audio.play('buy'));

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
  if (!$('intro').hidden) { window.__cosmoSkipIntro?.(); return true; }
  if (!screens.case.hidden) { screens.case.hidden = true; return true; }
  if (!screens.import.hidden) { pendingRestore = null; screens.import.hidden = true; return true; }
  if (mode === 'playing') { pauseGame(); return true; }
  if (mode === 'pause') { resumeGame(); return true; }
  if (mode === 'tutorial') { showMode('home'); return true; }
  if (['result', 'flight', 'hub'].includes(mode)) { returnHome(); return true; }
  return false;
};
for (const sector of SECTORS) sectorImage(sector.image).addEventListener('load', () => { if (game) renderGame(ctx, game, sectorImage(SECTORS[game.sectorIndex].image)); });
soundUI(); showMode('home'); resize(); playIntro();
