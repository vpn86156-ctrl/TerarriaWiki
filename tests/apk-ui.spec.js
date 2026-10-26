import { test, expect } from "@playwright/test";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, extname } from "node:path";
const apk = resolve("artifacts/TERRA-Letopis-0.1.0.apk"),
  folder = resolve("build/apk-test");
mkdirSync(folder, { recursive: true });
execFileSync("unzip", ["-q", "-o", apk, "assets/*", "-d", folder]);
const mime = {
  ".html": "text/html",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".txt": "text/plain",
  ".md": "text/plain",
};
const errors = new WeakMap();
test.beforeEach(async ({ page, context }) => {
  const found = [];
  errors.set(page, found);
  page.on("pageerror", (e) => found.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") found.push(m.text());
  });
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== "appassets.androidplatform.net")
      throw new Error("Unexpected network request: " + url);
    const path = resolve(folder, "." + decodeURIComponent(url.pathname));
    if (!path.startsWith(folder + "/") || !existsSync(path))
      throw new Error("Missing packaged asset: " + url.pathname);
    await route.fulfill({
      status: 200,
      contentType: mime[extname(path)] || "application/octet-stream",
      body: readFileSync(path),
    });
  });
  await context.setOffline(true);
  await page.goto("https://appassets.androidplatform.net/assets/index.html");
  await page.getByRole("button", { name: "Войти в мир" }).click();
  await expect(page.locator(".home-greeting h1")).toBeVisible();
});
test.afterEach(async ({ page }) => expect(errors.get(page)).toEqual([]));
async function navigate(page, name) {
  await page.getByRole("button", { name: "Открыть меню", exact: true }).click();
  await page
    .locator(".drawer")
    .getByRole("link", { name, exact: true })
    .click();
  await expect(page.locator(".drawer")).not.toBeVisible();
}
async function widthOK(page) {
  const w = await page.evaluate(() => ({
    inner: innerWidth,
    body: document.body.scrollWidth,
    root: document.querySelector("#root").scrollWidth,
  }));
  if (w.body !== w.inner)
    console.log(
      await page.evaluate(() =>
        [...document.querySelectorAll("*")]
          .filter(
            (e) =>
              e instanceof HTMLElement && e.scrollWidth > e.clientWidth + 3,
          )
          .map((e) => ({
            tag: e.tagName,
            cls: e.className,
            right: e.getBoundingClientRect().right,
            width: e.clientWidth,
            scroll: e.scrollWidth,
          })),
      ),
    );
  expect(w.body).toBe(w.inner);
  expect(w.root).toBe(w.inner);
}
test("APK home: initial world, Android information, offline assets and mobile width", async ({
  page,
}) => {
  await expect(page.getByText("Зелёная долина", { exact: true })).toBeVisible();
  await expect(page.locator(".hero-progress b")).toHaveText("18%");
  await expect(page.locator(".hero-copy h2")).toHaveText("Взгляд из темноты");
  await widthOK(page);
  await page.screenshot({ path: "artifacts/android-home.png", fullPage: true });
  await page.getByRole("button", { name: "О приложении", exact: true }).click();
  await expect(page.locator("#modal-title")).toHaveText("Мир всегда рядом");
  await expect(page.locator(".modal-content")).toContainText("Android WebView");
  await page.keyboard.press("Escape");
  await expect(page.locator("dialog.modal")).not.toBeVisible();
  expect(
    await page.evaluate(() =>
      "serviceWorker" in navigator
        ? navigator.serviceWorker.getRegistrations().then((x) => x.length)
        : 0,
    ),
  ).toBe(0);
});
test("All eight sections, NPC 26 → 3 → empty → 26", async ({ page }) => {
  for (const name of [
    "Путь мира",
    "Из моих ресурсов",
    "Все крафты",
    "Как получить",
    "Все NPC",
    "Сюжет Terraria",
    "Мой дневник",
    "Главная",
  ]) {
    await navigate(page, name);
    await widthOK(page);
  }
  await navigate(page, "Все NPC");
  await expect(page.getByTestId("npc-count")).toHaveText("26");
  await page.getByRole("button", { name: "Пустыня", exact: true }).click();
  await expect(page.getByTestId("npc-count")).toHaveText("3");
  await page
    .getByRole("searchbox", { name: "Поиск NPC" })
    .fill("абракадабра 123 невозможное");
  await expect(
    page.getByRole("heading", { name: "Здесь пока тихо" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Сбросить поиск" }).click();
  await expect(page.getByTestId("npc-count")).toHaveText("26");
  await expect(page.locator(".extras-grid article")).toHaveCount(14);
});
test("Craft catalog: 48 cards, pagination, recipe, tree, ingredient and back", async ({
  page,
}) => {
  await page.getByRole("switch", { name: "Без спойлеров" }).click();
  await navigate(page, "Все крафты");
  await expect(page.locator(".item-grid .item-card")).toHaveCount(48);
  await expect(page.locator(".results-meta")).toContainText("3 233");
  const key = await page
    .locator(".item-card")
    .first()
    .getAttribute("data-item-key");
  await page.getByRole("button", { name: "Следующая страница" }).click();
  await expect(page.locator(".pagination")).toContainText("Страница 2");
  expect(
    await page.locator(".item-card").first().getAttribute("data-item-key"),
  ).not.toBe(key);
  await page
    .getByRole("searchbox", { name: "Поиск крафтов" })
    .fill("Железная кирка");
  await page
    .getByRole("button", {
      name: "Открыть рецепт: Железная кирка",
      exact: true,
    })
    .click();
  await expect(page.locator("#modal-title")).toHaveText("Железная кирка");
  await page
    .getByRole("button", { name: "Дерево крафта", exact: true })
    .click();
  await expect(page.locator(".tree-root")).toBeVisible();
  await page.getByRole("spinbutton", { name: "Нужно предметов" }).fill("3");
  await expect(
    page.locator(".tree-root>.tree-line .tree-amount"),
  ).toContainText("3");
  await widthOK(page);
  await page.locator(".tree-children .tree-item").first().click();
  await expect(
    page.getByRole("button", { name: "Назад к ингредиенту" }),
  ).toBeVisible();
  await expect(page.locator(".sources-section")).toBeVisible();
  await page.getByRole("button", { name: "Назад к ингредиенту" }).click();
  await expect(page.locator(".recipe-tree")).toBeVisible();
  await widthOK(page);
  const transforms = await page
    .locator(".game-sprite")
    .evaluateAll((nodes) => nodes.map((n) => getComputedStyle(n).transform));
  expect(transforms.every((t) => t === "none")).toBe(true);
  const ids = await page
    .locator("[data-layout-id]")
    .evaluateAll((n) => n.map((x) => x.dataset.layoutId));
  expect(new Set(ids).size).toBe(ids.length);
});
test("Inventory and favorites survive restart of packaged assets", async ({
  page,
}) => {
  await navigate(page, "Из моих ресурсов");
  await page
    .getByRole("spinbutton", { name: "Количество: Древесина" })
    .fill("321");
  await page
    .getByRole("button", { name: "Добавить предмет", exact: true })
    .click();
  await page
    .getByRole("searchbox", { name: "Поиск для добавления в инвентарь" })
    .fill("Камень");
  await page
    .getByRole("button", { name: "Добавить Камень", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await page.reload();
  await expect(
    page.getByRole("spinbutton", { name: "Количество: Древесина" }),
  ).toHaveValue("321");
  await navigate(page, "Все крафты");
  await page
    .locator(".item-card")
    .first()
    .getByRole("button", { name: "В избранное", exact: true })
    .click();
  await page.reload();
  await page.getByRole("button", { name: "Избранное", exact: true }).click();
  await expect(page.locator(".item-grid .item-card")).toHaveCount(1);
});
test("Journal create/edit/delete with confirmation and persistence", async ({
  page,
}) => {
  await navigate(page, "Мой дневник");
  await page.getByRole("button", { name: "Новая запись", exact: true }).click();
  await page.getByLabel("Заголовок", { exact: true }).fill("Мой первый поход");
  await page
    .getByLabel("Текст", { exact: true })
    .fill("Построить арену перед ночью.");
  await page
    .getByRole("button", { name: "Сохранить запись", exact: true })
    .click();
  await expect(page.locator(".diary-card h2")).toHaveText("Мой первый поход");
  await page.reload();
  await expect(page.locator(".diary-card h2")).toHaveText("Мой первый поход");
  await page
    .getByRole("button", { name: "Редактировать", exact: true })
    .click();
  await page.getByLabel("Заголовок", { exact: true }).fill("Арена готова");
  await page
    .getByRole("button", { name: "Сохранить запись", exact: true })
    .click();
  await expect(page.locator(".diary-card h2")).toHaveText("Арена готова");
  await page
    .getByRole("button", { name: "Удалить запись Арена готова", exact: true })
    .click();
  await expect(page.locator(".diary-card")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Удалить запись", exact: true })
    .click();
  await expect(page.locator(".diary-card")).toHaveCount(0);
});
test("Chapter confirmation changes progress, unlocks story, scenery and persists", async ({
  page,
}) => {
  await navigate(page, "Путь мира");
  await page
    .getByRole("button", { name: "Завершить главу", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Подтвердить завершение", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Мир запомнит этот день." }),
  ).toBeVisible();
  await expect(page.locator(".world-atmosphere")).toHaveAttribute(
    "data-scenery",
    "corruption",
  );
  await page
    .getByRole("button", { name: "Продолжить путешествие", exact: true })
    .click();
  await page.reload();
  await expect(page.locator(".path-progress")).toContainText("27%");
  await navigate(page, "Сюжет Terraria");
  await expect(
    page.getByRole("button", { name: "Читать у костра", exact: true }),
  ).toHaveCount(4);
  await page
    .getByRole("button", { name: "Читать у костра", exact: true })
    .nth(3)
    .click();
  await expect(page.locator("#modal-title")).toHaveText("Земля помнит");
  await expect(page.locator(".reading img")).toHaveAttribute(
    "src",
    /Eater_of_Worlds\.png/,
  );
  expect(
    await page
      .locator(".atmosphere-particle")
      .first()
      .evaluate((e) => getComputedStyle(e).animationName),
  ).toBe("none");
  expect(await page.evaluate(() => window.__terraAndroidBack())).toBe(true);
  await expect(page.locator("dialog.modal")).not.toBeVisible();
});
test("Acquisition, global search, source details, credits", async ({
  page,
}) => {
  await navigate(page, "Как получить");
  await expect(page.locator(".item-grid .item-card")).toHaveCount(48);
  await page.getByRole("searchbox", { name: "Поиск предметов" }).fill("Земля");
  await page.locator('[data-item-key="DirtBlock"] .card-open').click();
  await expect(page.locator("#modal-title")).toHaveText("Земля");
  await expect(page.locator(".sources-section")).toContainText("Мерцании");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Control+k");
  await page.getByRole("searchbox", { name: "Глобальный поиск" }).fill("Гид");
  await page.getByRole("button", { name: "Житель · Гид", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Гид", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Источники и права", exact: true })
    .click();
  await expect(page.locator(".credits-text")).toContainText("Re-Logic");
  await widthOK(page);
});

test("Ordinary motion and phone landscape keep shared sprites proportional", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const boss = page.locator(".hero-boss img");
  await expect(boss).toHaveAttribute("src", /Eye_of_Cthulhu.gif/);
  const ratio = await boss.evaluate((img) => ({
    natural: img.naturalWidth / img.naturalHeight,
    rendered:
      img.getBoundingClientRect().width / img.getBoundingClientRect().height,
  }));
  expect(Math.abs(ratio.natural - ratio.rendered)).toBeLessThan(0.01);
  await navigate(page, "Все крафты");
  await page
    .getByRole("searchbox", { name: "Поиск крафтов" })
    .fill("Железная кирка");
  await page
    .getByRole("button", {
      name: "Открыть рецепт: Железная кирка",
      exact: true,
    })
    .click();
  await expect(page.locator("#modal-title")).toHaveText("Железная кирка");
  await expect
    .poll(() =>
      page
        .locator(".modal-sprite-frame")
        .evaluate((e) => getComputedStyle(e).transform),
    )
    .toBe("none");
  const ids = await page
    .locator("[data-layout-id]")
    .evaluateAll((nodes) => nodes.map((n) => n.dataset.layoutId));
  expect(ids.length).toBeGreaterThan(0);
  expect(new Set(ids).size).toBe(ids.length);
  await page.setViewportSize({ width: 844, height: 390 });
  await widthOK(page);
  await page
    .getByRole("button", { name: "Дерево крафта", exact: true })
    .click();
  await widthOK(page);
});
