/* Сохранение прогресса.
   Локальный слой всегда доступен; облачный подключается, если задан конфиг Supabase.
   Никаких сетевых вызовов без явного конфига — игра обязана работать офлайн. */
import { cloud } from './supabase.js';

const KEY = 'lootora.save.v1';
let queue = null;

export const local = {
  read(){
    try{
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    }catch(e){ return null; }
  },
  write(data){
    try{ localStorage.setItem(KEY, JSON.stringify(data)); return true; }
    catch(e){ return false; }
  },
  clear(){ try{ localStorage.removeItem(KEY); }catch(e){} }
};

/** Отложенная запись: частое нажатие атаки не должно дёргать диск на каждый клик. */
export function saveSoon(getState, delay = 2200){
  if(queue) clearTimeout(queue);
  queue = setTimeout(() => { queue = null; saveNow(getState); }, delay);
}

export async function saveNow(getState){
  const data = getState();
  local.write(data);
  if(cloud.ready()){
    try{ await cloud.saveProgress(data); }
    catch(e){ /* офлайн — локальная копия уже записана */ }
  }
  return true;
}

export async function loadProgress(){
  if(cloud.ready()){
    try{
      const remote = await cloud.loadProgress();
      if(remote && remote.v) return { data: remote, source: 'cloud' };
    }catch(e){ /* падаем на локальную копию */ }
  }
  return { data: local.read(), source: 'local' };
}
