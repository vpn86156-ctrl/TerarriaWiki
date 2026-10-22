import {test,expect} from '@playwright/test';
import {treasures,blueprints} from '../src/treasures.js';
import {existsSync} from 'node:fs';

async function openArchive(page){await page.goto('/');await page.locator('nav button').filter({hasText:'Редкие предметы'}).click()}

test('all catalog and blueprint references have real assets',()=>{
 expect(new Set(treasures.map(t=>t.id)).size).toBe(treasures.length);
 for(const item of treasures){expect(existsSync(`public/assets/${item.id}.webp`),item.id).toBeTruthy();expect(item.source.length).toBeGreaterThan(30);expect(item.note.length).toBeGreaterThan(30)}
 for(const b of blueprints){expect(existsSync(`public/assets/${b.sprite}.webp`)).toBeTruthy();for(const id of b.groups.flatMap(g=>g[1]))expect(treasures.some(t=>t.id===id),id).toBeTruthy()}
});

test('catalog filtering, readable notes and persistent collection',async({page})=>{
 await openArchive(page);await expect(page.locator('.treasure-card')).toHaveCount(treasures.length);
 await page.getByRole('textbox',{name:'Найти предмет'}).fill('Медный');
 await expect(page.locator('.treasure-card')).toHaveCount(1);
 await page.getByRole('button',{name:'Подробнее: Медный короткий меч'}).click();
 await expect(page.getByRole('dialog')).toContainText('Не редкий и не уникальный');
 await page.getByRole('button',{name:'Добавить в найденное'}).click();await page.keyboard.press('Escape');
 await page.getByRole('textbox',{name:'Найти предмет'}).fill('');await page.getByLabel('Статус находки').selectOption('found');
 await expect(page.locator('.treasure-card')).toHaveCount(1);await expect(page.locator('.collection-banner')).toContainText(`1 / ${treasures.length}`);
 await page.reload();await page.locator('nav button').filter({hasText:'Редкие предметы'}).click();await page.getByLabel('Статус находки').selectOption('found');
 await expect(page.locator('.treasure-card')).toHaveCount(1);
 await page.getByLabel('Статус находки').selectOption('all');await page.getByLabel('Этап предметов').selectOption('3');
 await expect(page.locator('.treasure-card')).toHaveCount(2);
 await page.getByLabel('Этап предметов').selectOption('all');await page.getByLabel('Только редкие').check();
 await expect(page.locator('.treasure-card.important')).toHaveCount(0);
});

