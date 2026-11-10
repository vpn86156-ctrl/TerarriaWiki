/* Мультиплеерные экраны.
   Все данные приходят из базы. Пока игроков или лотов нет — так и пишем:
   никаких подставных соперников и сгенерированного чата.
   Спорные действия (бой, сделка, удар по рейду) выполняет сервер. */
import { esc } from './screens.js';
import { getState, stats } from '../core/state.js';
import { cloud } from '../core/supabase.js';
import { online } from '../systems/online.js';
import { RAR_BY_ID } from '../data/rarities.js';
import { toast } from './fx.js';
import { STAT_LABELS, STAT_SUFFIX } from '../data/items.js';

const n = v => Math.round(v).toLocaleString('ru-RU');
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

/* ---------- общие блоки ---------- */
const LOADER = '<div class="empty">Загружаем данные с сервера…</div>';
const box = (html, id) => `<div id="${id}">${html}</div>`;
const fail = t => `<div class="empty">${esc(t)}</div>`;
const say = (t, kind) => toast(t, kind || '');

function gate(title, text){
  return `
  <div class="needs-net">
    <div class="ni">⚿</div>
    <h4>${esc(title)}</h4>
    <p>${text}</p>
    <button class="btn btn-gold" id="net-to-auth">Войти в аккаунт</button>
  </div>`;
}

function tabs(root, items, active){
  return `<div class="tabs" data-tabs="${root}">` + items.map(([id, label]) =>
    `<button class="tab${id === active ? ' on' : ''}" data-tab="${id}">${esc(label)}</button>`
  ).join('') + '</div>';
}

function ago(iso){
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if(d < 60) return 'только что';
  if(d < 3600) return Math.floor(d / 60) + ' мин назад';
  if(d < 86400) return Math.floor(d / 3600) + ' ч назад';
  return Math.floor(d / 86400) + ' дн назад';
}

function table(head, rows){
  return `<div class="net-table"><div class="nt-head">${head.map(h => `<span>${h}</span>`).join('')}</div>
    ${rows.map(r => `<div class="nt-row">${r.map(c => `<span>${c}</span>`).join('')}</div>`).join('')}</div>`;
}

function battleLog(res, meFirst){
  const rows = (res.log || []).map(e => {
    const who = e.who === 'a' ? (meFirst ? 'Вы' : esc(res.foe.nick)) : (meFirst ? esc(res.foe.nick) : 'Вы');
    return `<div class="bl-row${e.crit ? ' crit' : ''}">
      <span class="bl-r">${e.r}</span>
      <span class="bl-who">${who}</span>
      <span class="bl-dmg">${n(e.dmg)}${e.crit ? ' ✧' : ''}</span>
      <span class="bl-hp">осталось ${n(e.hp)}</span>
    </div>`;
  }).join('');
  const head = res.draw ? 'Ничья — оба пали'
    : res.i_won ? `Победа над ${esc(res.foe.nick)}` : `Поражение от ${esc(res.foe.nick)}`;
  return `
  <div class="battle">
    <div class="bt-head ${res.draw ? 'draw' : res.i_won ? 'win' : 'lose'}">${head}</div>
    <div class="bt-side">
      <div><span class="mut">Вы</span><b>${esc(res.me.nick)}</b></div>
      <div><span class="mut">Сила</span><b>${n(res.me.power)}</b></div>
      <div><span class="mut">Здоровье</span><b>${n(res.me.hp)} / ${n(res.me.maxHp)}</b></div>
    </div>
    <div class="bt-side">
      <div><span class="mut">Соперник</span><b>${esc(res.foe.nick)}</b></div>
      <div><span class="mut">Сила</span><b>${n(res.foe.power)}</b></div>
      <div><span class="mut">Здоровье</span><b>${n(res.foe.hp)} / ${n(res.foe.maxHp)}</b></div>
    </div>
    <div class="bt-log">${rows}</div>
    <div class="bt-foot">Раундов: ${res.rounds}${res.delta !== undefined ? ` · изменение рейтинга: ${res.delta > 0 ? '+' : ''}${res.delta}` : ''}${res.points !== undefined ? ` · очков арены: +${res.points}` : ''}${res.score !== undefined ? ` · очков турнира: +${res.score}` : ''}</div>
  </div>`;
}

async function guard(api, root, fn){
  const el = $(root);
  if(!el) return;
  if(!cloud.ready()){ el.innerHTML = gate('Сервер не подключён', 'Облачные режимы работают только с базой данных. Локальный прогресс сохранён.'); bindGate(api, el); return; }
  const user = await cloud.user();
  if(!user){ el.innerHTML = gate('Нужен аккаунт', 'Войдите или создайте героя — тогда прогресс сохранится в облаке, а бои, гильдии и рынок станут доступны.'); bindGate(api, el); return; }
  try{ await fn(el, user); }
  catch(e){ el.innerHTML = fail(e.message || 'Не удалось получить данные'); }
}

function bindGate(api, root){
  const b = root.querySelector('#net-to-auth');
  if(b) b.onclick = () => api.toAuth();
}

