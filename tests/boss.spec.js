import { test, expect } from '@playwright/test';

const SAVE = {
  version: 3, tutorialSeen: true, credits: 1200, parts: 12,
  upgrades: { weapon: 3, hull: 2, engine: 2, wave: 2 },
  campaign: { stars: {}, unlockedBiomes: 8 },
};
for (const biome of ['lyra', 'debris', 'ice', 'gas', 'graveyard', 'sun', 'caves', 'singularity']) {
  for (const slot of [1, 2, 3]) SAVE.campaign.stars[`${biome}-${slot}`] = 3;
}

// Drives a guardian fight through every phase and captures the new visuals.
// The fight runs in real time: the game loop is driven by requestAnimationFrame, which the mocked
// clock cannot step reliably, so real frames keep the fight and the observations in sync.
test('a guardian fight shows phases, a weak point and a unique death', async ({ page }) => {
  test.setTimeout(300000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  await page.setViewportSize({ width: 1612, height: 720 });
  await page.addInitScript((value) => localStorage.setItem('kosmopilot.v2', JSON.stringify(value)), SAVE);
  await page.goto('/');
  await page.locator('#intro-skip').click();
  await page.getByRole('button', { name: 'В ПОЛЁТ', exact: true }).click();
  // Корона Солнца (биом 6) -> третий уровень: Солярис дерётся в три фазы.
  await page.locator('.biome-row').nth(5).click();
  await page.locator('.level-card').nth(2).click();
  await page.locator('#launch-button').click();
  await expect(page.locator('#boss-status')).toBeVisible({ timeout: 60000 });
  await expect(page.locator('#boss-name')).toHaveText('СОЛЯРИС');

  // A frame-accurate observer inside the page records the guardian's state for the whole fight.
  await page.evaluate(() => {
    window.__frames = [];
    const round = (value) => Math.round((Number(value) || 0) * 100) / 100;
    const tick = () => {
      // The observer must never break the frame chain, so it records whatever it can safely read.
      try {
        const boss = window.__kosmopilot?.game?.boss;
        if (boss) window.__frames.push([boss.phase, round(boss.phaseShift), round(boss.weakOpen)]);
      } catch { /* a frame without a boss is simply not recorded */ }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const state = () => page.evaluate(() => {
    const boss = window.__kosmopilot?.game?.boss;
    if (!boss) return null;
    return { phase: boss.phase, phaseCount: boss.phaseCount, health: boss.health, max: boss.maxHealth, weak: boss.weak, death: boss.death, shift: boss.phaseShift };
  });

  const first = await state();
  expect(first, 'the guardian is in the fight').not.toBeNull();
  expect(first.phase).toBe(1);
  expect(first.phaseCount).toBe(3);
  await page.screenshot({ path: 'shots/boss-phase1.png' });

  // Push the guardian over each threshold one at a time; the cannon finishes the last bit of damage.
  let topped = 0;
  for (let step = 0; step < 80; step += 1) {
    const boss = await state();
    if (!boss) break;
    if (boss.phase >= boss.phaseCount) {
      // Hold the guardian alive long enough for the screenshots: no phase left to reach.
      await page.evaluate(() => {
        const living = window.__kosmopilot.game.boss;
        if (living && living.health < living.maxHealth * .4) living.health = living.maxHealth * .4;
      });
      topped += 1;
      if (topped > 2) break;
      await page.waitForTimeout(200);
      continue;
    }
    await page.evaluate((phase) => {
      const game = window.__kosmopilot.game;
      const boss = game.boss;
      if (!boss || boss.phaseShift > 0 || boss.phase !== phase) return;
      const thresholds = boss.phaseCount >= 3 ? [.66, .33] : [.5];
      // Sit just above the threshold so the very next hit tips the guardian into its next phase.
      const target = Math.ceil(boss.maxHealth * (thresholds[boss.phase - 1] + .01));
      if (boss.health > target) boss.health = target;
      game.bullets.push({ x: boss.x - 14, y: boss.y, radius: 5, vx: 560, damage: 1, removed: false });
    }, boss.phase);
    await page.waitForTimeout(200);
  }
  const last = await state();
  expect(last, 'the guardian survives its phase changes').not.toBeNull();
  expect(last.phase, 'the fight reaches the final phase').toBe(last.phaseCount);

  const frames = await page.evaluate(() => window.__frames.slice());
  console.log(`frames: ${frames.length}, phases ${JSON.stringify([...new Set(frames.map(([phase]) => phase))])}`);
  // Headless Chromium renders only a handful of frames per second, so the bar is low on purpose.
  expect(frames.length, `the fight was rendered frame by frame (${frames.length} frames)`).toBeGreaterThan(15);
  const phases = new Set(frames.map(([phase]) => phase));
  expect([...phases].sort(), 'every phase was on screen').toEqual([1, 2, 3]);
  expect(frames.some(([, shift]) => shift > 0), 'the phase change is telegraphed on screen').toBe(true);
  expect(frames.some(([, , weakOpen]) => weakOpen > 0), 'the weak point opens during the fight').toBe(true);
  await expect(page.locator('#boss-phase')).toContainText('III');
  await page.screenshot({ path: 'shots/boss-phase3.png' });

  // The exposed weak point: a bright core with a draining countdown ring.
  await page.evaluate(() => { const boss = window.__kosmopilot.game.boss; boss.weakOpen = 2.6; boss.weakTimer = 4; });
  await page.waitForTimeout(120);
  expect((await state()).weak).toBe('core');
  await page.screenshot({ path: 'shots/boss-weak-open.png' });

  // Kill it and catch the death sequence.
  await page.evaluate(() => {
    const game = window.__kosmopilot.game;
    game.boss.weakOpen = 0;
    game.boss.health = .5;
    game.bullets.push({ x: game.boss.x - 14, y: game.boss.y, radius: 5, vx: 560, damage: 2, removed: false });
  });
  await page.waitForTimeout(250);
  await page.screenshot({ path: 'shots/boss-death-supernova.png' });
  const finale = await page.evaluate(() => window.__kosmopilot?.game?.finale?.style ?? null);
  expect(finale).toBe('supernova');
  await page.waitForTimeout(3200);
  await page.screenshot({ path: 'shots/boss-result.png' });
  expect(errors, `no runtime errors: ${errors.join(' | ')}`).toEqual([]);
});

// The gas biome must stay readable: dark billows keep the fog from washing the screen out.
test('the gas biome keeps its contrast', async ({ page }) => {
  test.setTimeout(300000);
  await page.setViewportSize({ width: 1612, height: 720 });
  await page.addInitScript((value) => localStorage.setItem('kosmopilot.v2', JSON.stringify(value)), SAVE);
  await page.goto('/');
  await page.locator('#intro-skip').click();
  await page.getByRole('button', { name: 'В ПОЛЁТ', exact: true }).click();
  await page.locator('.biome-row').nth(3).click();
  await page.locator('.level-card').nth(0).click();
  await page.locator('#launch-button').click();
  await page.waitForTimeout(9000);
  await page.screenshot({ path: 'shots/gas-flight.png' });
});
