import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

async function start(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'В ПОЛЁТ', exact: true }).click();
  if (await page.locator('#tutorial-overlay').isVisible()) await page.getByRole('button', { name: 'НАЧАТЬ ПОЛЁТ' }).click();
  await page.locator('#launch-button').click();
  await expect(page.locator('#game-hud')).toBeVisible();
}
async function shipCentroid(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('#game-canvas');
    const { width, height } = canvas;
    const data = canvas.getContext('2d').getImageData(0, 0, width, height).data;
    let xsum = 0, ysum = 0, count = 0;
    for (let y = 40; y < height - 40; y++) for (let x = 20; x < width * .65; x++) {
      const i = (y * width + x) * 4;
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
      if (r > 175 && g > 65 && g < 205 && b < 180 && r > g * 1.15) { xsum += x; ysum += y; count++; }
    }
    return { x: xsum / count, y: ysum / count, count };
  });
}

test('home screen and first-flight instructions are clear and usable', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'КОСМО ПИЛОТ' })).toBeVisible();
  await expect(page.getByText('ИГРАЙ БЕЗ ИНТЕРНЕТА')).toBeVisible();
  await page.getByRole('button', { name: 'В ПОЛЁТ', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'ГОТОВ К ПОЛЁТУ?' })).toBeVisible();
  for (const label of ['УПРАВЛЯЙ', 'СОБИРАЙ', 'ЗАЩИЩАЙСЯ']) await expect(page.getByRole('heading', { name: label })).toBeVisible();
  await page.getByRole('button', { name: 'НАЧАТЬ ПОЛЁТ' }).click();
  await expect(page.getByRole('dialog', { name: 'КУДА ЛЕТИМ?' })).toBeVisible();
  await page.locator('#launch-button').click();
  await expect(page.getByLabel('Корпус: 3 из 3')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Волна готова' })).toBeEnabled();
  expect(errors).toEqual([]);
});

test('a real touch drag moves the ship in both directions', async ({ page, context }) => {
  await start(page);
  await page.waitForTimeout(250);
  const before = await shipCentroid(page);
  expect(before.count).toBeGreaterThan(30);
  const client = await context.newCDPSession(page);
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 100, y: 230, id: 0 }] });
  await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 180, y: 130, id: 0 }] });
  await page.waitForTimeout(450);
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const after = await shipCentroid(page);
  expect(after.count).toBeGreaterThan(30);
  expect(after.x - before.x).toBeGreaterThan(55);
  expect(before.y - after.y).toBeGreaterThan(70);
});

test('the wave button works while another finger holds the controls', async ({ page, context }) => {
  await start(page);
  const button = page.getByRole('button', { name: 'Волна готова' });
  const box = await button.boundingBox();
  const client = await context.newCDPSession(page);
  const first = { x: 120, y: 260, id: 0 };
  const second = { x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 };
  const before = await shipCentroid(page);
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [first] });
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [first, second] });
  await expect(page.locator('#pulse-button')).toBeDisabled();
  await expect(page.locator('#pulse-label')).toHaveText(/СЕК/);
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [second] });
  await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 185, y: 180, id: 0 }] });
  await page.waitForTimeout(450);
  const after = await shipCentroid(page);
  expect(after.x - before.x).toBeGreaterThan(40);
  expect(before.y - after.y).toBeGreaterThan(50);
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
});

test('keyboard movement and the spacebar are available in preview', async ({ page }) => {
  await start(page);
  await page.waitForTimeout(200);
  const before = await shipCentroid(page);
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(400);
  await page.keyboard.up('ArrowUp');
  const after = await shipCentroid(page);
  expect(before.y - after.y).toBeGreaterThan(45);
  await page.keyboard.press('Space');
  await expect(page.locator('#pulse-button')).toBeDisabled();
});

test('pause freezes score and wave cooldown until resumed', async ({ page }) => {
  await start(page);
  await page.getByRole('button', { name: 'Волна готова' }).click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Пауза' }).click();
  await expect(page.getByRole('dialog', { name: 'ПАУЗА' })).toBeVisible();
  const score = await page.locator('#score-value').innerText();
  const cooldown = await page.locator('#pulse-label').innerText();
  await page.waitForTimeout(1200);
  expect(await page.locator('#score-value').innerText()).toBe(score);
  expect(await page.locator('#pulse-label').innerText()).toBe(cooldown);
  await page.getByRole('button', { name: 'ПРОДОЛЖИТЬ' }).click();
  await expect(page.locator('#score-value')).not.toHaveText(score, { timeout: 3000 });
});