/* ==================================================================
   PVP
   ================================================================== */
export const renderPvp = () => `
<div class="screen">
  <h1 class="screen-title">PVP</h1>
  <p class="screen-sub">Бой считает сервер: урон, здоровье и итог приходят из базы</p>
  <div id="pvp-root">${LOADER}</div>
</div>`;

export async function mountPvp(api){
  await guard(api, '#pvp-root', async (el) => {
    const [rating, hist] = await Promise.all([cloud.myRating(), online.duelHistory(6)]);
    el.innerHTML = `
      <div class="panel"><div class="panel-b statlist">
        <div class="stat"><span>Ваша мощь</span><b class="gold">${n(stats().power)}</b></div>
        <div class="stat"><span>Рейтинг</span><b>${rating ? n(rating.rating) : '—'}</b></div>
        <div class="stat"><span>Победы / поражения</span><b>${rating ? `${rating.wins} / ${rating.losses}` : '0 / 0'}</b></div>
        <div class="stat"><span>Серия побед</span><b>${rating ? rating.streak : 0}</b></div>
        <div class="stat"><span>Очки арены</span><b>${rating ? n(rating.arena_points) : 0}</b></div>
      </div></div>

      ${tabs('pvp', [['duel','Дуэль'],['arena','Арена'],['tour','Турнир недели']], 'duel')}
      <div id="pvp-out"></div>

      <div class="panel" style="margin-top:14px">
        <div class="panel-h">Последние дуэли</div>
        <div class="panel-b">
          ${hist.length ? table(['Соперник','Итог','Рейтинг','Когда'], hist.map(h => [
              esc(h.a_nick) === (getState().nick || '') ? esc(h.b_nick) : esc(h.a_nick),
              h.winner === null ? '<span class="mut">ничья</span>'
                : h.win ? '<b class="gold">победа</b>' : '<span class="blood">поражение</span>',
              (h.delta > 0 ? '+' : '') + h.delta,
              `<span class="mut small">${ago(h.created_at)}</span>`
            ]))
            : '<div class="empty">Боёв пока не было. Найдите соперника — он появится в списке.</div>'}
        </div>
      </div>`;

    const out = $('#pvp-out');
    const draw = {
      duel: () => { out.innerHTML = `
        <div class="panel"><div class="panel-b">
          <p class="mut small">Дуэль подбирает соперника с близкой силой и меняет рейтинг по формуле Эло.
             Бой целиком рассчитывается в базе — клиент не может повлиять на результат.</p>
          <div class="row" style="gap:10px;margin-top:12px">
            <button class="btn btn-gold" id="pvp-find">Найти соперника</button>
            <button class="btn btn-ghost" id="pvp-cancel" hidden>Отменить поиск</button>
          </div>
          <div id="pvp-result" style="margin-top:14px"></div>
        </div></div>`;
        $('#pvp-find').onclick = () => findDuel(api, out);
        $('#pvp-cancel').onclick = async () => { await online.pvpLeave(); $('#pvp-result').innerHTML = '<div class="empty">Поиск отменён</div>'; };
      },
      arena: () => { out.innerHTML = `
        <div class="panel"><div class="panel-b">
          <p class="mut small">Арена — быстрый бой без рейтинга: победа даёт 10 очков, ничья 3, поражение 1.
             Очки копятся за всё время.</p>
          <div class="row" style="gap:10px;margin-top:12px">
            <button class="btn btn-gold" id="arena-go">Быстрый бой</button>
          </div>
          <div id="arena-result" style="margin-top:14px"></div>
        </div></div>`;
        $('#arena-go').onclick = async (e) => {
          const b = e.currentTarget; b.disabled = true; b.textContent = 'Ищем соперника…';
          try{
            const res = await online.arenaMatch();
            $('#arena-result').innerHTML = res.status === 'empty'
              ? `<div class="empty">${esc(res.note)}</div>`
              : battleLog(res, true);
            api.rerender();
          }catch(err){ $('#arena-result').innerHTML = fail(err.message); }
          b.disabled = false; b.textContent = 'Быстрый бой';
        };
      },
      tour: async () => {
        out.innerHTML = LOADER;
        const { rows } = await online.tournamentTable(30);
        const mine = await online.tournamentMine();
        out.innerHTML = `
        <div class="panel"><div class="panel-b">
          <p class="mut small">Турнир недели: до 5 боев на участника, победа 3 очка, ничья 1.
             Таблица считается по реальным боям — подставных соперников нет.</p>
          <div class="row" style="gap:10px;margin-top:12px">
            <button class="btn btn-gold" id="tour-join">${mine ? 'Заявка подана' : 'Подать заявку'}</button>
            <button class="btn btn-ghost" id="tour-fight" ${mine ? '' : 'disabled'}>Бой турнира</button>
          </div>
          ${mine ? `<div class="statlist" style="margin-top:12px">
            <div class="stat"><span>Ваши бои</span><b>${mine.fights} из 5</b></div>
            <div class="stat"><span>Победы</span><b>${mine.wins}</b></div>
            <div class="stat"><span>Очки</span><b class="gold">${mine.score}</b></div>
          </div>` : ''}
          <div id="tour-result" style="margin-top:14px"></div>
          <div style="margin-top:16px">
            <div class="panel-h">Таблица турнира</div>
            ${rows.length ? table(['#','Игрок','Сила','Бои','Победы','Очки'], rows.map((r, i) => [
                String(i + 1), esc(r.nick), n(r.power), r.fights, r.wins, `<b class="gold">${r.score}</b>`]))
              : '<div class="empty">Заявок пока нет. Станьте первым.</div>'}
          </div>
        </div></div>`;
        $('#tour-join').onclick = async () => {
          try{ await online.tournamentJoin(); mountPvp(api); }
          catch(err){ $('#tour-result').innerHTML = fail(err.message); }
        };
        const fb = $('#tour-fight');
        if(fb) fb.onclick = async (e) => {
          e.currentTarget.disabled = true;
          try{
            const res = await online.tournamentFight();
            $('#tour-result').innerHTML = res.status === 'waiting'
              ? `<div class="empty">${esc(res.note)}</div>` : battleLog(res, true);
          }catch(err){ $('#tour-result').innerHTML = fail(err.message); }
          const b = $('#tour-fight'); if(b){ b.disabled = false; }
        };
      }
    };

    $$('[data-tabs="pvp"] .tab').forEach(b => {
      b.onclick = () => {
        $$('[data-tabs="pvp"] .tab').forEach(x => x.classList.toggle('on', x === b));
        draw[b.dataset.tab]();
      };
    });
    draw.duel();

    /* поиск дуэли: если соперника нет — встаём в очередь и повторяем */
    window.__pvpFind = async () => {
      const res = await online.pvpMatch();
      if(res.status === 'queued'){
        $('#pvp-result').innerHTML = `<div class="empty">Ищем соперника с близкой силой…<br>
          <span class="mut small">Очередь живёт две минуты. Проверяем каждые 4 секунды.</span></div>`;
        $('#pvp-cancel').hidden = false;
        let tries = 0;
        window.__pvpTimer = setInterval(async () => {
          tries++;
          try{
            const again = await online.pvpMatch();
            if(again.status === 'fight'){
              clearInterval(window.__pvpTimer);
              $('#pvp-cancel').hidden = true;
              $('#pvp-result').innerHTML = battleLog(again, true);
              api.rerender();
            } else if(tries > 28){
              clearInterval(window.__pvpTimer);
              $('#pvp-cancel').hidden = true;
              await online.pvpLeave();
              $('#pvp-result').innerHTML = '<div class="empty">Никто не откликнулся. Попробуйте позже или сыграйте на арене.</div>';
            }
          }catch(e){ clearInterval(window.__pvpTimer); }
        }, 4000);
      } else {
        $('#pvp-result').innerHTML = battleLog(res, true);
        api.rerender();
      }
    };
  });
}

