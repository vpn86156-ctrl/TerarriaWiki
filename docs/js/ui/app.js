/* Контроллер: загрузка, навигация, игровой цикл, боёвка, модалки. */
import {
  getState, setState, defaults, stats, currentBoss, resetState
} from '../core/state.js';
import { attack, tickCombat, onCombatEvent, resetCombatTimer } from '../systems/combat.js';
import { equip, unequip, sellItem, toggleLock } from '../systems/inventory.js';
import { check as checkAch } from '../systems/achievements.js';
import { readyCount } from '../systems/quests.js';
import { RAR_BY_ID } from '../data/rarities.js';
import { STAT_LABELS, STAT_SUFFIX, itemPower } from '../data/items.js';
import { slotLabel } from '../systems/inventory.js';
import { cloud, connectionLabel, initCloud } from '../core/supabase.js';
import { loadProgress, saveNow, saveSoon } from '../core/storage.js';
import { sfx, unlock, setEnabled, startAmbience, stopAmbience, isEnabled, isAmbience } from '../core/audio.js';
import { initAsh, damageNumber, hitPoint, shake, flash, burstParticles, toast, openOverlay, closeOverlay } from './fx.js';
import * as Screens from './screens.js';
import * as Net from './net.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const n = v => Math.round(v).toLocaleString('ru-RU');
const esc = Screens.esc;

let screen = 'hunt';
let running = false;
let loopId = null;
let lastT = 0;
let autoT = 0;
let saveT = 0;
let cloudT = 0;
let clickLock = 0;
let authMode = 'login';

const SCREEN_RENDER = {
  hunt: Screens.renderHunt,
  inventory: Screens.renderInventory,
  hero: Screens.renderHero,
  pets: Screens.renderPets,
  dungeons: Screens.renderDungeons,
  tower: Screens.renderTower,
  quests: Screens.renderQuests,
  pvp: Net.renderPvp,
  guild: Net.renderGuild,
  market: Net.renderMarket,
  rating: Net.renderRating,
  social: Net.renderSocial
};
const SCREEN_MOUNT = {
  hunt: Screens.mountHunt,
  inventory: Screens.mountInventory,
  hero: Screens.mountHero,
  pets: Screens.mountPets,
  dungeons: Screens.mountDungeons,
  tower: Screens.mountTower,
  quests: Screens.mountQuests,
  pvp: Net.mountPvp,
  guild: Net.mountGuild,
  market: Net.mountMarket,
  rating: Net.mountRating,
  social: Net.mountSocial
};

export const api = {
  rerender(){ render(); },
  refreshHeader(){ refreshHeader(); },
  attack(manual){ doAttack(manual); },
  openItem(uid){ openItemModal(uid); },
  showLoot(item, title){ showLootOverlay(item, title); },
  showDungeonResult(res){ showDungeonResult(res); },
  showConnect(){ showConnectModal(); },
  setScreen,

  /** Забрать актуальное сохранение из облака (после сделок на рынке). */
  async syncFromCloud(){
    if(!cloud.ready()) return null;
    const remote = await cloud.loadProgress();
    if(remote?.state){
      const cur = getState();
      setState({ ...remote.state, settings: cur.settings });
      render(); refreshHeader();
      return remote;
    }
    return null;
  },

  /** Отправить локальное сохранение в облако. */
  async pushToCloud(){
    if(!cloud.ready()) return null;
    return cloud.saveProgress(getState());
  },

  /** Выйти из игры к форме входа. */
  async toAuth(){
    await cloud.signOut().catch(()=>{});
    stopLoop();
    $('#game').hidden = true;
    $('#auth').hidden = false;
    note('');
  }
};

/* ==================================================================
   ЗАПУСК
   ================================================================== */
export async function boot(){
  const fill = document.getElementById('boot-fill');
  const step = async (pct) => { if(fill) fill.style.width = pct + '%'; await new Promise(r => setTimeout(r, 60)); };

  await step(12);
  await initCloud().catch(() => {});
  await step(18);
  const { data } = await loadProgress();
  if(data && data.v){
    setState({ ...defaults(), ...data });
    if(!getState().settings) getState().settings = { sound:true, ambience:false };
  }
  await step(46);
  initAsh();
  await step(72);

  const session = cloud.ready() ? await cloud.session().catch(() => null) : null;
  await step(92);

  if(session?.user){
    await startGame(session.user);
  } else {
    $('#boot').hidden = true;
    $('#auth').hidden = false;
    bindAuth();
  }
  await step(100);
  setTimeout(() => { $('#boot').hidden = true; }, 120);
}

