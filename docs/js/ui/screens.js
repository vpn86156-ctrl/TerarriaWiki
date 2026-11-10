/* Экраны игры. Каждый возвращает разметку и монтирует свои обработчики. */
import {
  getState, stats, currentBoss, xpToNext, activePetData,
  UPGRADES, UPG_BY_ID, upgradeCost, spendGold, addGold, combatPower
} from '../core/state.js';
import { RARITIES, RAR_BY_ID, RAR_INDEX } from '../data/rarities.js';
import { SLOT_NAMES, STAT_LABELS, STAT_SUFFIX, MODIFIERS, itemPower } from '../data/items.js';
import { PETS, petById, petRarity, petUpgradeCost, PET_BONUS_LABELS } from '../data/pets.js';
import { DUNGEONS } from '../data/dungeons.js';
import { ACHIEVEMENTS } from '../systems/achievements.js';
import { query, equip, unequip, sellItem, toggleLock, sellAll, slotLabel, INV_LIMIT } from '../systems/inventory.js';
import { ensureDaily, claim, readyCount } from '../systems/quests.js';
import { floorPower, floorReward } from '../systems/tower.js';
import { canEnter } from '../systems/dungeons.js';
import { cloud, connectionLabel } from '../core/supabase.js';
import { sfx } from '../core/audio.js';
import { toast, damageNumber, hitPoint, shake, flash, burstParticles } from './fx.js';

export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
const n = v => Math.round(v).toLocaleString('ru-RU');
const short = v => {
  if(v >= 1e12) return (v/1e12).toFixed(2) + ' трлн';
  if(v >= 1e9)  return (v/1e9).toFixed(2) + ' млрд';
  if(v >= 1e6)  return (v/1e6).toFixed(2) + ' млн';
  if(v >= 1e3)  return (v/1e3).toFixed(1) + ' тыс';
  return String(Math.round(v));
};

/* ==================================================================
   ОХОТА
   ================================================================== */