async function findDuel(api, out){
  const b = $('#pvp-find');
  if(b){ b.disabled = true; b.textContent = 'Ищем…'; }
  try{ await window.__pvpFind(); }
  catch(e){ $('#pvp-result').innerHTML = fail(e.message); }
  const btn = $('#pvp-find');
  if(btn){ btn.disabled = false; btn.textContent = 'Найти соперника'; }
}

/* ==================================================================
   ГИЛЬДИИ
   ================================================================== */
const EMBLEM_SYMBOLS = ['⚔','⚑','☾','✦','◈','☠','▲','❖','♛','⚜'];

export const renderGuild = () => `
<div class="screen">
  <h1 class="screen-title">ГИЛЬДИЯ</h1>
  <p class="screen-sub">Орден, общий рейд и чат — всё в одной базе</p>
  <div id="guild-root">${LOADER}</div>
</div>`;

export async function mountGuild(api){
  await guard(api, '#guild-root', async (el) => {
    const mine = await online.guildMine();
    el.innerHTML = mine ? await guildHome(api, mine) : await guildBrowser(api);
    if(mine) bindGuildHome(api, mine); else bindGuildBrowser(api);
  });
}

async function guildHome(api, g){
  const roster = await online.guildRoster(g.id);
  const raid = await online.guildRaid().catch(() => null);
  const chat = await online.guildChat().catch(() => []);
  const me = await cloud.user();
  const canRule = g.myRole === 'leader' || g.myRole === 'officer';

  return `
  <div class="panel">
    <div class="panel-h">${esc(g.name)} <span class="mut small">[${esc(g.tag)}]</span></div>
    <div class="panel-b">
      <div class="guild-top">
        <div class="emblem" style="--e1:${esc(g.emblem?.c1 || '#C9A46A')};--e2:${esc(g.emblem?.c2 || '#171922')}">
          ${esc(g.emblem?.sym || '⚑')}
        </div>
        <div class="statlist" style="flex:1">
          <div class="stat"><span>Уровень ордена</span><b class="gold">${g.level}</b></div>
          <div class="stat"><span>Опыт</span><b>${n(g.exp)}</b></div>
          <div class="stat"><span>Участников</span><b>${g.members}</b></div>
          <div class="stat"><span>Ваша роль</span><b>${g.myRole === 'leader' ? 'Глава' : g.myRole === 'officer' ? 'Офицер' : 'Боец'}</b></div>
        </div>
      </div>
      ${g.motto ? `<p class="motto">${esc(g.motto)}</p>` : ''}
      <div class="row" style="gap:10px;margin-top:12px">
        <button class="btn btn-ghost btn-sm" id="g-leave">Покинуть орден</button>
      </div>
    </div>
  </div>

  ${tabs('guild', [['roster','Состав'],['raid','Рейд'],['chat','Чат']], 'roster')}
  <div id="guild-out"></div>

  <script type="application/json" id="guild-data">${JSON.stringify({
    roster, raid, chat, me: me?.id, myRole: g.myRole, canRule
  }).replace(/</g, '\\u003c')}</script>`;
}