export async function startGame(user){
  const gs = getState();
  if(user){
    gs.nick = user.user_metadata?.nick || user.email?.split('@')[0] || 'Охотник';
    gs.email = user.email;
    gs.cloud = true;
  }
  $('#auth').hidden = true;
  $('#game').hidden = false;
  bindShell();
  render();
  refreshHeader();
  startLoop();
  const paint = () => {
    const conn = connectionLabel();
    const el = $('#h-conn');
    if(el){ el.className = 'conn ' + conn.cls; el.querySelector('span').textContent = conn.text; }
  };
  paint();

  /* Облако: берём то сохранение, где прогресс больше. */
  if(user && cloud.ready()){
    try{
      const r = await cloud.reconcile(getState(), remote => {
        const cur = getState();
        setState({ ...remote, settings: cur.settings });
      });
      render(); refreshHeader();
      if(r.from === 'cloud'){
        toast(`Прогресс взят из облака: уровень ${getState().level}`, 'good');
      } else if(r.fair === false){
        toast('Сохранение помечено для проверки и не попадает в рейтинг', 'bad');
      }
    }catch(e){
      toast('Облако недоступно — продолжаем локально', 'bad');
    }
    paint();
  }
}

/* ==================================================================
   АВТОРИЗАЦИЯ
   ================================================================== */
function bindAuth(){
  $$('.atab').forEach(b => {
    b.onclick = () => {
      authMode = b.dataset.amode;
      $$('.atab').forEach(x => x.classList.toggle('on', x === b));
      $('#fld-pass').hidden = authMode === 'reset';
      $('#fld-nick').hidden = authMode !== 'register';
      $('#a-submit').textContent =
        authMode === 'login' ? 'Войти' : authMode === 'register' ? 'Создать героя' : 'Отправить ссылку';
      note('');
    };
  });

  $('#auth-form').onsubmit = async (e) => {
    e.preventDefault();
    const email = $('#a-email').value.trim();
    const pass = $('#a-pass').value;

    if(!cloud.ready()){
      note('Вход и регистрация требуют подключения Supabase. Пока доступен локальный режим.', false);
      return;
    }
    unlock();
    note('…', true);
    try{
      if(authMode === 'register'){
        if(pass.length < 6) throw new Error('Пароль короче 6 символов');
        const nick = $('#a-nick').value.trim() || 'Охотник';
        const res = await cloud.signUp(email, pass, nick);
        if(res?.user && !res?.session){
          note('Письмо отправлено. Подтвердите email, затем войдите.', true);
        } else {
          startGame(res?.user);
        }
      } else if(authMode === 'login'){
        const res = await cloud.signIn(email, pass);
        startGame(res?.user);
      } else {
        await cloud.resetPassword(email);
        note('Ссылка для сброса отправлена на почту.', true);
      }
    }catch(err){
      note(err.message || 'Не удалось выполнить запрос', false);
      sfx.error();
    }
  };

  $('#a-offline').onclick = () => { unlock(); startGame(null); };
}

function note(text, ok){
  const el = $('#auth-note');
  if(!el) return;
  el.textContent = text;
  el.className = 'auth-note' + (ok ? ' ok' : '');
}

/* ==================================================================
   ОБОЛОЧКА
   ================================================================== */