test('results and record survive reload; tutorial is not repeated', async ({ page }) => {
  await start(page);
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: 'Пауза' }).click();
  await page.getByRole('button', { name: 'ЗАВЕРШИТЬ ПОЛЁТ' }).click();
  await expect(page.getByRole('dialog', { name: 'ОТЛИЧНЫЙ ПОЛЁТ!' })).toBeVisible();
  await expect(page.getByText('✦ НОВЫЙ РЕКОРД')).toBeVisible();
  const result = await page.locator('#result-score').innerText();
  expect(Number(result.replace(/\s/g, ''))).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'В ГЛАВНОЕ МЕНЮ' }).click();
  await expect(page.locator('#home-best')).toHaveText(result);
  await page.reload();
  await expect(page.locator('#home-best')).toHaveText(result);
  await page.getByRole('button', { name: 'В ПОЛЁТ', exact: true }).click();
  await expect(page.locator('#tutorial-overlay')).toBeHidden();
  await page.locator('#launch-button').click();
  await expect(page.locator('#game-hud')).toBeVisible();
});

test('sound setting is shared by menus and persists locally', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Выключить звук' }).click();
  await expect(page.getByRole('button', { name: 'Включить звук' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Включить звук' })).toBeVisible();
  await page.getByRole('button', { name: 'В ПОЛЁТ', exact: true }).click();
  await page.getByRole('button', { name: 'НАЧАТЬ ПОЛЁТ' }).click();
  await page.locator('#launch-button').click();
  await page.getByRole('button', { name: 'Пауза' }).click();
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Включить звук' })).toBeVisible();
});

test('backgrounding and Android back pause the game rather than advancing it', async ({ page }) => {
  await start(page);
  await page.evaluate(() => window.dispatchEvent(new Event('cosmopilot:background')));
  await expect(page.getByRole('dialog', { name: 'ПАУЗА' })).toBeVisible();
  const score = await page.locator('#score-value').innerText();
  await page.waitForTimeout(600);
  expect(await page.locator('#score-value').innerText()).toBe(score);
  expect(await page.evaluate(() => window.__cosmoBack())).toBe(true);
  await expect(page.getByRole('dialog', { name: 'ПАУЗА' })).toBeHidden();
  expect(await page.evaluate(() => window.__cosmoBack())).toBe(true);
  await expect(page.getByRole('dialog', { name: 'ПАУЗА' })).toBeVisible();
});

test('portrait preview asks to rotate and pauses an active flight', async ({ page }) => {
  await start(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByText('ПОВЕРНИ ЭКРАН')).toBeVisible();
  await expect(page.locator('#pause-overlay')).not.toHaveAttribute('hidden', '');
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.getByText('ПОВЕРНИ ЭКРАН')).toBeHidden();
  await expect(page.getByRole('dialog', { name: 'ПАУЗА' })).toBeVisible();
  await page.getByRole('button', { name: 'ПРОДОЛЖИТЬ' }).click();
  await expect(page.getByRole('dialog', { name: 'ПАУЗА' })).toBeHidden();
});

test('menu and tutorial fit compact phones, wide phones and tablets', async ({ page }) => {
  for (const size of [{ width: 568, height: 320 }, { width: 780, height: 360 }, { width: 915, height: 412 }, { width: 1280, height: 720 }]) {
    await page.setViewportSize(size);
    await page.goto('/');
    const startButton = page.getByRole('button', { name: 'В ПОЛЁТ', exact: true });
    await expect(startButton).toBeVisible();
    const homeBox = await startButton.boundingBox();
    expect(homeBox.x).toBeGreaterThanOrEqual(0);
    expect(homeBox.y + homeBox.height).toBeLessThanOrEqual(size.height);
    await page.getByRole('button', { name: 'КАК ИГРАТЬ' }).click();
    const tutorialButton = page.getByRole('button', { name: 'НАЧАТЬ ПОЛЁТ' });
    await expect(tutorialButton).toBeVisible();
    const box = await tutorialButton.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(size.width);
    expect(box.y + box.height).toBeLessThanOrEqual(size.height);
    await tutorialButton.click();
    const launch = page.locator('#launch-button');
    await expect(launch).toBeVisible();
    const launchBox = await launch.boundingBox();
    expect(launchBox.x).toBeGreaterThanOrEqual(0);
    expect(launchBox.y + launchBox.height).toBeLessThanOrEqual(size.height);
    await launch.click();
    await expect(page.getByRole('button', { name: 'Пауза' })).toBeVisible();
  }
});

test('production bundle loads and plays offline through the same synthetic HTTPS asset origin as Android', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 915, height: 412 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const badRequests = [];
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  const dist = path.resolve('dist');
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.woff': 'font/woff', '.woff2': 'font/woff2', '.webp': 'image/webp', '.png': 'image/png' };
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== 'https://appassets.androidplatform.net' || !url.pathname.startsWith('/assets/')) {
      badRequests.push(url.href); return route.abort();
    }
    const filename = path.resolve(dist, decodeURIComponent(url.pathname.slice('/assets/'.length)));
    if (!filename.startsWith(dist + path.sep)) { badRequests.push(url.href); return route.abort(); }
    try {
      const bytes = await readFile(filename);
      await route.fulfill({ status: 200, body: bytes, headers: { 'Content-Type': types[path.extname(filename)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' } });
    } catch { badRequests.push(url.href); await route.fulfill({ status: 404, body: '' }); }
  });
  await context.setOffline(true);
  await page.goto('https://appassets.androidplatform.net/assets/index.html');
  await expect(page.getByRole('button', { name: 'В ПОЛЁТ', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'В ПОЛЁТ', exact: true }).click();
  await page.getByRole('button', { name: 'НАЧАТЬ ПОЛЁТ' }).click();
  await page.locator('#launch-button').click();
  await expect(page.locator('#score-value')).not.toHaveText('0', { timeout: 5000 });
  await page.getByRole('button', { name: 'Пауза' }).click();
  await page.getByRole('button', { name: 'ЗАВЕРШИТЬ ПОЛЁТ' }).click();
  await expect(page.locator('#result-score')).not.toHaveText('0');
  await page.getByRole('button', { name: 'В ГЛАВНОЕ МЕНЮ' }).click();
  await page.reload();
  await expect(page.locator('#home-best')).not.toHaveText('0');
  expect(badRequests).toEqual([]);
  expect(pageErrors).toEqual([]);
  await context.close();
});

test('the intro plays for a new pilot and can be skipped', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#intro')).toBeVisible();
  await expect(page.locator('#intro-skip')).toHaveText(/ПРОПУСТИТЬ/);
  await page.locator('#intro-skip').click();
  await expect(page.locator('#intro')).toBeHidden();
  await page.reload();
  await page.evaluate(() => localStorage.setItem('kosmopilot.v2', JSON.stringify({ version: 2, tutorialSeen: true })));
  await page.reload();
  await expect(page.locator('#intro')).toBeHidden();
});

test('campaign map locks sectors until their boss is defeated', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('kosmopilot.v2', JSON.stringify({ version: 2, tutorialSeen: true, credits: 500, parts: 5 })));
  await page.reload();
  await page.getByRole('button', { name: 'В ПОЛЁТ', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'КУДА ЛЕТИМ?' })).toBeVisible();
  const cards = page.locator('.sector-card');
  await expect(cards).toHaveCount(3);
  await expect(cards.nth(0)).not.toBeDisabled();
  await expect(cards.nth(1)).toBeDisabled();
  await expect(cards.nth(2)).toBeDisabled();
  await expect(cards.nth(1)).toContainText('ЗАКРЫТ');
  await page.locator('#mode-endless').click();
  await expect(cards.nth(2)).not.toBeDisabled();
  await page.locator('#mode-campaign').click();
  await page.locator('#launch-button').click();
  await expect(page.getByRole('button', { name: 'Пауза' })).toBeVisible();
  await expect(page.locator('#sector-name')).toHaveText('ТУМАННОСТЬ');
  await expect(page.locator('#boss-status')).toBeHidden();
  await expect(page.locator('#sector-progress')).toContainText('ДО БОССА');
});

