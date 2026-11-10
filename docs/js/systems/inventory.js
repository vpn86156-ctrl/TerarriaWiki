/* Инвентарь: добавление, экипировка, продажа, блокировка, фильтры. */
import { getState } from '../core/state.js';
import { itemPower, SLOT_NAMES } from '../data/items.js';
import { RAR_INDEX } from '../data/rarities.js';

export const INV_LIMIT = 120;

export function addItem(item){
  const gs = getState();
  gs.inv.unshift(item);
  if(gs.inv.length > INV_LIMIT){
    // вытесняем самый слабый незаблокированный и не надетый предмет
    let worst = -1, worstPower = Infinity;
    gs.inv.forEach((it, i) => {
      if(it.locked || it.equipped) return;
      const p = itemPower(it);
      if(p < worstPower){ worstPower = p; worst = i; }
    });
    if(worst >= 0) gs.inv.splice(worst, 1);
  }
  return item;
}

export function removeItem(uid){
  const gs = getState();
  const i = gs.inv.findIndex(it => it.uid === uid);
  if(i < 0) return null;
  const [it] = gs.inv.splice(i, 1);
  for(const slot of Object.keys(gs.equip)){
    if(gs.equip[slot] === uid) gs.equip[slot] = null;
  }
  return it;
}

export function equip(uid){
  const gs = getState();
  const it = gs.inv.find(i => i.uid === uid);
  if(!it) return false;
  const prev = gs.equip[it.slot];
  if(prev){
    const p = gs.inv.find(i => i.uid === prev);
    if(p) p.equipped = false;
  }
  gs.equip[it.slot] = uid;
  gs.inv.forEach(i => { if(i.slot === it.slot) i.equipped = (i.uid === uid); });
  return true;
}

export function unequip(slot){
  const gs = getState();
  const uid = gs.equip[slot];
  if(!uid) return false;
  const it = gs.inv.find(i => i.uid === uid);
  if(it) it.equipped = false;
  gs.equip[slot] = null;
  return true;
}

export function isEquipped(uid){
  const gs = getState();
  return Object.values(gs.equip).includes(uid);
}

export function sellItem(uid){
  const gs = getState();
  const it = gs.inv.find(i => i.uid === uid);
  if(!it || it.locked || it.equipped) return 0;
  const price = Math.max(1, Math.round(it.price * 0.4));
  removeItem(uid);
  gs.gold += price;
  return price;
}

export function sellAll(rarityIds){
  const gs = getState();
  let sum = 0, count = 0;
  gs.inv.slice().forEach(it => {
    if(it.locked || it.equipped) return;
    if(rarityIds && !rarityIds.includes(it.rarity)) return;
    sum += sellItem(it.uid);
    count++;
  });
  return { sum, count };
}

export function toggleLock(uid){
  const it = getState().inv.find(i => i.uid === uid);
  if(!it) return false;
  it.locked = !it.locked;
  return it.locked;
}

/** Фильтрация и сортировка для экрана инвентаря. */
export function query({ rarity = 'all', slot = 'all', sort = 'power', q = '' } = {}){
  const gs = getState();
  let list = gs.inv.slice();
  if(rarity !== 'all') list = list.filter(i => i.rarity === rarity);
  if(slot !== 'all')   list = list.filter(i => i.slot === slot);
  if(q){
    const needle = q.trim().toLowerCase();
    list = list.filter(i =>
      (i.name + ' ' + i.modName).toLowerCase().includes(needle));
  }
  const byPower = a => itemPower(a);
  switch(sort){
    case 'power':     list.sort((a,b) => byPower(b) - byPower(a)); break;
    case 'rarity':    list.sort((a,b) => (RAR_INDEX[b.rarity]||0) - (RAR_INDEX[a.rarity]||0) || byPower(b)-byPower(a)); break;
    case 'price':     list.sort((a,b) => b.price - a.price); break;
    case 'new':       list.sort((a,b) => b.obtainedAt - a.obtainedAt); break;
  }
  // надетое и заблокированное — всегда сверху
  list.sort((a,b) => (b.equipped?1:0) - (a.equipped?1:0) || (b.locked?1:0) - (a.locked?1:0));
  return list;
}

export function slotLabel(slot){ return SLOT_NAMES[slot] || slot; }
export { itemPower };