function bindShell(){
  $$('[data-screen]').forEach(b => {
    b.onclick = () => {
      if(b.dataset.screen === 'more'){ $('#sidebar').classList.add('open'); return; }
      setScreen(b.dataset.screen);
      $('#sidebar').classList.remove('open');
    };
  });

  $('#h-menu').onclick = () => $('#sidebar').classList.toggle('open');
  $('#h-profile').onclick = () => setScreen('hero');
  $('#h-bell').onclick = () => setScreen('quests');

  $('#h-loot').onclick = () => {
    if(!lootQueue.length) return;
    if(anyOverlayOpen()){ toast('Сначала закройте открытое окно'); return; }
    openLootCard(lootQueue[0]);
  };

  $('#h-sound').onclick = () => {
    unlock();
    const gs = getState();
    gs.settings.sound = !gs.settings.sound;
    setEnabled(gs.settings.sound);
    if(gs.settings.sound){ sfx.ui(); startAmbienceMaybe(); } else { stopAmbience(); }
    $('#h-sound').classList.toggle('muted', !gs.settings.sound);
    $('#h-sound').textContent = gs.settings.sound ? '♪' : '♪̸';
    saveSoon(getState);
  };

  document.addEventListener('keydown', (e) => {
    if($('#game').hidden) return;
    if(e.code === 'Space' && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)){
      e.preventDefault();
      doAttack(true);
    }
  });

  window.addEventListener('beforeunload', () => { saveNow(getState); });
  document.addEventListener('visibilitychange', () => {
    if(document.hidden) saveNow(getState);
  });
}

function startAmbienceMaybe(){
  const gs = getState();
  if(gs.settings.ambience && gs.settings.sound) startAmbience();
}

export function setScreen(name){
  if(!SCREEN_RENDER[name]) name = 'hunt';
  screen = name;
  $$('[data-screen]').forEach(b => b.classList.toggle('on', b.dataset.screen === name));
  render();
  const stage = $('#stage');
  if(stage) stage.scrollTop = 0;
  sfx.ui();
  setTimeout(drainLoot, 120);
}

function render(){
  const stage = $('#stage');
  if(!stage) return;
  const fn = SCREEN_RENDER[screen] || Screens.renderHunt;
  stage.innerHTML = fn();
  const mount = SCREEN_MOUNT[screen];
  if(mount) mount(api);
  refreshHeader();
  updateBadges();
}

function refreshHeader(){
  const gs = getState();
  const st = stats();
  const set = (sel, val) => { const el = $(sel); if(el) el.textContent = val; };
  set('#h-gold', n(gs.gold));
  set('#h-level', gs.level);
  set('#h-power', n(st.power));
  set('#h-nick', gs.nick || 'Охотник');
  const av = $('#h-avatar');
  if(av) av.textContent = (gs.nick || 'L')[0].toUpperCase();
}

function updateBadges(){
  const rc = readyCount();
  const items = getState().inv.length;
  [['#n-q', rc], ['#dk-q', rc], ['#n-inv', items], ['#dk-inv', items]].forEach(([sel, v]) => {
    const el = $(sel);
    if(!el) return;
    el.textContent = v;
    el.classList.toggle('zero', !v);
  });
}

/* ==================================================================
   ИГРОВОЙ ЦИКЛ
   ================================================================== */
function stopLoop(){
  running = false;
  if(loopId) cancelAnimationFrame(loopId);
  loopId = null;
}

function startLoop(){
  if(running) return;
  running = true;
  lastT = performance.now();
  loopId = requestAnimationFrame(frame);
}

function frame(now){
  const dt = Math.min((now - lastT) / 1000, 1.5);
  lastT = now;

  tickCombat(dt);

  const st = stats();
  if(st.autoInterval > 0){
    autoT += dt;
    if(autoT >= st.autoInterval){ autoT = 0; doAttack(false); }
  }

  saveT += dt;
  if(saveT >= 8){ saveT = 0; saveNow(getState); }

  if(cloud.ready()){
    cloudT += dt;
    if(cloudT >= 30){ cloudT = 0; cloud.saveProgress(getState()).catch(() => {}); }
  }

  loopId = requestAnimationFrame(frame);
}

/* ==================================================================
   АТАКА
   ================================================================== */
function doAttack(manual){
  const now = performance.now();
  if(manual && now - clickLock < stats().clickInterval * 1000) return;
  clickLock = now;

  const gs = getState();
  if(gs.hp <= 0){ toast('Вы обессилены — подождите восстановления', 'bad'); return; }

  const res = attack(manual);
  if(res.blocked) return;

  const portrait = $('#boss-portrait');
  const pt = hitPoint(portrait);
  damageNumber(pt.x, pt.y, res.dmg, res.isCrit);
  if(portrait){
    portrait.classList.remove('hit');
    void portrait.offsetWidth;
    portrait.classList.add('hit');
    flash(portrait);
  }
  if(res.isCrit){ sfx.crit(); shake($('.arena-main'), 10); }
  else sfx.hit();

  if(manual){
    import('../systems/quests.js').then(m => m.onAttack());
  }

  updateBossBar();
  refreshHeader();

  if(res.killed) onBossKilled(res);

  saveSoon(getState);
}

