'use strict';
/* ============ утилиты ============ */
const $  = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const rnd  = (a,b) => a + Math.random()*(b-a);
const rndi = (a,b) => Math.floor(rnd(a,b+1));
const pick = a => a[Math.floor(Math.random()*a.length)];
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
const money = n => Math.round(n).toLocaleString('ru-RU') + ' ₽';
const moneyK = n => n>=1e6 ? (n/1e6).toFixed(n>=1e7?1:2).replace('.',',')+' млн' : n>=10000 ? Math.round(n/1000)+' тыс' : Math.round(n).toLocaleString('ru-RU');
const chance = p => Math.random() < p;
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* ============ состояние ============ */
const SAVE = 'playerok_tycoon_v1';
const DEF = () => ({
  nick:'Продавец', bal:5000, turn:0, deals:0, rate:5, votes:0, claims:0,
  blocked:0, stock:[], my:[], orders:[], inbox:[], pending:[], upg:{}, news:[], day:1, dayTurn:0,
  heat:0, dirty:0, roofT:0,
  achievements:[], log:[], started:Date.now(), last:Date.now(), best:0, fine:0,
  totalEarn:0, scamLoss:0, chargeLoss:0, blocks:0, warns:0,
});
let S = DEF();
let M = { lots:[], t:0, newsTimer:22, orderTimer:8, saleTimer:3, prices:{} };

/* ============ цены ============ */
function basePrice(g){ return g[3]; }
function mktPrice(g){ return (M.prices[g[0]]||g[3]); }
function fairPrice(g){ return Math.round(mktPrice(g)); }
function priceTrend(g){
  const h = M.hist && M.hist[g[0]];
  if(!h || h.length<3) return 0;
  return (mktPrice(g) - h[0]) / h[0];
}

function newPrices(){
  M.prices = {}; M.hist = {};
  for(const g of GOODS){ M.prices[g[0]] = g[3]; M.hist[g[0]] = [g[3]]; }
}
function tickPrices(){
  for(const g of GOODS){
    const p = M.prices[g[0]], vol = 0.006 + g[5]*0.012;
    let np = p * (1 + rnd(-vol,vol));
    np += (g[3]-np)*0.004;                        // возврат к базовой
    M.prices[g[0]] = clamp(np, g[3]*0.45, g[3]*2.6);
    const h = M.hist[g[0]]; h.push(M.prices[g[0]]); if(h.length>40) h.shift();
  }
}
let momentum = 0;

/* ============ генерация лотов на рынке ============ */
function genLot(){
  const roll = Math.random(), cat = pick(Object.keys(CATS));
  let pool = GOODS.filter(g => g[1]===cat);
  if(roll > 0.93) pool = GOODS.filter(g => g[4]===3);
  if(!pool.length) pool = GOODS;
  // часть лотов подбирается по покупательной способности игрока
  const budget = Math.max(800, S.bal*0.75);
  const byMoney = pool.filter(g => mktPrice(g) <= budget);
  if(byMoney.length && chance(0.62)) pool = byMoney;
  const g = pick(pool);
  const urgent = chance(0.38);                    // срочная продажа — заметно ниже рынка
  const disc = urgent ? rnd(0.58, 0.82) : rnd(0.84, 1.10);
  const price = Math.max(30, Math.round(mktPrice(g)*disc));
  return {
    id:'L'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),
    g:g[0], price, disc, urgent, seller:pick(SELLERS), scam: chance(0.14 + g[4]*0.05),
    hot: chance(0.12), views: rndi(0, 40),
  };
}
const SELLERS = ['Seller_Pro','Игроман','KotTrade','Магазин_77','xXxDealer','LootKing','Влад_Опт','N1ceSell','Тёмный_Лорд','Mr.Key','Айсберг','Гном-Трейд'];
function refreshMarket(){
  const want = 24;
  while(M.lots.length < want) M.lots.push(genLot());
  if(M.lots.length > want) M.lots.length = want;
  for(const l of M.lots){
    const fair = mktPrice(goodByName(l.g));
    const target = fair * (l.disc||1);
    l.price = Math.max(30, Math.round(l.price*0.55 + target*0.45));   // продавец следит за рынком
    if(chance(0.3)) l.price = Math.max(30, Math.round(l.price*rnd(0.97,1.03)));
  }
}
function goodByName(n){ return GOODS.find(g => g[0]===n); }

/* ============ апгрейды ============ */
function upgLvl(id){ return S.upg[id]||0; }
function upgCost(u){ return Math.round(u.base * Math.pow(u.mul, upgLvl(u.id))); }
function slots(){ return 6 + upgLvl('slots')*4; }
function speedMul(){ return 1 + upgLvl('ads')*0.18; }
function scamMul(){ return Math.pow(0.8, upgLvl('guar')) * diffK().risk; }
function chargeMul(){ return Math.pow(0.72, upgLvl('anti')) * diffK().risk; }
function autoLvl(){ return upgLvl('auto'); }
function lawMul(){ return Math.pow(0.75, upgLvl('law')); }
function fee(){ return clamp(0.042 - upgLvl('prem')*0.008, 0.012, 0.042); }
function rateBonus(){ return upgLvl('rep')*0.05; }
function bankMul(){ return 1 + upgLvl('bank')*0.004; }
function effRate(){ return clamp(S.rate + rateBonus(), 1, 5); }

/* ============ склад ============ */
function addStock(name, price){
  S.stock.push({id:'S'+Date.now().toString(36)+Math.random().toString(36).slice(2,6), g:name, buy:price});
}
function stockCount(){ return S.stock.length; }
function stockFree(){ return slots() - S.stock.length; }

/* ============ покупка лота ============ */
function buy(lotId){
  const i = M.lots.findIndex(l => l.id===lotId);
  if(i<0) return toast('Лот уже купили','bad');
  const l = M.lots[i], g = goodByName(l.g);
  if(l.price > S.bal) return toast('Не хватает денег','bad');
  if(stockFree() <= 0) return toast('Склад полон — прокачайте склад','bad');
  S.bal -= l.price;
  M.lots.splice(i,1);
  if(l.scam && Math.random() < (0.42 + g[4]*0.10) * scamMul()){
    // скам: деньги ушли, товара нет
    S.scamLoss += l.price;
    addLog(`Оплатил, но ${l.seller} пропал: «${g[0]}» не пришёл. Потеряно ${money(l.price)}`,'bad');
    toast('СКАМ: товар не пришёл','bad');
    bumpClaims(0.5);
    ach('first_scam');
  } else {
    addStock(g[0], l.price);
    addLog(`Куплен «${g[0]}» за ${money(l.price)}`,'ok');
    toast('В склад: ' + g[0],'ok');
    S.deals++;
  }
  refreshMarket(); save(); render();
}

/* ============ выставление лота ============ */
function listItem(stockId, price){
  const i = S.stock.findIndex(s => s.id===stockId);
  if(i<0) return;
  const s = S.stock[i], g = goodByName(s.g);
  const maxLots = 4 + upgLvl('ads')*2;
  if(S.my.length >= maxLots) return toast('Слишком много лотов на витрине','bad');
  S.stock.splice(i,1);
  S.my.push({id:'M'+Date.now().toString(36)+Math.random().toString(36).slice(2,6), g:s.g, buy:s.buy, price:Math.round(price), t:0, views:0});
  addLog(`Выставлен «${g[0]}» за ${money(price)}`,'');
  save(); render();
}

/* ============ продажа: поиск покупателя ============ */
function saleChance(my){
  const g = goodByName(my.g), mkt = mktPrice(g);
  const over = my.price / mkt;                      // насколько дороже рынка
  let ch = 0.55 * Math.pow(0.45, Math.max(0, over-1.06)*6);
  ch *= 0.6 + effRate()/5 * 0.6;                    // рейтинг
  ch *= 0.55 + g[6]*0.6;                            // ликвидность
  ch *= speedMul();
  ch *= 1 + (my.hot?0.3:0);
  return clamp(ch, 0.005, 0.9);
}
function trySales(){
  for(let i=S.my.length-1;i>=0;i--){
    const my = S.my[i];
    my.views += rndi(1, 4 + upgLvl('ads')*4);
    if(!chance(saleChance(my))) continue;
    // покупатель сначала пишет: авто-выдача закрывает часть сделок сама
    const already = S.inbox.some(q => q.lot === my.id);
    if(!already && !chance(0.28 + autoLvl()*0.16)){
      S.inbox.push(genInquiryWrapped(my));
      addLog(`Покупатель ${S.inbox[S.inbox.length-1].buyer} пишет по лоту «${goodByName(my.g)[0]}»`,'warn');
      toast('Новое сообщение от покупателя','warn'); sound('msg');
      save(); if(currentTab==='inbox') render();
      continue;
    }
    const g = goodByName(my.g);
    const gross = my.price, feeSum = gross*fee();
    const net = Math.round((gross - feeSum) * bankMul());
    const profit = net - my.buy;
    // авто-выдача ускоряет и исключает часть жалоб
    S.bal += net; S.turn += gross; S.dayTurn += gross; S.totalEarn += Math.max(0, profit);
    S.deals++; S.my.splice(i,1);
    // отзыв
    const good = chance(0.72 + effRate()/5*0.16);
    S.votes++; S.rate = clamp((S.rate*S.votes + (good?5:rndi(1,3)))/(S.votes+1), 1, 5);
    addLog(`Продан «${g[0]}» за ${money(gross)} · комиссия ${money(feeSum)} · <b class="${profit>=0?'ok':'bad'}">${profit>=0?'+':''}${money(profit)}</b>`,'ok');
    toast(`+${money(net)} · ${g[0]}`,'ok');
    // риск возврата платежа
    const cr = CATS[g[1]].risk * 0.5 * chargeMul() * (1 - (autoLvl()?autoLvl()*0.12:0));
    if(chance(cr)){
      const back = Math.min(S.bal, Math.round(gross*rnd(0.6,1)));
      S.bal -= back; S.turn -= gross; S.chargeLoss += back;
      addLog(`Чарджбэк! Покупатель вернул платёж по «${g[0]}» — минус ${money(back)}`,'bad');
      toast('Чарджбэк: ' + money(back),'bad');
      bumpClaims(1.2); ach('first_charge');
    }
    if(profit > 0) ach('first_profit');
    if(g[4]===3) ach('legend_sell');
    checkRank(); save(); render();
    return;
  }
}

/* ============ заказы под ключ ============ */
function genOrder(){
  const g = pick(GOODS.filter(x => x[3] <= Math.max(2000, S.turn*0.4)));
  if(!g) return;
  const qty = g[3] > 8000 ? 1 : rndi(1, chance(0.3)?3:2);
  const pay = Math.round(mktPrice(g)*qty*rnd(1.18,1.55));
  const limit = Math.round(18 + qty*7 + (g[4]*6));
  S.orders.push({id:'O'+Date.now().toString(36)+Math.random().toString(36).slice(2,7), g:g[0], qty, pay, limit, left:limit, state:'new', hold:50});
  addLog(`Заказ под ключ: ${qty} × «${g[0]}» за ${money(pay)} · ${limit} с на выполнение`,'warn');
  toast('Новый заказ под ключ','warn');
}
function fulfill(oId){
  const i = S.orders.findIndex(o => o.id===oId);
  if(i<0) return;
  const o = S.orders[i];
  o.state = 'taken';
  const have = S.stock.filter(s => s.g===o.g);
  if(have.length < o.qty) return toast(`Нужно ${o.qty} шт. «${o.g}» в складе`,'bad');
  for(let k=0;k<o.qty;k++){
    const idx = S.stock.findIndex(s => s.g===o.g);
    S.stock.splice(idx,1);
  }
  S.orders.splice(i,1);
  const net = Math.round(o.pay*(1-fee())*bankMul());
  S.bal += net; S.turn += o.pay; S.dayTurn += o.pay; S.deals++; S.totalEarn += o.pay;
  S.votes++; S.rate = clamp((S.rate*S.votes+5)/(S.votes+1),1,5);
  addLog(`Заказ выполнен: ${o.qty} × «${o.g}» → +${money(net)}`,'ok');
  toast('Заказ закрыт: +' + money(net),'ok');
  ach('first_order');
  if(chance(CATS[goodByName(o.g)[1]].risk*0.7*chargeMul())){
    S.bal -= o.pay; S.chargeLoss += o.pay;
    addLog(`Возврат по заказу «${o.g}» — минус ${money(o.pay)}`,'bad');
  }
  checkRank(); save(); render();
}
function takeOrder(id){
  const o = S.orders.find(x => x.id===id);
  if(!o || o.state==='taken') return;
  o.state = 'taken';
  addLog(`Заказ принят: ${o.qty} × «${o.g}» · осталось ${Math.ceil(o.left)} с`,'warn');
  save(); render();
}
function tickOrders(dt){
  for(let i=S.orders.length-1;i>=0;i--){
    const o = S.orders[i];
    if(o.state === 'new'){                     // предложение: ждём решения, штрафа нет
      o.hold -= dt;
      if(o.hold<=0){
        S.orders.splice(i,1);
        addLog(`Заказ на «${o.g}» ушёл другому продавцу`,'');
      }
      continue;
    }
    o.left -= dt;
    if(o.left<=0){
      S.orders.splice(i,1);
      S.claims += 1.4; S.votes++;
      S.rate = clamp((S.rate*S.votes+1)/(S.votes+1),1,5);
      addLog(`Сорван заказ на «${o.g}»: рейтинг упал, +жалоба`,'bad');
      toast('Заказ сорван','bad');
      checkBlock(); save(); render();
    }
  }
}

/* ============ жалобы, блокировка ============ */
function bumpClaims(n){
  S.claims += n;
  if(S.claims >= 8){ S.claims = 8; checkBlock(); }
}
function checkBlock(){
  if(S.blocked > 0) return;
  const p = clamp((S.claims/8)*0.20 * lawMul(), 0, 0.5);
  if(chance(p)){
    S.blocked = Math.round(rnd(25,70)); S.blocks++; S.claims = 0; S.warns++;
    addLog(`АККАУНТ ЗАБЛОКИРОВАН на ${S.blocked} с. Торговля остановлена`,'bad');
    toast('Блокировка аккаунта!','bad'); ach('first_block');
  }
}
function coolClaims(dt){
  if(S.claims>0) S.claims = Math.max(0, S.claims - dt*(0.06 + upgLvl('rep')*0.03 + upgLvl('law')*0.03));
}

