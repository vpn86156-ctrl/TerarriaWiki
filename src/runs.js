import {exportJournal,validRuns} from './journal';
import {RUN_KEYS} from './runKeys';

export function readRuns(storage=localStorage){
 const data=exportJournal(storage).data;
 if(validRuns(data['terraria-runs']))return data['terraria-runs'];
 const raw=storage.getItem('terraria-runs');
 if(raw!==null)throw new Error('Не удалось прочитать список прохождений. Сначала сохрани резервную копию данных браузера; существующие записи не изменены.');
 return {activeId:'original',entries:[{id:'original',name:'Моё первое прохождение',evil:'unknown',data:Object.fromEntries(Object.entries(data).filter(([key])=>RUN_KEYS.includes(key)))}]};
}
// Every touched key is backed up before the first mutation; quota failure rolls back.
export function changeRun({id,name,classId='warrior',difficulty='classic',evil='unknown'},storage=localStorage){
 const runs=readRuns(storage);let target=runs.entries.find(e=>e.id===id);
 if(!target){
  if(runs.entries.length>=8)throw new Error('Можно хранить до 8 прохождений. Сохрани резервную копию перед дальнейшими изменениями.');
  if(typeof name!=='string'||!name.trim()||name.trim().length>60||!['warrior','ranger','mage','summoner'].includes(classId)||!['classic','expert','master'].includes(difficulty)||!['corruption','crimson','unknown'].includes(evil))throw new Error('Проверь название и параметры прохождения.');
  target={id:`run-${crypto.randomUUID()}`,name:name.trim(),evil,data:{'terraria-profile':{classId,difficulty,health:100},'terraria-route-class':classId,'terraria-route-stage':'arrival'}};
  runs.entries.push(target);
 }
 const next={...runs,activeId:target.id};if(!validRuns(next))throw new Error('Некорректное прохождение. Данные не изменены.');
 const keys=[...RUN_KEYS,'terraria-runs'];const before=new Map(keys.map(k=>[k,storage.getItem(k)]));
 try{
  storage.setItem('terraria-run-switch','switching');
  for(const key of RUN_KEYS){if(Object.hasOwn(target.data,key))storage.setItem(key,key==='terraria-route-class'?target.data[key]:JSON.stringify(target.data[key]));else storage.removeItem(key)}
  storage.setItem('terraria-runs',JSON.stringify(next));
 }catch{
  let failed=false;for(const key of keys)try{storage.removeItem(key)}catch{failed=true}
  for(const [key,value] of before)if(value!==null)try{storage.setItem(key,value)}catch{failed=true}
  throw new Error(failed?'Не удалось полностью восстановить данные. Используй резервную копию и проверь место в браузере.':'Переключение отменено: прежние данные восстановлены. Проверь свободное место в браузере.');
 }finally{storage.removeItem('terraria-run-switch')}
 return target.id;
}
export function renameRun(id,name,evil,storage=localStorage){
 if(!name.trim()||name.trim().length>60||!['corruption','crimson','unknown'].includes(evil))throw new Error('Название должно содержать от 1 до 60 символов.');
 const runs=readRuns(storage),entry=runs.entries.find(e=>e.id===id);if(!entry)throw new Error('Прохождение не найдено.');entry.name=name.trim();entry.evil=evil;storage.setItem('terraria-runs',JSON.stringify(runs));
}
