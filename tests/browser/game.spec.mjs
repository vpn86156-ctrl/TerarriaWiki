import { test, expect } from "@playwright/test";
async function attach(page) {
  await page.evaluate(async () => {
    const { Dungeon } = await import("/src/engine.js");
    const start = Dungeon.prototype.start;
    Dungeon.prototype.start = function (...args) {
      window.__testGame = this;
      return start.apply(this, args);
    };
  });
}
async function start(page) {
  await page.goto("/");
  await attach(page);
  await page.getByRole("button", { name: "Начать побег" }).click();
  await expect(page.locator("#game-overlay")).toBeHidden();
}
async function state(page) {
  return page.evaluate(() => ({
    x: __testGame.player.x,
    y: __testGame.player.y,
    phase: __testGame.phase,
    time: __testGame.elapsed,
    keys: __testGame.keyCount,
    hp: __testGame.player.hp,
  }));
}
test("desktop: real movement, key pickup, dash, pause, help and audio", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page).toHaveTitle(/Последний факел/);
  await expect(
    page.getByRole("button", { name: "Начать побег" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/desktop-intro.png",
    fullPage: true,
  });
  await attach(page);
  await page.getByRole("button", { name: "Начать побег" }).click();
  await expect(page.locator("#game")).toBeFocused();
  const before = await state(page);
  await page.keyboard.down("d");
  await page.waitForFunction(() => __testGame.player.x >= 492);
  await page.keyboard.up("d");
  await page.keyboard.down("w");
  await page.waitForFunction(() => __testGame.player.y <= 114);
  await page.keyboard.up("w");
  await expect(page.locator("#key-count")).toHaveText("1 / 2");
  const after = await state(page);
  expect(after.x).toBeGreaterThan(before.x + 300);
  expect(after.keys).toBe(1);
  expect(after.hp).toBeGreaterThan(0);
  await page.keyboard.press("Space");
  await expect(page.locator("#dash-state")).not.toHaveText("Готов");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("heading", { name: "Факел подождёт." }),
  ).toBeVisible();
  const paused = await state(page);
  await page.waitForTimeout(400);
  expect((await state(page)).time).toBe(paused.time);
  await page.getByRole("button", { name: "Продолжить", exact: true }).click();
  await page.getByRole("button", { name: "Как играть" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect((await state(page)).phase).toBe("paused");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect((await state(page)).phase).toBe("playing");
  await page.getByRole("button", { name: "Включить звук" }).click();
  await expect(page.locator("#sound-button")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.screenshot({
    path: "test-results/desktop-playing.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
  await page.reload();
  await expect(page.locator("#sound-button")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});
test("floor progression, death/retry, victory and persisted best", async ({
  page,
}) => {
  await start(page);
  await page.evaluate(() => {
    __testGame.hurt();
    __testGame.invulnerable = 0;
    __testGame.hurt();
    __testGame.invulnerable = 0;
    __testGame.hurt();
  });
  await expect(
    page.getByRole("heading", { name: "Факел погас." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Зажечь снова" }).click();
  expect((await state(page)).hp).toBe(3);
  for (let floor = 0; floor < 3; floor++) {
    await page.evaluate(() => {
      const g = __testGame;
      g.keys.forEach((k) => (k.taken = true));
      Object.assign(g.player, g.exit);
      g.updateVision();
      g.emit();
    });
    await page.keyboard.press("e");
    if (floor < 2) {
      await expect(
        page.getByRole("heading", { name: "На шаг ближе." }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Следующий этаж" }).click();
      await expect(page.locator("#floor-number")).toHaveText(
        `0${floor + 2} / 03`,
      );
    }
  }
  await expect(
    page.getByRole("heading", { name: "Ты нашёл выход." }),
  ).toBeVisible();
  expect((await state(page)).phase).toBe("won");
  await expect(page.locator("#best-time")).toHaveText(/\d+:\d{2}/);
  const best = await page.locator("#best-time").textContent();
  await page.reload();
  await expect(page.locator("#best-time")).toHaveText(best);
  await expect(
    page.getByRole("button", { name: "Начать побег" }),
  ).toBeVisible();
});
test("restart requires confirmation; background blur clears held input", async ({
  page,
}) => {
  await start(page);
  await page.keyboard.down("d");
  await page.waitForTimeout(150);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  expect((await state(page)).phase).toBe("paused");
  await page.getByRole("button", { name: "Начать новый побег" }).click();
  await expect(
    page.getByRole("heading", { name: "Вернуться к началу?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Нет, продолжить" }).click();
  await expect(
    page.getByRole("heading", { name: "Факел подождёт." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Продолжить", exact: true }).click();
  const resumed = await state(page);
  await page.waitForTimeout(150);
  expect((await state(page)).x).toBe(resumed.x);
  await page.keyboard.up("d");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Начать новый побег" }).click();
  await page.getByRole("button", { name: "Да, новый побег" }).click();
  expect((await state(page)).time).toBeLessThan(0.15);
});
test("mobile: touch movement, action buttons, resize and no overflow", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await start(page);
  await expect(page.locator(".touch-pad")).toBeVisible();
  const before = await state(page);
  await page
    .getByRole("button", { name: "Идти вправо" })
    .dispatchEvent("pointerdown", { pointerId: 1, pointerType: "touch" });
  await page.waitForTimeout(350);
  await page
    .getByRole("button", { name: "Идти вправо" })
    .dispatchEvent("pointerup", { pointerId: 1, pointerType: "touch" });
  expect((await state(page)).x).toBeGreaterThan(before.x + 15);
  await page.getByRole("button", { name: "Рывок — готов" }).tap();
  await expect(page.locator("#dash-state")).not.toHaveText("Готов");
  await page.getByRole("button", { name: "Действие", exact: true }).tap();
  await expect(page.locator("#game-message")).toContainText(/Подойди/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/mobile-playing.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 320, height: 740 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/mobile-small.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Пауза", exact: true }).tap();
  await expect(
    page.getByRole("heading", { name: "Факел подождёт." }),
  ).toBeVisible();
  expect(errors).toEqual([]);
  expect(
    await page.locator("#game").evaluate((c) => {
      const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4)
        if (d[i] + d[i + 1] + d[i + 2] > 85) n++;
      return n;
    }),
  ).toBeGreaterThan(1000);
  await context.close();
});
test("storage denied and reduced motion do not prevent play", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    Storage.prototype.getItem = function () {
      throw new Error("denied");
    };
    Storage.prototype.setItem = function () {
      throw new Error("denied");
    };
  });
  await start(page);
  await page.keyboard.press("Space");
  await expect(page.locator("#dash-state")).not.toHaveText("Готов");
  await page.getByRole("button", { name: "Включить звук" }).click();
  await expect(page.locator("#sound-button")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});
