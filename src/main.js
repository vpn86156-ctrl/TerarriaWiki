/* «Заброшка» — сборка игры: экраны, HUD, ввод, звук, прогресс. */

import { createGame, updateGame, applyPurchase, equipWeapon } from './engine.js';
import { renderGame, renderMinimap, resize } from './render.js';
import {
  LOCATIONS, SHOP_ITEMS, SHOP_WEAPONS, TUTORIAL, WEAPONS, AMMO_LABEL, TILE,
} from './content.js';
import { AudioEngine } from './audio.js';
import { TouchControls } from './input.js';
import { loadProgress, saveProgress, wipeProgress, defaultSave } from './progress.js';

const $ = (id) => document.getElementById(id);

const canvas = $('game');
const ctx = canvas.getContext('2d', { alpha: false });
const minimap = $('minimap');
const mapCtx = minimap.getContext('2d');

const audio = new AudioEngine();
const controls = new TouchControls();

let progress = loadProgress();
let game = null;
let run = { locationIndex: 0, slot: 0, time: 0, coins: 0, kills: 0 };
let screenName = 'title';
// Откуда пришли в настройки: возврат должен попасть ровно туда же.
let screenBeforeSettings = 'title';
let paused = false;
let combatTimer = 0;
let deathDelay = 0;
let clearDelay = 0;
let frames = 0;
let toastTimer = 0;
let lastHud = '';
let lastMusicRole = null;

/* ---------- screens ---------- */
const SCREENS = ['title', 'locations', 'tutorial', 'settings', 'shop', 'clear', 'pause', 'death', 'victory', 'credits'];

function show(name) {
  if (name === 'settings' && screenName !== 'settings') screenBeforeSettings = screenName;
  screenName = name;
  for (const id of SCREENS) $(`screen-${id}`).classList.toggle('active', id === name);
  const inGame = name === 'game';
  $('hud').classList.toggle('hidden', !inGame);
  if (name !== 'game') minimap.classList.add('hidden');
  else minimap.classList.toggle('hidden', !progress.settings.minimap);
}

function toast(text, time = 2.2) {
  const node = $('toast');
  node.textContent = text;
  node.classList.add('show');
  toastTimer = time;
}

/* ---------- run control ---------- */
function startLevel(locationIndex, slot, { freshRun = false } = {}) {
  run.locationIndex = locationIndex;
  run.slot = slot;
  run.time = 0;
  run.coins = 0;
  run.kills = 0;
  game = createGame({ seed: Date.now() + slot * 7919 + locationIndex * 104729, locationIndex, slot, upgrades: progress.upgrades });
  applyLoadout(game);
  paused = false;
  deathDelay = 0;
  clearDelay = 0;
  combatTimer = 0;
  lastHud = '';
  syncHud(true);
  show('game');
  audio.playRole(LOCATIONS[locationIndex].levels === slot + 1 ? 'boss' : 'explore');
  lastMusicRole = null;
  toast(`${LOCATIONS[locationIndex].short} · ЭТАЖ ${slot + 1}`, 2.4);
  if (freshRun) progress.stats.levels = 0;
}

function applyLoadout(target) {
  const player = target.player;
  player.maxHealth = 6 + (progress.upgrades.maxhp || 0);
  player.health = Math.max(1, Math.min(player.maxHealth, progress.health || player.maxHealth));
  player.grenades = progress.grenades ?? 1;
  player.melee = progress.melee || 'crowbar';
  player.gun = null;
  player.magazine = 0;
  player.ammo = { pistol: 0, shells: 0, rifle: 0, ...progress.ammo };
  player.coins = 0;
  if (progress.gun && progress.weapons.includes(progress.gun)) equipWeapon(target, progress.gun);
  if (progress.melee && WEAPONS[progress.melee]) player.melee = progress.melee;
}

function finishLevel() {
  const location = LOCATIONS[run.locationIndex];
  progress.coins += game.player.coins;
  progress.health = game.player.health;
  progress.ammo = { ...game.player.ammo };
  progress.grenades = game.player.grenades;
  progress.stats.kills += game.stats.killed;
  progress.stats.coins += game.stats.coins;
  progress.stats.time += game.time;
  progress.stats.levels += 1;
  progress.maxLevel[run.locationIndex] = Math.max(progress.maxLevel[run.locationIndex] || 1, run.slot + 2);
  const isLastLevel = run.slot + 1 >= location.levels;
  if (isLastLevel) {
    progress.stats.bosses += 1;
    if (run.locationIndex + 1 < LOCATIONS.length) {
      progress.unlocked = Math.max(progress.unlocked, run.locationIndex + 2);
      progress.location = run.locationIndex + 1;
      progress.level = 1;
    }
  } else {
    progress.location = run.locationIndex;
    progress.level = run.slot + 2;
  }
  saveProgress(progress);
  return isLastLevel;
}