function updateBossBar(){
  const gs = getState();
  const boss = currentBoss();
  const pct = Math.max(0, gs.boss.hp / boss.maxHp * 100);
  const fill = $('#hpfill'), text = $('#hptext'), ghost = $('#hpghost');
  if(fill) fill.style.width = pct + '%';
  if(text) text.textContent = `${n(gs.boss.hp)} / ${n(boss.maxHp)}`;
  if(ghost){
    ghost.style.width = pct + '%';
    setTimeout(() => { if(ghost) ghost.style.width = pct + '%'; }, 10);
  }
}

function onBossKilled(res){
  const portrait = $('#boss-portrait');
  const pt = hitPoint(portrait);
  burstParticles(pt.x, pt.y, '201,164,106', 34);
  sfx.bossDeath();
  shake($('.arena-main'), 16);

  if(portrait) portrait.classList.add('dying');

  const rewards = res.rewards;
  setTimeout(() => {
    if(rewards?.gold){ sfx.coin(); }
    toast(`Босс пал · +${n(rewards.gold)} ◈ · +${n(rewards.xp)} ✦`, 'good');
    if(rewards.item) showLootOverlay(rewards.item, 'Добыча');
    if(rewards.levels){ sfx.levelUp(); toast(`Новый уровень: ${getState().level}!`, 'good'); }

    const got = checkAch();
    got.forEach(a => toast(`🏆 Достижение: ${a.name}`, 'good'));

    resetCombatTimer();
    render();
    const p = $('#boss-portrait');
    if(p) p.classList.add('spawn');
    updateBadges();
  }, Screens.motionOff ? 60 : 900);
}

/* ==================================================================
   МОДАЛКИ
   ================================================================== */
export function openItemModal(uid){
  const gs = getState();
  const it = gs.inv.find(i => i.uid === uid);
  if(!it) return;
  const r = RAR_BY_ID[it.rarity] || RAR_BY_ID.common;
  const isEq = Object.values(gs.equip).includes(uid);

  const html = `
  <div class="mbox" style="--rc:${r.color};--rg:${r.glow};border-color:${r.color}">
    <h3 style="color:${r.color}">${it.icon} ${esc(it.name)}</h3>
    <div style="font-family:var(--f-art);font-style:italic;color:var(--muted);margin-bottom:12px">
      ${esc(it.modName)} · ${esc(slotLabel(it.slot))} · уровень ${it.level}
    </div>
    <div class="loot-stats" style="text-align:left">
      ${Object.entries(it.stats).map(([k, v]) =>
        `<div style="display:flex;justify-content:space-between">
           <span class="mut">${STAT_LABELS[k] || k}</span>
           <b>+${v}${STAT_SUFFIX[k] || ''}</b>
         </div>`).join('')}
    </div>
    <div class="stat" style="border:0"><span>Сила предмета</span><b>${itemPower(it)}</b></div>
    <div class="stat" style="border:0"><span>Цена продажи</span><b class="gold">${n(Math.round(it.price * 0.4))} ◈</b></div>
    <div class="row" style="margin-top:16px">
      <button class="btn ${isEq ? '' : 'btn-gold'}" id="mi-eq">${isEq ? 'Снять' : 'Надеть'}</button>
      <button class="btn" id="mi-lock">${it.locked ? 'Снять блок' : 'Заблокировать'}</button>
      <button class="btn btn-blood" id="mi-sell" ${it.locked || isEq ? 'disabled' : ''}>Продать</button>
      <button class="btn btn-ghost" id="mi-close">Закрыть</button>
    </div>
  </div>`;

  const ov = $('#ov-modal');
  openOverlay(ov, html);
  sfx.ui();

  $('#mi-close').onclick = () => closeOverlay(ov);
  ov.onclick = (e) => { if(e.target === ov) closeOverlay(ov); };

  $('#mi-eq').onclick = () => {
    if(isEq) unequip(it.slot); else equip(uid);
    sfx.buy(); toast(isEq ? 'Снято' : 'Надето', 'good');
    closeOverlay(ov); render(); saveSoon(getState);
  };
  $('#mi-lock').onclick = () => {
    const locked = toggleLock(uid);
    sfx.ui(); toast(locked ? 'Предмет защищён от продажи' : 'Блокировка снята', 'good');
    closeOverlay(ov); render(); saveSoon(getState);
  };
  $('#mi-sell').onclick = () => {
    const got = sellItem(uid);
    if(got){ sfx.coin(); toast(`Продано за ${n(got)} ◈`, 'good'); }
    closeOverlay(ov); render(); refreshHeader(); saveSoon(getState);
  };
}