function guildData(){
  const el = document.getElementById('guild-data');
  return el ? JSON.parse(el.textContent) : { roster: [], raid: null, chat: [] };
}

function bindGuildHome(api, g){
  const d = guildData();
  const out = $('#guild-out');
  const draw = {
    roster: () => {
      out.innerHTML = `<div class="panel"><div class="panel-b">
        ${d.roster.length ? table(['Игрок','Роль','Уровень','Сила',''], d.roster.map(m => [
            esc(m.nick),
            m.role === 'leader' ? '<b class="gold">Глава</b>' : m.role === 'officer' ? 'Офицер' : 'Боец',
            n(m.level), n(m.power),
            d.canRule && m.user_id !== d.me && m.role !== 'leader'
              ? `<button class="btn btn-sm btn-ghost" data-kick="${m.user_id}">Исключить</button>
                 ${d.myRole === 'leader'
                   ? `<button class="btn btn-sm btn-ghost" data-role="${m.user_id}" data-to="${m.role === 'officer' ? 'member' : 'officer'}">${m.role === 'officer' ? 'Разжаловать' : 'Повысить'}</button>`
                   : ''}`
              : ''
          ])) : '<div class="empty">Состав пуст</div>'}
      </div></div>`;
      $$('#guild-out [data-kick]').forEach(b => b.onclick = async () => {
        try{ await online.guildKick(b.dataset.kick); mountGuild(api); }catch(e){ say(e.message); }
      });
      $$('#guild-out [data-role]').forEach(b => b.onclick = async () => {
        try{ await online.guildRole(b.dataset.role, b.dataset.to); mountGuild(api); }catch(e){ say(e.message); }
      });
    },
    raid: () => {
      const r = d.raid;
      if(!r?.raid){ out.innerHTML = fail('Рейд недоступен'); return; }
      const pct = Math.max(0, Math.min(100, r.raid.hp / r.raid.max_hp * 100));
      const cd = Math.ceil(r.cooldown || 0);
      out.innerHTML = `
      <div class="panel">
        <div class="panel-h">${esc(r.raid.boss?.name || 'Порождение разлома')}</div>
        <div class="panel-b">
          <div class="raid-bar"><i style="width:${pct}%"></i></div>
          <div class="row" style="justify-content:space-between;margin-top:6px">
            <span class="mut small">${n(r.raid.hp)} / ${n(r.raid.max_hp)} HP</span>
            <span class="mut small">${r.raid.ended_at ? 'рейд завершён' : 'рейд идёт'}</span>
          </div>
          <div class="row" style="gap:10px;margin-top:14px">
            <button class="btn btn-blood" id="raid-hit" ${(cd > 0 || r.raid.ended_at) ? 'disabled' : ''}>
              ${r.raid.ended_at ? 'Рейд завершён' : cd > 0 ? `Отдых ${cd} с` : 'Ударить'}
            </button>
            <span class="mut small">Урон считает сервер из вашей мощи. Между ударами — 3 минуты.</span>
          </div>
          ${r.mine ? `<div class="statlist" style="margin-top:12px">
            <div class="stat"><span>Ваш урон</span><b class="gold">${n(r.mine.damage)}</b></div>
            <div class="stat"><span>Ударов</span><b>${r.mine.hits}</b></div>
          </div>` : ''}
          <div style="margin-top:16px">
            <div class="panel-h">Вклад участников</div>
            ${(r.top || []).length ? table(['#','Игрок','Урон','Ударов'], r.top.map((t, i) => [
                String(i + 1), esc(t.nick), n(t.damage), t.hits ]))
              : '<div class="empty">Ударов пока не было</div>'}
          </div>
        </div>
      </div>`;
      const hit = $('#raid-hit');
      if(hit && !r.raid.ended_at && cd <= 0){
        hit.onclick = async () => {
          hit.disabled = true; hit.textContent = '…';
          try{
            const res = await online.guildRaidHit();
            d.raid = await online.guildRaid();
            draw.raid();
            if(res.killed) say('Рейдовый босс пал! Орден получает 1200 опыта.');
          }catch(e){ say(e.message); draw.raid(); }
        };
      }
    },
    chat: () => {
      out.innerHTML = `
      <div class="panel"><div class="panel-b">
        <div class="chat" id="gchat"></div>
        <div class="row" style="gap:8px;margin-top:10px">
          <input class="fld-i" id="gchat-in" maxlength="300" placeholder="Сообщение ордену…">
          <button class="btn btn-gold btn-sm" id="gchat-send">Отправить</button>
        </div>
      </div></div>`;
      const box = $('#gchat');
      const paint = () => {
        box.innerHTML = d.chat.length ? d.chat.map(m => `
          <div class="chat-msg${m.user_id === d.me ? ' mine' : ''}">
            <b>${esc(m.nick)}</b><span class="mut small"> ${ago(m.created_at)}</span>
            <div>${esc(m.body)}</div>
          </div>`).join('') : '<div class="empty">Сообщений пока нет</div>';
        box.scrollTop = box.scrollHeight;
      };
      paint();
      $('#gchat-send').onclick = async () => {
        const input = $('#gchat-in');
        const text = input.value.trim();
        if(!text) return;
        try{
          await online.guildSay(text);
          input.value = '';
          d.chat = await online.guildChat();
          paint();
        }catch(e){ say(e.message); }
      };
      $('#gchat-in').onkeydown = e => { if(e.key === 'Enter') $('#gchat-send').click(); };
      online.subscribe('guild_messages', async () => {
        d.chat = await online.guildChat();
        if($('#gchat')) paint();
      });
    }
  };
  $$('[data-tabs="guild"] .tab').forEach(b => {
    b.onclick = () => {
      $$('[data-tabs="guild"] .tab').forEach(x => x.classList.toggle('on', x === b));
      draw[b.dataset.tab]();
    };
  });
  draw.roster();
  const leave = $('#g-leave');
  if(leave) leave.onclick = async () => {
    if(!confirm('Покинуть орден?')) return;
    try{ await online.guildLeave(); mountGuild(api); }catch(e){ say(e.message); }
  };
}