/* ============ ранг ============ */
function rankIdx(){
  let k = 0;
  for(let i=0;i<RANKS.length;i++){
    const r = RANKS[i];
    if(S.turn >= r.turn && effRate() >= r.rate && S.deals >= r.deals) k = i;
  }
  return k;
}
function checkRank(){
  const k = rankIdx();
  if(k > (S.rankIdx||0)){
    S.rankIdx = k;
    const bonus = Math.round(3000*Math.pow(2.2,k));
    S.bal += bonus;
    addLog(`НОВЫЙ РАНГ: <b>${RANKS[k].name}</b> · бонус ${money(bonus)}`,'ok');
    toast('Ранг: ' + RANKS[k].name,'ok');
    ach('rank_'+k);
  } else S.rankIdx = Math.max(S.rankIdx||0, k);
}

/* ============ новости рынка ============ */
function pushNews(){
  const n = pick(NEWS);
  momentum = (n.k-1)*0.25;
  for(const g of GOODS){
    if(n.cat==='all' || g[1]===n.cat){
      M.prices[g[0]] = clamp(M.prices[g[0]]*n.k, g[3]*0.45, g[3]*2.6);
    }
  }
  for(const g of GOODS) M.hist[g[0]] = [M.prices[g[0]]];
  S.news.unshift({t:n.t, k:n.k}); if(S.news.length>5) S.news.pop();
  addLog(`Рынок: ${n.t}`,'warn');
  toast('Новость рынка','warn');
}

/* ============ достижения ============ */
const ACHS = {
  first_profit:{n:'Первая прибыль', i:'💰'},
  first_scam :{n:'Обманутый',       i:'🕳️'},
  first_charge:{n:'Первый возврат', i:'↩️'},
  first_order:{n:'Заказ под ключ',  i:'📝'},
  first_block:{n:'В бане',          i:'⛔'},
  legend_sell:{n:'Легендарная сделка', i:'👑'},
  rank_1:{n:'Ранг: Любитель', i:'🥉'}, rank_2:{n:'Ранг: Продавец', i:'🥈'},
  rank_3:{n:'Ранг: Проверенный', i:'🥇'}, rank_4:{n:'Ранг: Профи', i:'💠'},
  rank_5:{n:'Ранг: Топ-продавец', i:'🔥'}, rank_6:{n:'Ранг: Легенда', i:'🌟'},
  million:{n:'Оборот 1 000 000 ₽', i:'🏦'},
  first_fraud:{n:'Первый обман', i:'😈'},
  serial_fraud:{n:'Рецидивист: 5 обманов', i:'🔪'},
  king_fraud:{n:'Король кидалова: 25 обманов', i:'👹'},
  banned_fraud:{n:'Заблокирован за обман', i:'⛓️'},
};
function ach(id){
  if(S.achievements.includes(id)) return;
  S.achievements.push(id);
  const a = ACHS[id]; if(!a) return;
  addLog(`Достижение: ${a.i} ${a.n}`,'ok');
  toast('🏆 ' + a.n,'ok');
}

/* ============ сохранение ============ */
function save(){
  S.last = Date.now();
  try{ localStorage.setItem(SAVE, JSON.stringify(S)); }catch(e){}
}
function load(){
  try{
    const raw = localStorage.getItem(SAVE);
    if(!raw) return false;
    const o = JSON.parse(raw);
    S = Object.assign(DEF(), o);
    return true;
  }catch(e){ return false; }
}
function reset(){
  if(!confirm('Точно начать заново? Весь прогресс удалится.')) return;
  const nick = S.nick, tops = getTops();
  localStorage.removeItem(SAVE);
  S = DEF(); S.nick = nick; setTops(tops);
  newPrices(); refreshMarket();
  save(); render(); toast('Новая карьера','warn');
}
function getTops(){ try{ return JSON.parse(localStorage.getItem(SAVE+'_top')||'[]'); }catch(e){ return []; } }
function setTops(t){ try{ localStorage.setItem(SAVE+'_top', JSON.stringify(t)); }catch(e){} }
function pushTop(){
  const tops = getTops();
  tops.push({n:S.nick, turn:Math.round(S.turn), bal:Math.round(S.bal), rank:RANKS[rankIdx()].name, d:Date.now()});
  tops.sort((a,b) => b.turn - a.turn);
  setTops(tops.slice(0,10));
}

/* ============ офлайн-доход ============ */
function offline(){
  const dt = (Date.now() - (S.last||Date.now()))/1000;
  if(dt < 60) return;
  const mins = Math.min(dt/60, 240);
  let sold = 0, earned = 0;
  for(let i=S.my.length-1;i>=0;i--){
    const my = S.my[i];
    const p = clamp(saleChance(my)*mins/12, 0, 0.85);
    if(chance(p)){
      const g = goodByName(my.g);
      const gross = my.price, net = Math.round((gross-gross*fee())*bankMul());
      S.bal += net; S.turn += gross; S.dayTurn += gross; S.deals++; S.my.splice(i,1);
      earned += net; sold++;
    }
  }
  if(sold){
    addLog(`Пока вас не было, продано лотов: ${sold} на ${money(earned)}`,'ok');
    toast(`Офлайн: +${money(earned)}`,'ok');
  }
  checkRank();
}

/* ============ лог и тосты ============ */
function addLog(html, cls){
  S.log.unshift({t:new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}), h:html, c:cls||''});
  if(S.log.length>60) S.log.pop();
  drawLog();
}
function drawLog(){
  const el = $('#log'); if(!el) return;
  el.innerHTML = S.log.slice(0,14).map(l => `<div class="li ${l.c}"><span>${l.t}</span>${l.h}</div>`).join('');
}
function toast(text, cls){
  const w = $('#toasts'); if(!w) return;
  const d = document.createElement('div');
  d.className = 'toast ' + (cls||'');
  d.textContent = text;
  w.appendChild(d);
  setTimeout(() => { d.classList.add('out'); setTimeout(()=>d.remove(), 400); }, 2600);
}

/* ============ главный цикл ============ */
let lastT = performance.now();
const raf = window.requestAnimationFrame
  ? cb => window.requestAnimationFrame(cb)
  : cb => setTimeout(() => cb(performance.now()), 50);
function loop(now){
  const dt = Math.min(((now||performance.now())-lastT)/1000, 1.5); lastT = now||performance.now();
  if(!S.paused) step(dt);
  raf(loop);
}
function step(dt){
  M.t += dt;
  if(S.blocked > 0){
    S.blocked -= dt;
    if(S.blocked <= 0){ S.blocked = 0; addLog('Аккаунт разблокирован','ok'); toast('Разблокировано','ok'); }
  } else {
    M.saleTimer -= dt;
    if(M.saleTimer <= 0){ M.saleTimer = rnd(2.2, 4.4)/(1+upgLvl('ads')*0.12); trySales(); }
    M.orderTimer -= dt;
    if(M.orderTimer <= 0){
      M.orderTimer = rnd(22, 48);
      if(S.orders.length < 3 && S.turn > 4000) genOrder();
    }
  }
  M.newsTimer -= dt; M.ptimer = (M.ptimer||0) - dt; M.rtimer = (M.rtimer||0) - dt;
  if(M.newsTimer <= 0){ M.newsTimer = rnd(28, 55); pushNews(); }
  if(M.ptimer <= 0){ M.ptimer = 1.0; momentum *= 0.86; tickPrices(); }
  if(M.rtimer <= 0){ M.rtimer = 6; refreshMarket(); }
  tickOrders(dt);
  tickInbox(dt);
  tickPending(dt);
  tickCrime(dt);
  coolClaims(dt);
  if(S.turn >= 1e6) ach('million');
  S.best = Math.max(S.best, S.bal);
  drawTop();
  if(currentTab==='market' || currentTab==='my') renderTickOnly();
}

/* ============ рендер ============ */
let currentTab = 'market';
function drawTop(){
  setNum($('#s-bal'), S.bal, money);
  const t = $('#s-turn'); if(t) t.textContent = 'оборот ' + moneyK(S.turn);
  const r = $('#s-rate'); if(r) r.textContent = effRate().toFixed(2);
  const set = (id, v) => { const e = $(id); if(e) e.textContent = v; };
  set('#s-stock', S.stock.length);
  set('#s-my', S.my.length);
  set('#s-inbox', S.inbox.length);
  set('#s-ord', S.orders.length);
  set('#s-deliv', (S.pending||[]).length);
  if(typeof drawDock === 'function') drawDock();
}
function drawCats(){
  const el = $('#cats'); if(!el) return;
  const counts = {};
  for(const l of M.lots){ const c = goodByName(l.g)[1]; counts[c] = (counts[c]||0)+1; }
  el.innerHTML =
    `<button class="cat ${filters.cat==='all'?'on':''}" data-cat="all"><i>${ico('market')}</i>Все категории<b>${M.lots.length}</b></button>` +
    Object.entries(CATS).map(([k,c]) =>
      `<button class="cat ${filters.cat===k?'on':''}" data-cat="${k}"><i>${ico(k)}</i>${c.name}<b>${counts[k]||0}</b></button>`
    ).join('');
}

function render(){
  drawTop(); drawCats(); drawLog();
  const v = $('#view');
  const tab = currentTab;
  if(tab==='market')  v.innerHTML = viewMarket();
  if(tab==='stock')   v.innerHTML = viewStock();
  if(tab==='my')      v.innerHTML = viewMy();
  if(tab==='crime')   v.innerHTML = viewCrime();
  if(tab==='deliv')   v.innerHTML = viewPending();
  if(tab==='inbox')   v.innerHTML = viewInbox();
  if(tab==='orders')  v.innerHTML = viewOrders();
  if(tab==='upg')     v.innerHTML = viewUpgrades();
  if(tab==='top')     v.innerHTML = viewTop();
  bindView();
}
function renderTickOnly(){
  // обновляем только динамические числа, без перестройки сетки
  const v = $('#view');
  if(currentTab==='market'){
    for(const el of v.querySelectorAll('.card')){
      const l = M.lots.find(x => x.id===el.dataset.id);
      if(!l) continue;
      const g = goodByName(l.g), fair = fairPrice(g);
      const d = el.querySelector('.pdelta');
      if(d){ const p = ((l.price/fair-1)*100); d.textContent = (p>=0?'+':'')+p.toFixed(0)+'% к рынку'; d.className = 'pdelta ' + (p>2?'bad':p<-2?'ok':''); }
      const pe = el.querySelector('.price');
      if(pe){
        const was = +pe.dataset.p || 0;
        if(l.price !== was && was !== 0){ flashPrice(pe, l.price > was); }
        pe.dataset.p = l.price; pe.textContent = money(l.price);
      }
    }
  }
  if(currentTab==='my'){
    for(const el of v.querySelectorAll('.card')){
      const m = S.my.find(x => x.id===el.dataset.id);
      if(!m) continue;
      const cd = el.querySelector('.chance');
      if(cd) cd.textContent = 'шанс продажи ' + (saleChance(m)*100).toFixed(0) + '%';
      const pv = el.querySelector('.views'); if(pv) pv.textContent = '👁 ' + m.views;
    }
  }
  if(currentTab==='orders'){
    for(const el of v.querySelectorAll('.ord')){
      const o = S.orders.find(x => x.id===el.dataset.id);
      if(!o) continue;
      const t = el.querySelector('.tmr'); if(t) t.textContent = Math.max(0,Math.ceil(o.left)) + ' с';
      const b = el.querySelector('.obar i'); if(b) b.style.width = (o.left/o.limit*100)+'%';
    }
  }
}

function lotsFiltered(){
  let a = M.lots.slice();
  const f = filters;
  if(f.cat !== 'all') a = a.filter(l => goodByName(l.g)[1] === f.cat);
  if(f.q.trim()){
    const q = f.q.trim().toLowerCase();
    a = a.filter(l => l.g.toLowerCase().includes(q) || CATS[goodByName(l.g)[1]].name.toLowerCase().includes(q));
  }
  if(f.sort===1) a.sort((x,y) => x.price - y.price);
  if(f.sort===2) a.sort((x,y) => y.price - x.price);
  if(f.sort===3) a.sort((x,y) => (x.price/fairPrice(goodByName(x.g))) - (y.price/fairPrice(goodByName(y.g))));
  return a;
}
/* -------- рынок -------- */
function viewMarket(){
  const news = S.news.length ? `<div class="news">📰 ${esc(S.news[0].t)}</div>` : '';
  const blocked = S.blocked>0 ? `<div class="block-banner">⛔ Аккаунт заблокирован: ${Math.ceil(S.blocked)} с. Покупки и продажи остановлены</div>` : '';
  const cards = lotsFiltered().map((l,i) => {
    const g = goodByName(l.g), fair = fairPrice(g);
    const p = (l.price/fair-1)*100;
    const tr = priceTrend(g);
    return `<div class="card ${RAR[g[4]].cls} ${l.hot?'hot':''}" data-id="${l.id}" tabindex="0" style="animation-delay:${Math.min(i*22,340)}ms">
      <div class="thumb">
        <img src="${imgFor(g[0], g[1])}" alt="${esc(g[0])}" loading="lazy" onerror="this.style.display='none';this.parentNode.innerHTML+='<div style=\'font-size:40px\'>${g[7]}</div>'">
        <span class="cat">${CATS[g[1]].name}</span>
        <span class="rr ${RAR[g[4]].cls}">${RAR[g[4]].name}</span>
        <div class="badges">
          ${l.urgent?'<div class="urgentflag">СРОЧНО</div>':''}
          ${l.hot?'<div class="hotflag">🔥 HOT</div>':''}
        </div>
      </div>
      <div class="cbody">
      <div class="cname">${esc(g[0])}</div>
      <div class="prow"><b class="price" data-p="${l.price}">${money(l.price)}</b></div>
      <div class="pdelta ${p>2?'bad':p<-2?'ok':''}">${p>=0?'+':''}${p.toFixed(0)}% к рынку</div>
      ${upgLvl('an') ? `<div class="trend ${tr>0.02?'ok':tr<-0.02?'bad':''}">${tr>0.02?'▲ рост':tr<-0.02?'▼ падение':'▬ ровно'}</div>`:''}
      <div class="csell">${esc(l.seller)} · 👁 ${l.views}</div>
      <button class="btn ${l.price<=S.bal&&stockFree()>0&&S.blocked<=0?'ok':''}" data-buy="${l.id}" ${l.price>S.bal||stockFree()<=0||S.blocked>0?'disabled':''}>Купить</button>
      </div></div>`;
  }).join('');
  const f = filters;
  const sorts = [[0,'По порядку'],[1,'Сначала дешёвые'],[2,'Сначала дорогие'],[3,'Сначала выгодные']];
  return `${blocked}${news}
   <div class="toolbar">
     ${sorts.map(([v,n])=>`<button class="chipf ${f.sort==v?'on':''}" data-sort="${v}">${n}</button>`).join('')}
     <button class="chipf" id="btn-refresh" style="margin-left:auto">Обновить</button>
   </div>
   <div class="hint">Найдено ${lotsFiltered().length} лотов · склад свободен <b>${stockFree()}/${slots()}</b> · комиссия <b>${(fee()*100).toFixed(1)}%</b></div>
   <div class="grid">${cards}</div>`;
}
const filters = {q:'', cat:'all', sort:0};
function catOptions(cur){
  return `<option value="all"${cur==='all'?' selected':''}>Все категории</option>` +
    Object.entries(CATS).map(([k,c]) => `<option value="${k}"${cur===k?' selected':''}>${c.icon} ${c.name}</option>`).join('');
}