function advanceAfterClear() {
  const location = LOCATIONS[run.locationIndex];
  const isLastLevel = run.slot + 1 >= location.levels;
  if (isLastLevel && run.locationIndex + 1 >= LOCATIONS.length) {
    showVictory();
    return;
  }
  openShop();
}

function nextLevel() {
  // Everything bought in the shop has to travel into the next level.
  if (game) {
    progress.health = game.player.health;
    progress.ammo = { ...game.player.ammo };
    progress.grenades = game.player.grenades;
    progress.melee = game.player.melee;
    progress.gun = game.player.gun || progress.gun;
    saveProgress(progress);
  }
  const location = LOCATIONS[run.locationIndex];
  if (run.slot + 1 < location.levels) startLevel(run.locationIndex, run.slot + 1);
  else if (run.locationIndex + 1 < LOCATIONS.length) startLevel(run.locationIndex + 1, 0);
  else showVictory();
}

function playerDied() {
  progress.stats.deaths += 1;
  progress.health = 8 + (progress.upgrades.maxhp || 0);
  progress.ammo = { pistol: Math.max(12, (progress.ammo.pistol || 0) >> 1), shells: progress.ammo.shells || 0, rifle: 0 };
  progress.grenades = Math.max(1, (progress.grenades || 1) - 1);
  progress.coins += Math.floor(game.player.coins / 2);
  saveProgress(progress);
  $('death-stats').innerHTML = statBlock([
    ['ЭТАЖ', `${LOCATIONS[run.locationIndex].short} ${run.slot + 1}`],
    ['УБИТО', game.stats.killed],
    ['МОНЕТ', game.player.coins],
    ['ВРЕМЯ', formatTime(game.time)],
  ]);
  $('death-text').textContent = 'Половина найденных монет осталась в кармане. Остальное — в заброшке.';
  audio.playRole('explore');
  show('death');
}

function showVictory() {
  $('victory-text').textContent = 'Три заброшки позади: подвал, больница, завод. Ты вышел — редкий случай.';
  $('victory-stats').innerHTML = statBlock([
    ['УБИТО', progress.stats.kills],
    ['БОССОВ', progress.stats.bosses],
    ['МОНЕТ', progress.coins],
    ['СМЕРТЕЙ', progress.stats.deaths],
    ['ВРЕМЯ', formatTime(progress.stats.time)],
  ]);
  show('victory');
}

const formatTime = (seconds) => {
  const total = Math.floor(seconds);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};
const statBlock = (pairs) => pairs
  .map(([label, value]) => `<div><span class="tag">${label}</span><span>${value}</span></div>`)
  .join('');

