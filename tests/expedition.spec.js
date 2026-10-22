import {test,expect} from '@playwright/test';
import {existsSync} from 'node:fs';
import {biomes,enemies,npcData,plants,potions,housePlans,comparisons,missions} from '../src/expeditionData.js';
import {makeBlueprint,blueprintMaterials} from '../src/blueprints.js';
const tabs=['Следующий шаг','Перед боссом','Атлас биомов','Бестиарий','Помощник фарма','Сравнить броню','Поселение NPC','Алхимический сад','Календарь мира','Галерея построек','Зал трофеев','Приключения','Записки Гида','Настройки и перенос'];
async function openHub(page,tab=tabs[0]){await page.goto('/');if(await page.locator('.mobile-menu').isVisible())await page.getByRole('button',{name:'Открыть меню'}).click();await page.locator('.sidebar nav button').filter({hasText:'Штаб путешественника'}).click();await page.locator('.expedition-nav').waitFor();await tool(page,tab)}
async function tool(page,name){await page.locator('.expedition-nav button').getByText(name,{exact:true}).click();await expect(page.locator('.tool-heading')).toBeVisible()}
async function seed(page,values){await page.addInitScript(values=>{for(const [key,value] of Object.entries(values)){if(localStorage.getItem(key)===null)localStorage.setItem(key,JSON.stringify(value))}},values)}
const backup=data=>JSON.stringify({application:'terraria-guide',schemaVersion:1,data});
async function upload(page,text){await page.getByLabel('Импорт прогресса').setInputFiles({name:'progress.json',mimeType:'application/json',buffer:Buffer.from(text)})}

test('all new catalog sprites exist and blueprints have exactly counted, valid geometry',()=>{
 for(const item of [...biomes,...enemies,...npcData,...potions,...comparisons])expect(existsSync(`public/assets/${item.sprite||item.id}.webp`)).toBeTruthy();
 for(const plant of plants)expect(existsSync(`public/assets/${plant[2]}.webp`)).toBeTruthy();
 for(const plan of housePlans){const grid=makeBlueprint(plan),m=blueprintMaterials(plan);expect(grid).toHaveLength(plan.height);expect(grid.every(r=>r.length===plan.width)).toBeTruthy();expect(grid.flat().filter(c=>c==='D')).toHaveLength(3);expect(m[0][1]).toBe(2*plan.width+2*(plan.height-2)-3);expect(m[1][1]).toBe((plan.width-2)*(plan.height-2));expect(grid.at(-1).every(c=>c==='B')).toBeTruthy();expect(m.every(x=>Number.isInteger(x[1])&&x[1]>0)).toBeTruthy()}
 expect(new Set(missions.map(m=>m[0])).size).toBe(missions.length);
});

test('all fourteen tools render without errors, broken images or desktop overflow',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.emulateMedia({reducedMotion:'reduce'});await openHub(page);
 for(const tab of tabs){await tool(page,tab);await page.waitForFunction(()=>[...document.images].every(i=>i.complete));expect(await page.locator('img').evaluateAll(a=>a.every(i=>i.naturalWidth>0))).toBeTruthy();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy()}
 expect(errors).toEqual([]);
});

test('all tools remain reachable on 320px and 390px phones',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 for(const width of [320,390]){await page.setViewportSize({width,height:844});await openHub(page);for(const tab of tabs){await tool(page,tab);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy()}}
});

test('compass infers intermediate progression and uses saved class and health profile',async({page})=>{
 await seed(page,{'terraria-bosses':['Wall_of_Flesh','The_Destroyer']});await openHub(page);
 await page.getByRole('button',{name:'Определить по победам'}).click();await expect(page.getByLabel('На каком я этапе')).toHaveValue('mechanical');await expect(page.locator('.goal-card')).toHaveCount(3);
 await page.getByLabel('Мой класс',{exact:true}).selectOption('mage');await page.getByLabel('Сложность мира').selectOption('expert');await page.getByLabel('Максимум здоровья').fill('400');await expect(page.locator('.exp-pair')).toContainText('Святая броня');await page.reload();await openHub(page);await expect(page.getByLabel('Мой класс',{exact:true})).toHaveValue('mage');await expect(page.getByLabel('Максимум здоровья')).toHaveValue('400');await expect(page.getByLabel('На каком я этапе')).toHaveValue('mechanical');
});