async function guildBrowser(api){
  const list = await online.guildList();
  return `
  <div class="panel">
    <div class="panel-h">Ордена мира</div>
    <div class="panel-b">
      ${list.length ? table(['Орден','Тег','Уровень','Участников','Опыт',''], list.map(g => [
          `<span class="emblem mini" style="--e1:${esc(g.emblem?.c1 || '#C9A46A')};--e2:${esc(g.emblem?.c2 || '#171922')}">${esc(g.emblem?.sym || '⚑')}</span> ${esc(g.name)}`,
          esc(g.tag), g.level, g.members, n(g.exp),
          `<button class="btn btn-sm btn-gold" data-join="${g.id}">Вступить</button>`
        ])) : '<div class="empty">Орденов пока нет — создайте первый.</div>'}
    </div>
  </div>

  <div class="panel" style="margin-top:14px">
    <div class="panel-h">Создать орден</div>
    <div class="panel-b">
      <div class="row" style="gap:10px;flex-wrap:wrap">
        <label class="fld"><span>Название</span><input id="gc-name" maxlength="20" placeholder="Сумрачный дозор"></label>
        <label class="fld"><span>Тег</span><input id="gc-tag" maxlength="5" placeholder="СД"></label>
      </div>
      <label class="fld" style="margin-top:10px"><span>Девиз</span><input id="gc-motto" maxlength="120" placeholder="Мы приходим последними"></label>
      <div class="row" style="gap:8px;margin-top:10px;flex-wrap:wrap">
        ${EMBLEM_SYMBOLS.map((s, i) => `<button class="emb-pick${i === 0 ? ' on' : ''}" data-sym="${s}">${s}</button>`).join('')}
      </div>
      <div class="row" style="gap:8px;margin-top:8px;flex-wrap:wrap">
        ${[['#C9A46A','#171922'],['#8F2635','#171922'],['#7546A8','#171922'],['#5C9BC9','#101117'],['#E8E2D8','#20232D']]
          .map(([a, b], i) => `<button class="emb-pick col${i === 0 ? ' on' : ''}" data-c1="${a}" data-c2="${b}" style="--e1:${a};--e2:${b}"></button>`).join('')}
      </div>
      <button class="btn btn-gold" id="gc-create" style="margin-top:12px">Основать орден</button>
      <p class="mut small" style="margin-top:8px">Орден создаётся бесплатно и только игровой валютой не оплачивается — тут нет никаких платежей.</p>
    </div>
  </div>`;
}