/* -------- склад -------- */
function viewStock(){
  if(!S.stock.length) return `<div class="empty">Склад пуст. Купите лоты на вкладке «Рынок».</div>`;
  const cards = S.stock.map((s,i) => {
    const g = goodByName(s.g), cur = fairPrice(g);
    const d = cur - s.buy, pr = (cur/s.buy-1)*100;
    return `<div class="card ${RAR[g[4]].cls}" data-id="${s.id}" tabindex="0" style="animation-delay:${Math.min(i*22,340)}ms">
      <div class="thumb">
        <img src="${imgFor(g[0], g[1])}" alt="${esc(g[0])}" loading="lazy" onerror="this.style.display='none'">
        <span class="cat">${CATS[g[1]].name}</span>
        <span class="rr ${RAR[g[4]].cls}">${RAR[g[4]].name}</span>
      </div>
      <div class="cbody">
      <div class="cname">${esc(g[0])}</div>
      <div class="prow"><b class="price">${money(cur)}</b></div>
      <div class="pdelta ${pr>=0?'ok':'bad'}">${pr>=0?'+':''}${pr.toFixed(1)}% к покупке</div>
      <div class="csell">куплено за ${money(s.buy)} · прибыль <span class="${d>=0?'ok':'bad'}">${money(d)}</span></div>
      <div class="row">
        <button class="btn ok" data-list="${s.id}" ${S.blocked>0?'disabled':''}>Продать</button>
        <button class="btn ghost" data-quick="${s.id}" ${S.blocked>0?'disabled':''}>Быстро</button>
        <button class="btn ghost scam-btn" data-dispute="${s.id}" title="Открыть спор и вернуть деньги">Спор</button>
      </div>
      </div></div>`;
  }).join('');
  return `<div class="hint">Занято <b>${S.stock.length}/${slots()}</b> · в товаре на сумму <b>${money(S.stock.reduce((a,s)=>a+s.buy,0))}</b></div><div class="grid">${cards}</div>`;
}

/* -------- мои лоты -------- */
function viewMy(){
  if(!S.my.length) return `<div class="empty">🛒 На витрине пусто. Выставьте товар со склада.</div>`;
  const cards = S.my.map((m,i) => {
    const g = goodByName(m.g);
    return `<div class="card ${RAR[g[4]].cls}" data-id="${m.id}" tabindex="0" style="animation-delay:${Math.min(i*22,340)}ms">
      <div class="thumb">
        <img src="${imgFor(g[0], g[1])}" alt="${esc(g[0])}" loading="lazy" onerror="this.style.display='none'">
        <span class="cat">${CATS[g[1]].name}</span>
        <span class="rr ${RAR[g[4]].cls}">${RAR[g[4]].name}</span>
      </div>
      <div class="cbody">
      <div class="cname">${esc(g[0])}</div>
      <div class="prow"><b class="price">${money(m.price)}</b></div>
      <div class="pdelta">рынок ${money(fairPrice(g))}</div>
      <div class="chance">шанс продажи ${(saleChance(m)*100).toFixed(0)}%</div>
      <div class="csell views">👁 ${m.views}</div>
      <div class="row">
        <button class="btn small" data-reprice="${m.id}">Цена</button>
        <button class="btn ghost" data-delist="${m.id}">Снять</button>
      </div>
      </div></div>`;
  }).join('');
  return `<div class="hint">Лотов на витрине <b>${S.my.length}/${4+upgLvl('ads')*2}</b> · комиссия <b>${(fee()*100).toFixed(0)}%</b></div><div class="grid">${cards}</div>`;
}

/* -------- заказы -------- */
function viewOrders(){
  if(!S.orders.length) return `<div class="empty">📝 Активных заказов нет. Они приходят по мере роста оборота.</div>`;
  return S.orders.map(o => {
    const g = goodByName(o.g), have = S.stock.filter(s=>s.g===o.g).length;
    const profit = Math.round(o.pay*(1-fee())*bankMul() - S.stock.filter(s=>s.g===o.g).slice(0,o.qty).reduce((a,s)=>a+s.buy,0));
    return `<div class="ord" data-id="${o.id}">
      <div class="ohead">
        <b>${o.qty} × ${esc(g[0])} ${o.state==='new'?'<span class="chip">новый</span>':''}</b>
        <span class="tmr">${o.state==='new' ? 'решение '+Math.ceil(o.hold)+' с' : Math.ceil(o.left)+' с'}</span>
      </div>
      <div class="obar"><i style="width:${((o.state==='new'?o.hold/50:o.left/o.limit)*100).toFixed(0)}%${o.state==='new'?';background:#5b6779':'padding'}"></i></div>
      <div class="orow">
        <span>Оплата: <b>${money(o.pay)}</b></span>
        <span>В складе: <b class="${have>=o.qty?'ok':'bad'}">${have}/${o.qty}</b></span>
        <span>Чистыми: <b class="ok">${money(Math.round(o.pay*(1-fee())*bankMul()))}</b></span>
      </div>
      <div class="row end">
        ${o.state==='new' ? `<button class="btn" data-take="${o.id}" ${have<o.qty?'disabled':''}>Взять</button>` : ''}
        <button class="btn ok" data-do="${o.id}" ${have<o.qty||S.blocked>0?'disabled':''}>Выдать</button>
        <button class="btn ghost" data-skip="${o.id}">Отказаться</button>
      </div>
    </div>`;
  }).join('');
}

/* -------- прокачка -------- */
function viewUpgrades(){
  const ups = UPGRADES.map(u => {
    const lv = upgLvl(u.id), cost = upgCost(u), max = lv >= u.max;
    return `<div class="upg ${max?'maxed':''}">
      <div class="uicon">${ico(u.icon)}</div>
      <div class="ubody">
        <div class="uname">${u.name} <span class="ulvl">${lv}/${u.max}</span></div>
        <div class="udesc">${u.desc}</div>
        <div class="ubar"><i style="width:${(lv/u.max*100).toFixed(0)}%"></i></div>
      </div>
      <button class="btn ok" data-upg="${u.id}" ${max||cost>S.bal?'disabled':''}>${max?'Макс':moneyK(cost)}</button>
    </div>`;
  }).join('');
  const a = S.achievements.map(id => `<span class="ach">${ACHS[id].i} ${ACHS[id].n}</span>`).join('') || '<span class="mut">пока нет</span>';
  return `<div class="hint">Баланс <b>${money(S.bal)}</b> · оборот <b>${moneyK(S.turn)}</b> · сделок <b>${S.deals}</b></div>
   <div class="grid one">${ups}</div>
   <div class="prof">
     <h3>Профиль</h3>
     <div class="prow2"><span>Ранг</span><b>${RANKS[rankIdx()].name}</b></div>
     <div class="prow2"><span>Рейтинг</span><b>${effRate().toFixed(2)} ★ (${S.votes} отзывов)</b></div>
     <div class="prow2"><span>Жалобы</span><b>${S.claims.toFixed(1)} / 8</b></div>
     <div class="prow2"><span>Потери от скама</span><b class="bad">${money(S.scamLoss)}</b></div>
     <div class="prow2"><span>Потери от возвратов</span><b class="bad">${money(S.chargeLoss)}</b></div>
     <div class="prow2"><span>Блокировок</span><b class="bad">${S.blocks}</b></div>
     <div class="prow2"><span>Обманов / выгода</span><b class="bad">${S.scamsDone||0} · ${money(S.scamProfit||0)}</b></div>
     <div class="prow2"><span>Споров открыто</span><b>${S.disputes||0}</b></div>
     <div class="prow2"><span>Лучший баланс</span><b>${money(S.best)}</b></div>
     <div class="achwrap">${a}</div>
     <div class="row">
       <button class="btn ghost" id="btn-save-top">Сохранить результат в топ</button>
       <button class="btn bad" id="btn-reset">Начать заново</button>
     </div>
   </div>`;
}

/* -------- топ -------- */
function viewTop(){
  const tops = getTops();
  const rows = tops.length ? tops.map((t,i) => `<div class="trow">
      <b class="tpos">${i+1}</b>
      <span class="tnick">${esc(t.n)}</span>
      <span class="trank">${esc(t.rank)}</span>
      <b class="tturn">${money(t.turn)}</b>
      <span class="tdate">${new Date(t.d).toLocaleDateString('ru-RU')}</span>
    </div>`).join('') : '<div class="empty">Пока пусто — нажмите «Сохранить результат в топ» в прокачке.</div>';
  const code = btoa(unescape(encodeURIComponent(JSON.stringify({n:S.nick,t:Math.round(S.turn),b:Math.round(S.bal),r:RANKS[rankIdx()].name}))));
  return `<div class="hint">Топ хранится <b>в этом браузере</b>: общий онлайн-рейтинг требует сервера, статический сайт не может его вести. Обменяться результатом можно кодом ниже.</div>
   <div class="topwrap">${rows}</div>
   <div class="share">
     <label>Ваш код результата (можно отправить другу)</label>
     <textarea class="inp" id="share-out" rows="2" readonly>${code}</textarea>
     <div class="row">
       <button class="btn small" id="btn-copy">Копировать код</button>
       <button class="btn small" id="btn-paste">Вставить код друга</button>
     </div>
   </div>`;
}

/* ============ фильтры ============ */
function bindFilters(){
  const q = $('#q');
  if(q){
    q.oninput = () => { filters.q = q.value; render(); const n=$('#q'); if(n && document.activeElement===n){ const v=n.value; n.value=''; n.value=v; } };
    q.onkeydown = e => { if(e.key==='Escape'){ q.value=''; filters.q=''; q.blur(); render(); } };
  }
  $$('[data-cat]').forEach(b => b.onclick = () => { filters.cat = b.dataset.cat; render(); });
  $$('[data-sort]').forEach(b => b.onclick = () => { filters.sort = +b.dataset.sort; render(); });
  $$('[data-go]').forEach(b => b.onclick = () => setTab(b.dataset.go));
}