test('the hangar spends credits on upgrades and applies them to the next flight', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('kosmopilot.v2', JSON.stringify({ version: 2, tutorialSeen: true, credits: 900, parts: 9 })));
  await page.reload();
  await expect(page.locator('#home-credits')).toHaveText('900');
  await page.getByRole('button', { name: /^⬡ АНГАР$/ }).click();
  await expect(page.getByRole('dialog', { name: 'АНГАР' })).toBeVisible();
  const hull = page.locator('.upgrade-card').filter({ hasText: 'КОРПУС' });
  await hull.locator('.card-buy').click();
  await expect(page.locator('#hub-message')).toContainText('уровень 1');
  await expect(hull.locator('.card-level i.on')).toHaveCount(1);
  await expect(page.locator('#hub-credits')).toHaveText('790');
  await page.locator('#hub-close').click();
  await page.getByRole('button', { name: 'В ПОЛЁТ', exact: true }).click();
  await page.locator('#launch-button').click();
  await expect(page.getByLabel('Корпус: 4 из 4')).toBeVisible();
});

test('case rewards are granted once per purchase and cannot be bought without credits', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('kosmopilot.v2', JSON.stringify({ version: 2, tutorialSeen: true, credits: 1000 })));
  await page.reload();
  await page.getByRole('button', { name: /^\u25c8 \u041c\u0410\u0413\u0410\u0417\u0418\u041d$/ }).click();
  const stellar = page.locator('.case-card').filter({ hasText: 'ЗВЁЗДНЫЙ КЕЙС' });
  await stellar.locator('.card-buy').click();
  await expect(page.locator('#case-overlay')).toBeVisible();
  await expect(page.locator('#case-reward')).not.toBeEmpty();
  await page.locator('#case-close').click();
  await expect(page.locator('#hub-credits')).toHaveText('780');
  const parts = Number(await page.locator('#hub-parts').innerText());
  await stellar.locator('.card-buy').click();
  await expect(page.locator('#case-reward')).not.toBeEmpty();
  await page.locator('#case-close').click();
  await expect(page.locator('#hub-credits')).toHaveText('560');
  const after = Number(await page.locator('#hub-parts').innerText());
  const skins = await page.evaluate(() => JSON.parse(localStorage.getItem('kosmopilot.v2')).ownedSkins.length);
  expect(after > parts || skins > 1).toBe(true);
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('kosmopilot.v2'));
    data.credits = 30;
    localStorage.setItem('kosmopilot.v2', JSON.stringify(data));
  });
  await page.reload();
  await page.getByRole('button', { name: /^\u25c8 \u041c\u0410\u0413\u0410\u0417\u0418\u041d$/ }).click();
  await expect(stellar.locator('.card-buy')).toBeDisabled();
  await expect(page.locator('#hub-credits')).toHaveText('30');
});