function bindGuildBrowser(api){
  $$('[data-join]').forEach(b => b.onclick = async () => {
    try{ await online.guildJoin(b.dataset.join); mountGuild(api); }catch(e){ say(e.message); }
  });
  const pick = (sel, cb) => $$(sel).forEach(b => b.onclick = () => {
    $$(sel).forEach(x => x.classList.toggle('on', x === b));
    cb(b);
  });
  let sym = EMBLEM_SYMBOLS[0], c1 = '#C9A46A', c2 = '#171922';
  pick('.emb-pick[data-sym]', b => { sym = b.dataset.sym; });
  pick('.emb-pick.col', b => { c1 = b.dataset.c1; c2 = b.dataset.c2; });
  const create = $('#gc-create');
  if(create) create.onclick = async () => {
    const name = ($('#gc-name')?.value || '').trim();
    const tag = ($('#gc-tag')?.value || '').trim().toUpperCase();
    const motto = ($('#gc-motto')?.value || '').trim();
    if(name.length < 3) return say('Название короче 3 символов');
    if(tag.length < 2) return say('Тег короче 2 символов');
    create.disabled = true;
    try{
      await online.guildCreate(name, tag, { sym, c1, c2 }, motto);
      mountGuild(api);
    }catch(e){ say(e.message); create.disabled = false; }
  };
}

/* ==================================================================
   РЫНОК
   ================================================================== */
export const renderMarket = () => `
<div class="screen">
  <h1 class="screen-title">РЫНОК</h1>
  <p class="screen-sub">Только игровое золото · сделка атомарная, считает сервер</p>
  <div id="market-root">${LOADER}</div>
</div>`;

function itemLine(it){
  const r = RAR_BY_ID[it.rarity] || RAR_BY_ID.common;
  return `<span class="${r.css}">${esc(it.icon || '▣')} ${esc(it.modName)} ${esc(it.name)}</span>`;
}
function itemStats(it){
  return Object.entries(it.stats || {}).map(([k, v]) =>
    `${esc(STAT_LABELS[k] || k)} +${v}${STAT_SUFFIX[k] || ''}`).join(' · ');
}

export async function mountMarket(api){
  await guard(api, '#market-root', async (el) => {
    const gs = getState();
    el.innerHTML = `
      <div class="panel"><div class="panel-b statlist">
        <div class="stat"><span>Ваше золото</span><b class="gold">${n(gs.gold)} ◈</b></div>
        <div class="stat"><span>Свободно места</span><b>${120 - gs.inv.length} из 120</b></div>
        <div class="stat"><span>Пошлина рынка</span><b>3 % с продажи</b></div>
      </div></div>
      ${tabs('market', [['all','Все лоты'],['mine','Мои лоты'],['sell','Выставить вещь']], 'all')}
      <div id="market-out">${LOADER}</div>`;

    const out = $('#market-out');
    const draw = {
      all: async () => {
        out.innerHTML = LOADER;
        const rows = await online.marketList({ order:'created_at' });
        out.innerHTML = `<div class="panel"><div class="panel-b">
          ${rows.length ? table(['Вещь','Характеристики','Цена','Продавец',''], rows.map(l => [
              itemLine(l.item), `<span class="mut small">${esc(itemStats(l.item))}</span>`,
              `<b class="gold">${n(l.price)} ◈</b>`, esc(l.seller_nick),
              `<button class="btn btn-sm btn-gold" data-buy="${l.id}">Купить</button>`]))
            : '<div class="empty">Лотов нет. Выставьте вещь — она появится здесь у всех игроков.</div>'}
        </div></div>`;
        $$('#market-out [data-buy]').forEach(b => b.onclick = async () => {
          b.disabled = true;
          try{
            const res = await online.marketBuy(b.dataset.buy);
            await api.syncFromCloud();
            say(`Куплено: ${res.item.modName} ${res.item.name} за ${n(res.price)} ◈ · пошлина ${n(res.fee)}`, 'good');
            draw.all();
          }catch(e){ say(e.message); b.disabled = false; }
        });
      },
      mine: async () => {
        out.innerHTML = LOADER;
        const me = await cloud.user();
        const rows = await online.marketList({ mine:true, uid: me.id });
        out.innerHTML = `<div class="panel"><div class="panel-b">
          ${rows.length ? table(['Вещь','Цена','Статус','',''], rows.map(l => [
              itemLine(l.item),
              `<b class="gold">${n(l.price)} ◈</b>`,
              l.sold_at ? '<span class="mut small">продано</span>' : '<span class="mut small">в продаже</span>',
              l.sold_at ? '' : `<button class="btn btn-sm btn-ghost" data-cancel="${l.id}">Снять</button>`,
              `<span class="mut small">${ago(l.created_at)}</span>`]))
            : '<div class="empty">Вы ничего не выставляли</div>'}
        </div></div>`;
        $$('#market-out [data-cancel]').forEach(b => b.onclick = async () => {
          b.disabled = true;
          try{
            await online.marketCancel(b.dataset.cancel);
            await api.syncFromCloud();
            draw.mine();
          }catch(e){ say(e.message); b.disabled = false; }
        });
      },
      sell: () => {
        const inv = getState().inv.filter(i => !i.locked);
        out.innerHTML = `<div class="panel"><div class="panel-b">
          ${inv.length ? table(['Вещь','Характеристики','Цена','Действие'], inv.map(it => [
              itemLine(it), `<span class="mut small">${esc(itemStats(it))}</span>`,
              `<input class="fld-i price" data-price="${it.uid}" type="number" min="1" step="1" placeholder="цена">`,
              `<button class="btn btn-sm btn-gold" data-sell="${it.uid}">Выставить</button>`]))
            : '<div class="empty">В инвентаре нет свободных вещей. Снимите замок с той, что хотите продать.</div>'}
        </div></div>`;
        $$('#market-out [data-sell]').forEach(b => b.onclick = async () => {
          const uid = b.dataset.sell;
          const price = Math.floor(+(document.querySelector(`[data-price="${uid}"]`)?.value || 0));
          if(price < 1) return say('Укажите цену');
          b.disabled = true;
          try{
            const it = getState().inv.find(x => x.uid === uid);
            if(!it) throw new Error('Вещь не найдена');
            await online.marketSell(it, price);
            const s = getState();
            s.inv = s.inv.filter(x => x.uid !== uid);
            for(const slot of Object.keys(s.equip || {})) if(s.equip[slot] === uid) s.equip[slot] = null;
            await api.pushToCloud();
            api.rerender();
          }catch(e){ say(e.message); b.disabled = false; }
        });
      }
    };
    $$('[data-tabs="market"] .tab').forEach(b => {
      b.onclick = () => {
        $$('[data-tabs="market"] .tab').forEach(x => x.classList.toggle('on', x === b));
        draw[b.dataset.tab]();
      };
    });
    draw.all();
  });
}