export function renderHunt(){
  const gs = getState();
  const st = stats();
  const boss = currentBoss();
  const pct = Math.max(0, (gs.boss.hp / boss.maxHp) * 100);
  const pet = activePetData();

  return `
  <div class="screen">
    <h1 class="screen-title">ОХОТА</h1>
    <p class="screen-sub">${esc(boss.category)} · круг ${boss.loop + 1}</p>

    <div class="arena">
      <section class="panel arena-main">
        <div class="arena-bg"></div>
        <div class="boss-stage">
          <div class="boss-portrait" id="boss-portrait" style="--boss-rgb:${boss.rgb}">
            <img src="${boss.img}" alt="${esc(boss.name)}" id="boss-img" draggable="false">
            <div class="flash"></div>
          </div>

          <div class="boss-name" id="boss-name">${esc(boss.name)}</div>
          <div class="boss-title" id="boss-title">${esc(boss.title)}</div>
          <div class="boss-lvl" id="boss-lvl">Уровень ${boss.level} · tier ${boss.tier}</div>

          <div class="hpwrap">
            <div class="hpbar" id="hpbar">
              <div class="hpghost" id="hpghost" style="width:${pct}%"></div>
              <i id="hpfill" style="width:${pct}%"></i>
              <b id="hptext">${short(gs.boss.hp)} / ${short(boss.maxHp)}</b>
            </div>
            <div class="hpmeta">
              <span class="dps" id="boss-dps">Сила: ${n(st.power)} · крит ${(st.crit*100).toFixed(1)}%</span>
              <span id="boss-atk">${esc(boss.attacks[0])}</span>
            </div>
          </div>

          <div class="attack-zone">
            <button class="attack-btn" id="btn-attack">ATTACK</button>
            <div class="attack-hint">Пробел — быстрая атака</div>
            <span class="auto-badge ${st.autoLvl ? '' : 'off'}" id="auto-badge">
              ${st.autoLvl ? 'Авто-атака ур.' + st.autoLvl : 'Авто-атака не куплена'}
            </span>
          </div>
          <div class="arena-floor"></div>
        </div>
      </section>

      <aside class="panel">
        <div class="panel-h"><h3>Охотник</h3><span class="sub">${esc(gs.nick)}</span></div>
        <div class="panel-b">
          <div class="statlist">
            <div class="stat"><span>✦ Уровень</span><b class="gold">${gs.level}</b></div>
            <div class="stat"><span>◈ Золото</span><b class="gold" id="s-gold">${n(gs.gold)}</b></div>
            <div class="stat"><span>⚔ Сила атаки</span><b id="s-power">${n(st.power)}</b></div>
            <div class="stat"><span>✧ Шанс крита</span><b>${(st.crit*100).toFixed(1)}%</b></div>
            <div class="stat"><span>☠ Крит. урон</span><b>×${st.critDmg.toFixed(2)}</b></div>
            <div class="stat"><span>⏵ Скорость</span><b>${st.clickInterval.toFixed(2)} с</b></div>
            <div class="stat"><span>▣ Защита</span><b>${n(st.defense)} <span class="mut small">(-${Math.round(st.dr*100)}% урона)</span></b></div>
            <div class="stat"><span>☠ Побед</span><b>${n(gs.bossKills)}</b></div>
            <div class="stat"><span>★ Лучший удар</span><b class="arcane">${n(gs.maxHit)}</b></div>
          </div>

          <div class="xpbar"><i style="width:${Math.min(100, gs.xp / xpToNext(gs.level) * 100)}%"></i></div>
          <div class="stat" style="border:0;padding-top:6px">
            <span>Опыт</span><b>${n(gs.xp)} / ${n(xpToNext(gs.level))}</b>
          </div>

          <div class="stat" style="border:0">
            <span>❤ Здоровье</span><b class="${gs.hp < st.hpMax*0.3 ? 'blood' : ''}">${n(gs.hp)} / ${n(st.hpMax)}</b>
          </div>
          <div class="xpbar" style="margin-top:4px"><i style="width:${Math.min(100, gs.hp/st.hpMax*100)}%;background:linear-gradient(90deg,#8F2635,#C23B4C)"></i></div>

          ${pet ? `
          <div class="pet-slot">
            <img src="${pet.img}" alt="${esc(pet.name)}">
            <div>
              <div class="pn">${esc(pet.name)} <span class="mut small">ур.${pet.level}</span></div>
              <div class="pb">${Object.entries(pet.bonus).map(([k,v]) =>
                `+${Math.round(v*100)}% ${PET_BONUS_LABELS[k] || k}`).join(', ')}</div>
            </div>
          </div>` : `
          <div class="pet-slot">
            <div style="width:42px;height:42px;flex:0 0 42px;border-radius:8px;background:#0A0B0F;display:grid;place-items:center;color:#3A4052">☾</div>
            <div><div class="pn mut">Нет питомца</div><div class="pb mut" style="color:var(--faint)">Найдите во вкладке «Питомцы»</div></div>
          </div>`}
        </div>
      </aside>
    </div>

    <section class="panel" style="margin-top:14px">
      <div class="panel-h"><h3>Легенда</h3><span class="sub">${esc(boss.attacks.join(' · '))}</span></div>
      <div class="panel-b">
        <p style="font-family:var(--f-art);font-style:italic;font-size:15px;color:var(--muted);line-height:1.7">${esc(boss.lore)}</p>
      </div>
    </section>
  </div>`;
}

export function mountHunt(api){
  const btn = document.getElementById('btn-attack');
  if(btn) btn.onclick = () => { sfx.click(); api.attack(true); };
}

/* ==================================================================
   ИНВЕНТАРЬ
   ================================================================== */
let invFilter = { rarity:'all', slot:'all', sort:'power', q:'' };

function itemCard(it){
  const r = RAR_BY_ID[it.rarity] || RAR_BY_ID.common;
  const statsRows = Object.entries(it.stats)
    .map(([k, v]) => `<div>+${v}${STAT_SUFFIX[k] || ''} ${STAT_LABELS[k] || k}</div>`).join('');
  return `
  <div class="item ${r.css} ${it.equipped ? 'equipped' : ''} ${it.locked ? 'locked' : ''}"
       data-item="${it.uid}" style="--rc:${r.color};--rg:${r.glow}">
    <div class="item-name">${it.icon} ${esc(it.name)}</div>
    <div class="item-mod">${esc(it.modName)} · ${esc(slotLabel(it.slot))}</div>
    <div class="item-stats">${statsRows}</div>
    <div class="item-foot">
      <span>${n(it.price)} ◈</span>
      <span class="mut">сила ${itemPower(it)}</span>
    </div>
  </div>`;
}