test('readiness explains missing health and stores manual preparation, never a win probability',async({page})=>{
 await openHub(page,'Перед боссом');await page.getByLabel('К кому готовимся').selectOption('Moon_Lord');await expect(page.locator('.exp-list').first()).toContainText('500 HP');
 for(const box of await page.locator('.exp-checks input[type=checkbox]').all())await box.check();await expect(page.locator('.readiness-meter')).toContainText('6 / 6');await page.getByLabel('Максимум здоровья').fill('500');await expect(page.locator('.readiness-meter')).toContainText('Основная подготовка отмечена');await page.reload();await openHub(page,'Перед боссом');await expect(page.locator('.readiness-meter')).toContainText('6 / 6');
});

test('farm counters persist per target, verified odds follow difficulty and unknown odds stay unknown',async({page})=>{
 await openHub(page,'Помощник фарма');await expect(page.locator('.expedition-body')).toContainText('0,2%');await page.getByLabel('Сложность',{exact:true}).selectOption('expert');await expect(page.locator('.expedition-body')).toContainText('0,25%');await page.getByRole('button',{name:'+10',exact:true}).click();await expect(page.locator('.farm-counter strong')).toHaveText('10');await page.getByLabel('Цель охоты').selectOption('Uzi');await expect(page.locator('.farm-counter strong')).toHaveText('0');await expect(page.locator('.expedition-body')).toContainText('не заявлен численный шанс');await page.getByRole('button',{name:'Добавить одну попытку'}).click();await page.getByLabel('Цель охоты').selectOption('Rod_of_Discord');await expect(page.locator('.farm-counter strong')).toHaveText('10');await page.reload();await openHub(page,'Помощник фарма');await expect(page.locator('.farm-counter strong')).toHaveText('10');await expect(page.locator('.expedition-body')).toContainText('2,47%');await page.evaluate(()=>localStorage.setItem('terraria-farm-counts',JSON.stringify({Rod_of_Discord:1000000})));await openHub(page,'Помощник фарма');await expect(page.locator('.expedition-body')).toContainText('больше 99,99%, но не гарантия');
});

test('atlas links precise biome and enemy; enemy links the correct farm target even without numeric odds',async({page})=>{
 await openHub(page,'Атлас биомов');await page.locator('.world-map button').filter({hasText:'Пещеры',exact:true}).click();await page.locator('.enemy-chips button').filter({hasText:'Нимфа'}).click();await expect(page.locator('.enemy-card')).toHaveCount(1);await expect(page.locator('.enemy-card')).toContainText('Нимфа');await page.getByRole('button',{name:'План фарма и счётчик',exact:true}).click();await expect(page.getByLabel('Цель охоты')).toHaveValue('Metal_Detector');await expect(page.locator('.farm-hero')).toContainText('Нимфа');await expect(page.locator('.farm-hero')).toContainText('Металлоискатель');
});

test('hell changes ambience; every biome has a dossier and atlas exit restores scene',async({page})=>{
 await openHub(page,'Атлас биомов');for(const b of biomes){await page.locator('.world-map button').getByText(b.name,{exact:true}).click();await expect(page.locator('.biome-title h3')).toHaveText(b.name)}await expect(page.locator('html')).toHaveAttribute('data-scene','hell');await tool(page,'Алхимический сад');await expect(page.locator('html')).toHaveAttribute('data-scene','forest');
});

test('all eight comparisons use the exact original armor and distinguish Titanium from old dodge',async({page})=>{
 await openHub(page,'Сравнить броню');for(const c of ['warrior','ranger','mage','summoner']){await page.getByLabel('Класс сравнения').selectOption(c);const sets=comparisons.filter(s=>s.classId===c);for(let i=0;i<2;i++){await expect(page.locator('.gear-compare>.sprite').nth(i)).toHaveAttribute('src',`/assets/${sets[i].sprite}.webp`);await expect(page.locator('.gear-compare').nth(i)).toContainText(String(sets[i].def))}}await page.getByLabel('Класс сравнения').selectOption('ranger');await expect(page.locator('.gear-compare').nth(1)).toContainText('Титановый барьер');
});

test('NPC planner warns on unknown relations, crowding and no-shop, separate from network conditions',async({page})=>{
 await openHub(page,'Поселение NPC');await expect(page.locator('.village-pylon')).toHaveClass(/lit/);await page.getByLabel('Ближайший сосед').selectOption('Wizard');await expect(page.locator('.expedition-body')).toContainText('отношение не описано');await expect(page.locator('.village-pylon')).not.toHaveClass(/lit/);await page.getByLabel('Чей магазин').selectOption('Nurse');await expect(page.locator('.expedition-body')).toContainText('нет магазина пилонов');await page.getByLabel('Идёт босс / мешающее событие').check();await expect(page.locator('.expedition-body')).toContainText('Есть незакрытые условия');await page.getByLabel('Других жителей рядом').fill('3');await expect(page.locator('.expedition-body')).toContainText('скученность');
});