test('missions pay out only when completed and the backup code restores progress', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('kosmopilot.v2', JSON.stringify({ version: 2, tutorialSeen: true, credits: 100, parts: 1, metrics: { stars: 3 } })));
  await page.reload();
  await page.getByRole('button', { name: /^✦ ИСПЫТАНИЯ$/ }).click();
  const mission = page.locator('.mission-card').filter({ hasText: 'ЛОВЕЦ ЗВЁЗД' });
  await expect(mission.locator('.card-buy')).toHaveText('ЗАБРАТЬ');
  await mission.locator('.card-buy').click();
  await expect(mission.locator('.card-buy')).toHaveText('ПОЛУЧЕНО');
  await expect(page.locator('#hub-credits')).toHaveText('220');
  await page.locator('[data-hub-tab="backup"]').click();
  const code = await page.locator('#backup-code').inputValue();
  expect(code).toContain('kosmopilot-backup-v2');
  await page.evaluate((saved) => {
    localStorage.setItem('kosmopilot.v2', JSON.stringify({ version: 2, tutorialSeen: true, credits: 1, parts: 0 }));
    window.__savedCode = saved;
  }, code);
  await page.reload();
  await page.getByRole('button', { name: /^⬡ АНГАР$/ }).click();
  await page.locator('[data-hub-tab="backup"]').click();
  await page.getByRole('button', { name: 'ВОССТАНОВИТЬ' }).click();
  await page.locator('#restore-input').fill(code);
  await page.locator('#restore-input').dispatchEvent('change');
  await expect(page.locator('[aria-labelledby="import-title"]')).toBeVisible();
  await page.locator('#import-confirm').click();
  await expect(page.locator('#hub-credits')).toHaveText('220');
});