export function renderInventory(){
  const gs = getState();
  const list = query(invFilter);
  const rarChips = [['all','Все'], ...RARITIES.map(r => [r.id, r.name])];

  return `
  <div class="screen">
    <h1 class="screen-title">ИНВЕНТАРЬ</h1>
    <p class="screen-sub">${gs.inv.length} из ${INV_LIMIT} · нажмите на предмет, чтобы надеть, продать или заблокировать</p>

    <div class="inv-tools">
      <input id="inv-q" placeholder="Поиск по названию…" value="${esc(invFilter.q)}">
      <select id="inv-slot">
        <option value="all"${invFilter.slot==='all'?' selected':''}>Все слоты</option>
        ${Object.entries(SLOT_NAMES).map(([k,v]) =>
          `<option value="${k}"${invFilter.slot===k?' selected':''}>${v}</option>`).join('')}
      </select>
      <select id="inv-sort">
        <option value="power"${invFilter.sort==='power'?' selected':''}>По силе</option>
        <option value="rarity"${invFilter.sort==='rarity'?' selected':''}>По редкости</option>
        <option value="price"${invFilter.sort==='price'?' selected':''}>По цене</option>
        <option value="new"${invFilter.sort==='new'?' selected':''}>Сначала новые</option>
      </select>
      ${rarChips.map(([id,name]) =>
        `<button class="chipf ${invFilter.rarity===id?'on':''}" data-rar="${id}">${name}</button>`).join('')}
    </div>

    ${gs.inv.length === 0
      ? `<div class="empty"><b>ПУСТО</b>Победите босса — первая добыча не заставит себя ждать.</div>`
      : list.length === 0
        ? `<div class="empty"><b>НИЧЕГО НЕ НАЙДЕНО</b>Измените фильтры или очистите поиск.</div>`
        : `<div class="inv-grid">${list.map(itemCard).join('')}</div>`}

    ${gs.inv.length > 0 ? `
    <section class="panel" style="margin-top:16px">
      <div class="panel-h"><h3>Быстрая продажа</h3><span class="sub">сдаёте за 40% стоимости</span></div>
      <div class="panel-b row">
        <button class="btn btn-sm" data-sellrar="common">Обычные</button>
        <button class="btn btn-sm" data-sellrar="common,rare">Обычные и редкие</button>
        <button class="btn btn-sm" data-sellrar="common,rare,superb">До сверхредких</button>
      </div>
    </section>` : ''}
  </div>`;
}

export function mountInventory(api){
  const q = document.getElementById('inv-q');
  const slot = document.getElementById('inv-slot');
  const sort = document.getElementById('inv-sort');
  if(q) q.oninput = () => { invFilter.q = q.value; api.rerender(); const el = document.getElementById('inv-q'); if(el){ el.focus(); el.setSelectionRange(el.value.length, el.value.length); } };
  if(slot) slot.onchange = () => { invFilter.slot = slot.value; api.rerender(); };
  if(sort) sort.onchange = () => { invFilter.sort = sort.value; api.rerender(); };

  document.querySelectorAll('[data-rar]').forEach(b => {
    b.onclick = () => { invFilter.rarity = b.dataset.rar; sfx.ui(); api.rerender(); };
  });
  document.querySelectorAll('[data-item]').forEach(el => {
    el.onclick = () => api.openItem(el.dataset.item);
  });
  document.querySelectorAll('[data-sellrar]').forEach(b => {
    b.onclick = () => {
      const ids = b.dataset.sellrar.split(',');
      const res = sellAll(ids);
      if(res.count){ sfx.coin(); toast(`Продано ${res.count} предм. · +${n(res.sum)} ◈`, 'good'); }
      else { sfx.error(); toast('Нечего продавать', 'bad'); }
      api.rerender();
    };
  });
}

/* ==================================================================
   ГЕРОЙ (улучшения + достижения + профиль)
   ================================================================== */