/* Добыча не вырывает управление: пока открыто окно или игрок не на охоте,
   предметы складываются в очередь и забираются кнопкой в шапке. */
const lootQueue = [];
const OV_IDS = ['#ov-loot', '#ov-modal', '#ov-connect'];

function anyOverlayOpen(){
  return OV_IDS.some(id => { const e = $(id); return e && !e.hidden; });
}
function updateLootBadge(){
  const b = $('#h-loot'), c = $('#h-loot-n');
  if(!b) return;
  const k = lootQueue.length;
  b.hidden = k === 0;
  if(c) c.textContent = k;
  b.classList.toggle('pulse', k > 0);
}

export function showLootOverlay(item, title = 'Добыча'){
  if(!item) return;
  lootQueue.push({ item, title });
  import('../systems/quests.js').then(m => m.onItemGot());

  const r = RAR_BY_ID[item.rarity] || RAR_BY_ID.common;
  const rare = item.rarity === 'legendary' || item.rarity === 'secret' || item.rarity === 'mythic';
  toast(`Добыча · ${r.name}: ${item.name}`, rare ? 'good' : '');
  updateLootBadge();
  drainLoot();
}

export function drainLoot(){
  if(!lootQueue.length || anyOverlayOpen()) return;
  if(screen !== 'hunt'){ updateLootBadge(); return; }
  openLootCard(lootQueue[0]);
}

function openLootCard(entry){
  const { item, title } = entry;
  const r = RAR_BY_ID[item.rarity] || RAR_BY_ID.common;
  const left = lootQueue.length;

  const html = `
  <div class="loot-card ${r.css}" style="--rc:${r.color};--rg:${r.glow}">
    <div class="lk">${esc(title)} · ${r.name}</div>
    <div class="ln">${item.icon} ${esc(item.name)}</div>
    <div class="lm">${esc(item.modName)}</div>
    <div class="loot-stats">
      ${Object.entries(item.stats).map(([k, v]) =>
        `<div style="display:flex;justify-content:space-between;max-width:230px;margin:0 auto;width:100%">
           <span class="mut">${STAT_LABELS[k] || k}</span><b>+${v}${STAT_SUFFIX[k] || ''}</b>
         </div>`).join('')}
    </div>
    <button class="btn btn-gold btn-block" id="loot-ok">${left > 1 ? `Забрать · ещё ${left - 1}` : 'Забрать'}</button>
  </div>`;

  const ov = $('#ov-loot');
  openOverlay(ov, html);
  if(item.rarity === 'legendary' || item.rarity === 'secret') sfx.legendary();
  else sfx.loot();

  const take = () => {
    if(!lootQueue.length) return;
    lootQueue.shift();
    closeOverlay(ov);
    sfx.ui();
    updateLootBadge();
    updateBadges();
    render();
    setTimeout(drainLoot, 180);
  };
  $('#loot-ok').onclick = take;
  ov.onclick = (e) => { if(e.target === ov) take(); };
}