test('finishing a flight pays credits and parts that survive a reload', async ({ page }) => {
  await start(page);
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: 'Пауза' }).click();
  await page.getByRole('button', { name: 'ЗАВЕРШИТЬ ПОЛЁТ' }).click();
  await expect(page.locator('#result-credits')).not.toHaveText('0');
  const credits = Number((await page.locator('#result-credits').innerText()).replace(/\s/g, ''));
  expect(credits).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'В ГЛАВНОЕ МЕНЮ' }).click();
  const home = Number((await page.locator('#home-credits').innerText()).replace(/\s/g, ''));
  expect(home).toBeGreaterThanOrEqual(200 + credits);
  await page.reload();
  expect(Number((await page.locator('#home-credits').innerText()).replace(/\s/g, ''))).toBe(home);
});

test('a campaign flight reaches the sector boss and a victory unlocks the next sector', async ({ page }) => {
  // The clock fast-forwards ~40 simulated seconds of 60 fps rendering, which costs real time.
  test.setTimeout(240000);
  await page.addInitScript(() => localStorage.setItem('kosmopilot.v2', JSON.stringify({ version: 2, tutorialSeen: true, upgrades: { weapon: 5, hull: 2, engine: 3, wave: 2 } })));
  await page.clock.install();
  await page.goto('/');
  await page.getByRole('button', { name: 'В ПОЛЁТ', exact: true }).click();
  await page.locator('#launch-button').click();
  await expect(page.locator('#boss-status')).toBeHidden();
  await expect(page.locator('#sector-progress')).toContainText('ДО БОССА');
  await page.clock.runFor(25000);
  await expect(page.locator('#boss-status')).toBeVisible();
  await expect(page.locator('#boss-name')).toHaveText('СТРАЖ ПУСТОТЫ');
  await expect(page.locator('#boss-health')).toHaveAttribute('style', /width:/);
  let key = 'ArrowDown';
  await page.keyboard.down(key);
  for (let i = 0; i < 40 && !(await page.locator('#result-overlay').isVisible()); i += 1) {
    await page.clock.runFor(1000);
    await page.keyboard.up(key);
    key = key === 'ArrowDown' ? 'ArrowUp' : 'ArrowDown';
    await page.keyboard.down(key);
  }
  await page.keyboard.up(key);
  await expect(page.locator('#result-title')).toHaveText(/СТРАЖ/);
  await expect(page.locator('#result-unlock')).toBeVisible();
  await page.getByRole('button', { name: 'В ГЛАВНОЕ МЕНЮ' }).click();
  await page.getByRole('button', { name: 'В ПОЛЁТ', exact: true }).click();
  await expect(page.locator('.sector-card').nth(1)).not.toBeDisabled();
});

test('new screens fit compact phones, wide phones and tablets without overflow', async ({ page }) => {
  for (const size of [{ width: 568, height: 320 }, { width: 780, height: 360 }, { width: 915, height: 412 }, { width: 1280, height: 720 }]) {
    await page.setViewportSize(size);
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('kosmopilot.v2', JSON.stringify({ version: 2, tutorialSeen: true, credits: 900, parts: 8, ownedSkins: ['classic', 'ice'] })));
    await page.reload();
    for (const [name, dialog] of [['В ПОЛЁТ', '#flight-overlay'], ['АНГАР', '#hub-overlay']]) {
      await page.getByRole('button', { name: new RegExp(name) }).first().click();
      const panel = page.locator(`${dialog} .dialog`);
      await expect(panel).toBeVisible();
      const box = await panel.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.width).toBeLessThanOrEqual(size.width);
      expect(box.height).toBeLessThanOrEqual(size.height + 1);
      if (dialog === '#hub-overlay') {
        for (const tab of ['ships', 'shop', 'missions', 'backup']) {
          await page.locator(`[data-hub-tab="${tab}"]`).click();
          await expect(page.locator('.hub-card').first()).toBeVisible();
          const inner = await page.locator(`${dialog} .dialog`).boundingBox();
          expect(inner.height).toBeLessThanOrEqual(size.height + 1);
        }
      }
      await page.locator(`${dialog} .close-button`).click();
    }
  }
});