export function renderHero(){
  const gs = getState();
  const st = stats();
  const gotCount = Object.keys(gs.ach).length;

  return `
  <div class="screen">
    <h1 class="screen-title">ГЕРОЙ</h1>
    <p class="screen-sub">${esc(gs.nick)} · уровень ${gs.level} · достижений ${gotCount} из ${ACHIEVEMENTS.length}</p>

    <div class="grid2" style="align-items:start">
      <section class="panel">
        <div class="panel-h"><h3>Улучшения</h3><span class="sub">золото: ${n(gs.gold)} ◈</span></div>
        <div class="panel-b">
          ${UPGRADES.map(u => {
            const lvl = gs.upg[u.id] || 0;
            const cost = upgradeCost(u, lvl);
            const can = gs.gold >= cost;
            return `
            <div class="upg">
              <div class="upg-ic">${u.icon}</div>
              <div class="upg-main">
                <div class="upg-name">${u.name}<span class="upg-lvl">ур.${lvl}</span></div>
                <div class="upg-desc">${u.desc}</div>
                <div class="upg-gain">${upgradeGain(u.id, lvl)}</div>
              </div>
              <button class="btn btn-sm ${can ? 'btn-gold' : ''}" data-upg="${u.id}" ${can ? '' : 'disabled'}>
                ${n(cost)} ◈
              </button>
            </div>`;
          }).join('')}
        </div>
      </section>

      <div>
        <section class="panel">
          <div class="panel-h"><h3>Показатели</h3></div>
          <div class="panel-b">
            <div class="statlist">
              <div class="stat"><span>Всего урона</span><b>${n(gs.totalDamage)}</b></div>
              <div class="stat"><span>Лучший удар</span><b class="arcane">${n(gs.maxHit)}</b></div>
              <div class="stat"><span>Атак вручную</span><b>${n(gs.clicks)}</b></div>
              <div class="stat"><span>Побед над боссами</span><b>${n(gs.bossKills)}</b></div>
              <div class="stat"><span>Круг прохождения</span><b class="gold">${gs.loop + 1}</b></div>
              <div class="stat"><span>Лучший этаж башни</span><b>${gs.tower.best}</b></div>
              <div class="stat"><span>Подземелий пройдено</span><b>${Object.keys(gs.dungeons).length}</b></div>
              <div class="stat"><span>Предметов в коллекции</span><b>${gs.inv.length}</b></div>
            </div>
          </div>
        </section>

        <section class="panel" style="margin-top:12px">
          <div class="panel-h"><h3>Достижения</h3><span class="sub">${gotCount} / ${ACHIEVEMENTS.length}</span></div>
          <div class="panel-b">
            <div class="grid2" style="gap:8px">
              ${ACHIEVEMENTS.map(a => `
                <div class="ach ${gs.ach[a.id] ? 'got' : ''}">
                  <div class="ach-ic">${a.icon}</div>
                  <div>
                    <div style="font-weight:600">${a.name}</div>
                    <div class="mut small">${a.desc}</div>
                  </div>
                </div>`).join('')}
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>`;
}

function upgradeGain(id, lvl){
  const next = lvl + 1;
  switch(id){
    case 'weapon':  return `→ +${next * 2} к силе атаки`;
    case 'attack':  return `→ +${(next * 1.5).toFixed(1)} к силе атаки`;
    case 'crit':    return `→ ${(5 + next * 0.8).toFixed(1)}% шанс крита`;
    case 'critdmg': return `→ ×${(1.5 + next * 0.08).toFixed(2)} крит. урона`;
    case 'speed':   return `→ +${next * 7}% скорости`;
    case 'auto':    return lvl === 0 ? '→ открывает авто-атаку' : `→ интервал ${(Math.max(0.22, 2.4/(1+next*0.55))).toFixed(2)} с`;
    case 'defense': return `→ +${next * 6} защиты`;
    case 'gold':    return `→ +${next * 6}% золота`;
    case 'xp':      return `→ +${next * 5}% опыта`;
    default:        return '';
  }
}