/* ---------- HUD ---------- */
function syncHud(force = false) {
  if (!game) return;
  const player = game.player;
  const weapon = WEAPONS[player.gun] || WEAPONS[player.melee];
  const reserve = player.gun ? (player.ammo[WEAPONS[player.gun].ammo] || 0) : 0;
  const key = [
    player.health, player.maxHealth, weapon?.id, player.magazine, reserve,
    player.coins, game.keys, player.grenades, game.doorOpen,
    game.level.boss ? Math.ceil(game.level.boss.health) : -1,
  ].join('|');
  if (!force && key === lastHud) return;
  lastHud = key;

  const hearts = Math.max(3, Math.ceil(player.maxHealth));
  const filled = Math.ceil(Math.max(0, player.health));
  $('hearts').innerHTML = Array.from({ length: hearts }, (_, index) =>
    `<div class="heart${index < filled ? '' : ' empty'}"></div>`).join('');

  $('weapon-name').textContent = weapon ? weapon.name : 'БЕЗ ОРУЖИЯ';
  $('ammo-text').textContent = player.gun
    ? `${player.magazine} / ${reserve} · ${AMMO_LABEL[WEAPONS[player.gun].ammo]}`
    : 'ТОЛЬКО БЛИЖНИЙ БОЙ';
  $('coins').textContent = player.coins;
  $('keys').textContent = game.keys;
  $('grenade-count').textContent = player.grenades;
  $('level-title').textContent = `${LOCATIONS[run.locationIndex].short} · ЭТАЖ ${run.slot + 1}`;

  let objective = 'ИДИ К ВЫХОДУ';
  if (game.level.boss && !game.level.boss.dead) objective = `УБЕЙ: ${game.level.boss.name}`;
  else if (!game.doorOpen) objective = game.keys > 0 ? 'ОТКРОЙ ДВЕРЬ КЛЮЧОМ' : 'НАЙДИ КЛЮЧ В ЯЩИКАХ';
  $('objective').textContent = objective;

  const boss = game.level.boss;
  const bar = $('boss-bar');
  if (boss && !boss.dead) {
    bar.classList.remove('hidden');
    $('boss-name').textContent = boss.name;
    $('boss-fill').style.width = `${Math.max(0, (boss.health / boss.maxHealth) * 100).toFixed(1)}%`;
  } else {
    bar.classList.add('hidden');
  }

  for (const action of ['reload']) {
    const button = document.querySelector(`[data-action="${action}"]`);
    if (button) button.disabled = !player.gun;
  }
  const grenadeButton = document.querySelector('[data-action="grenade"]');
  if (grenadeButton) grenadeButton.disabled = player.grenades <= 0;
  const fireButton = document.querySelector('[data-action="shoot"]');
  if (fireButton) fireButton.disabled = !player.gun || (player.magazine <= 0 && reserve <= 0);
}

/* ---------- events → sound ---------- */
function handleEvents(events) {
  for (const event of events) {
    switch (event) {
      case 'swing': audio.play('swing', { volume: .5, throttle: .05 }); break;
      case 'hit-enemy': audio.play('hit', { volume: .6, throttle: .04 }); combatTimer = Math.max(combatTimer, 3); break;
      case 'enemy-die':
        audio.play('hit', { volume: .7, rate: .85 });
        audio.play('growl', { volume: .35, rate: .8, throttle: .3 });
        break;
      case 'enemy-shoot': audio.play('gun', { volume: .35, rate: .7, throttle: .1 }); combatTimer = Math.max(combatTimer, 3); break;
      case 'player-hurt': audio.play('hurt', { volume: .7, throttle: .2 }); combatTimer = Math.max(combatTimer, 3); break;
      case 'player-die': audio.play('hurt', { volume: 1, rate: .7 }); deathDelay = 1.1; break;
      case 'shoot': audio.play('gun', { volume: .55, throttle: .04 }); combatTimer = Math.max(combatTimer, 2.5); break;
      case 'reload': audio.play('reload', { volume: .5 }); break;
      case 'reload-done': audio.play('click', { volume: .35 }); break;
      case 'grenade-throw': audio.play('swing', { volume: .4, rate: .6 }); break;
      case 'explosion': audio.play('boom', { volume: .8 }); combatTimer = Math.max(combatTimer, 3); break;
      case 'prop-break': audio.play('hit', { volume: .45, rate: .7, throttle: .1 }); break;
      case 'coin': audio.play('pickup', { volume: .35, rate: 1.5, throttle: .05 }); break;
      case 'key': audio.play('pickup', { volume: .6, rate: 1.2 }); toast('КЛЮЧ НАЙДЕН'); break;
      case 'pickup': audio.play('pickup', { volume: .5, throttle: .1 }); break;
      case 'door-open': audio.play('door', { volume: .7 }); toast('ДВЕРЬ ОТКРЫТА'); break;
      case 'boss-telegraph': audio.play('growl', { volume: .8 }); break;
      case 'boss-shoot': audio.play('gun', { volume: .45, rate: .6 }); break;
      case 'boss-phase': audio.play('boom', { volume: .5, rate: .7 }); toast('БОСС В ЯРОСТИ'); break;
      case 'boss-summon': audio.play('growl', { volume: .6, rate: 1.2 }); break;
      case 'boss-die':
        audio.play('boom', { volume: 1 });
        toast('БОСС ПОВЕРЖЕН');
        break;
      case 'level-complete': clearDelay = .8; break;
      default:
        if (event.startsWith('melee:')) audio.play('swing', { volume: .5, rate: event.endsWith('axe') ? .7 : 1 });
        else if (event.startsWith('gun:')) audio.play('gun', { volume: .55, rate: event.endsWith('shotgun') ? .75 : event.endsWith('rifle') ? 1.15 : 1 });
    }
  }
}

