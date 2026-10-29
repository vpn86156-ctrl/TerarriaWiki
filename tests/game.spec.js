/* Интерфейс «Заброшки» в браузере: экраны, HUD, управление, магазин, настройки. */
import { test, expect } from '@playwright/test';

const canvasStats = (page) => page.evaluate(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let sum = 0, lit = 0;
  const colors = new Set();
  for (let i = 0; i < data.length; i += 4) {
    const l = (data[i] + data[i + 1] + data[i + 2]) / 3;
    sum += l;
    if (l > 24) lit += 1;
    if (i % 40 === 0) colors.add(`${data[i] >> 3},${data[i + 1] >> 3},${data[i + 2] >> 3}`);
  }
  const pixels = data.length / 4;
  return { mean: +(sum / pixels).toFixed(1), lit: +(lit / pixels).toFixed(3), colors: colors.size };
});

async function skipTutorial(page) {
  const next = page.locator('#btn-tutorial-next');
  for (let i = 0; i < 8; i += 1) {
    if (!(await next.isVisible().catch(() => false))) break;
    await next.click();
    await page.waitForTimeout(80);
  }
}

test.beforeEach(async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.__errors = errors;
  await page.goto('/');
  await page.waitForFunction(() => !!window.__zabroshka);
});

test('первый запуск начинается с обучения', async ({ page }) => {
  await expect(page.locator('#screen-tutorial')).toHaveClass(/active/);
  await expect(page.locator('#tutorial-title')).toContainText('1 / 5');
  await skipTutorial(page);
  await expect(page.locator('#screen-title')).toHaveClass(/active/);
  expect(await page.evaluate(() => window.__zabroshka.progress.tutorialSeen)).toBe(true);
});

test('экран заголовка: кнопки и подсказка', async ({ page }) => {
  await skipTutorial(page);
  await expect(page.locator('.logo')).toHaveText('ЗАБРОШКА');
  await expect(page.locator('#btn-continue')).toBeDisabled();
  await expect(page.locator('[data-go="new"]')).toBeVisible();
  await expect(page.locator('#screen-title [data-go="settings"]')).toBeVisible();
});

test('новая игра запускает уровень и показывает HUD', async ({ page }) => {
  await skipTutorial(page);
  await page.locator('[data-go="new"]').click();
  await page.waitForTimeout(1200);
  expect(await page.evaluate(() => window.__zabroshka.screen)).toBe('game');
  await expect(page.locator('#hud')).not.toHaveClass(/hidden/);
  await expect(page.locator('#level-title')).toContainText('ПОДВАЛ · ЭТАЖ 1');
  await expect(page.locator('#objective')).toContainText('КЛЮЧ');
  const hearts = await page.locator('#hearts .heart').count();
  expect(hearts).toBeGreaterThanOrEqual(6);
  const stats = await canvasStats(page);
  expect(stats.mean).toBeGreaterThan(8);
  expect(stats.colors).toBeGreaterThan(15);
  expect(page.__errors).toEqual([]);
});

test('спрайты загружаются и используются в кадре', async ({ page }) => {
  await skipTutorial(page);
  await page.locator('[data-go="new"]').click();
  await page.waitForTimeout(1500);
  const count = await page.evaluate(() => window.__zabroshka.sprites);
  expect(count, 'спрайты должны прийти из images/sprites').toBeGreaterThan(8);
  const stats = await canvasStats(page);
  expect(stats.colors, 'спрайты делают кадр богаче по цвету').toBeGreaterThan(40);
  expect(page.__errors).toEqual([]);
});

test('игра рисует кадры и двигает героя клавиатурой', async ({ page }) => {
  await skipTutorial(page);
  await page.locator('[data-go="new"]').click();
  await page.waitForTimeout(600);
  const before = await page.evaluate(() => ({ x: window.__zabroshka.game.player.x, frames: window.__zabroshka.frames }));
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(900);
  await page.keyboard.up('KeyD');
  const after = await page.evaluate(() => ({ x: window.__zabroshka.game.player.x, frames: window.__zabroshka.frames }));
  expect(after.frames).toBeGreaterThan(before.frames + 6);
  expect(Math.abs(after.x - before.x)).toBeGreaterThan(4);
  expect(page.__errors).toEqual([]);
});

