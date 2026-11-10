/* Достижения: проверяются после игровых событий. */
import { getState, stats } from '../core/state.js';

export const ACHIEVEMENTS = [
  { id:'first_blood', icon:'⚔', name:'Первая кровь',   desc:'Нанести первый удар',                    test:s => s.totalDamage > 0 },
  { id:'hunter',      icon:'☠', name:'Охотник',        desc:'Победить 10 боссов',                     test:s => s.bossKills >= 10 },
  { id:'slayer',      icon:'☠', name:'Убийца',         desc:'Победить 100 боссов',                    test:s => s.bossKills >= 100 },
  { id:'clicker',     icon:'✦', name:'Кликер',         desc:'Сделать 500 атак вручную',               test:s => s.clicks >= 500 },
  { id:'crit10k',     icon:'✧', name:'Точный удар',    desc:'Нанести 10 000 урона одним ударом',      test:s => s.maxHit >= 10000 },
  { id:'rich',        icon:'◈', name:'Золотая лихорадка', desc:'Накопить 100 000 золота',             test:s => s.gold >= 100000 },
  { id:'epic_find',   icon:'◉', name:'Эпическая находка', desc:'Получить предмет эпической редкости',  test:s => (s.seen.epic || s.seen.mythic || s.seen.legendary || s.seen.secret) },
  { id:'legend',      icon:'★', name:'Легенда',        desc:'Получить легендарный предмет',            test:s => !!(s.seen.legendary || s.seen.secret) },
  { id:'tower10',     icon:'▲', name:'Восхождение',    desc:'Дойти до 10 этажа башни',                test:s => s.tower.best >= 10 },
  { id:'tower50',     icon:'▲', name:'Высотник',       desc:'Дойти до 50 этажа башни',                test:s => s.tower.best >= 50 },
  { id:'dungeon1',    icon:'⌂', name:'Первый спуск',   desc:'Пройти любое подземелье',                test:s => Object.keys(s.dungeons).length > 0 },
  { id:'level25',     icon:'✦', name:'Опытный',        desc:'Достичь 25 уровня',                      test:s => s.level >= 25 },
  { id:'pet',         icon:'☾', name:'Не один',        desc:'Завести питомца',                        test:s => s.pets.length > 0 }
];

export function check(){
  const gs = getState();
  const got = [];
  for(const a of ACHIEVEMENTS){
    if(gs.ach[a.id]) continue;
    let ok = false;
    try{ ok = !!a.test(gs); }catch(e){ ok = false; }
    if(ok){ gs.ach[a.id] = Date.now(); got.push(a); }
  }
  return got;
}