export function mountHero(api){
  document.querySelectorAll('[data-upg]').forEach(b => {
    b.onclick = () => {
      const u = UPG_BY_ID[b.dataset.upg];
      const lvl = getState().upg[u.id] || 0;
      const cost = upgradeCost(u, lvl);
      if(!spendGold(cost)){ sfx.error(); toast('Не хватает золота', 'bad'); return; }
      getState().upg[u.id] = lvl + 1;
      sfx.buy();
      import('../systems/quests.js').then(m => m.onUpgrade());
      api.rerender();
      api.refreshHeader();
    };
  });
}

/* ==================================================================
   ПИТОМЦЫ
   ================================================================== */
export function renderPets(){
  const gs = getState();
  return `
  <div class="screen">
    <h1 class="screen-title">ПИТОМЦЫ</h1>
    <p class="screen-sub">Спутник даёт постоянный бонус. Улучшайте его золотом.</p>

    <div class="grid2" style="grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:12px">
      ${PETS.map(p => {
        const owned = gs.pets.find(x => x.id === p.id);
        const r = petRarity(p);
        const lvl = owned?.level || 0;
        const cost = petUpgradeCost(p, lvl || 1);
        const active = gs.activePet === p.id;
        return `
        <div class="pet-card ${r.css} ${active ? 'on' : ''}" style="--rc:${r.color};--rg:${r.glow}" data-pet="${owned ? p.id : ''}">
          <img src="${p.img}" alt="${esc(p.name)}">
          <div class="pn">${esc(p.name)}</div>
          <div class="pb">${Object.entries(p.bonus).map(([k,v]) => `+${Math.round(v*100)}% ${PET_BONUS_LABELS[k]||k}`).join(', ')}</div>
          <div class="pl">${r.name}${lvl ? ' · ур.' + lvl : ' · не получен'}</div>
          <div style="margin-top:8px">
            ${owned
              ? `<button class="btn btn-sm ${active ? '' : 'btn-gold'}" data-act="${active ? 'off' : 'on'}" data-petid="${p.id}">
                   ${active ? 'Снять' : 'Надеть'}
                 </button>
                 <button class="btn btn-sm" data-petup="${p.id}" ${gs.gold >= cost ? '' : 'disabled'} style="margin-top:6px">
                   Улучшить · ${n(cost)} ◈
                 </button>`
              : `<button class="btn btn-sm btn-gold" data-buypet="${p.id}" ${gs.gold >= p.baseCost ? '' : 'disabled'}>
                   Нанять · ${n(p.baseCost)} ◈
                 </button>`}
          </div>
        </div>`;
      }).join('')}
    </div>

    <section class="panel" style="margin-top:16px">
      <div class="panel-h"><h3>О спутниках</h3></div>
      <div class="panel-b">
        <p style="font-size:13px;color:var(--muted);line-height:1.7">
          Бонус питомца умножается на его уровень: каждый уровень добавляет 42% к базовому эффекту.
          В коллекции пока ${PETS.length} существ — дальше будут редкие фамильяры из подземелий и башни.
        </p>
      </div>
    </section>
  </div>`;
}

export function mountPets(api){
  document.querySelectorAll('[data-buypet]').forEach(b => {
    b.onclick = () => {
      const p = petById(b.dataset.buypet);
      const gs = getState();
      if(gs.gold < p.baseCost){ sfx.error(); toast('Не хватает золота', 'bad'); return; }
      spendGold(p.baseCost);
      gs.pets.push({ id:p.id, level:1 });
      gs.activePet = p.id;
      sfx.legendary();
      toast('Питомец получен: ' + p.name, 'good');
      api.rerender(); api.refreshHeader();
    };
  });
  document.querySelectorAll('[data-petup]').forEach(b => {
    b.onclick = () => {
      const gs = getState();
      const p = petById(b.dataset.petup);
      const own = gs.pets.find(x => x.id === p.id);
      if(!own) return;
      const cost = petUpgradeCost(p, own.level);
      if(!spendGold(cost)){ sfx.error(); toast('Не хватает золота', 'bad'); return; }
      own.level++;
      sfx.buy();
      toast(`${p.name}: уровень ${own.level}`, 'good');
      api.rerender(); api.refreshHeader();
    };
  });
  document.querySelectorAll('[data-act]').forEach(b => {
    b.onclick = () => {
      getState().activePet = b.dataset.act === 'on' ? b.dataset.petid : null;
      sfx.ui();
      api.rerender(); api.refreshHeader();
    };
  });
}