test('джойстик двигает героя', async ({ page }) => {
  await skipTutorial(page);
  await page.locator('[data-go="new"]').click();
  await page.waitForTimeout(600);
  const box = await page.locator('#stick').boundingBox();
  const before = await page.evaluate(() => window.__zabroshka.game.player.x);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width, box.y + box.height / 2, { steps: 8 });
  await page.waitForTimeout(800);
  await page.mouse.up();
  const after = await page.evaluate(() => window.__zabroshka.game.player.x);
  expect(after).toBeGreaterThan(before);
  expect(page.__errors).toEqual([]);
});

test('кнопки удара и выстрела работают', async ({ page }) => {
  await skipTutorial(page);
  await page.locator('[data-go="new"]').click();
  await page.waitForTimeout(600);
  const start = await page.evaluate(() => ({
    mag: window.__zabroshka.game.player.magazine,
    gun: window.__zabroshka.game.player.gun,
  }));
  expect(start.gun).toBe('pistol');
  const fire = page.locator('[data-action="shoot"]');
  await fire.dispatchEvent('pointerdown');
  await page.waitForTimeout(500);
  await fire.dispatchEvent('pointerup');
  const afterShot = await page.evaluate(() => window.__zabroshka.game.player.magazine);
  expect(afterShot).toBeLessThan(start.mag);

  const melee = page.locator('[data-action="melee"]');
  await melee.dispatchEvent('pointerdown');
  await page.waitForTimeout(400);
  await melee.dispatchEvent('pointerup');
  const swing = await page.evaluate(() => Boolean(window.__zabroshka.game.player.swing || window.__zabroshka.game.player.cooldown > 0));
  expect(swing).toBe(true);
  expect(page.__errors).toEqual([]);
});

test('пауза, настройки и возврат в игру', async ({ page }) => {
  await skipTutorial(page);
  await page.locator('[data-go="new"]').click();
  await page.waitForTimeout(600);
  await page.locator('#btn-pause').click();
  await expect(page.locator('#screen-pause')).toHaveClass(/active/);
  expect(await page.evaluate(() => window.__zabroshka.screen)).toBe('pause');
  await page.locator('#screen-pause [data-go="settings"]').click();
  await expect(page.locator('#screen-settings')).toHaveClass(/active/);
  await page.locator('#set-music').uncheck();
  await expect(page.locator('#set-music')).not.toBeChecked();
  await page.locator('#screen-settings [data-go="back"]').click();
  await expect(page.locator('#screen-pause')).toHaveClass(/active/);
  await page.locator('#btn-resume').click();
  expect(await page.evaluate(() => window.__zabroshka.screen)).toBe('game');
  expect(await page.evaluate(() => window.__zabroshka.progress.settings.music)).toBe(false);
  expect(page.__errors).toEqual([]);
});

test('настройки сохраняются между запусками', async ({ page }) => {
  await skipTutorial(page);
  await page.locator('#screen-title [data-go="settings"]').click();
  await page.locator('#set-sound').uncheck();
  await page.locator('#set-volume').fill('40');
  await page.reload();
  await page.waitForFunction(() => !!window.__zabroshka);
  expect(await page.evaluate(() => window.__zabroshka.progress.settings.sound)).toBe(false);
  expect(await page.evaluate(() => window.__zabroshka.progress.settings.volume)).toBeCloseTo(.4, 5);
});

test('мини-карту можно выключить', async ({ page }) => {
  await skipTutorial(page);
  await page.locator('[data-go="new"]').click();
  await page.waitForTimeout(500);
  await expect(page.locator('#minimap')).not.toHaveClass(/hidden/);
  await page.locator('#btn-pause').click();
  await page.locator('#screen-pause [data-go="settings"]').click();
  await page.locator('#set-minimap').uncheck();
  await page.locator('#screen-settings [data-go="back"]').click();
  await page.locator('#btn-resume').click();
  await expect(page.locator('#minimap')).toHaveClass(/hidden/);
});

