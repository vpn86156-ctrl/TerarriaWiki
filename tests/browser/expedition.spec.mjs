import { test, expect } from "@playwright/test";
const attach = (page) =>
  page.evaluate(async () => {
    const { Dungeon } = await import("/src/engine.js");
    const start = Dungeon.prototype.start;
    Dungeon.prototype.start = function (...args) {
      window.__testGame = this;
      return start.apply(this, args);
    };
  });
test("collection: cases cost coins, reward persists, equipping applies next attempt", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "last-torch:profile-v2",
      JSON.stringify({
        coins: 300,
        owned: ["mercury", "sun"],
        equipped: { skin: "wanderer", boots: "worn" },
      }),
    ),
  );
  await page.goto("/");
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.getByRole("button", { name: "Коллекция" }).click();
  await page.getByRole("button", { name: "Кейсы", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Честные шансы" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Открыть за 100 ◉" }).click();
  await expect(page.locator(".drop-reveal")).toBeVisible();
  const p = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("last-torch:profile-v2")),
  );
  expect(p.opened).toBe(1);
  expect(p.coins).toBeLessThanOrEqual(300);
  await page.getByRole("button", { name: "Ботинки", exact: true }).click();
  await page.locator('[data-equip="mercury"]').click();
  await expect(page.locator('[data-equip="mercury"]')).toHaveText("✓ Надето");
  await page.screenshot({
    path: "test-results/collection.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Закрыть коллекцию" }).click();
  await attach(page);
  await page.getByRole("button", { name: "Начать побег" }).click();
  await page.evaluate(() => {
    __testGame.reset();
  });
  expect(await page.evaluate(() => __testGame.bonuses.boots)).toBe("mercury");
  expect(await page.evaluate(() => __testGame.dashDuration)).toBeLessThan(1.8);
  expect(errors).toEqual([]);
});
test("floor reward cannot be collected twice by repeated UI updates", async ({
  page,
}) => {
  await page.goto("/");
  await attach(page);
  await page.getByRole("button", { name: "Начать побег" }).click();
  await page.evaluate(() => {
    const g = __testGame;
    g.keys.forEach((k) => (k.taken = true));
    Object.assign(g.player, g.exit);
    g.interact();
  });
  const coins = await page.locator("#wallet-coins").textContent();
  expect(Number(coins)).toBeGreaterThanOrEqual(60);
  await page.evaluate(() => {
    for (let i = 0; i < 5; i++) __testGame.emit();
  });
  await expect(page.locator("#wallet-coins")).toHaveText(coins);
  await page.reload();
  await expect(page.locator("#wallet-coins")).toHaveText(coins);
});
test("installable shell works offline after first load", async ({
  page,
  context,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  const manifest = await page
    .locator('link[rel="manifest"]')
    .getAttribute("href");
  expect(manifest).toBe("./manifest.webmanifest");
  const info = await page.evaluate(
    async () => await (await fetch("./manifest.webmanifest")).json(),
  );
  expect(info.display).toBe("standalone");
  expect(info.orientation).toBe("any");
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Начать побег" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Начать побег" }).click();
  await expect(page.locator("#game-overlay")).toBeHidden();
  await page.getByRole("button", { name: "Коллекция" }).click();
  await expect(
    page.getByRole("heading", { name: "Твой свет. Твой стиль." }),
  ).toBeVisible();
  expect(errors).toEqual([]);
  await context.setOffline(false);
});
test("landscape: side controls fit screen, long hold cannot select text", async ({
  browser,
}) => {
  const ctx = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  await page.goto("/");
  await page.getByRole("button", { name: "Начать побег" }).tap();
  await expect(page.locator(".intro-heading")).not.toBeVisible();
  const stage = await page.locator(".game-stage").boundingBox(),
    pad = await page.locator(".touch-pad").boundingBox(),
    action = await page.locator(".action-controls").boundingBox();
  expect(stage.width).toBeGreaterThan(400);
  expect(pad.x + pad.width).toBeLessThanOrEqual(stage.x + 4);
  expect(action.x).toBeGreaterThanOrEqual(stage.x + stage.width - 4);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    await page
      .locator(".game-shell")
      .evaluate((e) => getComputedStyle(e).userSelect),
  ).toBe("none");
  await page
    .getByRole("button", { name: "Идти вправо" })
    .dispatchEvent("pointerdown", { pointerId: 1, pointerType: "touch" });
  await page.waitForTimeout(500);
  await page
    .getByRole("button", { name: "Идти вправо" })
    .dispatchEvent("pointerup", { pointerId: 1, pointerType: "touch" });
  expect(await page.evaluate(() => getSelection().toString())).toBe("");
  await page.screenshot({ path: "test-results/landscape.png", fullPage: true });
  await ctx.close();
});
test("two real browser clients create a room, join and start together", async ({
  browser,
}) => {
  test.slow();
  const a = await browser.newContext(),
    b = await browser.newContext();
  const host = await a.newPage(),
    guest = await b.newPage();
  const errors = [];
  for (const p of [host, guest])
    p.on("pageerror", (e) => errors.push(e.message));
  try {
    await host.goto("/");
    await host.getByRole("button", { name: "Вдвоём" }).click();
    await host.getByLabel("Имя путника").fill("Первый");
    await host
      .getByRole("button", { name: "Создать комнату", exact: true })
      .click();
    await expect(host.locator("#coop-room-info")).toContainText("1/2");
    const code = (await host.locator("#coop-room-info").textContent()).match(
      /Комната ([A-F0-9]{6})/,
    )[1];
    await guest.goto("/");
    await guest.getByRole("button", { name: "Вдвоём" }).click();
    await guest.getByLabel("Имя путника").fill("Второй");
    await guest.getByLabel("Код комнаты").fill(code);
    await guest
      .getByRole("button", { name: "Присоединиться", exact: true })
      .click();
    await expect(guest.locator("#coop-room-info")).toContainText("2/2");
    await expect(host.locator("#coop-room-info")).toContainText("Второй");
    await host.getByRole("button", { name: "Начать вдвоём" }).click();
    await expect(host.locator("#coop-hud")).toContainText("Ты: 1");
    await expect(host.locator("#coop-canvas")).toBeFocused();
    await expect(guest.locator("#coop-hud")).toContainText("Ты: 2");
    await expect(host.locator("#coop-status")).toContainText("плиты");
    await host.screenshot({
      path: "test-results/coop-room.png",
      fullPage: true,
    });
    await guest.getByRole("button", { name: "Выйти из комнаты" }).click();
    await expect(host.locator("#coop-status")).toContainText("Ждём друга");
    expect(errors).toEqual([]);
  } finally {
    await a.close();
    await b.close();
  }
});
