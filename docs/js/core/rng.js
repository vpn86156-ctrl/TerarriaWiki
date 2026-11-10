/* Случайные величины и выборки — единая точка для игровых формул. */
export const rnd  = (a, b) => a + Math.random() * (b - a);
export const rndi = (a, b) => Math.floor(rnd(a, b + 1));
export const chance = p => Math.random() < p;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function pick(arr){ return arr[Math.floor(Math.random() * arr.length)]; }

/** Взвешенный выбор: items = [{w, ...}] */
export function weighted(items, weightOf = x => x.w){
  let total = 0;
  for(const it of items) total += weightOf(it);
  let r = Math.random() * total;
  for(const it of items){
    r -= weightOf(it);
    if(r <= 0) return it;
  }
  return items[items.length - 1];
}

/** Независимые копии для таблиц добычи. */
export function shuffle(arr){
  const a = arr.slice();
  for(let i = a.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