test('магазин: покупка списывает монеты и выдаёт снаряжение', async ({ page }) => {
  await skipTutorial(page);
  await page.evaluate(() => window.__zabroshka.setProgress({ coins: 500 }));
  await page.evaluate(() => { window.__zabroshka.startLevel(0, 0); window.__zabroshka.openShop(); });
  await expect(page.locator('#screen-shop')).toHaveClass(/active/);
  await expect(page.locator('#shop-coins')).toHaveText('500');
  const items = page.locator('#shop-grid .shop-item');
  expect(await items.count()).toBeGreaterThanOrEqual(10);

  const shotgun = items.filter({ hasText: 'ДРОБОВИК' }).first();
  await shotgun.locator('.buy').click();
  await expect(page.locator('#shop-coins')).toHaveText('260');
  expect(await page.evaluate(() => window.__zabroshka.progress.weapons)).toContain('shotgun');

  const medkit = items.filter({ hasText: 'АПТЕЧКА' }).first();
  const healthBefore = await page.evaluate(() => window.__zabroshka.game.player.health);
  await page.evaluate(() => { window.__zabroshka.game.player.health = 3; });
  await medkit.locator('.buy').click();
  expect(await page.evaluate(() => window.__zabroshka.game.player.health)).toBeGreaterThan(3);
  void healthBefore;
  expect(page.__errors).toEqual([]);
});

test('прохождение этажа открывает магазин и следующий этаж', async ({ page }) => {
  await skipTutorial(page);
  await page.locator('[data-go="new"]').click();
  await page.waitForTimeout(500);
  // Ставим героя на выход при открытой двери — уровень должен завершиться.
  await page.evaluate(() => {
    const game = window.__zabroshka.game;
    game.doorOpen = true;
    game.level.grid[game.level.door.y * game.level.w + game.level.door.x] = 1;
    game.player.x = game.level.exit.x;
    game.player.y = game.level.exit.y;
  });
  await expect(page.locator('#screen-clear')).toHaveClass(/active/, { timeout: 10000 });
  await expect(page.locator('#clear-stats')).toContainText('МОНЕТ');
  await page.locator('#btn-clear-next').click();
  await expect(page.locator('#screen-shop')).toHaveClass(/active/);
  await page.locator('#btn-shop-next').click();
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => window.__zabroshka.screen)).toBe('game');
  await expect(page.locator('#level-title')).toContainText('ЭТАЖ 2');
});

test('смерть показывает итог и перезапускает этаж', async ({ page }) => {
  await skipTutorial(page);
  await page.locator('[data-go="new"]').click();
  await page.waitForTimeout(500);
  await page.evaluate(() => { window.__zabroshka.game.player.health = 0.1; });
  await page.evaluate(() => {
    const game = window.__zabroshka.game;
    for (let i = 0; i < 5; i += 1) game.player.invulnerable = 0;
  });
  await page.evaluate(() => {
    const game = window.__zabroshka.game;
    game.player.invulnerable = 0;
    game.player.health = 0.05;
    const enemy = game.level.enemies[0];
    enemy.x = game.player.x + 8;
    enemy.y = game.player.y;
    enemy.cooldown = 0;
    enemy.windup = 0.01;
  });
  await expect(page.locator('#screen-death')).toHaveClass(/active/, { timeout: 10000 });
  await expect(page.locator('#death-stats')).toContainText('ЭТАЖ');
  await page.locator('#btn-retry').click();
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.__zabroshka.screen)).toBe('game');
  expect(await page.evaluate(() => window.__zabroshka.game.player.health)).toBeGreaterThan(1);
});