/* ==================================================================
   РЕЙТИНГ
   ================================================================== */
export const renderRating = () => `
<div class="screen">
  <h1 class="screen-title">РЕЙТИНГ</h1>
  <p class="screen-sub">Таблица считается в базе из сохранённых прогрессов</p>
  <div id="rating-root">${LOADER}</div>
</div>`;

export async function mountRating(api){
  await guard(api, '#rating-root', async (el) => {
    const me = await cloud.user();
    el.innerHTML = `
      ${tabs('rating', [['rating','По рейтингу'],['power','По силе'],['level','По уровню'],['kills','По убийствам']], 'rating')}
      <div id="rating-out">${LOADER}</div>`;
    const out = $('#rating-out');
    const draw = async (sort) => {
      out.innerHTML = LOADER;
      const rows = await cloud.leaderboard(sort, 50);
      const mine = rows.findIndex(r => r.user_id === me.id);
      out.innerHTML = `<div class="panel"><div class="panel-b">
        ${rows.length ? table(['#','Игрок','Уровень','Сила','Рейтинг','Победы / поражения'], rows.map((r, i) => [
            String(i + 1),
            (r.user_id === me.id ? '<b class="gold">' : '') + esc(r.nick) + (r.user_id === me.id ? '</b>' : '')
              + (r.fair ? '' : ' <span class="mut small" title="Прогресс не прошёл проверку">· проверка</span>'),
            n(r.level), n(r.power), n(r.rating), `${r.wins} / ${r.losses}`]))
          : '<div class="empty">Таблица пуста. Ваш прогресс попадёт сюда после сохранения в облаке.</div>'}
        <p class="mut small" style="margin-top:10px">
          ${mine >= 0 ? `Ваше место: <b>${mine + 1}</b> из ${rows.length}.`
                      : 'Вас пока нет в выборке — сохраните прогресс в облаке.'}
          Сила и уровень пересчитываются сервером по формулам игры, поэтому подменить их нельзя.</p>
      </div></div>`;
    };
    $$('[data-tabs="rating"] .tab').forEach(b => {
      b.onclick = () => {
        $$('[data-tabs="rating"] .tab').forEach(x => x.classList.toggle('on', x === b));
        draw(b.dataset.tab);
      };
    });
    draw('rating');
  });
}

/* ==================================================================
   ОБЩЕНИЕ: таверна, друзья, жалобы
   ================================================================== */
export const renderSocial = () => `
<div class="screen">
  <h1 class="screen-title">ОБЩЕНИЕ</h1>
  <p class="screen-sub">Общий чат, друзья и жалобы на нарушения</p>
  <div id="social-root">${LOADER}</div>
</div>`;