/* ==================================================================
   ПОДЗЕМЕЛЬЯ
   ================================================================== */
export function renderDungeons(){
  const gs = getState();
  return `
  <div class="screen">
    <h1 class="screen-title">ПОДЗЕМЕЛЬЯ</h1>
    <p class="screen-sub">Каждое можно проходить сколько угодно раз. Уникальный предмет выпадает за первое прохождение.</p>

    <div class="grid2" style="grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">
      ${DUNGEONS.map(d => {
        const gate = canEnter(d, gs);
        const clears = gs.dungeons[d.id]?.clears || 0;
        return `
        <div class="dung ${gate.ok ? '' : 'locked'}">
          <h4>${esc(d.name)}</h4>
          <div class="dd">${esc(d.desc)}</div>
          <div class="dmeta">
            <span>Уровень ${d.reqLevel}+</span>
            <span class="diff">${[1,2,3,4,5].map(i => `<i class="${i <= d.difficulty ? 'on' : ''}"></i>`).join('')}</span>
            <span>${clears ? 'пройдено: ' + clears : 'ещё не пройдено'}</span>
          </div>
          <div class="dmeta">
            <span class="gold">${n(d.reward.gold)} ◈</span>
            <span class="arcane">${n(d.reward.xp)} ✦</span>
          </div>
          <div class="mut small" style="margin-top:8px;font-style:italic">${esc(d.unique)}</div>
          <div style="margin-top:10px">
            <button class="btn btn-sm ${gate.ok ? 'btn-gold' : ''}" data-dung="${d.id}" ${gate.ok ? '' : 'disabled'}>
              ${gate.ok ? 'Войти' : gate.reason}
            </button>
          </div>
        </div>`;
      }).join('')}
    </div>
  </div>`;
}

export function mountDungeons(api){
  document.querySelectorAll('[data-dung]').forEach(b => {
    b.onclick = async () => {
      const { run } = await import('../systems/dungeons.js');
      const res = run(b.dataset.dung);
      if(!res) return;
      if(!res.ok){ sfx.error(); toast(res.reason || 'Не удалось пройти', 'bad'); api.rerender(); return; }
      sfx.legendary();
      api.showDungeonResult(res);
      api.rerender(); api.refreshHeader();
    };
  });
}

/* ==================================================================
   БАШНЯ
   ================================================================== */
export function renderTower(){
  const gs = getState();
  const st = stats();
  const floor = gs.tower.floor;
  const need = floorPower(floor);
  const rw = floorReward(floor);

  const rows = [];
  const from = Math.max(1, floor - 2);
  for(let f = from; f <= from + 6; f++){
    const done = f < floor;
    const cur = f === floor;
    rows.push(`
      <div class="tower-floor ${done ? 'done' : ''} ${cur ? 'current' : ''}">
        <div>
          <div style="font-family:var(--f-display);font-weight:700;letter-spacing:.1em">Этаж ${f}</div>
          <div class="mut small">нужна сила ${n(floorPower(f))}</div>
        </div>
        <div class="mut small" style="text-align:right">
          ${n(floorReward(f).gold)} ◈ · ${n(floorReward(f).xp)} ✦
        </div>
      </div>`);
  }

  return `
  <div class="screen">
    <h1 class="screen-title">БЕСКОНЕЧНАЯ БАШНЯ</h1>
    <p class="screen-sub">Каждый этаж тяжелее предыдущего. Рекорд: ${gs.tower.best}</p>

    <div class="grid2" style="align-items:start">
      <section class="panel">
        <div class="panel-h"><h3>Этаж ${floor}</h3><span class="sub">нужна сила ${n(need)}</span></div>
        <div class="panel-b">
          <div class="statlist">
            <div class="stat"><span>Ваша боевая мощь</span><b class="gold">${n(combatPower(st))}</b></div>
            <div class="stat"><span>Награда за этаж</span><b>${n(rw.gold)} ◈ · ${n(rw.xp)} ✦</b></div>
            <div class="stat"><span>Здоровье</span><b>${n(gs.hp)} / ${n(st.hpMax)}</b></div>
          </div>
          <button class="btn btn-gold btn-block" id="btn-climb" style="margin-top:14px">Подняться на этаж ${floor}</button>
          <p class="mut small" style="margin-top:10px;line-height:1.6">
            Неудачная попытка стоит здоровья. Если оно упадёт до нуля — отступите и вернётесь сильнее.
          </p>
        </div>
      </section>

      <section class="panel">
        <div class="panel-h"><h3>Лестница</h3><span class="sub">рекорд ${gs.tower.best}</span></div>
        <div class="panel-b">${rows.join('')}</div>
      </section>
    </div>
  </div>`;
}

