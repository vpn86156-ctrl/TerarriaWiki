import {RUN_KEYS} from './runKeys';
export {useJournal} from './useJournal';
import {treasures} from './treasures';
import {bosses,guides} from './data';
import {progression} from './progression';
import {missions} from './expeditionData';

export const difficultyNames={classic:'Обычная',expert:'Эксперт',master:'Мастер'};
export function inferStage(done){if(done.includes('Moon_Lord'))return 'endgame';if(done.includes('Golem')||done.includes('Lunatic_Cultist'))return 'lunar';if(done.includes('Plantera'))return 'temple';if(['The_Twins','The_Destroyer','Skeletron_Prime'].every(x=>done.includes(x)))return 'plantera';if(['The_Twins','The_Destroyer','Skeletron_Prime'].some(x=>done.includes(x)))return 'mechanical';if(done.includes('Wall_of_Flesh'))return 'early-hardmode';if(done.includes('Skeletron'))return 'underworld';if(done.includes('Eater_of_Worlds'))return 'dungeon';if(done.includes('Eye_of_Cthulhu'))return 'evil';return 'arrival'}
export const stageTier=id=>{const n=progression.findIndex(p=>p.id===id);return n>=10?3:n>=7?2:n>=5?1:0};
const arr=(value,allowed)=>Array.isArray(value)&&value.every(x=>typeof x==='string'&&allowed.includes(x))&&new Set(value).size===value.length;
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const safeObject=v=>object(v)&&Object.keys(v).every(k=>!['__proto__','constructor','prototype'].includes(k));
const bounded=(n,min=0,max=1000000)=>Number.isInteger(n)&&n>=min&&n<=max;
const booleans=v=>safeObject(v)&&Object.values(v).every(x=>typeof x==='boolean');
const classes=['warrior','ranger','mage','summoner'];
const taskIds=progression.flatMap(s=>s.tasks.map((_,i)=>`${s.id}-${i}`));
const schema={
 'terraria-notes':v=>safeObject(v)&&Object.keys(v).length<=80&&Object.values(v).every(x=>typeof x==='string')&&Object.values(v).reduce((sum,x)=>sum+x.length,0)<=12000&&Object.entries(v).every(([k,text])=>(k==='general'||bosses.some(b=>k===`boss:${b[0]}`)||progression.some(p=>k===`stage:${p.id}`))&&typeof text==='string'&&text.length<=3000),
 'terraria-focus':v=>v===null||(safeObject(v)&&Object.keys(v).every(k=>['type','id'].includes(k))&&((v.type==='boss'&&bosses.some(b=>b[0]===v.id))||(v.type==='stage'&&progression.some(s=>s.id===v.id)))),
 'terraria-resume':v=>safeObject(v)&&Object.keys(v).every(k=>['page','hubTab','scroll'].includes(k))&&['home','journey','guides','classes','bosses','lore','treasures','tips','hub','tools','favorites','focus','runs'].includes(v.page)&&['next','ready','atlas','bestiary','farm','compare','npc','alchemy','calendar','building','hall','quests','secrets','settings'].includes(v.hubTab)&&bounded(v.scroll),
 'terraria-bosses':v=>arr(v,bosses.map(b=>b[0])),
 'terraria-bookmarks':v=>arr(v,guides.map(g=>g.id)),
 'terraria-read':v=>arr(v,guides.map(g=>g.id)),
 'terraria-treasures':v=>arr(v,treasures.map(t=>t.id)),
 'terraria-route-stage':v=>progression.some(p=>p.id===v),
 'terraria-route-class':v=>classes.includes(v),
 'terraria-route-tasks':v=>booleans(v)&&Object.keys(v).every(k=>taskIds.includes(k)),
 'terraria-armor-stage':v=>bounded(v,0,3),
 'terraria-motion':v=>typeof v==='boolean',
 'terraria-motion-mode':v=>['auto','full'].includes(v),
 'terraria-effects':v=>booleans(v)&&Object.keys(v).every(k=>['reveal','particles','ambient','float'].includes(k)),
 'terraria-quick':v=>typeof v==='boolean',
 'terraria-profile':v=>safeObject(v)&&Object.keys(v).every(k=>['classId','difficulty','health'].includes(k))&&classes.includes(v.classId)&&['classic','expert','master'].includes(v.difficulty)&&bounded(v.health,100,500),
 'terraria-farm-counts':v=>safeObject(v)&&Object.keys(v).every(k=>treasures.some(t=>t.id===k))&&Object.values(v).every(n=>bounded(n)),
 'terraria-readiness':v=>booleans(v)&&Object.keys(v).every(k=>/^(arena|weapon|armor|mobility|potions|food)$/.test(k)),
 'terraria-missions':v=>arr(v,missions.map(m=>m[0])),
 'terraria-pinned':v=>arr(v,missions.map(m=>m[0]))&&v.length<=3,
 'terraria-secrets':v=>arr(v,['slime','star','guide']),
 'terraria-hall-theme':v=>['forest','hell','lunar'].includes(v),
 'terraria-alchemy':v=>safeObject(v)&&Object.keys(v).every(k=>['Ironskin_Potion','Regeneration_Potion','Swiftness_Potion','Endurance_Potion','Wrath_Potion','Rage_Potion','Summoning_Potion','Magic_Power_Potion'].includes(k))&&Object.values(v).every(n=>bounded(n,0,99)),
 'terraria-planner':v=>safeObject(v)&&Object.keys(v).every(k=>['vendor','biome','neighbor','extra','housing','residents','danger'].includes(k))&&['Arms_Dealer','Nurse','Goblin_Tinkerer','Mechanic','Zoologist','Golfer','Dryad','Witch_Doctor','Wizard','Merchant'].includes(v.vendor)&&['forest','snow','desert','jungle','hallow','cavern','ocean'].includes(v.biome)&&['none','Arms_Dealer','Nurse','Goblin_Tinkerer','Mechanic','Zoologist','Golfer','Dryad','Witch_Doctor','Wizard','Merchant'].includes(v.neighbor)&&v.neighbor!==v.vendor&&bounded(v.extra,0,8)&&typeof v.housing==='boolean'&&bounded(v.residents,0,8)&&typeof v.danger==='boolean'
};
export function validRuns(v){return safeObject(v)&&Object.keys(v).every(k=>['activeId','entries'].includes(k))&&typeof v.activeId==='string'&&Array.isArray(v.entries)&&v.entries.length>0&&v.entries.length<=8&&new Set(v.entries.map(e=>e?.id)).size===v.entries.length&&v.entries.some(e=>e?.id===v.activeId)&&v.entries.every(e=>safeObject(e)&&Object.keys(e).every(k=>['id','name','evil','data'].includes(k))&&typeof e.id==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(e.id)&&typeof e.name==='string'&&e.name.trim().length>0&&e.name.length<=60&&['corruption','crimson','unknown'].includes(e.evil)&&safeObject(e.data)&&Object.entries(e.data).every(([k,x])=>RUN_KEYS.includes(k)&&schema[k](x)))}
schema['terraria-runs']=validRuns;
function decode(raw){try{return JSON.parse(raw)}catch{return raw}}
export function exportJournal(storage=localStorage){const data={};for(const [key,valid] of Object.entries(schema)){const raw=storage.getItem(key);if(raw===null)continue;const value=decode(raw);if(valid(value))data[key]=value}if(data['terraria-runs']){const runs=data['terraria-runs'];data['terraria-runs']={...runs,entries:runs.entries.map(e=>e.id===runs.activeId?{...e,data:Object.fromEntries(Object.entries(data).filter(([k])=>RUN_KEYS.includes(k)))}:e)}}return {application:'terraria-guide',schemaVersion:1,createdAt:new Date().toISOString(),data}}
export function validateJournal(text){if(typeof text!=='string'||new Blob([text]).size>512*1024)throw new Error('Файл слишком большой: максимум 512 КБ.');let file;try{file=JSON.parse(text)}catch{throw new Error('Это не читаемый JSON-файл.')}if(!safeObject(file)||file.application!=='terraria-guide'||file.schemaVersion!==1||!safeObject(file.data))throw new Error('Нужен экспорт Terraria Guide версии 1.');const entries=Object.entries(file.data);if(!entries.length)throw new Error('В файле нет данных прогресса.');for(const [key,value] of entries)if(!Object.hasOwn(schema,key)||!schema[key](value))throw new Error(`Недопустимые данные: ${key}`);return file}
export function applyJournal(file,mode='merge',storage=localStorage){validateJournal(JSON.stringify(file));if(!['merge','replace'].includes(mode))throw new Error('Неизвестный режим импорта.');if(mode==='merge'&&file.data['terraria-notes']){const prior=decode(storage.getItem('terraria-notes'));if(schema['terraria-notes'](prior)&&!schema['terraria-notes']({...prior,...file.data['terraria-notes']}))throw new Error('Объединённые заметки превышают лимит прохождения. Сократи их или выбери замену после резервного копирования. Данные не изменены.')}const old=new Map();if(mode==='merge'&&file.data['terraria-runs']){let current;try{current=JSON.parse(storage.getItem('terraria-runs'))}catch{}if(validRuns(current)&&new Set([...current.entries,...file.data['terraria-runs'].entries].map(e=>e.id)).size>8)throw new Error('Вместе получится больше 8 прохождений. Импортируй с заменой после резервного копирования.')}try{if(mode==='replace'&&file.data['terraria-runs'])for(const key of RUN_KEYS)if(!Object.hasOwn(file.data,key)){old.set(key,storage.getItem(key));storage.removeItem(key)}for(const [key,value] of Object.entries(file.data)){const raw=storage.getItem(key);old.set(key,raw);const previous=raw===null?null:decode(raw);let next=value;if(mode==='merge'&&schema[key](previous)){if(Array.isArray(value))next=[...new Set([...previous,...value])];else if(object(value)){next={...previous,...value};if(['terraria-route-tasks','terraria-readiness'].includes(key))for(const k of Object.keys(next))next[k]=!!(previous[k]||value[k]);if(key==='terraria-farm-counts')for(const k of Object.keys(next))next[k]=Math.max(previous[k]||0,value[k]||0)}if(key==='terraria-pinned')next=next.slice(0,3);if(key==='terraria-runs')next={activeId:previous.activeId,entries:[...previous.entries,...value.entries.filter(e=>!previous.entries.some(p=>p.id===e.id))]}}storage.setItem(key,key==='terraria-route-class'?next:JSON.stringify(next))}old.set('terraria-data-revision',storage.getItem('terraria-data-revision'));storage.setItem('terraria-data-revision',`${Date.now()}-${Math.random()}`)}catch{let failed=false;for(const key of old.keys()){try{storage.removeItem(key)}catch{failed=true}}for(const [key,raw] of old){if(raw!==null)try{storage.setItem(key,raw)}catch{failed=true}}throw new Error(failed?'Импорт прерван. Не удалось полностью восстановить запись: используй резервную копию и проверь доступ браузера к хранилищу.':'Не удалось сохранить данные. Импорт отменён, прежние значения восстановлены; проверь свободное место браузера.')}}
export function downloadJournal(){const url=URL.createObjectURL(new Blob([JSON.stringify(exportJournal(),null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`terraria-guide-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