/* ---------- music roles ---------- */
function updateMusic(dt) {
  if (!game) return;
  combatTimer = Math.max(0, combatTimer - dt);
  const boss = game.level.boss;
  const bossNear = boss && !boss.dead && Math.hypot(boss.x - game.player.x, boss.y - game.player.y) < 340;
  const awake = game.level.enemies.some((enemy) => enemy.state === 'chase' || enemy.state === 'attack');
  if (awake) combatTimer = Math.max(combatTimer, 2);
  const role = bossNear ? 'boss' : combatTimer > 0 ? 'fight' : 'explore';
  if (role !== lastMusicRole) {
    lastMusicRole = role;
    audio.playRole(role);
  }
}

/* ---------- loop ---------- */
let lastTime = performance.now();
function frame(now) {
  const dt = Math.min(.05, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;
  frames += 1;

  if (toastTimer > 0) {
    toastTimer -= dt;
    if (toastTimer <= 0) $('toast').classList.remove('show');
  }

  if (game && screenName === 'game' && !paused) {
    const events = updateGame(game, dt, controls.state);
    handleEvents(events);
    audio.footsteps(dt, game.player.moving && !game.dead);
    updateMusic(dt);
    syncHud();
    if (!minimap.classList.contains('hidden')) renderMinimap(mapCtx, game, 0, 0, 120);

    if (deathDelay > 0) {
      deathDelay -= dt;
      if (deathDelay <= 0) playerDied();
    }
    if (clearDelay > 0) {
      clearDelay -= dt;
      if (clearDelay <= 0) {
        clearDelay = 0;
        const isLastLevel = finishLevel();
        $('clear-title').textContent = isLastLevel ? 'ЛОКАЦИЯ ЗАЧИЩЕНА' : 'ЭТАЖ ПРОЙДЕН';
        $('clear-stats').innerHTML = statBlock([
          ['УБИТО', game.stats.killed],
          ['МОНЕТ', game.player.coins],
          ['ВРЕМЯ', formatTime(game.time)],
          ['ЗДОРОВЬЕ', `${Math.ceil(game.player.health)} / ${game.player.maxHealth}`],
        ]);
        audio.playRole('explore');
        show('clear');
      }
    }
  }

  if (game) renderGame(ctx, game, { weapon: game.player.melee });
  requestAnimationFrame(frame);
}

/* ---------- screens: locations ---------- */
function renderLocations() {
  const list = $('location-list');
  list.innerHTML = '';
  LOCATIONS.forEach((location, index) => {
    const locked = index + 1 > progress.unlocked;
    const card = document.createElement('div');
    card.className = `location-card${locked ? ' locked' : ''}`;
    const levels = Array.from({ length: location.levels }, (_, level) => {
      const done = level + 1 < (progress.maxLevel[index] || 1);
      const current = level + 1 === (progress.maxLevel[index] || 1) && !locked;
      const lockedLevel = locked || level + 1 > (progress.maxLevel[index] || 1);
      const className = `level-pip${done ? ' done' : ''}${current ? ' current' : ''}${lockedLevel && !done ? ' locked' : ''}`;
      return `<span class="${className}" data-loc="${index}" data-slot="${level}">${level + 1}</span>`;
    }).join('');
    card.innerHTML = `
      <div class="name">${location.name}</div>
      <div class="intro">${locked ? 'Закрыто. Пройди предыдущую заброшку.' : location.intro}</div>
      <div class="levels">${levels}</div>`;
    if (!locked) {
      card.querySelectorAll('.level-pip').forEach((pip) => {
        const slot = Number(pip.dataset.slot);
        if (pip.classList.contains('locked')) return;
        pip.addEventListener('click', (event) => {
          event.stopPropagation();
          audio.play('click', { volume: .5 });
          startLevel(index, slot);
        });
      });
    }
    list.appendChild(card);
  });
}

/* ---------- screens: shop ---------- */
function openShop() {
  renderShop();
  show('shop');
}

function renderShop() {
  $('shop-coins').textContent = progress.coins;
  const grid = $('shop-grid');
  grid.innerHTML = '';

  const addItem = (item, { owned = false, equipped = false, onClick }) => {
    const node = document.createElement('div');
    node.className = `shop-item${equipped ? ' equipped' : ''}${owned ? ' owned' : ''}`;
    node.innerHTML = `
      <div class="item-name">${item.name}</div>
      <div class="item-desc">${item.description}</div>
      <button class="buy" ${progress.coins < item.price ? 'disabled' : ''}>${equipped ? 'В РУКАХ' : owned ? 'КУПЛЕНО' : `${item.price} М`}</button>`;
    const button = node.querySelector('.buy');
    button.addEventListener('click', () => {
      if (progress.coins < item.price) return;
      progress.coins -= item.price;
      onClick();
      audio.play('pickup', { volume: .5, rate: 1.1 });
      saveProgress(progress);
      renderShop();
    });
    grid.appendChild(node);
  };

  for (const item of SHOP_WEAPONS) {
    const owned = (progress.weapons || []).includes(item.weapon);
    const equipped = owned && (WEAPONS[item.weapon].kind === 'melee' ? progress.melee : progress.gun) === item.weapon;
    addItem(item, {
      owned,
      equipped,
      onClick: () => {
        if (!owned) progress.weapons = [...(progress.weapons || []), item.weapon];
        if (WEAPONS[item.weapon].kind === 'melee') progress.melee = item.weapon;
        else progress.gun = item.weapon;
      },
    });
  }
  for (const item of SHOP_ITEMS) {
    addItem(item, { onClick: () => { applyPurchase(game, item.id, progress); } });
  }
}

/* ---------- screens: tutorial ---------- */
let tutorialStep = 0;
function renderTutorial() {
  const step = TUTORIAL[Math.min(tutorialStep, TUTORIAL.length - 1)];
  $('tutorial-text').textContent = step.text;
  $('tutorial-title').textContent = `ОБУЧЕНИЕ ${tutorialStep + 1} / ${TUTORIAL.length}`;
  $('btn-tutorial-next').textContent = tutorialStep >= TUTORIAL.length - 1 ? 'ПОНЯТНО' : 'ДАЛЬШЕ';
  drawTutorialArt(step.key);
}

function drawTutorialArt(key) {
  const art = $('tutorial-canvas');
  const g = art.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, art.width, art.height);
  g.fillStyle = '#14161d';
  g.fillRect(0, 0, art.width, art.height);
  // floor
  for (let y = 74; y < art.height; y += 8) {
    for (let x = 0; x < art.width; x += 8) {
      g.fillStyle = ((x / 8 + y / 8) % 2 === 0) ? '#242832' : '#1e212a';
      g.fillRect(x, y, 8, 8);
    }
  }
  g.fillStyle = '#3b3f4b';
  g.fillRect(0, 66, art.width, 8);

  const hero = (x, y, extra) => {
    g.fillStyle = '#f0c090'; g.fillRect(x - 4, y - 20, 8, 7);
    g.fillStyle = '#2f6f4f'; g.fillRect(x - 5, y - 13, 10, 11);
    g.fillStyle = '#26313f'; g.fillRect(x - 5, y - 2, 4, 6); g.fillRect(x + 1, y - 2, 4, 6);
    if (extra) extra();
  };

  if (key === 'move') {
    hero(110, 96);
    g.fillStyle = '#ffb347';
    for (let i = 0; i < 5; i += 1) g.fillRect(140 + i * 12, 92, 8, 3);
    g.fillRect(196, 86, 4, 15); g.fillRect(190, 92, 16, 4);
    const stick = $('stick');
    void stick;
  } else if (key === 'melee') {
    hero(100, 96, () => {
      g.save();
      g.translate(112, 78); g.rotate(-.5);
      g.fillStyle = '#c9c9d4'; g.fillRect(0, 0, 34, 4);
      g.fillStyle = '#8a8a99'; g.fillRect(0, 4, 6, 4);
      g.restore();
    });
    g.fillStyle = '#6f8f5a'; g.fillRect(160, 76, 12, 22);
    g.fillStyle = '#3f5c38'; g.fillRect(160, 88, 12, 10);
    g.fillStyle = '#ff6b5a';
    for (let i = 0; i < 6; i += 1) g.fillRect(178 + i * 6, 74 + (i % 2) * 10, 4, 4);
  } else if (key === 'shoot') {
    hero(90, 96, () => {
      g.fillStyle = '#4a4a58'; g.fillRect(104, 80, 16, 5);
    });
    g.fillStyle = '#ffd166';
    for (let i = 0; i < 5; i += 1) g.fillRect(130 + i * 18, 82, 8, 3);
    g.fillStyle = '#d8d3c2'; g.fillRect(230, 74, 12, 24);
    g.fillStyle = '#8a8676'; g.fillRect(230, 86, 12, 12);
  } else if (key === 'keys') {
    g.fillStyle = '#7a5a3a'; g.fillRect(120, 76, 30, 22);
    g.fillStyle = '#5d432b'; g.fillRect(120, 76, 30, 4); g.fillRect(120, 92, 30, 6);
    g.fillStyle = '#ffe9b0';
    g.fillRect(196, 84, 14, 4); g.fillRect(206, 78, 4, 6); g.fillRect(206, 88, 4, 5);
    hero(70, 98);
  } else if (key === 'light') {
    g.fillStyle = '#0a0b10'; g.fillRect(0, 66, art.width, 54);
    const gradient = g.createRadialGradient(150, 88, 6, 150, 88, 92);
    gradient.addColorStop(0, 'rgba(255,190,110,.55)');
    gradient.addColorStop(1, 'rgba(255,190,110,0)');
    g.fillStyle = gradient; g.fillRect(0, 60, art.width, 60);
    hero(140, 96);
    g.fillStyle = '#ffb347'; g.fillRect(206, 84, 4, 10); g.fillStyle = '#ff7b3a'; g.fillRect(204, 78, 8, 8);
    g.fillStyle = '#0a0b10'; g.fillRect(240, 70, 60, 50);
  }
}

