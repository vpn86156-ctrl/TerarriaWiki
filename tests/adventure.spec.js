import {test,expect} from '@playwright/test';
import {progression} from '../src/progression.js';

test('levitating Zenith opens its guide and animation preference persists',async({page})=>{
 await page.goto('/');
 const relic=page.getByRole('button',{name:'Парящий Зенит — открыть рецепт'});
 await expect(relic).toBeVisible();
 expect(await page.locator('.relic-spin').evaluate(el=>getComputedStyle(el).animationName)).toBe('relic-spin');
 await relic.click();await expect(page.getByRole('dialog')).toContainText('Путь к Зениту');
 await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Отключить анимации'}).click();
 expect(await page.locator('.relic-spin').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
 await page.reload();await expect(page.getByRole('button',{name:'Включить анимации'})).toBeVisible();
});

test('stage, tasks and class selection survive reload',async({page})=>{
 await page.goto('/');await page.locator('nav button').filter({hasText:'Мой этап'}).click();
 await page.locator('.route-map button').filter({hasText:'Первые шаги хардмода'}).click();
 await expect(page.locator('.route-stage-banner')).toContainText('Незнакомая опасность');
 await page.locator('.stage-tasks input').first().check();
 await expect(page.locator('.route-overview')).toContainText('1 / 44');
 await page.locator('.route-classes button').filter({hasText:'Маг',exact:true}).click();
 await expect(page.locator('.route-gear')).toContainText('Кристальный змей');
 await page.reload();await page.locator('nav button').filter({hasText:'Мой этап'}).click();
 await expect(page.locator('.stage-tasks input').first()).toBeChecked();
 await expect(page.locator('.route-stage-banner')).toContainText('Незнакомая опасность');
 await expect(page.locator('.route-gear')).toContainText('Кристальный змей');
 await page.locator('.route-classes button').filter({hasText:'Стрелок',exact:true}).click();
 await expect(page.locator('.route-gear')).toContainText('Лук Дедала');
});

test('all eleven stages have actionable resources, builds, bosses and linked tutorials',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:390,height:844});await page.goto('/');
 await page.getByRole('button',{name:'Открыть меню'}).click();await page.locator('nav button').filter({hasText:'Мой этап'}).click();
 for(const s of progression){
  await page.locator('#route-select').selectOption(s.id);
  await expect(page.locator('.route-stage-banner h2')).toHaveText(s.title);
  await expect(page.locator('.stage-tasks input')).toHaveCount(4);
  await expect(page.locator('.resource-entry')).toHaveCount(4);
  await expect(page.locator('.route-guide-links button')).toHaveCount(s.guideIds.length);
  await expect(page.locator('.route-bosses button')).toHaveCount(s.bossIds.length);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();
 }
 await page.locator('#route-select').selectOption('evil');
 await page.locator('.route-bosses button').filter({hasText:'Мозг Ктулху'}).click();
 await expect(page.getByRole('dialog')).toContainText('Ползунцы');
 await expect(page.getByRole('dialog')).toContainText('Багрянце');
 expect(errors).toEqual([]);
});

test('expanded boss manual and a new victory celebration',async({page})=>{
 await page.goto('/');await page.locator('nav button').filter({hasText:'Боссы',exact:true}).click();
 await page.locator('.boss-info').filter({hasText:'Лунный лорд'}).click();
 await expect(page.getByRole('dialog')).toContainText('луч проходит через блоки');
 await expect(page.getByRole('dialog')).toContainText('Ради чего побеждать');
 await page.getByRole('button',{name:'Отметить победу',exact:true}).click();
 await expect(page.locator('.victory-message')).toContainText('Лунный лорд побеждён');
 await page.getByRole('button',{name:'Побеждён! Отменить отметку',exact:true}).click();
 await page.keyboard.press('Escape');await expect(page.locator('.boss-progress')).toContainText('0 из 16');
});

test('reduced motion and narrow phone layout',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:320,height:740});
 await page.goto('/');
 expect(await page.locator('.relic-spin').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();
 await page.getByRole('button',{name:'Открыть меню'}).click();await page.locator('nav button').filter({hasText:'Мой этап'}).click();
 await page.locator('#route-select').selectOption('lunar');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();
 await expect(page.locator('.route-next .primary')).toBeVisible();
});