/* ============ действия ============ */
function bindView(){
  bindFilters();
  $$('[data-buy]').forEach(b => b.onclick = e => { e.stopPropagation(); doBuy(b.dataset.buy); });
  $$('[data-list]').forEach(b => b.onclick = e => { e.stopPropagation(); openSell(b.dataset.list); });
  $$('[data-quick]').forEach(b => b.onclick = e => {
    e.stopPropagation();
    const s = S.stock.find(x => x.id===b.dataset.quick);
    if(s) listItem(s.id, Math.round(fairPrice(goodByName(s.g))*0.97));
  });
  $$('[data-reprice]').forEach(b => b.onclick = e => { e.stopPropagation(); reprice(b.dataset.reprice); });
  $$('[data-delist]').forEach(b => b.onclick = e => {
    e.stopPropagation();
    const i = S.my.findIndex(m => m.id===b.dataset.delist);
    if(i>=0){ const m = S.my.splice(i,1)[0]; addStock(m.g, m.buy); addLog('Лот снят с витрины',''); save(); render(); }
  });
  $$('[data-ans]').forEach(b => b.onclick = e => { e.stopPropagation(); replyInquiry(b.dataset.q, b.dataset.ans); });
  $$('[data-scam]').forEach(b => b.onclick = e => {
    e.stopPropagation();
    const box = document.getElementById('scam-' + b.dataset.scam);
    if(box){ const open = box.style.display !== 'none'; box.style.display = open ? 'none' : 'flex'; b.classList.toggle('ok', !open); }
    sound('click');
  });
  $$('[data-fraud]').forEach(b => b.onclick = e => { e.stopPropagation(); scamBuyer(b.dataset.q, b.dataset.fraud); });
  $$('[data-dispute]').forEach(b => b.onclick = e => { e.stopPropagation(); openDispute(b.dataset.dispute); });
  $$('[data-crime]').forEach(b => b.onclick = () => doCrime(b.dataset.crime));
  $$('[data-pick]').forEach(b => b.onclick = e => { e.stopPropagation(); pickDelivery(b.dataset.pick); });
  $$('[data-tpl]').forEach(b => b.onclick = e => { e.stopPropagation(); sendTpl(b.dataset.tpl, b.dataset.tplt); });
  $$('[data-take]').forEach(b => b.onclick = e => { e.stopPropagation(); takeOrder(b.dataset.take); });
  $$('[data-do]').forEach(b => b.onclick = e => { e.stopPropagation(); fulfill(b.dataset.do); });
  $$('[data-skip]').forEach(b => b.onclick = e => {
    e.stopPropagation();
    const i = S.orders.findIndex(o => o.id===b.dataset.skip);
    if(i>=0){
      const o = S.orders[i];
      S.orders.splice(i,1);
      if(o.state==='taken'){ S.claims += 0.6; S.votes++; S.rate = clamp((S.rate*S.votes+2)/(S.votes+1),1,5); addLog('Отказ от принятого заказа — жалоба','warn'); }
      else addLog('Заказ отклонён','');
      save(); render();
    }
  });
  $$('[data-upg]').forEach(b => b.onclick = e => {
    const u = UPGRADES.find(x => x.id===b.dataset.upg);
    const cost = upgCost(u);
    if(S.bal < cost) return toast('Не хватает денег','bad');
    S.bal -= cost; S.upg[u.id] = upgLvl(u.id)+1;
    addLog(`Куплено улучшение «${u.name}» ур.${upgLvl(u.id)} за ${money(cost)}`,'ok');
    toast(u.name + ' ур.' + upgLvl(u.id),'ok'); save(); render();
  });
  const br = $('#btn-refresh'); if(br) br.onclick = () => { refreshMarket(); render(); toast('Рынок обновлён',''); };
  const bt = $('#btn-save-top'); if(bt) bt.onclick = () => { pushTop(); render(); toast('Результат в топе','ok'); };
  const bres = $('#btn-reset'); if(bres) bres.onclick = reset;
  const bc = $('#btn-copy'); if(bc) bc.onclick = () => {
    const ta = $('#share-out'); ta.select();
    try{ document.execCommand('copy'); toast('Код скопирован','ok'); }catch(e){ toast('Скопируйте вручную','warn'); }
  };
  const bp = $('#btn-paste'); if(bp) bp.onclick = () => {
    const code = prompt('Вставьте код результата друга:');
    if(!code) return;
    try{
      const o = JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
      const tops = getTops();
      tops.push({n:o.n+' (гость)', turn:o.t, bal:o.b, rank:o.r, d:Date.now()});
      tops.sort((a,b) => b.turn-a.turn); setTops(tops.slice(0,10));
      render(); toast('Результат добавлен в топ','ok');
    }catch(e){ toast('Неверный код','bad'); }
  };
  $$('.card').forEach(c => c.onclick = () => openCard(c.dataset.id));
}

/* ============ модалки ============ */
function openCard(id){
  const l = M.lots.find(x=>x.id===id);
  if(!l) return;
  const g = goodByName(l.g), fair = fairPrice(g);
  const p = (l.price/fair-1)*100;
  $('#m-item-body').innerHTML = `
    <div class="det">
      <div class="dthumb ${RAR[g[4]].cls}"><img src="${imgFor(g[0], g[1])}" alt="${esc(g[0])}" onerror="this.parentNode.innerHTML='<div style=\\'font-size:46px\\'>${g[7]}</div>'"></div>
      <div class="dmain">
        <div class="rr ${RAR[g[4]].cls}">${RAR[g[4]].name}</div>
        <h2>${esc(g[0])}</h2>
        <div class="chips">
          <span class="chip">${CATS[g[1]].icon} ${CATS[g[1]].name}</span>
          <span class="chip">риск возврата ${(CATS[g[1]].risk*100).toFixed(1)}%</span>
          <span class="chip">ликвидность ${(g[6]*100).toFixed(0)}%</span>
        </div>
        <div class="dprice">${money(l.price)} <small>рынок ${money(fair)} · ${p>=0?'+':''}${p.toFixed(1)}%</small></div>
        <div class="dcalc">Продадите по рынку: <b>${money(Math.round(fair*(1-fee())*bankMul()))}</b> чистыми ·
          прибыль <b class="${Math.round(fair*(1-fee()))-l.price>=0?'ok':'bad'}">${money(Math.round(fair*(1-fee())*bankMul())-l.price)}</b></div>
        <div class="csell">Продавец <b>${esc(l.seller)}</b> · на площадке ${rndi(2,60)} мес. · просмотров ${l.views}</div>

      </div>
    </div>
    <div class="row end">
      <button class="btn ghost" data-close>Закрыть</button>
      ${l.noHaggle?'':'<button class="btn" id="d-haggle">Предложить цену</button>'}
      <button class="btn ok" id="d-buy" ${l.price>S.bal||stockFree()<=0||S.blocked>0?'disabled':''}>Купить за ${money(l.price)}</button>
    </div>`;
  $('#m-item').classList.add('show');
  const db = $('#d-buy'); if(db) db.onclick = () => { closeModals(); doBuy(id); };
  const dh = $('#d-haggle'); if(dh) dh.onclick = () => openHaggle(id);
}
function openSell(sid){
  const s = S.stock.find(x=>x.id===sid);
  if(!s) return;
  const g = goodByName(s.g), fair = fairPrice(g);
  const start = Math.round(fair*1.02);
  $('#m-item-body').innerHTML = `
    <h2>Продать «${esc(g[0])}»</h2>
    <p class="mut">Куплено за ${money(s.buy)} · рынок сейчас ${money(fair)} · комиссия ${(fee()*100).toFixed(0)}%</p>
    <label class="fld">Цена продажи
      <input id="sp" type="number" value="${start}" step="10">
    </label>
    <input id="spr" type="range" min="${Math.round(fair*0.7)}" max="${Math.round(fair*1.5)}" value="${start}" step="10">
    <div class="quick">
      <button class="btn small" data-p="0.9">−10%</button>
      <button class="btn small" data-p="1">рынок</button>
      <button class="btn small" data-p="1.1">+10%</button>
      <button class="btn small" data-p="1.25">+25%</button>
    </div>
    <div id="sell-calc" class="dcalc"></div>
    <div class="row end">
      <button class="btn ghost" data-close>Отмена</button>
      <button class="btn ok" id="d-sell">Выставить</button>
    </div>`;
  $('#m-item').classList.add('show');
  const sp = $('#sp'), sr = $('#spr'), sc = $('#sell-calc');
  const calc = () => {
    const v = +sp.value||0;
    const net = Math.round(v*(1-fee())*bankMul());
    const profit = net - s.buy;
    const ch = saleChance({g:s.g, price:v});
    sc.innerHTML = `Чистыми <b>${money(net)}</b> · прибыль <b class="${profit>=0?'ok':'bad'}">${money(profit)}</b> · шанс продажи <b>${(ch*100).toFixed(0)}%</b>`;
  };
  sp.oninput = () => { sr.value = sp.value; calc(); };
  sr.oninput = () => { sp.value = sr.value; calc(); };
  $$('#m-item [data-p]').forEach(b => b.onclick = () => {
    sp.value = Math.round(fair*(+b.dataset.p)); sr.value = sp.value; calc();
  });
  calc(); sp.focus();
  $('#d-sell').onclick = () => { closeModals(); listItem(sid, +sp.value||fair); };
}
function reprice(mid){
  const m = S.my.find(x=>x.id===mid);
  if(!m) return;
  const nv = prompt('Новая цена для «'+m.g+'» (рынок '+fairPrice(goodByName(m.g))+'):', m.price);
  if(nv==null) return;
  const v = Math.max(10, Math.round(+nv||m.price));
  m.price = v; addLog(`Цена на «${m.g}» изменена на ${money(v)}`,''); save(); render();
}
function closeModals(){ $$('.modal').forEach(m => m.classList.remove('show')); }
$$('[data-close]').forEach(b => b.onclick = closeModals);
$$('.modal').forEach(m => m.onclick = e => { if(e.target===m && !m.id.includes('start')) m.classList.remove('show'); });