/* ---------- settings ---------- */
function bindSettings() {
  const settings = progress.settings;
  const map = {
    'set-sound': 'sound', 'set-music': 'music', 'set-shake': 'shake',
    'set-hints': 'hints', 'set-minimap': 'minimap',
  };
  for (const [id, key] of Object.entries(map)) {
    const node = $(id);
    node.checked = !!settings[key];
    node.addEventListener('change', () => {
      settings[key] = node.checked;
      audio.configure(settings);
      if (key === 'music' && node.checked) audio.playRole(lastMusicRole || 'explore');
      if (key === 'minimap') minimap.classList.toggle('hidden', !node.checked || screenName !== 'game');
      saveProgress(progress);
    });
  }
  const volume = $('set-volume');
  volume.value = Math.round(settings.volume * 100);
  volume.addEventListener('input', () => {
    settings.volume = Number(volume.value) / 100;
    audio.configure(settings);
    saveProgress(progress);
  });
  const stickSize = $('set-stick');
  stickSize.value = Math.round((settings.stickSize || 1) * 100);
  stickSize.addEventListener('input', () => {
    settings.stickSize = Number(stickSize.value) / 100;
    document.documentElement.style.setProperty('--ui-scale', String(settings.stickSize));
    saveProgress(progress);
  });
  $('btn-wipe').addEventListener('click', () => {
    progress = wipeProgress();
    audio.configure(progress.settings);
    bindSettings();
    toast('ПРОГРЕСС СТЁРТ');
  });
}