test('forge tracks components without claiming a real inventory scan',async({page})=>{
 await openArchive(page);await page.getByRole('button',{name:'Мастерская легенд'}).click();
 await expect(page.locator('.forge-ingredient')).toHaveCount(10);
 await page.getByRole('button',{name:'Найдено: Медный короткий меч',exact:true}).click();
 await expect(page.locator('.forge-counter')).toContainText('1 / 10');
 await page.locator('.forge-picker button').filter({hasText:'Сотовый телефон'}).click();
 await expect(page.locator('.forge-ingredient')).toHaveCount(13);await expect(page.locator('.forge-detail')).toContainText('не сканер инвентаря');
 await page.locator('.ingredient-info').first().click();await expect(page.getByRole('dialog')).toContainText('Где искать');
 await page.getByRole('button',{name:'Открыть мастерскую'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
 await expect(page.locator('.legend-forge')).toBeVisible();
});

test('four armor stages change all class cards and modal images',async({page})=>{
 await page.goto('/');const variants=[['Molten_armor','Necro_armor','Meteor_armor','Bee_armor'],['Adamantite_melee','Titanium_ranged','Adamantite_magic','Spider_armor'],['Beetle_shell','Shroomite_bullet','Spectre_mask','Spooky_armor'],['Solar_Flare_armor','Vortex_armor','Nebula_armor','Stardust_armor']];
 for(let s=0;s<4;s++){
  await page.locator('.armor-stage-picker button').nth(s).click();
  for(let c=0;c<4;c++){
   await expect(page.locator('.class-card').nth(c).locator('.armor-figure')).toHaveAttribute('data-armor',variants[s][c]);
   await page.locator('.class-card').nth(c).click();await expect(page.locator('.class-detail-sprite .armor-figure')).toHaveAttribute('data-armor',variants[s][c]);
   await expect(page.locator('.class-detail-sprite img')).toHaveJSProperty('complete',true);
   expect(await page.locator('.class-detail-sprite img').evaluate(i=>i.naturalWidth)).toBeGreaterThan(0);
   await page.keyboard.press('Escape');
  }
 }
});

test('builder displays the armor for all sixteen stage and class combinations',async({page})=>{
 await page.goto('/');await page.locator('nav button').filter({hasText:'Конструктор билда'}).click();
 const sets={warrior:['Molten_armor','Adamantite_melee','Beetle_shell','Solar_Flare_armor'],ranger:['Necro_armor','Titanium_ranged','Shroomite_bullet','Vortex_armor'],mage:['Meteor_armor','Adamantite_magic','Spectre_mask','Nebula_armor'],summoner:['Bee_armor','Spider_armor','Spooky_armor','Stardust_armor']};
 for(const [c,sprites] of Object.entries(sets)){await page.locator('select').first().selectOption(c);for(let s=0;s<4;s++){await page.locator('select').nth(1).selectOption(String(s));await expect(page.locator('.tool-output .armor-figure')).toHaveAttribute('data-armor',sprites[s])}}
 await expect(page.locator('.tool-output')).not.toContainText('На иллюстрации — финальная');
});

test('route keeps, random discoveries and reduced-motion mobile archive',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');
 await page.getByRole('button',{name:'Открыть тайник Гида',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('Где искать');await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Открыть меню'}).click();await page.locator('nav button').filter({hasText:'Мой этап'}).click();
 await expect(page.locator('.route-armor-preview .armor-figure')).toHaveAttribute('data-armor','Wood_armor');
 await page.locator('#route-select').selectOption('lunar');await expect(page.locator('.route-armor-preview .armor-figure')).toHaveAttribute('data-armor','Beetle_shell');
 await page.locator('.keep-items button').first().click();await expect(page.getByRole('dialog')).toContainText('Терра-меч');await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Открыть меню'}).click();await page.locator('nav button').filter({hasText:'Редкие предметы'}).click();
 for(const width of [390,320]){await page.setViewportSize({width,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy()}
 expect(await page.locator('.floating-loot .sprite').first().evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
 expect(errors).toEqual([]);
});

test('an ingredient opens the matching legendary recipe and modal traps focus',async({page})=>{
 await openArchive(page);await page.getByRole('textbox',{name:'Найти предмет'}).fill('Лавовый оберег');
 await page.getByRole('button',{name:'Подробнее: Лавовый оберег'}).click();
 await expect(page.locator('.modal-close')).toBeFocused();
 await page.keyboard.press('Shift+Tab');await expect(page.locator('.item-wiki-link')).toBeFocused();
 await page.keyboard.press('Tab');await expect(page.locator('.modal-close')).toBeFocused();
 await page.getByRole('button',{name:'Открыть мастерскую'}).click();
 await expect(page.locator('.forge-showcase h2')).toHaveText('Ботинки Терраспарка');
});

test('every route and class has a valid era-appropriate armor image',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');await page.getByRole('button',{name:'Открыть меню'}).click();await page.locator('nav button').filter({hasText:'Мой этап'}).click();
 const stages=await page.locator('#route-select option').evaluateAll(nodes=>nodes.map(n=>n.value));
 for(const stage of stages){await page.locator('#route-select').selectOption(stage);for(let c=0;c<4;c++){
  await page.locator('.route-classes button').nth(c).click();
  const image=page.locator('.route-armor-preview img');await expect(image).toHaveJSProperty('complete',true);
  expect(await image.evaluate(i=>i.naturalWidth)).toBeGreaterThan(0);
  if(stage!=='endgame')expect(await image.getAttribute('src')).not.toMatch(/Solar_Flare|Vortex_armor|Nebula_armor|Stardust_armor/);
 }}
});