/* ============ табы ============ */
function setTab(t){
  currentTab = t;
  $$('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab===t));
  render();
  if(window.innerWidth < 760) $('#view').scrollIntoView({behavior:'smooth', block:'start'});
}
$$('.tab').forEach(b => b.onclick = () => setTab(b.dataset.tab));
const btnMenu = $('#btn-menu');
if(btnMenu) btnMenu.onclick = () => { $('#tabs').classList.toggle('open'); };

/* ============ горячие клавиши ============ */
const KEYS = ['1','2','3','4','5','6','7','8','9'];
document.addEventListener('keydown', e => {
  if(/input|textarea|select/i.test(document.activeElement.tagName)) return;
  const k = e.key.toLowerCase();
  if(k==='escape'){ closeModals(); return; }
  if(k==='m'){ setTab('market'); }
  else if(k==='s'){ setTab('stock'); }
  else if(k==='l'){ setTab('my'); }
  else if(k==='o'){ setTab('orders'); }
  else if(k==='u'){ setTab('upg'); }
  else if(k==='t'){ setTab('top'); }
  else if(k==='r'){ refreshMarket(); render(); toast('Рынок обновлён',''); }
  else if(k==='b'){
    // купить самый выгодный доступный лот
    const a = lotsFiltered().filter(l => l.price<=S.bal && !l.scam && stockFree()>0 && S.blocked<=0);
    if(a.length){ buy(a[0].id); } else toast('Нет доступных лотов','warn');
  }
  else if(KEYS.includes(k)){
    const list = currentTab==='market' ? lotsFiltered() : currentTab==='stock' ? S.stock : currentTab==='my' ? S.my : [];
    const idx = KEYS.indexOf(k);
    if(list[idx]){
      if(currentTab==='market') buy(list[idx].id);
      if(currentTab==='stock')  openSell(list[idx].id);
      if(currentTab==='my')     reprice(list[idx].id);
    }
  }
});

/* ============ старт ============ */
function boot(){
  const had = load();
  newPrices();
  refreshMarket();
  if(had){
    offline();
    addLog(`С возвращением, ${esc(S.nick)}. Оборот ${moneyK(S.turn)}`,'ok');
  } else {
    addLog('Карьера начата. Стартовый капитал 5 000 ₽','ok');
    addLog('Подсказка: ищите лоты с ценой ниже рынка и перепродавайте','');
  }
  $('#m-start').classList.remove('show');
  if(had) $('#m-start').remove();
  render();
  drawLog();
  setInterval(() => { save(); pushTopIfGood(); }, 15000);
  requestAnimationFrame(loop);
}
function pushTopIfGood(){
  const tops = getTops();
  const mine = tops.find(t => t.n===S.nick && Math.abs(t.turn-S.turn) < 1);
  if(!mine && S.turn > 20000) pushTop();
}
const bs = $('#btn-set'); if(bs) bs.onclick = () => { sound('click'); openSettings(); };
$('#btn-start').onclick = () => {
  const n = $('#nick').value.trim();
  S.nick = n ? n.slice(0,14) : 'Продавец';
  boot();
};
$('#nick').addEventListener('keydown', e => { if(e.key==='Enter') $('#btn-start').click(); });
window.addEventListener('beforeunload', save);
window.addEventListener('resize', () => { $('#tabs').classList.remove('open'); });

/* покупка с подтверждением по настройке */
function doBuy(id){
  sound('click');
  const l = M.lots.find(x => x.id===id);
  if(!l) return;
  if(SET.confirmBuy && l.price > 500){
    const g = goodByName(l.g);
    $('#m-ask-title').textContent = 'Купить «'+g[0]+'»?';
    $('#m-ask-text').innerHTML = `Цена <b>${money(l.price)}</b> · рынок ${money(fairPrice(g))}` +
      '';
    $('#m-ask').classList.add('show');
    $('#m-ask-yes').onclick = () => { closeModals(); buy(id); };
    return;
  }
  buy(id);
}

/* ============ анимации интерфейса ============ */
function movePill(){
  const pill = $('#tab-pill'), act = $('.tab.active');
  if(!pill || !act) return;
  const w = act.offsetWidth, l = act.offsetLeft - $('.tabs').offsetLeft;
  pill.style.width = w + 'px'; pill.style.left = l + 'px';
}
function flyGain(text, minus){
  const fx = $('#fx'); if(!fx) return;
  const d = document.createElement('div');
  d.className = 'gain' + (minus ? ' minus' : '');
  d.textContent = text;
  const bal = $('#s-bal');
  const r = bal ? bal.getBoundingClientRect() : {left:window.innerWidth/2, top:120};
  d.style.left = Math.min(window.innerWidth-140, Math.max(10, r.left - 20)) + 'px';
  d.style.top = (r.top + 26) + 'px';
  fx.appendChild(d);
  setTimeout(() => d.remove(), 1200);
}
/* плавный счётчик числа */
const animNum = new WeakMap();
function setNum(el, val, fmt){
  if(!el) return;
  const prev = animNum.get(el);
  if(prev === val) return;
  animNum.set(el, val);
  const from = prev === undefined ? val : prev;
  if(prev === undefined || Math.abs(val-from) < 1){ el.textContent = fmt(val); return; }
  const t0 = performance.now(), dur = 380;
  const tick = now => {
    const k = Math.min(1, (now-t0)/dur);
    const e = 1 - Math.pow(1-k, 3);
    const v = from + (val-from)*e;
    el.textContent = fmt(v);
    if(k < 1 && animNum.get(el) === val) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
/* подсветка изменения показателя */
function flashStat(sel){
  const el = $(sel); if(!el) return;
  const box = el.closest('.stat'); if(!box) return;
  box.classList.remove('flash'); void box.offsetWidth; box.classList.add('flash');
}
/* вспышка цены */
function flashPrice(el, up){
  if(!el) return;
  el.classList.remove('up','down'); void el.offsetWidth;
  el.classList.add(up ? 'up' : 'down');
}
/* анимация покупки карточки */
function animateBuy(id){
  const c = document.querySelector('.card[data-id="'+id+'"]');
  if(c){ c.classList.add('bought'); setTimeout(()=>c.classList.remove('bought'), 520); }
}
/* — перехватываем изменения баланса, чтобы запустить эффекты — */
let lastBal = null, lastTurn = null;
const _origTrySales = trySales, _origFulfill = fulfill, _origBuy = buy;
buy = function(id){
  const l = M.lots.find(x => x.id===id);
  const el = document.querySelector('.card[data-id="'+id+'"]');
  if(l){ animateBuy(id); }
  _origBuy(id);
  if(l){
    const lost = l.scam && S.stock.every(x => x.g !== l.g) && S.scamLoss > (lastScam||0);
    lastScam = S.scamLoss;
    if(lost) flyGain('−' + money(l.price), true);
    else flyGain('−' + money(l.price), true);
    flashStat('#s-bal');
  }
};
let lastScam = 0;
trySales = function(){
  const before = S.bal, beforeTurn = S.turn;
  const r = _origTrySales();
  const delta = S.bal - before;
  if(Math.abs(delta) > 0.5){
    flyGain((delta>0?'+':'') + money(delta), delta < 0);
    flashStat('#s-bal');
    if(S.turn !== beforeTurn) flashStat('#s-turn');
  }
  return r;
};
fulfill = function(id){
  const before = S.bal;
  const r = _origFulfill(id);
  const delta = S.bal - before;
  if(Math.abs(delta) > 0.5){ flyGain('+' + money(delta)); flashStat('#s-bal'); flashStat('#s-turn'); }
  return r;
};
/* — счётчики в шапке делаем плавными — */
const _origDrawTop = drawTop;
drawTop = function(){
  _origDrawTop();
  setNum($('#s-bal'),  S.bal,  money);
  setNum($('#s-turn'), S.turn, moneyK);
};
/* — пилюля вкладок — */
const _origSetTab = setTab;
setTab = function(t){
  _origSetTab(t);
  requestAnimationFrame(() => { movePill(); $$('.card').forEach((c,i) => { c.style.animationDelay = Math.min(i*22,340)+'ms'; }); });
};
window.addEventListener('resize', movePill);
document.addEventListener('DOMContentLoaded', movePill);
let _booted = false;
const _origBoot = boot;
boot = function(){
  try{ loadSet(); bindDock(); drawDock(); }catch(e){}
  _origBoot();
  movePill();
  setTimeout(movePill, 120);
  if(!_booted){
    _booted = true;
    setTimeout(() => { movePill(); }, 400);
  }
};

/* ============ адаптивное качество: на слабых устройствах упрощаем анимации ============ */
(function(){
  let frames = 0, t0 = performance.now(), measured = false;
  function probe(t){
    frames++;
    if(t - t0 >= 2500){
      const fps = frames / ((t - t0)/1000);
      if(fps < 34){
        document.body.classList.add('lite');
        addLog('Включён облегчённый режим анимации для плавности','');
      }
      measured = true;
      return;
    }
    if(!measured) requestAnimationFrame(probe);
  }
  setTimeout(() => requestAnimationFrame(probe), 1500);
})();

/* ============================================================
   ТОРГ: игрок покупает у других продавцов и просит скидку
   ============================================================ */
const NEG_UPG = {id:'neg', name:'Переговорщик', icon:'🤝', max:5, base:5500, mul:2.4, desc:'+8% к шансу, что продавец уступит'};
if(!UPGRADES.find(u => u.id==='neg')) UPGRADES.push(NEG_UPG);
function negBonus(){ return upgLvl('neg')*0.08; }

/* решимость продавца: чем дольше лот висит и хуже ликвидность — тем сговорчивее */
function sellerMood(l){
  const g = goodByName(l.g);
  let m = 0.52;
  m -= (g[6]-0.5)*0.22;                 // неликвидный товар — уступает охотнее
  m += g[4]*0.045;                      // редкий товар держит цену
  m -= (l.disc !== undefined && l.disc < 0.9) ? 0.12 : 0;   // уже дёшево — уступает неохотно
  m -= (l.age||0) > 40 ? 0.14 : 0;      // залежался
  m += (l.hot ? 0.12 : 0);              // горячий лот держит цену
  return clamp(m, 0.08, 0.9);
}
function makeOffer(lotId, offer){
  const l = M.lots.find(x => x.id===lotId);
  if(!l) return;
  const g = goodByName(l.g);
  const off = Math.round(offer);
  if(off >= l.price){ buy(lotId); return; }
  l.offers = (l.offers||0) + 1;
  const gap = 1 - off/l.price;                       //Requested скидка, доля
  const mood = sellerMood(l);
  let p = clamp(mood + negBonus() - gap*2.1, 0.02, 0.94);
  if(l.offers > 3) p *= 0.55;                        // надоели торговаться
  const roll = Math.random();
  if(roll < p){
    // согласие
    const old = l.price; l.price = off;
    addLog(`Продавец ${esc(l.seller)} согласился: «${esc(g[0])}» за ${money(off)} вместо ${money(old)}`,'ok');
    toast(`Уступил: −${money(old-off)}`,'ok');
    sound('deal');
    buy(lotId);
  } else if(roll < p + (1-p)*0.45){
    // контрпредложение
    const counter = Math.round(Math.min(l.price, off + (l.price-off)*rnd(0.45,0.8)));
    l.counter = counter; l.price = Math.max(counter, Math.round(l.price*0.985));
    addLog(`${esc(l.seller)}: «Не ${money(off)}, но отдам за ${money(l.price)}»`,'warn');
    toast(`Встречное предложение: ${money(l.price)}`,'warn');
    sound('msg');
    render(); openCard(lotId);
  } else {
    addLog(`${esc(l.seller)}: «${pick(['Не торгуюсь, цена и так рыночная','Нет, и не проси','Это дешевле рынка, бери или уходи','Скидку дам только при двух штуках'])}»`,'bad');
    toast('Продавец отказал','bad');
    sound('no');
    l.noHaggle = true;
    render(); openCard(lotId);
  }
}

/* ============================================================
   ПОКУПАТЕЛИ: входящие сообщения по выставленным лотам
   ============================================================ */
const BUYER_LINES = {
  haggle: ['Скинешь сотку?','Уступи 5%?','Возьму, если отдашь подешевле','Дороговато, сделай скидку','Последняя цена? могу взять сейчас за меньшее'],
  normal: ['Беру, высылай','Оплачиваю, жду товар','Готов взять по указанной цене','Интересует, оформляем?'],
  warranty:['Гарантия на товар есть?','А если не подойдёт — вернёшь деньги?','Подтверди, что товар рабочий','Дай гарантию на сутки'],
  suspect: ['Это не подделка?','Почему так дёшево, оригинал?','Скинь скрин подтверждения','Отзывы есть?'],
  prepay:  ['Пришли товар, я потом оплачу','Давай без гаранта, я честный','Отправь сначала данные, деньги потом','Скинь на карту, верну вдвойне'],
  phishing:['Оплатил! Проверь поступление: playerok-pay.ru/confirm','Скинул оплату, подтверди получение по ссылке','Перевод прошёл, вот квитанция: bit.ly/oplata'],
};
function genInquiry(my){
  const g = goodByName(my.g);
  const roll = Math.random();
  let kind;
  if(roll < 0.34) kind = 'haggle';
  else if(roll < 0.56) kind = 'normal';
  else if(roll < 0.70) kind = 'warranty';
  else if(roll < 0.80) kind = 'suspect';
  else if(roll < 0.90) kind = 'prepay';
  else kind = 'phishing';
  const buyer = pick(BUYERS);
  const discount = kind==='haggle' ? Math.round(rnd(0.05,0.18)*100)/100 : 0;
  return {
    id:'Q'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),
    lot:my.id, g:my.g, buyer, kind,
    text: pick(BUYER_LINES[kind]),
    offer: discount ? Math.round(my.price*(1-discount)) : my.price,
    discount, left: kind==='haggle' ? 34 : 26,
  };
}
const BUYERS = ['Vasya_2004','Кисуля','DarkLoot','Илья','MarinaT','x_Gamer_x','Артём','Dimasik','NightFox','Ольга','Serj','Кэт','Валера','Мурзик'];

function replyInquiry(qid, answer){
  const i = S.inbox.findIndex(q => q.id===qid);
  if(i<0) return;
  const q = S.inbox[i];
  const m = S.my.find(x => x.id===q.lot);
  if(!m){ S.inbox.splice(i,1); render(); return; }
  const g = goodByName(m.g);
  const grossFull = m.price, feeSum = grossFull*fee();
  const profitFull = Math.round(grossFull*(1-fee())*bankMul()) - m.buy;
  let soldPrice = 0, text = '', cls = '';

  if(answer === 'accept'){                       // дать скидку
    soldPrice = q.offer;
    S.votes++; S.rate = clamp((S.rate*S.votes+5)/(S.votes+1),1,5);
    text = `Скидка ${(q.discount*100).toFixed(0)}%: «${g[0]}» ушёл за ${money(soldPrice)}. Покупатель доволен`; cls='ok';
  } else if(answer === 'full'){                  // только полная цена
    if(chance(0.55 + effRate()/5*0.2)){
      soldPrice = grossFull; S.votes++; S.rate = clamp((S.rate*S.votes+4)/(S.votes+1),1,5);
      text = `Продано без скидки: «${g[0]}» за ${money(soldPrice)}`; cls='ok';
    } else {
      S.inbox.splice(i,1);
      addLog(`${q.buyer}: «Нет, дорого» — покупатель ушёл`,'warn');
      toast('Покупатель ушёл','warn'); sound('no'); save(); render(); return;
    }
  } else if(answer === 'bonus'){                 // бонус вместо скидки
    if(chance(0.72)){
      soldPrice = grossFull; S.votes++; S.rate = clamp((S.rate*S.votes+5)/(S.votes+1),1,5);
      text = `Дал бонус вместо скидки: «${g[0]}» продан за ${money(soldPrice)}`; cls='ok';
    } else {
      S.inbox.splice(i,1);
      addLog(`${q.buyer} не устроил бонус — ушёл`,'warn'); toast('Не сработало','warn'); sound('no'); save(); render(); return;
    }
  } else if(answer === 'decline'){               // отказать
    S.inbox.splice(i,1);
    S.votes++; S.rate = clamp((S.rate*S.votes+3)/(S.votes+1),1,5);
    addLog(`Отказал покупателю ${q.buyer} по «${g[0]}»`,''); sound('no'); save(); render(); return;
  } else if(answer === 'prepay'){                // поверить и выслать вперёд — ловушка
    S.stock.length; S.my.splice(S.my.indexOf(m),1);
    S.scamLoss += m.buy;
    addLog(`СКАМ: выслал «${g[0]}» вперёд — ${q.buyer} исчез, оплата не пришла`,'bad');
    toast('Обман: товар ушёл без оплаты','bad'); sound('bad'); ach('first_scam');
    S.votes++; S.rate = clamp((S.rate*S.votes+1)/(S.votes+1),1,5); bumpClaims(1.2);
    S.inbox.splice(i,1);
    // другие вопросы по этому лоту снимаем
    S.inbox = S.inbox.filter(x => x.lot !== q.lot);
    save(); render(); return;
  } else if(answer === 'link'){                  // перейти по ссылке — фишинг
    const loss = Math.min(S.bal, Math.round(Math.min(S.bal*0.15, 20000) * rnd(0.5,1)));
    S.bal -= loss; S.scamLoss += loss;
    addLog(`ФИШИНГ: перешёл по ссылке от ${q.buyer} — со счёта ушло ${money(loss)}`,'bad');
    toast('Фишинг: −' + money(loss),'bad'); sound('bad'); ach('first_scam'); bumpClaims(1.5);
    S.inbox.splice(i,1); save(); render(); return;
  }

  // успешная продажа: деньги приходят, товар ещё нужно выдать
  const net = Math.round(soldPrice*(1-fee())*bankMul());
  S.bal += net; S.turn += soldPrice; S.dayTurn += soldPrice; S.deals++;
  S.totalEarn += Math.max(0, net - m.buy);
  S.my.splice(S.my.indexOf(m),1);
  S.pending = S.pending || [];
  S.pending.push({id:'D'+Date.now().toString(36)+Math.random().toString(36).slice(2,6), g:m.g, buyer:q.buyer, price:soldPrice, net, left:40});
  addLog(text + ` · чистыми ${money(net)} · <b class="${net-m.buy>=0?'ok':'bad'}">${net-m.buy>=0?'+':''}${money(net-m.buy)}</b> · <span class="warn">нужно выдать товар</span>`, cls);
  toast('Оплачено — выдайте товар','warn');
  flyGain('+' + money(net)); flashStat('#s-bal'); sound('deal');
  // возврат платежа
  if(chance(CATS[g[1]].risk*0.5*chargeMul()*(1-autoLvl()*0.12))){
    const back = Math.min(S.bal, Math.round(soldPrice*rnd(0.6,1)));
    S.bal -= back; S.chargeLoss += back;
    addLog(`Чарджбэк по «${g[0]}» — минус ${money(back)}`,'bad'); toast('Чарджбэк: '+money(back),'bad'); sound('bad');
  }
  S.inbox = S.inbox.filter(x => x.lot !== q.lot);
  if(net-m.buy > 0) ach('first_profit');
  checkRank(); save(); render();
}

function tickInbox(dt){
  for(let i=S.inbox.length-1;i>=0;i--){
    const q = S.inbox[i];
    q.left -= dt;
    if(q.left <= 0){
      S.inbox.splice(i,1);
      // если это было просто предложение купить — иногда берут и без ответа
      if(q.kind==='normal' && chance(0.3)){
        const m = S.my.find(x => x.id===q.lot);
        if(m){ replyInquiry(q.id, 'full'); continue; }
      }
      addLog(`${q.buyer} устал ждать ответа по «${q.g}»`,'warn');
      S.votes++; S.rate = clamp((S.rate*S.votes+3)/(S.votes+1),1,5);
    }
  }
}

/* ============================================================
   ВКЛАДКА «СООБЩЕНИЯ»
   ============================================================ */
function viewInbox(){
  if(!S.inbox.length) return `<div class="empty">💬 Сообщений нет. Покупатели напишут, когда заинтересуются вашими лотами.</div>`;
  const kindIcon = {haggle:'🏷️', normal:'✅', warranty:'🛡️', suspect:'🔍', prepay:'⚠️', phishing:'🎣'};
  const kindName = {haggle:'просит скидку', normal:'готов купить', warranty:'спрашивает про гарантию', suspect:'сомневается', prepay:'просит вперёд', phishing:'прислал ссылку'};
  return S.inbox.map(q => {
    const g = goodByName(q.g);
    const danger = (q.kind==='prepay' || q.kind==='phishing');
    const buttons = {
      haggle: `<button class="btn ok" data-ans="accept" data-q="${q.id}">Уступить ${(q.discount*100).toFixed(0)}% · ${money(q.offer)}</button>
               <button class="btn" data-ans="full" data-q="${q.id}">Только полная цена</button>
               <button class="btn" data-ans="bonus" data-q="${q.id}">Бонус вместо скидки</button>
               <button class="btn ghost" data-ans="decline" data-q="${q.id}">Отказать</button>`,
      normal: `<button class="btn ok" data-ans="full" data-q="${q.id}">Продать за ${money(q.offer)}</button>
               <button class="btn" data-ans="bonus" data-q="${q.id}">Продать с бонусом</button>
               <button class="btn ghost" data-ans="decline" data-q="${q.id}">Отказать</button>`,
      warranty: `<button class="btn ok" data-ans="bonus" data-q="${q.id}">Дать гарантию</button>
                 <button class="btn" data-ans="full" data-q="${q.id}">Без гарантии</button>
                 <button class="btn ghost" data-ans="decline" data-q="${q.id}">Отказать</button>`,
      suspect: `<button class="btn ok" data-ans="bonus" data-q="${q.id}">Подтвердить подлинность</button>
                <button class="btn" data-ans="full" data-q="${q.id}">Цена окончательная</button>
                <button class="btn ghost" data-ans="decline" data-q="${q.id}">Отказать</button>`,
      prepay: `<button class="btn bad" data-ans="prepay" data-q="${q.id}">Выслать товар вперёд</button>
               <button class="btn ok" data-ans="full" data-q="${q.id}">Только по предоплате</button>
               <button class="btn ghost" data-ans="decline" data-q="${q.id}">Отказать</button>`,
      phishing: `<button class="btn bad" data-ans="link" data-q="${q.id}">Перейти по ссылке</button>
                 <button class="btn ok" data-ans="full" data-q="${q.id}">Проверить в кабинете</button>
                 <button class="btn ghost" data-ans="decline" data-q="${q.id}">Игнорировать</button>`,
    }[q.kind] || '';
    return `<div class="msg ${danger?'danger':''}" data-id="${q.id}">
      <div class="msghead">
        <div class="ava">${esc(q.buyer.slice(0,2).toUpperCase())}</div>
        <div class="who">
          <b>${esc(q.buyer)}</b>
          <span class="${danger?'bad':''}">${kindIcon[q.kind]} ${kindName[q.kind]}</span>
        </div>
        <span class="mtimer">${Math.ceil(q.left)} с</span>
      </div>
      <div class="msgbody">
        <img src="${imgFor(q.g, g[1])}" alt="" class="mini" loading="lazy">
        <div>
          <div class="mq">«${esc(q.text)}»</div>
          <div class="mlot">${esc(q.g)} · ваша цена ${money(S.my.find(m=>m.id===q.lot)?.price||0)}${q.discount?` · просит за ${money(q.offer)}`:''}</div>
        </div>
      </div>
      ${q.hist && q.hist.length > 1 ? `<div class="hist">${q.hist.slice(-4).map(h=>`<div><b>${h.who==='you'?'Вы':esc(q.buyer)}</b> · ${h.t}: ${esc(h.text)}</div>`).join('')}</div>` : ''}
      ${q.typing ? `<div class="typing"><i></i><i></i><i></i> ${esc(q.buyer)} печатает…</div>` : ''}
      <div class="row answers">${buttons}</div>
      <div class="quicktpl">
        ${TPL.slice(0,3).map(t=>`<button class="chipf" data-tpl="${q.id}" data-tplt="${esc(t)}">${esc(t.slice(0,26))}</button>`).join('')}
      </div>
      ${S.my.find(m=>m.id===q.lot) ? `<div class="scamwrap">
        <button class="btn small scam-toggle" data-scam="${q.id}">😈 Обмануть покупателя</button>
        <div class="scamopts" id="scam-${q.id}" style="display:none">
          <button class="btn small scam-btn" data-fraud="silent" data-q="${q.id}">Не выслать ничего · +${money(S.my.find(m=>m.id===q.lot).price)} и товар остаётся</button>
          <button class="btn small scam-btn" data-fraud="empty" data-q="${q.id}">Выслать пустышку · +${money(S.my.find(m=>m.id===q.lot).price)}</button>
          <button class="btn small scam-btn" data-fraud="swap" data-q="${q.id}">Подсунуть дешёвое · +${money(Math.round(S.my.find(m=>m.id===q.lot).price*0.92))}</button>
          <div class="scam-note">Обман приносит деньги сразу, но покупатель может пожаловаться: рейтинг упадёт, появится риск блокировки. «Не выслать ничего» — самая выгодная и самая опасная схема.</div>
        </div>
      </div>` : ''}
    </div>`;
  }).join('');
}

/* ============================================================
   ОКНО ТОРГА ПРИ ПОКУПКЕ
   ============================================================ */
function openHaggle(lotId){
  const l = M.lots.find(x => x.id===lotId);
  if(!l) return;
  const g = goodByName(l.g), fair = fairPrice(g);
  const min = Math.max(30, Math.round(l.price*0.55));
  const start = Math.round(l.price*0.88);
  $('#m-item-body').innerHTML = `
    <h2>Торг: «${esc(g[0])}»</h2>
    <p class="mut">Продавец <b>${esc(l.seller)}</b> · цена ${money(l.price)} · рынок ${money(fair)}
      ${l.counter?` · его встречное: <b class="gold">${money(l.price)}</b>`:''}</p>
    <label class="fld">Ваше предложение
      <input id="hg" type="number" value="${start}" min="${min}" max="${l.price}">
    </label>
    <input id="hgr" type="range" min="${min}" max="${l.price}" value="${start}" step="10">
    <div class="quick">
      <button class="btn small" data-h="0.95">−5%</button>
      <button class="btn small" data-h="0.9">−10%</button>
      <button class="btn small" data-h="0.85">−15%</button>
      <button class="btn small" data-h="0.8">−20%</button>
    </div>
    <div id="hg-calc" class="dcalc"></div>
    ${upgLvl('neg')?`<div class="small ok">Переговорщик ур.${upgLvl('neg')} повышает шанс уступки</div>`:''}
    ${l.noHaggle?'<div class="small bad">Продавец уже отказался торговаться</div>':''}
    <div class="row end">
      <button class="btn ghost" data-close>Отмена</button>
      <button class="btn ok" id="hg-go">Предложить</button>
    </div>`;
  $('#m-item').classList.add('show');
  const i = $('#hg'), r = $('#hgr'), c = $('#hg-calc');
  const upd = () => {
    const v = Math.max(min, +i.value||min);
    const d = (1 - v/l.price)*100;
    const resale = Math.round(fairPrice(g)*(1-fee())*bankMul());
    c.innerHTML = `Скидка <b>${d.toFixed(0)}%</b> · ваша выгода при перепродаже <b class="${resale-v>=0?'ok':'bad'}">${money(resale-v)}</b>`;
  };
  i.oninput = () => { r.value = i.value; upd(); };
  r.oninput = () => { i.value = r.value; upd(); };
  $$('#m-item [data-h]').forEach(b => b.onclick = () => {
    i.value = Math.round(l.price*(+b.dataset.h)); r.value = i.value; upd();
  });
  upd(); i.focus();
  $('#hg-go').onclick = () => { closeModals(); makeOffer(lotId, +i.value||start); };
}

/* ============================================================
   НАСТРОЙКИ
   ============================================================ */
const SETDEF = {sound:true, anim:'auto', diff:'normal', autosave:true, confirmBuy:true, theme:'dark'};
const THEMES = [
  {id:'light',    name:'Светлая', bg:'#f4f5f7', card:'#ffffff', ac:'#4384d0'},
  {id:'dark',     name:'Тёмная',  bg:'#12141a', card:'#1a1d25', ac:'#6aa6e8'},
  {id:'graphite', name:'Графит',  bg:'#141213', card:'#1e1b1d', ac:'#5b93d6'},
  {id:'indigo',   name:'Индиго',  bg:'#0e1118', card:'#161b26', ac:'#7aa2ff'},
];
let SET = Object.assign({}, SETDEF);
function setKey(){ return SAVE+'_set'; }
function loadSet(){
  try{ SET = Object.assign({}, SETDEF, JSON.parse(localStorage.getItem(setKey())||'{}')); }catch(e){}
  applySet();
}
function saveSet(){ try{ localStorage.setItem(setKey(), JSON.stringify(SET)); }catch(e){} }
function applySet(){
  document.body.classList.toggle('lite', SET.anim==='lite');
  document.body.classList.toggle('force-anim', SET.anim==='full');
  document.documentElement.dataset.theme = SET.theme;
}
const DIFF = {
  easy:  {name:'Лёгкая',   risk:0.6, spreadK:0.85, gain:1.15},
  normal:{name:'Обычная',  risk:1.0, spreadK:1.0,  gain:1.0},
  hard:  {name:'Жёсткая',  risk:1.45,spreadK:1.2,  gain:0.85},
};
function diffK(){ return DIFF[SET.diff] || DIFF.normal; }
function openSettings(){
  const row = (label, control, hint) => `<div class="setrow"><div><b>${label}</b>${hint?`<div class="tiny">${hint}</div>`:''}</div><div>${control}</div></div>`;
  const sel = (id, opts, cur) => `<select id="${id}" class="inp" style="min-width:130px">${opts.map(o=>`<option value="${o[0]}"${o[0]===cur?' selected':''}>${o[1]}</option>`).join('')}</select>`;
  $('#set-body').innerHTML =
    row('Звук', `<button class="btn small ${SET.sound?'ok':''}" id="set-sound">${SET.sound?'Включён':'Выключен'}</button>`, 'короткие сигналы о сделках и сообщениях') +
    row('Анимации', sel('set-anim',[['auto','Авто'],['full','Полные'],['lite','Облегчённые']], SET.anim), 'автоматически упрощает эффекты на слабых устройствах') +
    row('Сложность', sel('set-diff',[['easy','Лёгкая'],['normal','Обычная'],['hard','Жёсткая']], SET.diff), 'влияет на скам, возвраты и спреды') +
    `<div class="setrow" style="display:block"><div><b>Тема оформления</b><div class="tiny">4 варианта, переключаются мгновенно</div></div>
      <div class="themes">${THEMES.map(t=>`<div class="tcard ${SET.theme===t.id?'on':''}" data-theme-btn="${t.id}">
        <div class="tprev"><i style="background:${t.bg}"></i><i style="background:${t.card}"></i><i style="background:${t.ac}"></i></div>${t.name}</div>`).join('')}
      </div></div>` +
    row('Подтверждать покупку', `<button class="btn small ${SET.confirmBuy?'ok':''}" id="set-conf">${SET.confirmBuy?'Да':'Нет'}</button>`) +
    `<div class="setrow"><div><b>Сохранение</b><div class="tiny">экспорт прогресса в файл и обратно</div></div>
      <div class="row end">
        <button class="btn small" id="set-export">Экспорт</button>
        <button class="btn small" id="set-import">Импорт</button>
      </div></div>
     <div class="setrow"><div><b>Сброс</b><div class="tiny">удалить прогресс и начать заново</div></div>
      <div><button class="btn small bad" id="set-reset">Сбросить всё</button></div></div>`;
  $('#m-set').classList.add('show');
  $('#set-sound').onclick = e => { SET.sound = !SET.sound; e.target.textContent = SET.sound?'Включён':'Выключен'; e.target.classList.toggle('ok', SET.sound); saveSet(); if(SET.sound) sound('click'); };
  $('#set-conf').onclick  = e => { SET.confirmBuy = !SET.confirmBuy; e.target.textContent = SET.confirmBuy?'Да':'Нет'; e.target.classList.toggle('ok', SET.confirmBuy); saveSet(); };
  $('#set-anim').onchange = e => { SET.anim = e.target.value; applySet(); saveSet(); };
  $('#set-diff').onchange = e => { SET.diff = e.target.value; saveSet(); toast('Сложность: '+DIFF[SET.diff].name,'warn'); };
  $$('[data-theme-btn]').forEach(el => el.onclick = () => {
    SET.theme = el.dataset.themeBtn; applySet(); saveSet(); sound('click');
    $$('[data-theme-btn]').forEach(x => x.classList.toggle('on', x.dataset.themeBtn===SET.theme));
    toast('Тема: ' + (THEMES.find(t=>t.id===SET.theme)||{}).name, 'ok');
  });
  $('#set-export').onclick = () => {
    const data = btoa(unescape(encodeURIComponent(JSON.stringify(S))));
    const a = document.createElement('a');
    a.href = 'data:application/json;base64,' + data;
    a.download = 'playerok-save.txt'; a.click();
    toast('Сохранение выгружено','ok');
  };
  $('#set-import').onclick = () => {
    const inp = document.createElement('input'); inp.type = 'file';
    inp.onchange = () => {
      const f = inp.files[0]; if(!f) return;
      const fr = new FileReader();
      fr.onload = () => {
        try{
          const o = JSON.parse(decodeURIComponent(escape(atob(fr.result.trim()))));
          S = Object.assign(DEF(), o); save(); render(); toast('Прогресс загружен','ok');
        }catch(e){ toast('Неверный файл','bad'); }
      };
      fr.readAsText(f);
    };
    inp.click();
  };
  $('#set-reset').onclick = () => {
    if(!confirm('Удалить весь прогресс?')) return;
    localStorage.removeItem(SAVE);
    S = DEF(); newPrices(); refreshMarket(); save(); closeModals(); render(); toast('Прогресс сброшен','warn');
  };
}

/* ============================================================
   ЗВУК — синтезируем на месте, без файлов
   ============================================================ */
let AC = null;
function sound(kind){
  if(!SET.sound) return;
  try{
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    if(AC.state === 'suspended') AC.resume();
    const t = AC.currentTime;
    const blip = (freq, dur, type, vol, slideTo) => {
      const o = AC.createOscillator(), g = AC.createGain();
      o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
      if(slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t+dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol||0.08, t+0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
      o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t+dur+0.02);
    };
    if(kind==='click')   blip(660, 0.05, 'square', 0.03);
    if(kind==='deal')  { blip(520, 0.09, 'sine', 0.09); setTimeout(()=>blip(780, 0.12, 'sine', 0.08), 80); }
    if(kind==='msg')     blip(880, 0.08, 'triangle', 0.06, 1180);
    if(kind==='no')      blip(220, 0.14, 'sawtooth', 0.05, 140);
    if(kind==='bad')   { blip(180, 0.18, 'sawtooth', 0.07, 90); }
    if(kind==='money') { blip(680,0.07,'sine',0.07); setTimeout(()=>blip(920,0.09,'sine',0.06),70); setTimeout(()=>blip(1240,0.12,'sine',0.05),150); }
  }catch(e){}
}

/* ============================================================
   ОБМАН: можно кинуть покупателя или продавца
   ============================================================ */
const SCAM_WAYS = {
  // что делаем                доход        товар остаётся      риск жалобы   риск блока
  empty:  {name:'Выслать пустышку',     keep:false, claim:2.6, block:0.9,  rate:1},
  swap:   {name:'Подсунуть дешёвое',    keep:false, claim:1.8, block:0.6,  rate:2},
  silent: {name:'Не выслать ничего',    keep:true,  claim:3.4, block:1.35, rate:1},
};
function scamStats(){
  return {done: S.scamsDone||0, profit: S.scamProfit||0};
}
function scamBuyer(qid, way){
  const i = S.inbox.findIndex(q => q.id===qid);
  if(i<0) return;
  const q = S.inbox[i];
  const m = S.my.find(x => x.id===q.lot);
  if(!m){ S.inbox.splice(i,1); render(); return; }
  const g = goodByName(m.g);
  const w = SCAM_WAYS[way];
  const price = (way==='swap') ? Math.round(m.price*0.92) : m.price;   // при подмене покупатель сбивает цену

  // деньги приходят сразу
  const gross = price, net = Math.round(gross*(1-fee())*bankMul());
  S.bal += net; S.turn += gross; S.dayTurn += gross; S.deals++;
  S.my.splice(S.my.indexOf(m),1);
  if(w.keep){ addStock(g[0], m.buy); }          // товар остался — можно продать снова
  S.scamsDone = (S.scamsDone||0)+1;
  S.scamProfit = (S.scamProfit||0) + Math.max(0, net - (w.keep?0:m.buy));
  S.inbox = S.inbox.filter(x => x.lot !== q.lot);

  // последствия
  const law = lawMul(), care = 1 - upgLvl('rep')*0.07;
  S.votes++; S.rate = clamp((S.rate*S.votes + w.rate)/(S.votes+1), 1, 5);
  const claimed = chance(0.62 * care);
  let txt = `ОБМАН (${w.name}): получил ${money(net)} за «${g[0]}»` + (w.keep?' · товар остался у вас':'');
  addLog(txt, 'bad');
  flyGain('+' + money(net)); flashStat('#s-bal'); sound('money');
  if(claimed){
    S.claims += w.claim * law;
    addLog(`Жалоба: покупатель ${q.buyer} пишет, что товар не получен`, 'bad');
    toast('Жалоба от покупателя','bad'); sound('bad');
    if(chance(0.22*law)){                      // возврат по жалобе
      const back = Math.min(S.bal, net);
      S.bal -= back; S.chargeLoss += back;
      addLog(`Площадка вернула деньги покупателю — минус ${money(back)}`,'bad');
      toast('Деньги вернули по жалобе','bad');
    }
  } else {
    addLog(`${q.buyer} так и не написал жалобу — прошло`,'warn');
    toast('Пронесло','warn');
  }
  checkBlock();
  ach('first_fraud');
  if((S.scamsDone||0) >= 5) ach('serial_fraud');
  if((S.scamsDone||0) >= 25) ach('king_fraud');
  if(S.blocked > 0) ach('banned_fraud');
  save(); render();
}

/* кидок продавца: открываем спор по уже купленному лоту */
function openDispute(stockId){
  const s = S.stock.find(x => x.id===stockId);
  if(!s) return;
  const g = goodByName(s.g);
  const back = Math.round(s.buy * rnd(0.85,1));
  $('#m-ask-title').textContent = 'Открыть спор по «' + g[0] + '»?';
  $('#m-ask-text').innerHTML =
    `Вы заявите, что товар не пришёл, и потребуете возврат <b>${money(back)}</b>.<br>
     Если площадка поверит — деньги вернутся, <b>товар останется у вас</b>.<br>
     <span class="bad">Последствия: жалоба продавца, падение рейтинга, риск блокировки. Частые споры замечают.</span>`;
  $('#m-ask').classList.add('show');
  $('#m-ask-yes').onclick = () => {
    closeModals();
    const law = lawMul(), care = Math.pow(0.88, upgLvl('rep'));
    const win = chance(0.5 + (S.disputes ? 0 : 0.12) - (S.disputes||0)*0.06) ;
    S.disputes = (S.disputes||0)+1;
    if(win){
      S.bal += back; S.scamProfit = (S.scamProfit||0)+back; S.scamsDone = (S.scamsDone||0)+1;
      addLog(`СПОР ВЫИГРАН: вернул ${money(back)} за «${g[0]}», товар остался в складе`,'bad');
      toast('+' + money(back) + ' по спору','ok'); sound('money'); flyGain('+'+money(back));
    } else {
      addLog(`Спор проигран: площадка встала на сторону продавца «${g[0]}»`,'bad');
      toast('Спор отклонён','bad'); sound('bad');
    }
    S.claims += (win?1.6:0.9) * law * care;
    S.votes++; S.rate = clamp((S.rate*S.votes+1)/(S.votes+1),1,5);
    ach('first_fraud');
    if((S.scamsDone||0) >= 5) ach('serial_fraud');
    checkBlock(); save(); render();
  };
}

/* ============================================================
   НИЖНЯЯ ПАНЕЛЬ
   ============================================================ */
function bindDock(){
  $$('#cats .cat i').forEach(i => { const k = i.parentElement.dataset.cat; if(ICONS[k]) i.innerHTML = ico(k); });
  $$('[data-go] i').forEach(i => { const k = i.parentElement.dataset.go; if(ICONS[k]) i.innerHTML = ico(k); });
  $$('#dock .dk').forEach(b => {
    const t = b.dataset.tab, i = b.querySelector('i');
    if(i && ICONS[t]) i.innerHTML = ico(t);
    b.onclick = () => { sound('click'); setTab(t); };
  });
}
function drawDock(){
  $$('.dk').forEach(b => b.classList.toggle('active', b.dataset.tab===currentTab));
  const badge = (id, n) => { const e = $(id); if(!e) return; e.textContent = n; e.classList.toggle('zero', !n); };
  badge('#dk-stock', S.stock.length);
  badge('#dk-my', S.my.length);
  badge('#dk-inbox', S.inbox.length);
  badge('#dk-ord', S.orders.length);
  const pend = (S.pending||[]).length;
  const dp = $('.dk[data-tab="deliv"]'); if(dp){ const e = $('#dk-deliv'); if(e){ e.textContent = pend; e.classList.toggle('zero', !pend); } dp.classList.toggle('pulse', pend>0 && currentTab!=='deliv'); }
  const chat = $('.dk[data-tab="inbox"]');
  if(chat) chat.classList.toggle('pulse', S.inbox.length > 0 && currentTab !== 'inbox');
}

/* ============================================================
   ВЫДАЧА ТОВАРА: можно перепутать и получить штраф
   ============================================================ */
const DELIVERY = {
  ok:      {name:'Выслать верный товар',    fine:0,    claim:0},
  wrong:   {name:'Выслать похожий (ошибка)',fine:0.25, claim:1.8},
  partial: {name:'Выслать часть',           fine:0.15, claim:1.2},
  late:    {name:'Задержать выдачу',        fine:0.05, claim:0.6},
};
function deliverOptions(myId){
  const m = S.my.find(x => x.id===myId);
  if(!m) return [];
  const g = goodByName(m.g);
  const similar = S.stock.filter(s => s.g !== m.g && goodByName(s.g)[1] === g[1]).slice(0,2);
  const list = [
    {key:'ok',    label:`Выслать «${g[0]}»`},
    {key:'late',  label:'Задержать на пару часов'},
  ];
  if(similar.length) list.push({key:'wrong', label:`Перепутать и выслать «${similar[0].g}»`});
  if((m.qty||1) > 1) list.push({key:'partial', label:'Выслать только часть'});
  return list;
}
function applyDelivery(myId, key){
  const m = S.my.find(x => x.id===myId);
  if(!m) return;
  const d = DELIVERY[key]; if(!d) return;
  const g = goodByName(m.g);
  if(key === 'ok'){
    addLog(`Выдал «${g[0]}» вовремя и полностью`,'ok');
    S.votes++; S.rate = clamp((S.rate*S.votes+5)/(S.votes+1),1,5);
    return;
  }
  const fine = Math.round(m.price * d.fine);
  if(fine > 0){ S.bal = Math.max(0, S.bal - fine); S.turn = Math.max(0, S.turn - fine); }
  S.claims += d.claim * lawMul();
  S.votes++; S.rate = clamp((S.rate*S.votes + (key==='wrong'?1:2))/(S.votes+1),1,5);
  const texts = {
    wrong:   `ОШИБКА ВЫДАЧИ: перепутал товар, выслал не то. Штраф ${money(fine)}, жалоба от покупателя`,
    partial: `ВЫДАЛ ЧАСТЬ: покупатель недоволен. Штраф ${money(fine)}`,
    late:    `ЗАДЕРЖКА: выдал позже срока. Штраф ${money(fine)}`,
  };
  addLog(texts[key],'bad');
  toast(`Штраф ${money(fine)}`,'bad'); sound('bad');
  flyGain('−'+money(fine), true);
  checkBlock(); save(); render();
}

/* ============================================================
   ЖИВОЙ ЧАТ: история, «печатает», шаблоны
   ============================================================ */

/* ===== SVG-иконки вместо эмодзи ===== */
const ICONS = {
  market:'<path d="M3 9l1.5-5h15L21 9M4 9h16v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><path d="M9 20v-6h6v6"/>',
  stock: '<path d="M3 7.5 12 3l9 4.5v9L12 21 3 16.5z"/><path d="M3 7.5 12 12l9-4.5M12 12v9"/>',
  my:    '<path d="M20.6 13.4 12 22l-9-9V4h8l1 3h8z"/>',
  deliv: '<path d="M3 12h13"/><path d="M12 5l7 7-7 7"/><path d="M21 3v6h-6"/>',
  inbox: '<path d="M21 11.5a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  orders:'<path d="M8 3h8l1 3h3v16H4V6h3z"/><path d="M9 12h6M9 16h4"/>',
  upg:   '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  crime: '<path d="M4 8h16v3a6 6 0 0 1-6 6h-1l-1 3h-1l-1-3h-1a6 6 0 0 1-5-6z"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/>',
  top:   '<path d="M6 9H3V4h5v3l4-3 4 3V4h5v5h-3"/><circle cx="12" cy="14" r="5"/><path d="M12 19v2M9 21h6"/>',
  acc:   '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6"/>',
  curr:  '<circle cx="12" cy="12" r="9"/><path d="M15 9.5c-.6-1.2-1.7-1.8-3-1.8-1.7 0-3 .9-3 2.3s1.3 2.1 3 2.4 3.1.7 3.1 2.4c0 1.5-1.4 2.4-3.1 2.4-1.4 0-2.5-.6-3.1-1.7"/><path d="M12 6v12"/>',
  sub:   '<path d="M3 6h18v12H3z"/><path d="M3 10h18M7 14h3"/>',
  key:   '<circle cx="8" cy="12" r="4"/><path d="M12 12h9M17 12v3M20 12v2"/>',
  app:   '<path d="M8 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M11 18h2"/>',
  item:  '<path d="M5 8h14M5 12h14M5 16h10"/><circle cx="3.5" cy="8" r="1.2"/><circle cx="3.5" cy="12" r="1.2"/><circle cx="3.5" cy="16" r="1.2"/>',
  social:'<path d="M12 21s-7-4.4-7-9.5A4.5 4.5 0 0 1 12 8a4.5 4.5 0 0 1 7 3.5c0 5.1-7 9.5-7 9.5z"/>',
  boost: '<circle cx="12" cy="14" r="5"/><path d="M8.5 9.5 7 3h4l1 3M15.5 9.5 17 3h-4l-1 3"/><path d="M10 14l2-2 2 2"/>',
  edu:   '<path d="M12 4 2 9l10 5 10-5z"/><path d="M6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5"/>',
  rent:  '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
  gear:  '<path d="M4 14h16v4H4z"/><path d="M7 14v-3a5 5 0 0 1 10 0v3"/><circle cx="17" cy="17" r="1.5"/>',
  bundle:'<path d="M3 8h18v4H3zM5 12v8h14v-8"/><path d="M12 8v12M12 8c-3 0-4-2-4-4 2 0 4 1 4 4zM12 8c3 0 4-2 4-4-2 0-4 1-4 4z"/>',
  server:'<rect x="3" y="4" width="18" height="6" rx="1"/><rect x="3" y="14" width="18" height="6" rx="1"/><path d="M7 7h.01M7 17h.01"/>',
  mobskin:'<path d="M12 3c4 0 6 2.5 6 5.5S16 14 12 14s-6-2.5-6-5.5S8 3 12 3z"/><path d="M8 15c-2 1-3 3-3 6h14c0-3-1-5-3-6"/>',
  collect:'<path d="M12 3 4 7v10l8 4 8-4V7z"/><path d="M12 11 4 7M12 11l8-4M12 11v10"/>',
  crypto:'<ellipse cx="12" cy="6.5" rx="7" ry="2.5"/><path d="M5 6.5v11c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-11"/><path d="M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5"/>',
};
function ico(k, cls){
  const d = ICONS[k];
  if(!d) return '';
  return `<svg class="ic ${cls||''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
}

const TPL = ['Здравствуйте! Товар в наличии','Отправлю в течение 5 минут','Цена окончательная, извините','Гарантия 24 часа','Спасибо за покупку!'];
function pushHistory(q, who, text){
  q.hist = q.hist || [];
  q.hist.push({who, text, t:new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})});
  if(q.hist.length > 12) q.hist.shift();
}
function sendTpl(qid, text){
  const q = S.inbox.find(x => x.id===qid);
  if(!q) return;
  pushHistory(q, 'you', text);
  sound('click');
  // покупатель «печатает» и отвечает
  q.typing = true; render();
  setTimeout(() => {
    q.typing = false;
    const answers = ['Понял, жду','Хорошо, согласен','А можно быстрее?','Тогда беру','Не подходит, отбой'];
    const a = pick(answers);
    pushHistory(q, q.buyer, a);
    addLog(`${q.buyer}: «${a}» (ответ на «${text}»)`,'');
    if(currentTab==='inbox') render(); else drawDock();
  }, rnd(1400, 2600));
}
function genInquiryWrapped(my){
  const q = genInquiry(my);
  q.hist = [{who:q.buyer, text:q.text, t:new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}];
  return q;
}

/* ============================================================
   ОЖИДАЮТ ВЫДАЧИ
   ============================================================ */
function tickPending(dt){
  if(!S.pending) return;
  for(let i=S.pending.length-1;i>=0;i--){
    const d = S.pending[i];
    d.left -= dt;
    if(d.left <= 0){
      S.pending.splice(i,1);
      const fine = Math.round(d.price*0.2);
      S.bal = Math.max(0, S.bal - fine);
      S.claims += 2.2*lawMul();
      S.votes++; S.rate = clamp((S.rate*S.votes+1)/(S.votes+1),1,5);
      addLog(`НЕ ВЫДАЛ ВОВРЕМЯ: «${d.g}» для ${d.buyer}. Штраф ${money(fine)} и жалоба`,'bad');
      toast('Просрочил выдачу: штраф '+money(fine),'bad'); sound('bad');
      checkBlock(); save(); render();
    }
  }
}
/* выбрать, что именно выслать */
function pickDelivery(pid){
  const d = (S.pending||[]).find(x => x.id===pid);
  if(!d) return;
  const g = goodByName(d.g);
  const similar = S.stock.filter(s => s.g !== d.g && goodByName(s.g)[1] === g[1]).slice(0,2);
  $('#m-ask-title').textContent = 'Выдача: «' + d.g + '»';
  $('#m-ask-text').innerHTML =
    `Покупатель <b>${esc(d.buyer)}</b> оплатил ${money(d.price)}. Что отправляем?<br>
     <span class="tiny">Ошибка в выдаче — штраф от 5 до 25 % суммы плюс жалоба.</span>`;
  $('#m-ask').classList.add('show');
  const box = $('#m-ask');
  let extra = box.querySelector('.deliv-opts');
  if(!extra){ extra = document.createElement('div'); extra.className = 'deliv-opts row'; box.querySelector('.mbox, .mbox.narrow').insertBefore(extra, box.querySelector('.row.end')); }
  extra.style.flexDirection = 'column';
  extra.innerHTML =
    `<button class="btn ok" data-dv="ok" data-p="${pid}">Выслать «${esc(d.g)}» как есть</button>` +
    (similar.length?`<button class="btn bad" data-dv="wrong" data-p="${pid}">Выслать «${esc(similar[0].g)}» (перепутать)</button>`:'') +
    `<button class="btn bad" data-dv="partial" data-p="${pid}">Выслать часть и сказать, что остальное позже</button>` +
    `<button class="btn ghost" data-dv="late" data-p="${pid}">Попросить подождать</button>`;
  extra.querySelectorAll('[data-dv]').forEach(b => b.onclick = () => {
    const way = b.dataset.dv;
    closeModals();
    const fine = Math.round(d.price * DELIVERY[way].fine);
    if(fine>0){ S.bal = Math.max(0, S.bal - fine); }
    if(way === 'ok'){
      addLog(`Выдал «${d.g}» покупателю ${d.buyer} — сделка закрыта`,'ok');
      toast('Выдано','ok'); sound('deal');
      S.votes++; S.rate = clamp((S.rate*S.votes+5)/(S.votes+1),1,5);
    } else {
      S.claims += DELIVERY[way].claim*lawMul();
      S.votes++; S.rate = clamp((S.rate*S.votes + (way==='wrong'?1:2))/(S.votes+1),1,5);
      const what = {wrong:'перепутал товар', partial:'выслал часть', late:'задержал выдачу'}[way];
      addLog(`ОШИБКА ВЫДАЧИ (${what}) по «${d.g}»: штраф ${money(fine)}`,'bad');
      toast('Штраф '+money(fine),'bad'); sound('bad'); flyGain('−'+money(fine), true);
    }
    S.pending = (S.pending||[]).filter(x => x.id !== pid);
    checkBlock(); save(); render();
  });
  $('#m-ask-yes').onclick = () => { closeModals(); pickDelivery(pid); };
}
function viewPending(){
  if(!(S.pending||[]).length) return `<div class="empty">Нечего выдавать. Здесь появятся оплаченные сделки, по которым нужно передать товар.</div>`;
  return (S.pending||[]).map(d => {
    const g = goodByName(d.g);
    return `<div class="ord ${d.left<15?'urgent':''}" data-id="${d.id}">
      <div class="ohead"><b>${esc(d.g)}</b><span class="tmr">${Math.ceil(d.left)} с</span></div>
      <div class="obar"><i style="width:${(d.left/40*100).toFixed(0)}%"></i></div>
      <div class="orow">
        <span>Покупатель: <b>${esc(d.buyer)}</b></span>
        <span>Оплачено: <b class="ok">${money(d.price)}</b></span>
        <span>${ico(g[1])} ${CATS[g[1]].name}</span>
      </div>
      <div class="row end"><button class="btn ok" data-pick="${d.id}">Выдать</button></div>
    </div>`;
  }).join('');
}

/* ============================================================
   КРИМИНАЛЬНАЯ ВЕТКА: розыск, кражи, отмывание, крыша, модерация
   ============================================================ */
const CRIME = {
  steal:   {name:'Угнать лот',        heat:14, dirty:0.85, cash:0,   desc:'Товар со скидкой 45–70 %, но он числится краденым'},
  carding: {name:'Кардинг',           heat:26, dirty:1.00, cash:1,   desc:'Быстрые деньги, но розыск растёт сильно'},
  launder: {name:'Отмыть деньги',     heat:8,  dirty:0,    cash:0,   desc:'Превращает грязные в чистые, теряешь 25 %'},
  roof:    {name:'Платить за крышу',  heat:-30,dirty:0,    cash:0,   desc:'Снимает розыск и жалобы, действует 3 минуты'},
  bribe:   {name:'Договориться с модератором', heat:-55, dirty:0, cash:0, desc:'Снимает блокировку и розыск, дорого'},
};
function heatMul(){ return DIFF[SET.diff].risk; }
function roofActive(){ return (S.roofT||0) > 0; }
/* ---- действие ---- */
function doCrime(kind){
  const c = CRIME[kind];
  if(S.blocked > 0 && kind !== 'bribe'){ toast('Сначала снимите блокировку','bad'); return; }
  const cost = crimeCost(kind);
  if(cost > 0){
    if(S.bal < cost){ toast('Недостаточно денег','bad'); sound('no'); return; }
    S.bal -= cost;
  }
  if(kind === 'steal'){
    const g = pick(GOODS.filter(x => x[2] >= 1) || GOODS);
    const base = fairPrice(g);
    const price = Math.round(base * rnd(0.30, 0.55));
    S.stock.push({id:'S'+Date.now().toString(36)+Math.random().toString(36).slice(2,6), g:g[0], buy:price, hot:false});
    S.heat = clamp((S.heat||0) + c.heat*heatMul(), 0, 100);
    addLog(`УГНАЛ «${g[0]}» за ${money(price)} (рынок ${money(Math.round(base))}) · розыск +${(c.heat*heatMul()).toFixed(0)}%`,'warn');
    toast('Товар у вас, но он краденый','warn');
  }
  if(kind === 'carding'){
    const sum = Math.round(rnd(0.06, 0.14) * Math.max(8000, S.turn||0) + rnd(1500, 6000));
    S.dirty = (S.dirty||0) + sum;
    S.heat = clamp((S.heat||0) + c.heat*heatMul(), 0, 100);
    addLog(`КАРДИНГ: +${money(sum)} грязными · розыск +${(c.heat*heatMul()).toFixed(0)}%`,'warn');
    toast('Грязные деньги получены','warn');
  }
  if(kind === 'launder'){
    const dirty = S.dirty||0;
    if(dirty < 500){ toast('Нечего отмывать','bad'); sound('no'); return; }
    const clean = Math.round(dirty * 0.75);
    S.bal += clean; S.dirty = 0;
    S.heat = clamp((S.heat||0) + c.heat*heatMul(), 0, 100);
    addLog(`ОТМЫЛ ${money(dirty)} → чистыми ${money(clean)} (потеряно 25 %)`,'ok');
    toast('Отмыто: '+money(clean),'ok'); flyGain('+'+money(clean)); sound('money');
  }
  if(kind === 'roof'){
    S.roofT = 180;
    S.heat = clamp((S.heat||0) + c.heat, 0, 100);
    S.claims = Math.max(0, (S.claims||0) - 2);
    addLog(`КРЫША оплачена на 3 мин: розыск −30 %, жалобы частично сняты`,'ok');
    toast('Крыша активна 3 минуты','ok');
  }
  if(kind === 'bribe'){
    S.blocked = 0; S.heat = clamp((S.heat||0) + c.heat, 0, 100);
    S.claims = Math.max(0, (S.claims||0) - 4);
    addLog(`МОДЕРАТОР закрыл глаза: блокировка снята, розыск −55 %`,'ok');
    toast('Блокировка снята','ok');
  }
  checkHeat(); save(); render();
}
function crimeCost(kind){
  const turn = Math.max(10000, S.turn||0);
  return {
    steal:   Math.round(turn*0.02 + 300),
    carding: Math.round(turn*0.03 + 800),
    launder: 0,
    roof:    Math.round(turn*0.06 + 1500),
    bribe:   Math.round(turn*0.12 + 4000),
  }[kind] || 0;
}
/* ---- проверка розыска ---- */
function checkHeat(){
  const h = S.heat||0;
  if(h >= 100){
    S.heat = 30;
    const lost = Math.round(Math.min(S.bal, (S.turn||0)*0.08 + 5000));
    S.bal = Math.max(0, S.bal - lost);
    S.blocked = Math.max(S.blocked||0, 45);
    addLog(`ОБЛАВА: розыск дошёл до 100 %. Изъято ${money(lost)}, аккаунт заморожен на 45 с`,'bad');
    toast('Облава! Изъято '+money(lost),'bad'); sound('bad');
  }
}
/* ---- тик: крыша и остывание розыска ---- */
function tickCrime(dt){
  if(S.roofT > 0) S.roofT = Math.max(0, S.roofT - dt);
  const cool = (roofActive() ? 0.55 : 0.25) * (lawMul ? (2.2 - lawMul()) : 1);
  if(S.heat > 0) S.heat = Math.max(0, S.heat - dt*cool);
}
/* ---- вкладка ---- */
function viewCrime(){
  const h = Math.round(S.heat||0), dirty = Math.round(S.dirty||0);
  const hcls = h > 70 ? 'bad' : h > 40 ? 'warn' : 'ok';
  return `
  <div class="ord">
    <div class="ohead"><b>Розыск</b><span class="${hcls}" style="font-weight:700">${h}%</span></div>
    <div class="obar"><i style="width:${h}%;background:${h>70?'var(--red)':h>40?'var(--orange)':'var(--green)'}"></i></div>
    <div class="orow">
      <span>Грязных денег: <b class="${dirty>0?'warn':'mut'}">${money(dirty)}</b></span>
      <span>Крыша: <b class="${roofActive()?'ok':'mut'}">${roofActive()?'активна '+Math.ceil(S.roofT)+' с':'нет'}</b></span>
      <span>Блокировка: <b class="${S.blocked>0?'bad':'mut'}">${S.blocked>0?Math.ceil(S.blocked)+' с':'нет'}</b></span>
    </div>
    <div class="tiny" style="margin-top:6px">Розыск растёт от криминальных действий и остывает сам. На 100 % приходит облава: изымают часть денег и морозят аккаунт.</div>
  </div>
  ${Object.entries(CRIME).map(([k,c])=>{
    const cost = crimeCost(k);
    const dis = (cost > S.bal) || (k==='launder' && dirty < 500) || (S.blocked>0 && k!=='bribe');
    return `<div class="upg ${dis?'maxed':''}">
      <div class="uicon">${ico(k==='steal'?'item':k==='carding'?'crypto':k==='launder'?'curr':k==='roof'?'bundle':'top')}</div>
      <div class="ubody">
        <div class="uname">${c.name}</div>
        <div class="udesc">${c.desc}</div>
        <div class="ubar"><i style="width:${k==='steal'?70:k==='carding'?45:k==='launder'?100:k==='roof'?60:85}%"></i></div>
      </div>
      <button class="btn ${k==='roof'||k==='bribe'||k==='launder'?'ok':'bad'}" data-crime="${k}" ${dis?'disabled':''}>${cost>0?money(cost):'Бесплатно'}</button>
    </div>`;
  }).join('')}
  <div class="prof">
    <h3>Что это даёт</h3>
    <div class="tiny">Угнанные лоты дешевле рынка в 2–3 раза — их выгодно перепродать. Грязные деньги нельзя тратить, пока не отмоете (теряете 25 %). Крыша и модератор — единственный способ быстро снизить розыск и снять блокировку.</div>
  </div>`;
}
