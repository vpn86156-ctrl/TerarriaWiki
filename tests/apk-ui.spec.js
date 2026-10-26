import { test, expect } from "@playwright/test";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, extname } from "node:path";
const apk = resolve(
    process.env.TERRA_TEST_APK || "artifacts/TERRA-Letopis-0.2.0.apk",
  ),
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

test("Screenshot regression: Zenith explains spoiler filtering and opens after consent", async ({
  page,
}) => {
  await navigate(page, "Все крафты");
  await page.getByRole("searchbox", { name: "Поиск крафтов" }).fill("Зенит");
  await expect(
    page.getByRole("heading", {
      name: "Совпадения скрыты режимом без спойлеров",
    }),
  ).toBeVisible();
  await expect(page.locator('[data-item-key="Zenith"]')).toHaveCount(0);
  await page
    .getByRole("button", { name: "Показать все этапы", exact: true })
    .click();
  await expect(
    page.getByRole("switch", { name: "Без спойлеров" }),
  ).toHaveAttribute("aria-checked", "false");
  await page.locator('[data-item-key="Zenith"] .card-open').click();
  await expect(page.locator("#modal-title")).toContainText("Зенит");
  await page
    .getByRole("button", { name: "Дерево крафта", exact: true })
    .click();
  await expect(page.locator(".tree-root")).toBeVisible();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("terra:chronicle:v1")).completed,
    ),
  ).toBe(2);
  await widthOK(page);
  await page.screenshot({ path: "artifacts/fixed-zenith.png", fullPage: true });
});

test("Screenshot regression: preparation chapters and stories do not reuse King Slime", async ({
  page,
}) => {
  await navigate(page, "Сюжет Terraria");
  const art = page.locator(".story-card .story-image");
  await expect(art.nth(0).locator("svg.game-sprite")).toHaveAttribute(
    "class",
    /chapter-item-art/,
  );
  await expect(art.nth(1).locator("svg.game-sprite")).toHaveAttribute(
    "class",
    /chapter-item-art/,
  );
  await expect(art.nth(0).locator("img")).toHaveCount(0);
  await expect(art.nth(1).locator("img")).toHaveCount(0);
  const first = await art
      .nth(0)
      .locator("svg.game-sprite")
      .getAttribute("viewBox"),
    second = await art
      .nth(1)
      .locator("svg.game-sprite")
      .getAttribute("viewBox");
  expect(first).not.toBe(second);
  await page
    .getByRole("button", { name: "Читать у костра", exact: true })
    .first()
    .click();
  await expect(
    page.locator(".reading-illustration svg.game-sprite"),
  ).toHaveAttribute("viewBox", first);
  await page.keyboard.press("Escape");
  await navigate(page, "Путь мира");
  await expect(
    page.locator(".chapter-art svg.game-sprite").nth(0),
  ).toHaveAttribute("viewBox", first);
  await expect(
    page.locator(".chapter-art svg.game-sprite").nth(1),
  ).toHaveAttribute("viewBox", second);
  await widthOK(page);
});

test("Screenshot regression: Guide and wide/tall items contain only their own atlas pixels", async ({
  page,
}) => {
  const { PNG } = await import("pngjs");
  for (const selector of [
    ".guide-portrait svg.game-sprite",
    ".quick-links>a:nth-child(1) svg.game-sprite",
    ".quick-links>a:nth-child(2) svg.game-sprite",
    ".quick-links>a:nth-child(3) svg.game-sprite",
  ]) {
    const expected = await page.locator(selector).evaluate(async (svg) => {
      const [x, y, w, h] = svg.getAttribute("viewBox").split(" ").map(Number),
        n = Math.max(w, h) * 4;
      const image = svg.querySelector("image"),
        url = new URL(image.getAttribute("href"), location.href).href;
      const img = new Image();
      img.src = url;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = n;
      canvas.height = n;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ff00ff";
      ctx.fillRect(0, 0, n, n);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        img,
        x,
        y,
        w,
        h,
        (n - w * 4) / 2,
        (n - h * 4) / 2,
        w * 4,
        h * 4,
      );
      const probe = document.createElement("div");
      probe.id = "sprite-pixel-probe";
      Object.assign(probe.style, {
        position: "fixed",
        left: "0",
        top: "0",
        width: n + "px",
        height: n + "px",
        background: "#ff00ff",
        zIndex: 9999,
      });
      const clone = svg.cloneNode(true);
      clone.style.width = n + "px";
      clone.style.height = n + "px";
      probe.appendChild(clone);
      document.body.appendChild(probe);
      return canvas.toDataURL("image/png").split(",")[1];
    });
    const actual = PNG.sync.read(
        await page.locator("#sprite-pixel-probe").screenshot(),
      ),
      reference = PNG.sync.read(Buffer.from(expected, "base64"));
    expect(actual.width).toBe(reference.width);
    expect(actual.height).toBe(reference.height);
    let wrong = 0;
    for (let i = 0; i < actual.data.length; i += 4) {
      if (
        [0, 1, 2, 3].some(
          (c) => Math.abs(actual.data[i + c] - reference.data[i + c]) > 3,
        )
      )
        wrong++;
    }
    expect(
      wrong,
      selector + " contains pixels from outside its atlas crop",
    ).toBeLessThan(reference.width * reference.height * 0.005);
    await page.locator("#sprite-pixel-probe").evaluate((e) => e.remove());
  }
});