export function showDungeonResult(res){
  const d = res.dungeon;
  const html = `
  <div class="mbox">
    <h3>${esc(d.name)} — пройдено</h3>
    <div class="stat" style="border:0"><span>Золото</span><b class="gold">+${n(res.gold)} ◈</b></div>
    <div class="stat" style="border:0"><span>Опыт</span><b class="arcane">+${n(res.xp)} ✦</b></div>
    ${res.first ? `<div class="stat" style="border:0"><span>Уникальная награда</span><b class="gold">${esc(d.unique)}</b></div>` : ''}
    ${res.item ? `<div class="stat" style="border:0"><span>Добыча</span><b>${esc(res.item.modName)} ${esc(res.item.name)}</b></div>` : ''}
    <button class="btn btn-gold btn-block" id="dr-ok" style="margin-top:14px">Отлично</button>
  </div>`;
  const ov = $('#ov-modal');
  openOverlay(ov, html);
  $('#dr-ok').onclick = () => {
    closeOverlay(ov);
    if(res.item) showLootOverlay(res.item, 'Добыча из подземелья');
  };
  ov.onclick = (e) => { if(e.target === ov) closeOverlay(ov); };
}

export async function showConnectModal(){
  const cfg = cloud.config ? cloud.config : { url:'' };
  const user = cloud.ready() ? await cloud.user().catch(() => null) : null;
  const label = !cloud.ready() ? 'не подключён'
    : user ? 'подключён · ' + (getState().nick || 'герой') : 'подключён, вход не выполнен';

  const html = `
  <div class="mbox">
    <h3>Облако и мультиплеер</h3>
    <div class="stat" style="border:0"><span>Состояние</span><b class="${user ? 'gold' : ''}">${esc(label)}</b></div>
    <div class="stat" style="border:0"><span>База</span><b class="mut small">${esc(cfg.url || '—')}</b></div>

    <p style="font-size:13px;color:var(--muted);line-height:1.7;margin:12px 0 0;text-align:left">
      Что работает через сервер: облачное сохранение, рейтинговые дуэли, арена, турнир недели,
      гильдии с общим рейдом и чатом, рынок и общая таверна. Бой, сделка и удар по рейду
      считаются в базе — клиент присылает только намерение, поэтому «накрутить» результат нельзя:
      сила, шанс крита, защита и здоровье пересчитываются сервером по формулам игры.
    </p>
    <p style="font-size:12.5px;color:var(--faint);line-height:1.7;margin:10px 0 0;text-align:left">
      Ограничение честно: прогресс растёт в браузере, поэтому полностью исключить подмену
      сохранения нельзя. Подозрительные профили помечаются и не попадают в рейтинг.
      Никаких реальных платежей в игре нет — только игровое золото.
    </p>

    <details style="margin-top:14px;text-align:left">
      <summary style="cursor:pointer;color:var(--gold);font-size:12.5px">Как поднять свой сервер</summary>
      <ol style="font-size:12.5px;color:var(--muted);line-height:1.9;padding-left:18px;margin-top:8px">
        <li>Создайте проект на <b>supabase.com</b> — бесплатного тарифа достаточно.</li>
        <li>Выполните миграции из <b>supabase/migrations</b> (схема, политики RLS, процедуры боёв и рынка).</li>
        <li>В <b>Project Settings → API</b> возьмите <b>Project URL</b> и <b>anon public</b> ключ.</li>
        <li>Вставьте их в <b>js/config.js</b>. Ключ <b>service_role</b> в браузер передавать нельзя.</li>
        <li>Включите <b>Row Level Security</b> — это сделано в миграциях, выключать не нужно.</li>
      </ol>
    </details>

    <div class="row" style="gap:8px;margin-top:14px">
      <button class="btn btn-gold" id="cn-ok">Понятно</button>
      ${user ? '<button class="btn btn-ghost" id="cn-out">Выйти из аккаунта</button>' : ''}
    </div>
  </div>`;

  const ov = $('#ov-connect');
  openOverlay(ov, html);
  $('#cn-ok').onclick = () => closeOverlay(ov);
  const out = $('#cn-out');
  if(out) out.onclick = async () => { closeOverlay(ov); await api.toAuth(); };
  ov.onclick = (e) => { if(e.target === ov) closeOverlay(ov); };
}

export function resetProgress(){
  resetState();
  saveNow(getState);
  render();
  refreshHeader();
}

/* Отладочный доступ из консоли: состояние, характеристики и управление экранами.
   Полезно при разработке и для диагностики сохранений. */
if(typeof window !== 'undefined'){
  window.LOOTORA = {
    get state(){ return getState(); },
    get stats(){ return stats(); },
    get boss(){ return currentBoss(); },
    api, setScreen, resetProgress,
    save: () => saveNow(getState)
  };
}