export async function mountSocial(api){
  await guard(api, '#social-root', async (el) => {
    el.innerHTML = `${tabs('social', [['tavern','Таверна'],['friends','Друзья'],['report','Жалоба']], 'tavern')}
      <div id="social-out">${LOADER}</div>`;
    const out = $('#social-out');
    let unsub = null;

    const draw = {
      tavern: async () => {
        out.innerHTML = LOADER;
        const me = await cloud.user();
        let msgs = await online.tavern(60);
        out.innerHTML = `
        <div class="panel"><div class="panel-b">
          <div class="chat" id="tchat"></div>
          <div class="row" style="gap:8px;margin-top:10px">
            <input class="fld-i" id="tchat-in" maxlength="240" placeholder="Сказать в таверне…">
            <button class="btn btn-gold btn-sm" id="tchat-send">Отправить</button>
          </div>
          <p class="mut small" style="margin-top:8px">Не чаще одного сообщения в 5 секунд. За оскорбления можно получить жалобу и временное отключение чата.</p>
        </div></div>`;
        const box = $('#tchat');
        const paint = () => {
          box.innerHTML = msgs.length ? msgs.map(m => `
            <div class="chat-msg${m.user_id === me.id ? ' mine' : ''}">
              <b>${esc(m.nick)}</b><span class="mut small"> ${ago(m.created_at)}</span>
              <div>${esc(m.body)}</div>
              <button class="rep-link" data-rep="${esc(m.nick)}">пожаловаться</button>
            </div>`).join('') : '<div class="empty">В таверне тихо. Напишите первым.</div>';
          box.scrollTop = box.scrollHeight;
        };
        paint();
        $('#tchat-send').onclick = async () => {
          const input = $('#tchat-in');
          const text = input.value.trim();
          if(!text) return;
          try{ await online.tavernSay(text); input.value = ''; msgs = await online.tavern(60); paint(); }
          catch(e){ say(e.message); }
        };
        $('#tchat-in').onkeydown = e => { if(e.key === 'Enter') $('#tchat-send').click(); };
        $$('#tchat [data-rep]').forEach(b => b.onclick = () => {
          $$('[data-tabs="social"] .tab').forEach(x => x.classList.toggle('on', x.dataset.tab === 'report'));
          draw.report(b.dataset.rep);
        });
        unsub = await online.subscribe('tavern_messages', async () => {
          msgs = await online.tavern(60);
          if($('#tchat')) paint();
        });
      },

      friends: async () => {
        out.innerHTML = LOADER;
        const { friends, pending } = await online.friendList();
        out.innerHTML = `
        <div class="panel"><div class="panel-b">
          <div class="row" style="gap:8px">
            <input class="fld-i" id="fr-nick" maxlength="16" placeholder="Ник игрока">
            <button class="btn btn-gold btn-sm" id="fr-add">Добавить</button>
          </div>
          <div style="margin-top:14px">
            <div class="panel-h">Друзья</div>
            ${friends.length ? table(['Игрок',''], friends.map(f => [
                esc(f.nick),
                `<button class="btn btn-sm btn-ghost" data-del="${f.user_id}">Убрать</button>`]))
              : '<div class="empty">Друзей пока нет</div>'}
          </div>
          ${pending.length ? `<div style="margin-top:14px">
            <div class="panel-h">Заявки</div>
            ${table(['Игрок',''], pending.map(f => [
                esc(f.nick),
                `<button class="btn btn-sm btn-gold" data-acc="${f.user_id}">Принять</button>`]))}
          </div>` : ''}
        </div></div>`;
        $('#fr-add').onclick = async () => {
          const nick = ($('#fr-nick').value || '').trim();
          if(!nick) return;
          try{ const r = await online.friendRequest(nick); say(r === 'accepted' ? 'Заявка принята автоматически' : 'Заявка отправлена'); draw.friends(); }
          catch(e){ say(e.message); }
        };
        $$('#social-out [data-del]').forEach(b => b.onclick = async () => {
          await online.friendRemove(b.dataset.del); draw.friends();
        });
        $$('#social-out [data-acc]').forEach(b => b.onclick = async () => {
          await online.friendAccept(b.dataset.acc); draw.friends();
        });
      },

      report: (preset = '') => {
        out.innerHTML = `
        <div class="panel"><div class="panel-b">
          <label class="fld"><span>Причина</span>
            <select id="rp-kind">
              <option value="nick">Оскорбительный ник</option>
              <option value="chat">Нарушение в чате</option>
              <option value="fraud">Мошенничество на рынке</option>
              <option value="other">Другое</option>
            </select>
          </label>
          <label class="fld"><span>Ник нарушителя</span>
            <input id="rp-nick" maxlength="16" value="${esc(preset)}" placeholder="Если относится к игроку">
          </label>
          <label class="fld"><span>Что случилось</span>
            <textarea id="rp-body" maxlength="500" rows="4" placeholder="Опишите ситуацию"></textarea>
          </label>
          <button class="btn btn-gold" id="rp-send">Отправить жалобу</button>
          <p class="mut small" style="margin-top:8px">Жалобы видны администратору проекта. Разбор происходит вручную — автоматических блокировок нет.</p>
        </div></div>`;
        $('#rp-send').onclick = async () => {
          const kind = $('#rp-kind').value;
          const nick = ($('#rp-nick').value || '').trim();
          const body = ($('#rp-body').value || '').trim();
          if(!body) return say('Опишите ситуацию');
          try{ await online.report(kind, nick || null, body); say('Жалоба отправлена'); out.innerHTML = '<div class="empty">Спасибо, жалоба зарегистрирована.</div>'; }
          catch(e){ say(e.message); }
        };
      }
    };

    $$('[data-tabs="social"] .tab').forEach(b => {
      b.onclick = () => {
        $$('[data-tabs="social"] .tab').forEach(x => x.classList.toggle('on', x === b));
        if(unsub){ try{ unsub.unsubscribe(); }catch(e){} unsub = null; }
        draw[b.dataset.tab]();
      };
    });
    draw.tavern();
  });
}