test('alchemy aggregates quantities and plant conditions; shopping plan survives reload',async({page})=>{
 await openHub(page,'Алхимический сад');await page.getByLabel('Количество: Железная кожа').fill('2');await page.getByLabel('Количество: Регенерация').fill('3');await page.getByLabel('Количество: Скорость').fill('0');await expect(page.locator('.ingredient-basket')).toContainText('Бутылка воды × 5');await expect(page.locator('.ingredient-basket')).toContainText('Дневноцвет × 5');await expect(page.locator('.ingredient-basket')).toContainText('Гриб × 3');await expect(page.locator('.herb-card')).toHaveCount(7);await expect(page.locator('.herb-garden')).toContainText('дождя');await page.reload();await openHub(page,'Алхимический сад');await expect(page.getByLabel('Количество: Регенерация')).toHaveValue('3');
});

test('calendar windows respond to manual time, phase and stage, without guaranteed natural events',async({page})=>{
 await openHub(page,'Календарь мира');await page.getByLabel('Игровое время').fill('22:00');await page.getByLabel('Прогресс этого мира').selectOption('1');await expect(page.locator('.event-card').filter({hasText:'Оборотни'})).toHaveCount(1);await page.getByLabel('Фаза Луны').selectOption('4');await expect(page.locator('.event-card').filter({hasText:'Оборотни'})).toHaveCount(0);await page.getByLabel('Игровое время').fill('10:00');await expect(page.locator('.event-card').filter({hasText:'Солнечное затмение'})).toHaveCount(0);await page.getByLabel('Прогресс этого мира').selectOption('2');await expect(page.locator('.event-card').filter({hasText:'Солнечное затмение'})).toContainText('не гарантировано');await page.getByLabel('Идёт дождь').check();await expect(page.locator('.bloom-strip>div').filter({hasText:'Воднолист'})).toHaveClass(/blooming/);
});

test('building gallery renders each full grid, materials and meaningful housing checks',async({page})=>{
 await openHub(page,'Галерея построек');for(const p of housePlans){await page.getByRole('button',{name:p.name,exact:true}).click();await expect(page.locator('.blueprint .cell')).toHaveCount(p.width*p.height);await expect(page.locator('.blueprint-label')).toContainText(`${p.width} × ${p.height}`)}await expect(page.locator('.expedition-body')).toContainText('хардмод');await page.getByLabel('Я проверил жильё в меню NPC').check();await expect(page.locator('.expedition-body')).toContainText('Дом проверен!');
});

test('trophy hall derives its real wall and shelf from existing boss and rare marks',async({page})=>{
 await seed(page,{'terraria-bosses':['Eye_of_Cthulhu','The_Twins','The_Destroyer'],'terraria-treasures':['Rod_of_Discord']});await openHub(page,'Зал трофеев');await expect(page.locator('button.trophy-frame')).toHaveCount(3);await expect(page.locator('.hall-shelf button')).toHaveCount(1);await expect(page.locator('.trophy-room')).toContainText('эмблема босса');await page.getByRole('button',{name:'Лунная обсерватория'}).click();await expect(page.locator('.trophy-room')).toHaveClass(/hall-lunar/);await page.waitForFunction(()=>[...document.images].every(i=>i.complete));expect(await page.locator('.trophy-room img').evaluateAll(a=>a.every(i=>i.naturalWidth))).toBeTruthy();
});

test('adventures are stage-gated and generated cards, completion and journal are persistent',async({page})=>{
 await openHub(page,'Приключения');await page.getByLabel('Чем хочется заняться').selectOption('Исследование');await page.getByRole('button',{name:'Найти приключение',exact:true}).click();await expect(page.locator('.quest-card')).toHaveCount(2);await expect(page.locator('.quest-board')).not.toContainText('темницы');const title=await page.locator('.quest-card h3').first().textContent();await page.getByRole('button',{name:'Приключение завершено',exact:true}).first().click();await expect(page.locator('.quest-history')).toContainText(title);await page.reload();await openHub(page,'Приключения');await expect(page.locator('.quest-history')).toContainText(title);await expect(page.locator('.quest-card.complete')).toHaveCount(1);
});

test('three accessible optional secrets unlock persistent Guide records',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Поймать маленького розового слизня'}).click();await page.getByRole('button',{name:'Поймать упавшую звезду'}).click();await openHub(page,'Записки Гида');await page.getByRole('button',{name:'Поговорить с Гидом',exact:true}).click();await expect(page.locator('.secret-record.discovered')).toHaveCount(3);await expect(page.locator('.secret-counter')).toContainText('3 / 3');await page.reload();await openHub(page,'Записки Гида');await expect(page.locator('.secret-record.discovered')).toHaveCount(3);
});