export function mountTower(api){
  const btn = document.getElementById('btn-climb');
  if(btn) btn.onclick = async () => {
    const { climb } = await import('../systems/tower.js');
    const res = climb();
    if(res.ok){
      sfx.levelUp();
      toast(`Этаж ${res.floor} пройден · +${n(res.gold)} ◈`, 'good');
      if(res.item) api.showLoot(res.item, 'Награда башни');
    } else {
      sfx.hurt();
      toast(`Не хватило силы: −${n(res.taken)} HP`, 'bad');
    }
    api.rerender(); api.refreshHeader();
  };
}

/* ==================================================================
   ЗАДАНИЯ
   ================================================================== */
export function renderQuests(){
  const gs = getState();
  const list = ensureDaily();
  return `
  <div class="screen">
    <h1 class="screen-title">ЗАДАНИЯ</h1>
    <p class="screen-sub">Обновляются каждый день · ${new Date().toLocaleDateString('ru-RU')}</p>

    ${list.map(q => {
      const ready = q.progress >= q.goal;
      const claimed = gs.quests.claimed.includes(q.id);
      const pct = Math.min(100, q.progress / q.goal * 100);
      return `
      <div class="quest ${ready ? 'done' : ''}">
        <div style="flex:1">
          <div style="font-size:13.5px;font-weight:600">${esc(q.label)}</div>
          <div class="mut small">${n(q.progress)} / ${n(q.goal)}</div>
          <div class="qbar"><i style="width:${pct}%"></i></div>
        </div>
        <div style="text-align:right;min-width:120px">
          <div class="gold small">${n(q.reward.gold)} ◈</div>
          <div class="arcane small">${n(q.reward.xp)} ✦</div>
          <button class="btn btn-sm ${ready && !claimed ? 'btn-gold' : ''}" style="margin-top:6px"
                  data-claim="${q.id}" ${ready && !claimed ? '' : 'disabled'}>
            ${claimed ? 'Получено' : ready ? 'Забрать' : 'В работе'}
          </button>
        </div>
      </div>`;
    }).join('')}

    <section class="panel" style="margin-top:16px">
      <div class="panel-h"><h3>Как это работает</h3></div>
      <div class="panel-b">
        <p style="font-size:13px;color:var(--muted);line-height:1.7">
          Задания формируются на текущую дату. В локальном режиме дата берётся из системы — при желании
          её можно подменить, поэтому награды за задания станут серверно-подтверждаемыми только
          после подключения Supabase. Остальной прогресс честно сохраняется и проверяется локально.
        </p>
      </div>
    </section>
  </div>`;
}

export function mountQuests(api){
  document.querySelectorAll('[data-claim]').forEach(b => {
    b.onclick = () => {
      const r = claim(b.dataset.claim);
      if(!r) return;
      sfx.coin();
      toast(`Награда: +${n(r.gold)} ◈ · +${n(r.xp)} ✦`, 'good');
      api.rerender(); api.refreshHeader();
    };
  });
}

/* ==================================================================
   МУЛЬТИПЛЕЕР
   Реализован в js/ui/net.js: данные приходят из базы, спорные действия
   (бой, сделка, рейд) считает сервер. Здесь только re-export.
   ================================================================== */
export {
  renderPvp, renderGuild, renderMarket, renderRating, renderSocial,
  mountPvp, mountGuild, mountMarket, mountRating, mountSocial
} from './net.js';
