import {test,expect} from '@playwright/test';
import {expertNotes,alternatives,quickAnswers} from '../src/fieldNotes.js';
async function section(page,name){await page.locator('.sidebar nav button').filter({hasText:name,exact:true}).click()}
async function pinBoss(page,id='Plantera'){await section(page,'Боссы');await page.locator(`.boss-info`).filter({has:page.locator(`img[src$="/${id}.webp"]`)}).click();await page.getByRole('button',{name:'Закрепить босса и собрать план'}).click();await expect(page.locator('.focus-hero')).toBeVisible()}

test('field notes cover every tracked boss plus Brain, and replacements distinguish combat from Zenith recipes',()=>{expect(Object.keys(expertNotes)).toHaveLength(17);expect(Object.keys(alternatives).length).toBeGreaterThanOrEqual(10);expect(alternatives.Uzi.stage).toContain('хардмод');expect(alternatives.Seedler.text).toContain('не подменяет компонент');expect(quickAnswers).toHaveLength(6)});

test('boss goal unifies manual checks, difficulty, supplies, persists and never grants a win',async({page})=>{
 await page.goto('/');await pinBoss(page);await expect(page.locator('.focus-dock')).toContainText('Плантера');await expect(page.locator('.focus-card').first()).toContainText('Зелья');await expect(page.locator('.focus-card').nth(1)).toContainText('Арена');
 for(const input of await page.locator('.focus-check input').all())await input.check();await expect(page.locator('.preparation-seal')).toHaveClass(/ready/);expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('terraria-bosses')))).toEqual([]);
 await page.locator('.difficulty-tabs button').getByText('Мастер',{exact:true}).click();await expect(page.locator('.master-note')).toContainText('поведение Эксперта');await page.getByRole('button',{name:'Добавить базовый набор в корзину'}).click();await expect(page.locator('.ingredient-basket')).toContainText('9 ЗЕЛИЙ');await page.reload();await section(page,'Моя цель');await expect(page.locator('.focus-hero')).toContainText('Плантера');await expect(page.locator('.focus-check input:checked')).toHaveCount(6);
});

test('stage goal shares route task marks, can be replaced and focus participates in export',async({page})=>{
 await page.goto('/');await section(page,'Мой этап');await page.getByRole('button',{name:'Закрепить этот этап',exact:true}).click();await page.locator('.focus-check input').first().check();await page.getByRole('button',{name:'Полное руководство'}).click();await expect(page.locator('.stage-tasks input').first()).toBeChecked();await section(page,'Моя цель');await page.getByRole('button',{name:'Выбрать другую цель'}).click();await expect(page.locator('.focus-empty')).toBeVisible();await page.locator('.focus-choices button').filter({hasText:'Глаз Ктулху'}).click();const exported=await page.evaluate(async()=>{const {exportJournal}=await import('/src/journal.js');return exportJournal().data});expect(exported['terraria-focus']).toEqual({type:'boss',id:'Eye_of_Cthulhu'});await page.getByRole('button',{name:'Открепить цель'}).click();await expect(page.locator('.focus-dock')).toHaveCount(0);
});

test('resume restores last tool and scroll without rerendering cards on scroll; browser back returns to previous section',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');await section(page,'Советы и секреты');await page.locator('.tip-card').last().scrollIntoViewIfNeeded();await page.waitForTimeout(400);const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('terraria-resume')));expect(saved.scroll).toBeGreaterThan(200);await page.reload();await page.getByRole('button',{name:/Продолжить:/}).click();await expect(page.locator('.tip-card')).toHaveCount(20);await expect.poll(()=>page.evaluate(()=>scrollY)).toBeGreaterThan(200);await section(page,'Боссы');await page.goBack();await expect(page.locator('.tip-card')).toHaveCount(20);
});

test('question search gives concise correct answers and exact linked destinations',async({page})=>{
 await page.goto('/');await page.locator('#search').fill('кто роняет Узи');await expect(page.locator('.search-results button').first()).toContainText('Сердитого ловца');await page.locator('.search-results button').first().click();await expect(page.getByRole('dialog')).toContainText('Доступный другой путь');await expect(page.getByRole('dialog')).toContainText('Ружьё-дробовик');await page.keyboard.press('Escape');await page.locator('#search').fill('почему не продаётся пилон');await expect(page.locator('.search-results button').first()).toContainText('У Медсестры нет магазина');await page.locator('#search').press('ArrowDown');await page.keyboard.press('Enter');await expect(page.locator('.tool-heading')).toContainText('Соседи, домики и пилоны');
});

test('full content search finds recipes, bloom conditions and deep tactics, not just titles',async({page})=>{
 await page.goto('/');const result=await page.evaluate(async()=>{const {searchContent}=await import('/src/searchIndex.js');return {rain:searchContent('цветёт во время дождя'),uzi:searchContent('дробовик'),beam:searchContent('луч проходит сквозь блоки')}});expect(result.rain.some(x=>x.title==='Воднолист')).toBeTruthy();expect(result.uzi.some(x=>x.title==='Узи')).toBeTruthy();expect(result.beam.some(x=>x.title==='Лунный лорд')).toBeTruthy();
});

test('difficulty manuals distinguish Expert changes from Master statistics and give source/version labels',async({page})=>{
 await page.goto('/');await section(page,'Боссы');await page.locator('.boss-info').filter({hasText:'Герцог Рыброн'}).click();await page.locator('.difficulty-tabs button').getByText('Эксперт',{exact:true}).click();await expect(page.locator('.difficulty-notes')).toContainText('третья фаза');await page.locator('.difficulty-tabs button').getByText('Мастер',{exact:true}).click();await expect(page.locator('.master-note')).toContainText('Отдельную новую фазу');await expect(page.locator('.source-stamp')).toContainText('1.4.4');await expect(page.locator('.source-stamp a')).toHaveAttribute('href',/Duke_Fishron/);
});

test('mobile search, sticky tool switcher and bottom goal navigation remain usable at 320px',async({page})=>{
 await page.setViewportSize({width:320,height:740});await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');await page.getByRole('button',{name:'Открыть поиск',exact:true}).click();await page.locator('#search').fill('что нужно для крыльев');await page.locator('.search-results button').first().click();await expect(page.locator('.enemy-card')).toContainText('Виверна');await page.locator('.hub-mobile-switch select').selectOption('alchemy');await page.locator('.herb-card').last().scrollIntoViewIfNeeded();await expect(page.locator('.hub-mobile-switch')).toBeInViewport();await page.locator('.mobile-bottom-nav button').filter({hasText:'Моя цель'}).click();await expect(page.locator('.focus-empty')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});

test('collection arrival actually settles, quick and reduced motion keep its text without decorative motion',async({page})=>{
 await page.goto('/');await section(page,'Редкие предметы');await page.locator('.treasure-collect').first().click();await expect(page.locator('.collection-arrival')).toBeVisible();const sample=()=>page.locator('.collection-arrival .sprite').evaluate(e=>getComputedStyle(e).transform);const a=await sample();await expect.poll(sample,{timeout:2000}).not.toBe(a);await page.emulateMedia({reducedMotion:'reduce'});expect(await page.locator('.collection-arrival .sprite').evaluate(e=>getComputedStyle(e).animationName)).toBe('none');await page.locator('.collection-arrival button').click();await expect(page.locator('.trophy-room')).toBeVisible();
});