async function replayIntro(page) {
  await page.getByRole("button", { name: "О приложении", exact: true }).click();
  await page.getByRole("button", { name: "Повторить вступление" }).click();
  await expect(page.locator(".intro-cinematic")).toBeVisible();
  await expect(page.locator("dialog.modal")).not.toBeVisible();
}
test("Cinematic Moon Lord: real local art, one flash, visible float, immediate skip and no overflow", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await replayIntro(page);
  const figure = page.locator(".moon-figure");
  await expect(figure.locator("img")).toHaveAttribute(
    "src",
    "./images/Moon_Lord.gif",
  );
  await expect(figure.locator("img")).toHaveJSProperty("complete", true);
  expect(
    await figure.locator("img").evaluate((e) => e.naturalWidth),
  ).toBeGreaterThan(0);
  await expect(page.locator(".intro-flash")).toHaveCount(1);
  const samples = [];
  for (let i = 0; i < 4; i++) {
    await page.waitForTimeout(250);
    samples.push(await figure.evaluate((e) => getComputedStyle(e).transform));
  }
  expect(new Set(samples).size).toBeGreaterThan(1);
  await expect(page.locator(".intro-flash")).toHaveCSS("opacity", "0");
  await page.screenshot({ path: "artifacts/design-intro-mobile.png" });
  await widthOK(page);
  for (const size of [
    { width: 320, height: 568 },
    { width: 844, height: 390 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(size);
    const enter = page.getByRole("button", { name: "Войти в мир" });
    await expect(enter).toBeInViewport();
    await widthOK(page);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Пропустить вступление" }).click();
  await expect(page.locator(".intro-cinematic")).toHaveCount(0);
  await expect(page.locator(".home-greeting")).toHaveCSS("opacity", "1");
});
test("Scroll entrances run once; focused cards are revealed and live reduced motion stops effects", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await navigate(page, "Все NPC");
  const cards = page.locator(".npc-card[data-reveal]"),
    last = cards.last();
  await expect(cards.first()).toHaveAttribute("data-reveal", "visible");
  await expect(last).toHaveAttribute("data-reveal", "pending");
  await expect(last).toHaveCSS("opacity", "0");
  await last.scrollIntoViewIfNeeded();
  await expect(last).toHaveAttribute("data-reveal", "visible");
  await expect(last).toHaveCSS("opacity", "1");
  await page.evaluate(() => scrollTo(0, 0));
  await expect(last).toHaveAttribute("data-reveal", "visible");
  await expect(last).toHaveCSS("opacity", "1");
  const hiddenCard = page.locator('.npc-card[data-reveal="pending"]').first();
  await expect(hiddenCard).toBeAttached();
  await hiddenCard.locator("button").first().focus();
  await expect(page.locator(".npc-card:focus-within")).toHaveAttribute(
    "data-reveal",
    "visible",
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator('[data-reveal="pending"]')).toHaveCount(0);
  await page.evaluate(() => scrollTo(0, 0));
  await replayIntro(page);
  await expect(page.locator(".intro-flash")).toHaveCount(0);
  await expect(page.locator(".intro-mote")).toHaveCount(0);
  await expect(page.locator(".moon-figure img")).toHaveAttribute(
    "src",
    "./images/Moon_Lord.png",
  );
  await expect(page.locator(".moon-figure")).toHaveCSS("transform", "none");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(page.locator(".intro-flash")).toHaveCount(1);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".intro-flash")).toHaveCount(0);
  await page.getByRole("button", { name: "Войти в мир" }).click();
  await expect(page.locator(".intro-cinematic")).toHaveCount(0);
});
