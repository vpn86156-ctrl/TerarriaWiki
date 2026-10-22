import {test,expect} from '@playwright/test';
test('homepage assets and guide interactions',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await expect(page.locator('h1')).toContainText('Копай глубже');
 await expect(page.locator('.class-card')).toHaveCount(4);
 expect(await page.locator('img').evaluateAll(imgs=>imgs.every(i=>i.complete&&i.naturalWidth>0))).toBeTruthy();
 await page.getByRole('button',{name:'Начать приключение'}).click();
 await expect(page.getByRole('dialog')).toContainText('Твоя первая ночь');
 await page.getByRole('button',{name:'Сохранить',exact:true}).click();
 await page.getByRole('button',{name:'Готово, я разобрался'}).click();
 await page.locator('.favorite-nav').click();
 await expect(page.locator('.guide-card')).toHaveCount(1);
 await page.reload();await page.locator('.favorite-nav').click();
 await expect(page.locator('.guide-card')).toHaveCount(1);expect(errors).toEqual([]);
});
test('class stages and searchable guides',async({page})=>{
 await page.goto('/');await page.locator('.class-card').nth(2).click();
 await expect(page.getByRole('dialog')).toContainText('Броня туманности');
 await page.getByRole('button',{name:'До хардмода',exact:true}).click();
 await expect(page.getByRole('dialog')).toContainText('Метеоритная броня');
 await page.keyboard.press('Escape');await page.locator('#search').fill('Зенит');
 await page.locator('.search-results button').filter({hasText:'Путь к Зениту'}).click();
 await expect(page.getByRole('dialog')).toContainText('Путь к Зениту');
});
test('boss progress persists and filters work',async({page})=>{
 await page.goto('/');await page.locator('nav button').filter({hasText:'Боссы'}).click();
 await expect(page.locator('.boss-card')).toHaveCount(16);
 await page.locator('.boss-check').first().click();
 await expect(page.locator('.boss-progress')).toContainText('1 из 16');
 await page.getByRole('button',{name:'Не побеждены',exact:true}).click();
 await expect(page.locator('.boss-card')).toHaveCount(15);
 await page.reload();await page.locator('nav button').filter({hasText:'Боссы'}).click();
 await expect(page.locator('.boss-progress')).toContainText('1 из 16');
 await page.getByRole('button',{name:'Сбросить прогресс',exact:true}).click();
 await page.getByRole('dialog').getByRole('button',{name:'Сбросить прогресс',exact:true}).click();
 await expect(page.locator('.boss-progress')).toContainText('0 из 16');
});
test('all pages and tool selectors render without errors',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');
 for(const label of ['Прохождение','Классы и билды','Боссы','История мира','Советы и секреты','Конструктор билда']){
  await page.locator('nav button').filter({hasText:label}).click();await expect(page.locator('main')).toBeVisible();
 }
 await page.locator('select').first().selectOption('mage');await page.locator('select').nth(1).selectOption('2');
 await expect(page.locator('.tool-output')).toContainText('Спектральная броня');expect(errors).toEqual([]);
});
test('mobile navigation and responsive layout',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();
 await page.getByRole('button',{name:'Открыть меню'}).click();await page.locator('nav button').filter({hasText:'Боссы'}).click();
 await expect(page.locator('.boss-card')).toHaveCount(16);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();
 await page.locator('.boss-info').first().click();await expect(page.getByRole('dialog')).toBeVisible();
});
