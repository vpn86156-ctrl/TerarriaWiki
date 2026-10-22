import {guides,classes,bosses} from './data';
import {treasures} from './treasures';
import {progression} from './progression';
import {bossDetails} from './bossDetails';
import {biomes,enemies,npcData,plants,potions,housePlans,missions} from './expeditionData';
import {quickAnswers,expertNotes,alternatives,spawnNotes} from './fieldNotes';
const text=v=>typeof v==='string'?v:Array.isArray(v)?v.map(text).join(' '):v&&typeof v==='object'?Object.values(v).map(text).join(' '):'';
export const normalize=s=>s.toLocaleLowerCase('ru').replaceAll('ё','е').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const stops=new Set(['а','и','или','в','во','на','с','со','для','по','как','где','кто','что','почему','ли','это','нужно','мне','у','из','не']);
function words(q){return normalize(q).split(' ').filter(w=>w.length>1&&!stops.has(w)).map(w=>w.length>5?w.replace(/(ами|ями|ого|ему|ыми|ими|ов|ев|ей|ах|ях|ам|ям|ый|ий|ая|ое|ые|ом|ем|а|я|ы|и|у|ю|е)$/u,''):w)}
const record=(type,id,title,body,target,answer='')=>({key:`${type}:${id}`,title,category:type,body:text(body),target,answer});
export const searchRecords=[
 ...quickAnswers.map(q=>record('Короткий ответ',q.id,q.title,q.aliases,q.target,q.answer)),
 ...guides.map(g=>record('Руководство',g.id,g.title,g,{type:'guide',id:g.id},g.intro)),
 ...treasures.map(t=>record('Находка',t.id,t.name,[t,alternatives[t.id]],{type:'treasure',id:t.id},t.source)),
 ...bosses.map(b=>record('Босс',b[0],b[1],[b,bossDetails[b[0]],expertNotes[b[0]]],{type:'boss',id:b[0]},bossDetails[b[0]]?.arena)),
 ...classes.map(c=>record('Класс',c.id,c.name,c,{type:'class',id:c.id},c.text)),
 ...progression.map(s=>record('Этап',s.id,s.name,s,{type:'route',id:s.id},s.goal)),
 ...biomes.map(b=>record('Биом',b.id,b.name,b,{type:'hub',id:'atlas',biome:b.id},b.danger)),
 ...enemies.map(e=>record('Враг',e.id,e.name,[e,spawnNotes[e.id]],{type:'hub',id:'bestiary',biome:e.biome,enemy:e.id},spawnNotes[e.id]||e.where)),
 ...npcData.map(n=>record('Житель',n.id,n.name,[n,'NPC счастье пилон поселение жилье'],{type:'hub',id:'npc',vendor:n.id},'Открой планировщик: биом, соседи, магазин и работа пилонов.')),
 ...plants.map(p=>record('Растение',p[0],p[1],p,{type:'hub',id:'alchemy'},p[3])),
 ...potions.map(p=>record('Зелье',p.id,p.name,p,{type:'hub',id:'alchemy'},p.effect)),
 ...housePlans.map(p=>record('Чертёж',p.id,p.name,p,{type:'hub',id:'building',plan:p.id},p.description)),
 ...missions.map(m=>record('Приключение',m[0],m[3],m,{type:'hub',id:'quests'},m[4])),
 ...[['next','Что делать дальше'],['ready','Готовность к боссу'],['atlas','Атлас биомов'],['bestiary','Бестиарий врагов'],['farm','Фарм редких находок'],['compare','Сравнение брони'],['npc','NPC, жильё и пилоны'],['alchemy','Алхимия и зелья'],['calendar','Календарь событий'],['building','Чертежи построек'],['hall','Зал трофеев'],['quests','Генератор приключений'],['secrets','Записки Гида'],['settings','Настройки и перенос прогресса']].map(([id,title])=>record('Инструмент штаба',id,title,title,{type:'hub',id},'Открыть инструмент'))
].map(r=>({...r,normalized:normalize(`${r.title} ${r.body} ${r.answer}`),heading:normalize(r.title)}));
export function searchContent(query,limit=12){const q=normalize(query),tokens=words(query);if(!q||!tokens.length)return [];return searchRecords.map(r=>{const hits=tokens.filter(w=>r.normalized.includes(w)),coverage=hits.length/tokens.length;if(coverage<.65)return null;const titleHits=tokens.filter(w=>r.heading.includes(w)).length;return {...r,score:coverage*30+titleHits*12+(r.heading===q?150:0)+(r.heading.includes(q)?75:0)+(r.category==='Короткий ответ'&&coverage===1?100:0)}}).filter(Boolean).sort((a,b)=>b.score-a.score||a.title.localeCompare(b.title,'ru')).slice(0,limit)}
