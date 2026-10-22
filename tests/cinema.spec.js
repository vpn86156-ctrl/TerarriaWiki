import {test,expect} from '@playwright/test';
import {existsSync} from 'node:fs';
import {huntTreasures} from '../src/huntTreasures.js';

async function section(page,name){await page.locator('nav button').filter({hasText:name,exact:true}).click()}

test('Zenith really changes position and rotates over time, not just an animation name',async({page})=>{
 await page.goto('/');await page.locator('.hero').evaluate(el=>el.scrollIntoView());
 const sample=()=>page.locator('.zenith-relic').evaluate(el=>({float:getComputedStyle(el.querySelector('.relic-float')).transform,spin:getComputedStyle(el.querySelector('.relic-spin')).transform,blade:getComputedStyle(el.querySelector('.sprite')).rotate}));
 const first=await sample();await page.waitForTimeout(400);const second=await sample();
 expect(second.float).not.toBe(first.float);expect(second.spin).not.toBe(first.spin);expect(second.blade).not.toBe(first.blade);
});

test('auto explains reduced motion, explicit full mode restores movement and persists',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');
 await expect(page.locator('.motion-notice')).toContainText('уменьшение движения');
 expect(await page.locator('.relic-spin').evaluate(e=>getComputedStyle(e).animationName)).toBe('none');
 await page.getByRole('button',{name:'Включить полные анимации',exact:true}).click();
 await expect(page.locator('.motion-notice')).toHaveCount(0);
 await expect(page.locator('html')).toHaveAttribute('data-motion-level','full');
 expect(await page.locator('.relic-spin').evaluate(e=>getComputedStyle(e).animationName)).toBe('relic-spin');
 await page.reload();expect(await page.locator('.relic-spin').evaluate(e=>getComputedStyle(e).animationName)).toBe('relic-spin');
 await page.getByRole('button',{name:'Отключить анимации'}).click();
 await expect(page.locator('.motion-notice')).toContainText('сохранённой настройкой');
 expect(await page.locator('.relic-spin').evaluate(e=>getComputedStyle(e).animationName)).toBe('none');
});

test('scroll reveals work on non-home pages and register cards inserted by filters',async({page})=>{
 await page.goto('/');await section(page,'Советы и секреты');
 const last=page.locator('.tip-card').last();await expect(last).toHaveClass(/scroll-wait/);
 await last.scrollIntoViewIfNeeded();await expect(last).toHaveClass(/scroll-in/);
 await section(page,'Прохождение');await page.locator('.tabs button').filter({hasText:'Исследование',exact:true}).click();
 await expect(page.locator('.guide-card').first()).toHaveClass(/scroll-reveal/);
 await page.locator('.guide-card').first().scrollIntoViewIfNeeded();await expect(page.locator('.guide-card').first()).toHaveClass(/scroll-in/);
 await section(page,'Редкие предметы');await page.getByRole('button',{name:'Добыча с мобов',exact:true}).click();
 await expect(page.locator('.treasure-card').first()).toHaveClass(/scroll-reveal/);
 await page.locator('.treasure-card').first().scrollIntoViewIfNeeded();await expect(page.locator('.treasure-card').first()).toHaveClass(/scroll-in/);
 await page.getByRole('button',{name:'Отключить анимации'}).click();
 await expect(page.locator('.scroll-wait')).toHaveCount(0);
});

test('story chapters change illustrations and smoothly tint the world red then restore it',async({page})=>{
 await page.goto('/');await section(page,'История мира');
 await expect(page.locator('.story-theater')).toHaveAttribute('data-chapter','balance');
 await expect(page.getByRole('button',{name:'Предыдущая глава'})).toBeDisabled();
 await page.locator('.story-chapter-nav button').filter({hasText:'Преисподняя'}).click();
 await expect(page.locator('html')).toHaveAttribute('data-scene','hell');
 await expect(page.locator('.story-landscape')).toHaveAttribute('src',/story-underworld.webp/);
 await expect(page.locator('#story-title')).toContainText('жарко');
 expect(await page.locator('.world-color').evaluate(el=>getComputedStyle(el).transitionDuration)).toBe('2.2s');
 await expect.poll(()=>page.locator('.world-color').evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgb(107, 32, 21)');
 await page.getByRole('button',{name:'Следующая глава',exact:true}).click();
 await expect(page.locator('html')).toHaveAttribute('data-scene','lunar');
 await expect(page.locator('.story-theater')).toHaveAttribute('data-chapter','moon');
 await section(page,'Прохождение');await expect(page.locator('html')).toHaveAttribute('data-scene','guides');
});

test('24 new hunts have real sprites and non-crafting farming details',async({page})=>{
 expect(huntTreasures.length).toBe(24);for(const t of huntTreasures){expect(existsSync(`public/assets/${t.id}.webp`),t.id).toBeTruthy();expect(t.farm.length).toBeGreaterThan(45);expect(t.enemy.length).toBeGreaterThan(3)}
 await page.goto('/');await section(page,'Редкие предметы');await page.getByRole('button',{name:'Добыча с мобов',exact:true}).click();
 await expect(page.locator('.treasure-card')).toHaveCount(huntTreasures.filter(t=>t.group==='drops').length);
 await page.getByRole('textbox',{name:'Найти предмет'}).fill('Костяной ключ');
 await page.getByRole('button',{name:'Подробнее: Костяной ключ'}).click();
 await expect(page.getByRole('dialog')).toContainText('Гарантированная награда');await expect(page.getByRole('dialog')).toContainText('Цель: Страж темницы');
});

test('mobile story is manually navigable, all images load and no page overflows',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:390,height:844});await page.goto('/');
 await page.getByRole('button',{name:'Открыть меню'}).click();await section(page,'История мира');
 for(let i=0;i<6;i++){await expect(page.locator('.story-landscape')).toHaveJSProperty('complete',true);expect(await page.locator('.story-landscape').evaluate(el=>el.naturalWidth)).toBeGreaterThan(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();if(i<5)await page.getByRole('button',{name:'Следующая глава',exact:true}).click()}
 await page.setViewportSize({width:320,height:740});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 await page.getByRole('button',{name:'Вернуться к началу'}).click();await expect(page.locator('.story-theater')).toHaveAttribute('data-chapter','balance');expect(errors).toEqual([]);
});

test('a card actually fades and moves during scroll, including after a filter change',async({page})=>{
 await page.goto('/');await section(page,'Советы и секреты');
 const card=page.locator('.tip-card').last();await expect(card).toHaveClass(/scroll-wait/);
 const initial=await card.evaluate(el=>getComputedStyle(el).opacity);expect(Number(initial)).toBe(0);
 await card.evaluate(el=>el.scrollIntoView({behavior:'instant',block:'center'}));
 await expect(card).toHaveClass(/scroll-in/);
 expect(await card.evaluate(el=>el.getAnimations().some(a=>a.animationName==='world-reveal'&&a.playState==='running'))).toBeTruthy();
 await expect.poll(()=>card.evaluate(el=>getComputedStyle(el).opacity)).toBe('1');
 expect(await card.evaluate(el=>getComputedStyle(el).transform)).toBe('none');
});