/* ---------- credits ---------- */
async function renderCredits() {
  const list = $('credits-list');
  list.innerHTML = '<li>Загружаю список…</li>';
  try {
    const response = await fetch('./audio/manifest.json');
    const data = await response.json();
    const groups = new Map();
    for (const entry of data.sfx || []) {
      if (!groups.has(entry.pack)) groups.set(entry.pack, { title: entry.pack, license: entry.license, source: entry.source, count: 0 });
      groups.get(entry.pack).count += 1;
    }
    const items = [...groups.values()].sort((a, b) => b.count - a.count)
      .map((group) => `<li><b>${group.title}</b> — ${group.count} звуков, ${group.license}. ${group.source}</li>`);
    items.push(`<li><b>FreePD</b> — ${(data.music || []).length} музыкальных треков, CC0 1.0. github.com/SoundSafari/CC0-1.0-Music</li>`);
    list.innerHTML = items.join('');
  } catch {
    list.innerHTML = '<li>Не удалось прочитать список файлов.</li>';
  }
}

/* ---------- buttons ---------- */
function bindUi() {
  document.querySelectorAll('[data-go]').forEach((button) => {
    button.addEventListener('click', () => {
      const go = button.dataset.go;
      audio.unlock();
      audio.play('click', { volume: .5 });
      if (go === 'new') {
        progress = { ...defaultSave(), settings: progress.settings, stats: progress.stats };
        progress.tutorialSeen = true;
        saveProgress(progress);
        startLevel(0, 0, { freshRun: true });
      } else if (go === 'continue') {
        startLevel(progress.location || 0, Math.max(0, (progress.level || 1) - 1));
      } else if (go === 'locations') { renderLocations(); show('locations'); }
      else if (go === 'tutorial') { tutorialStep = 0; renderTutorial(); show('tutorial'); }
      else if (go === 'settings') show('settings');
      else if (go === 'credits') { renderCredits(); show('credits'); }
      else if (go === 'back') show(screenBeforeSettings === 'settings' ? 'title' : screenBeforeSettings || 'title');
      else if (go === 'title') { game = null; show('title'); refreshTitle(); }
    });
  });

  $('btn-tutorial-next').addEventListener('click', () => {
    audio.play('click', { volume: .5 });
    if (tutorialStep >= TUTORIAL.length - 1) {
      progress.tutorialSeen = true;
      saveProgress(progress);
      show('title');
    } else {
      tutorialStep += 1;
      renderTutorial();
    }
  });

  $('btn-pause').addEventListener('click', () => {
    audio.play('click', { volume: .5 });
    paused = true;
    controls.release();
    show('pause');
  });
  $('btn-resume').addEventListener('click', () => {
    audio.play('click', { volume: .5 });
    paused = false;
    show('game');
  });
  $('btn-quit').addEventListener('click', () => {
    game = null;
    show('title');
    refreshTitle();
  });
  $('btn-restart-level').addEventListener('click', () => {
    paused = false;
    startLevel(run.locationIndex, run.slot);
  });
  $('btn-retry').addEventListener('click', () => { startLevel(run.locationIndex, run.slot); });
  $('btn-clear-next').addEventListener('click', () => { audio.play('click', { volume: .5 }); advanceAfterClear(); });
  $('btn-shop-next').addEventListener('click', () => { audio.play('click', { volume: .5 }); nextLevel(); });
}