test('кнопка «назад» на телефоне уходит в паузу', async ({ page }) => {
  await skipTutorial(page);
  await page.locator('[data-go="new"]').click();
  await page.waitForTimeout(400);
  const handled = await page.evaluate(() => window.__zabroshkaBack && window.__zabroshkaBack());
  expect(handled).toBe(true);
  await expect(page.locator('#screen-pause')).toHaveClass(/active/);
  const second = await page.evaluate(() => window.__zabroshkaBack());
  expect(second).toBe(true);
  await expect(page.locator('#screen-title')).toHaveClass(/active/);
  const third = await page.evaluate(() => window.__zabroshkaBack());
  expect(third).toBe(false);
});

test('выбор локации: открыт только подвал', async ({ page }) => {
  await skipTutorial(page);
  await page.locator('[data-go="locations"]').click();
  await expect(page.locator('#screen-locations')).toHaveClass(/active/);
  const cards = page.locator('.location-card');
  expect(await cards.count()).toBe(3);
  await expect(cards.nth(0)).not.toHaveClass(/locked/);
  await expect(cards.nth(1)).toHaveClass(/locked/);
  await cards.nth(0).locator('.level-pip').first().click();
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.__zabroshka.screen)).toBe('game');
});

test('экран музыки и звуков показывает источники', async ({ page }) => {
  await skipTutorial(page);
  await page.locator('[data-go="credits"]').click();
  await expect(page.locator('#screen-credits')).toHaveClass(/active/);
  await expect(page.locator('#credits-list')).toContainText('CC0', { timeout: 10000 });
  await expect(page.locator('#credits-list')).toContainText('FreePD');
});

test('звук: манифест, декодирование сэмплов и список музыки', async ({ page }) => {
  await skipTutorial(page);
  await page.locator('[data-go="new"]').click();
  await page.waitForTimeout(800); // первое касание разблокирует звук
  const audio = await page.evaluate(async () => {
    const engine = window.__zabroshka.audio;
    if (!engine.context) return { context: false };
    await engine.loadManifest();
    const groups = Object.keys(engine.manifest || {});
    const sfxFile = engine.manifest?.swing?.[0]?.file;
    const buffer = sfxFile ? await engine.bufferFor(`./audio/sfx/${sfxFile}`) : null;
    return {
      context: true,
      state: engine.context.state,
      groups,
      sfxFile,
      decoded: !!buffer && buffer.length > 0,
      music: (engine.musicList || []).length,
      roles: [...new Set((engine.musicList || []).map((track) => track.role))].sort(),
    };
  });
  expect(audio.context).toBe(true);
  expect(audio.groups.length).toBeGreaterThanOrEqual(10);
  expect(audio.sfxFile).toBeTruthy();
  expect(audio.decoded).toBe(true);
  expect(audio.music).toBeGreaterThanOrEqual(16);
  expect(audio.roles).toEqual(['boss', 'explore', 'fight']);
  expect(page.__errors).toEqual([]);
});

test('игра не ловит ошибки за минуту боя', async ({ page }) => {
  await skipTutorial(page);
  await page.locator('[data-go="new"]').click();
  await page.waitForTimeout(400);
  for (let round = 0; round < 6; round += 1) {
    await page.keyboard.down('KeyD');
    await page.keyboard.down('KeyJ');
    await page.waitForTimeout(500);
    await page.keyboard.up('KeyJ');
    await page.keyboard.down('KeyK');
    await page.waitForTimeout(500);
    await page.keyboard.up('KeyK');
    await page.keyboard.up('KeyD');
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(400);
    await page.keyboard.up('KeyW');
  }
  const state = await page.evaluate(() => {
    const game = window.__zabroshka.game;
    return { alive: !game.dead, x: game.player.x, y: game.player.y, frames: window.__zabroshka.frames };
  });
  expect(Number.isFinite(state.x)).toBe(true);
  expect(Number.isFinite(state.y)).toBe(true);
  expect(state.frames).toBeGreaterThan(60);
  expect(page.__errors).toEqual([]);
});