test('independent effects, full override and quick mode are effective and persistent',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await openHub(page,'Настройки и перенос');await page.getByLabel('Уважать настройки устройства').selectOption('full');expect(await page.locator('.expedition-mark i').evaluate(e=>getComputedStyle(e).animationName)).toBe('exp-orbit');await page.getByLabel('Постоянное движение атмосферы и карт').uncheck();expect(await page.locator('.expedition-mark i').evaluate(e=>getComputedStyle(e).animationName)).toBe('none');await page.getByLabel('Парение предметов и спрайтов').uncheck();await page.getByLabel('Искры, частицы и победные эффекты').uncheck();await page.getByLabel('Появление карточек при прокрутке').uncheck();await tool(page,'Алхимический сад');expect(await page.locator('.potion-row>.sprite').first().evaluate(e=>getComputedStyle(e).animationName)).toBe('none');await expect(page.locator('.scroll-wait')).toHaveCount(0);await expect(page.locator('.world-motes')).toBeHidden();await page.locator('.quick-toggle').click();await expect(page.locator('.quick-toolbar')).toBeVisible();await expect(page.locator('html')).toHaveAttribute('data-quick','on');await page.reload();await expect(page.locator('html')).toHaveAttribute('data-quick','on');await expect(page.locator('html')).toHaveAttribute('data-float','off');
});

test('backup download and import preview require explicit consent; merge preserves existing marks',async({page})=>{
 await seed(page,{'terraria-bosses':['Eye_of_Cthulhu']});await openHub(page,'Настройки и перенос');const download=page.waitForEvent('download');await page.getByRole('button',{name:'Скачать мой прогресс'}).click();expect((await download).suggestedFilename()).toMatch(/terraria-guide.*json/);await upload(page,backup({'terraria-bosses':['Skeletron'],'terraria-farm-counts':{Rod_of_Discord:10}}));await expect(page.locator('.import-preview')).toContainText('2 разделов');expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('terraria-bosses')))).toEqual(['Eye_of_Cthulhu']);await expect(page.getByRole('button',{name:'Применить и перезагрузить'})).toBeDisabled();await page.getByLabel('Я проверил изменения и согласен перенести эти данные').check();await page.getByRole('button',{name:'Применить и перезагрузить'}).click();await page.waitForLoadState();expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('terraria-bosses')))).toEqual(['Eye_of_Cthulhu','Skeletron']);
});

test('invalid backups, unknown keys, wrong types, duplicates and prototypes are rejected without writes',async({page})=>{
 await openHub(page,'Настройки и перенос');for(const text of ['not json',backup({'unrelated-key':true}),backup({'terraria-bosses':'Skeletron'}),backup({'terraria-bosses':['unknown']}),backup({'terraria-bosses':['Skeletron','Skeletron']}),backup({'terraria-farm-counts':{Rod_of_Discord:-1}}),'{"application":"terraria-guide","schemaVersion":1,"data":{"__proto__":{"polluted":true}}}']){await upload(page,text);await expect(page.getByRole('alert')).toBeVisible();await expect(page.locator('.import-preview')).toHaveCount(0)}expect(await page.evaluate(()=>localStorage.getItem('unrelated-key'))).toBeNull();
});

test('transfer utilities round-trip raw class, replace only supplied keys and roll back on quota failure',async({page})=>{
 await page.goto('/');const result=await page.evaluate(async()=>{const {exportJournal,validateJournal,applyJournal}=await import('/src/journal.js');const map=new Map([['terraria-bosses','["Eye_of_Cthulhu"]'],['terraria-route-class','mage'],['unrelated','safe']]);const storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};const file=validateJournal(JSON.stringify(exportJournal(storage)));applyJournal({application:'terraria-guide',schemaVersion:1,data:{'terraria-bosses':['Skeletron']}},'replace',storage);const replaced=JSON.parse(map.get('terraria-bosses'));let threw=false,failed=false;const before=JSON.stringify([...map].sort(([a],[b])=>a.localeCompare(b)));const broken={...storage,setItem(k,v){if(k==='terraria-route-class'&&!failed){failed=true;throw new Error('quota')}map.set(k,v)}};try{applyJournal({application:'terraria-guide',schemaVersion:1,data:{'terraria-bosses':['Moon_Lord'],'terraria-route-class':'warrior'}},'replace',broken)}catch{threw=true}return {raw:file.data['terraria-route-class'],replaced,unrelated:map.get('unrelated'),threw,restored:before===JSON.stringify([...map].sort(([a],[b])=>a.localeCompare(b)))}});expect(result).toEqual({raw:'mage',replaced:['Skeletron'],unrelated:'safe',threw:true,restored:true});
});