function refreshTitle() {
  const hasProgress = (progress.level || 1) > 1 || (progress.location || 0) > 0 || progress.coins > 0;
  $('btn-continue').disabled = !hasProgress;
  $('title-hint').textContent = hasProgress
    ? `Прогресс: ${LOCATIONS[progress.location || 0].short} · этаж ${progress.level || 1} · монет ${progress.coins}`
    : 'Управление: джойстик слева, кнопки справа';
}

/* ---------- boot ---------- */
function resizeAll() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  resize(canvas, ctx, width, height);
}

function boot() {
  resizeAll();
  window.addEventListener('resize', resizeAll);
  window.addEventListener('orientationchange', () => setTimeout(resizeAll, 120));

  controls.attach({
    stick: $('stick'),
    buttons: [...document.querySelectorAll('[data-action]')],
  });
  controls.onFirstInput = () => {
    audio.unlock();
    audio.configure(progress.settings);
    audio.playRole(screenName === 'game' ? (lastMusicRole || 'explore') : 'explore');
  };

  document.documentElement.style.setProperty('--ui-scale', String(progress.settings.stickSize || 1));
  audio.settings = { ...audio.settings, ...progress.settings };

  bindSettings();
  bindUi();
  refreshTitle();
  show('title');
  if (!progress.tutorialSeen) {
    tutorialStep = 0;
    renderTutorial();
    show('tutorial');
  }

  // Кнопка «назад» на телефоне и уход в фон.
  window.__zabroshkaBack = () => {
    if (screenName === 'game') {
      paused = true;
      controls.release();
      show('pause');
      return true;
    }
    if (screenName !== 'title') {
      show('title');
      refreshTitle();
      return true;
    }
    return false;
  };
  window.addEventListener('zabroshka:background', () => {
    audio.suspend();
    if (screenName === 'game') {
      paused = true;
      controls.release();
      show('pause');
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      audio.suspend();
      if (screenName === 'game') { paused = true; show('pause'); }
    } else {
      audio.resume();
    }
  });

  requestAnimationFrame(frame);
}

/* Хуки для автотестов. */
window.__zabroshka = {
  get game() { return game; },
  get progress() { return progress; },
  get screen() { return screenName; },
  get frames() { return frames; },
  get audio() { return audio; },
  get controls() { return controls; },
  startLevel,
  show,
  openShop,
  setProgress(next) { progress = { ...progress, ...next }; saveProgress(progress); },
  toast,
};

boot();
