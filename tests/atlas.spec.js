import { test, expect } from "@playwright/test";
import { existsSync } from "node:fs";
import {
  atlasRegions,
  atlasResources,
  atlasCreatures,
  atlasLandmarks,
  cameraFor,
  phaseVisible,
} from "../src/atlasData.js";
const url = "http://localhost:8111/TerarriaWiki/";
async function nav(page, name) {
  if (await page.locator(".mobile-menu").isVisible())
    await page
      .getByRole("button", { name: "Открыть меню", exact: true })
      .click();
  await page
    .locator(".sidebar nav button")
    .getByText(name, { exact: true })
    .click();
}
async function open(page, reduced = true) {
  await page.emulateMedia({
    reducedMotion: reduced ? "reduce" : "no-preference",
  });
  await page.goto("/");
  await nav(page, "Мир экспедиций");
  await expect(page.locator(".atlas-world-svg")).toBeVisible();
}
async function region(page, id) {
  const r = atlasRegions.find((b) => b.id === id);
  await page
    .locator(".world-map button")
    .getByText(r.name, { exact: true })
    .click();
  await expect(page.locator(".biome-title h3")).toHaveText(r.name);
}
const matrix = (page) =>
  page.locator(".atlas-camera").evaluate((e) => {
    const m = new DOMMatrixReadOnly(getComputedStyle(e).transform);
    return [m.a, m.d, m.e, m.f].map((n) => +n.toFixed(4));
  });

test("atlas data has 13 framed areas, valid stage gates, local original sprites and visible in-world anchors", () => {
  expect(atlasRegions).toHaveLength(13);
  expect(new Set(atlasRegions.map((r) => r.id)).size).toBe(13);
  expect(cameraFor(null)).toEqual({ x: 0, y: 0, scale: 1 });
  for (const r of atlasRegions) {
    expect(r.name).toBeTruthy();
    expect(r.box.every(Number.isFinite)).toBeTruthy();
    expect(r.zoom).toBeGreaterThan(1);
    expect(atlasResources[r.id].length).toBeGreaterThan(0);
    const c = cameraFor(r);
    for (const [x, y] of atlasLandmarks[r.id]) {
      const px = c.x + x * c.scale,
        py = c.y + y * c.scale;
      expect(px).toBeGreaterThan(295);
      expect(px).toBeLessThan(905);
      expect(py).toBeGreaterThan(100);
      expect(py).toBeLessThan(790);
    }
    for (const e of [...atlasResources[r.id], ...atlasCreatures[r.id]]) {
      expect([0, 1, 2]).toContain(e.phase);
      expect(existsSync(`public/assets/${e.sprite || e.id}.webp`)).toBeTruthy();
      expect(e.where).toBeTruthy();
    }
  }
  expect(atlasResources.hallow.filter((e) => phaseVisible(e, 0))).toHaveLength(
    0,
  );
  expect(
    atlasResources.dungeon.find((e) => e.sprite === "Ectoplasm").phase,
  ).toBe(2);
});

test("world starts whole, exact map clicks animate the camera into a biome and back without changing pages", async ({
  page,
}) => {
  await open(page, false);
  expect(await matrix(page)).toEqual([1, 1, 0, 0]);
  await expect(page.locator(".atlas-region")).toHaveCount(14);
  await expect(page.locator(".biome-dossier")).toHaveCount(0);
  const duration = await page
    .locator(".atlas-camera")
    .evaluate((e) => parseFloat(getComputedStyle(e).transitionDuration));
  expect(duration).toBeGreaterThan(0.5);
  await page
    .getByRole("button", { name: "Приблизить: Джунгли", exact: true })
    .click();
  const c = cameraFor(atlasRegions.find((r) => r.id === "jungle"));
  await expect.poll(async () => {
    const [scale] = await matrix(page);
    return scale > 1 && scale < c.scale;
  }, {intervals:[40,60,80]}).toBe(true);
  await expect
    .poll(() => matrix(page))
    .toEqual([c.scale, c.scale, c.x, c.y].map((n) => +n.toFixed(4)));
  await expect(page.locator(".biome-title h3")).toHaveText("Джунгли");
  await expect(page.locator(".atlas-scene-pin")).toHaveCount(3);
  await expect(page.locator(".atlas-scene-pin").first()).toContainText(
    "Красная древесина",
  );
  await expect(page.locator("html")).toHaveAttribute("data-scene", "jungle");
  await page.locator(".exp-atlas-back").click();
  await expect.poll(() => matrix(page)).toEqual([1, 1, 0, 0]);
  await expect(page.locator(".biome-dossier")).toHaveCount(0);
  await expect(page.locator("html")).toHaveAttribute("data-scene", "forest");
});

test("every area opens correct resources and camera; SVG textures and sprites are actual decodable images", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await open(page);
  for (const r of atlasRegions) {
    await region(page, r.id);
    const c = cameraFor(r);
    await expect
      .poll(() => matrix(page))
      .toEqual([c.scale, c.scale, c.x, c.y].map((n) => +n.toFixed(4)));
    const actual = await page
      .locator(".exp-atlas-resource h4")
      .allTextContents();
    expect(actual).toEqual(
      atlasResources[r.id].filter((e) => phaseVisible(e, 0)).map((e) => e.name),
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
  }
  const decoded = await page.locator("svg image").evaluateAll(async (nodes) => {
    const urls = [...new Set(nodes.map((n) => n.getAttribute("href")))];
    return Promise.all(
      urls.map(async (src) => {
        const img = new Image();
        img.src = src;
        try {
          await img.decode();
          return img.naturalWidth > 0;
        } catch {
          return false;
        }
      }),
    );
  });
  expect(decoded.every(Boolean)).toBeTruthy();
  expect(errors).toEqual([]);
});

test("stage switch changes resources, creatures, loot and terrain without claiming automatic boss progress", async ({
  page,
}) => {
  await open(page);
  await region(page, "hallow");
  await expect(page.locator(".exp-atlas-planning")).toContainText(
    "Пока только планируем",
  );
  await expect(page.locator(".atlas-scene-pin")).toHaveCount(0);
  await page.getByRole("button", { name: "Хардмод", exact: true }).click();
  await expect(page.locator(".exp-atlas-resource")).toHaveCount(4);
  await expect(page.locator(".atlas-scene-pin")).toHaveCount(3);
  await expect(page.locator(".exp-atlas-resource-grid")).toContainText(
    "Кристальные осколки",
  );
  await page
    .locator(".exp-atlas-tabs button")
    .filter({ hasText: "Мобы" })
    .click();
  await expect(page.locator(".exp-atlas-creatures")).toContainText(
    "Элементаль хаоса",
  );
  await region(page, "dungeon");
  await expect(page.locator(".exp-atlas-resource-grid")).not.toContainText(
    "Эктоплазма",
  );
  await page
    .getByRole("button", { name: "После Плантеры", exact: true })
    .click();
  await expect(page.locator(".exp-atlas-resource-grid")).toContainText(
    "Эктоплазма",
  );
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("terraria-bosses")),
    ),
  ).toEqual([]);
  await page.getByRole("button", { name: "До хардмода", exact: true }).click();
  await region(page, "jungle");
  await expect(page.locator(".exp-atlas-resource-grid")).not.toContainText(
    "Хлорофитовая руда",
  );
  await page.getByRole("button", { name: "Хардмод", exact: true }).click();
  await expect(page.locator(".exp-atlas-resource-grid")).toContainText("200%");
  await expect(page.locator(".exp-atlas-resource-grid")).toContainText(
    "хотя бы одного механического босса",
  );
});

test("scene pins open relevant dossiers, valuable-item details, bestiary deep links and correct crimson boss", async ({
  page,
}) => {
  await open(page);
  await region(page, "cavern");
  await page.getByRole("button", { name: "Мобы: Пещеры", exact: true }).click();
  await expect(page.locator(".exp-atlas-creatures")).toContainText("Нимфа");
  await expect(page.locator(".biome-dossier")).toBeFocused();
  await page
    .getByRole("button", { name: "Открыть в бестиарии", exact: true })
    .click();
  await expect(page.locator(".enemy-card")).toHaveCount(1);
  await expect(page.locator(".enemy-card")).toContainText("Нимфа");
  await nav(page, "Мир экспедиций");
  await region(page, "sky");
  await page
    .getByRole("button", {
      name: "Редкие находки: Небо и острова",
      exact: true,
    })
    .click();
  await page.locator(".exp-atlas-loot button").first().click();
  await expect(page.getByRole("dialog")).toContainText("Звёздная ярость");
  await page.getByRole("button", { name: "Закрыть", exact: true }).click();
  await region(page, "crimson");
  await page
    .getByRole("button", { name: "Тактика: Мозг Ктулху", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Мозг Ктулху");
});

test("320px and 390px phones: overview, all biomes, modal map and escape/close stay accessible without overflow", async ({
  page,
}) => {
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await open(page);
    for (const r of atlasRegions) {
      await region(page, r.id);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBeTruthy();
    }
    await page
      .getByRole("button", { name: "Развернуть карту", exact: true })
      .click();
    const dialog = page.getByRole("dialog", { name: "Карта на весь экран" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Весь мир", exact: true }).click();
    await dialog.getByRole("button", { name: "Лес", exact: true }).click();
    await expect(dialog.locator(".atlas-scene-pin")).toHaveCount(3);
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: "Развернуть карту", exact: true }),
    ).toBeFocused();
    await expect(page.locator(".biome-title h3")).toHaveText("Лес");
    await page
      .getByRole("button", { name: "Развернуть карту", exact: true })
      .click();
    await dialog
      .getByRole("button", { name: "Руды и ресурсы: Лес", exact: true })
      .click();
    await expect(dialog).not.toBeVisible();
    await expect(page.locator(".biome-dossier")).toBeFocused();
  }
});

test("SVG can be operated by keyboard, Escape returns the world and reduced/manual-off motion remains immediate", async ({
  page,
}) => {
  await open(page);
  const snow = page.getByRole("button", {
    name: "Приблизить: Снега",
    exact: true,
  });
  await snow.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".biome-title h3")).toHaveText("Снега");
  expect(
    await page
      .locator(".atlas-camera")
      .evaluate((e) => parseFloat(getComputedStyle(e).transitionDuration)),
  ).toBeLessThanOrEqual(0.001);
  await page.locator(".exp-atlas-frame").focus();
  await page.keyboard.press("Escape");
  await expect(page.locator(".biome-dossier")).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page
    .getByRole("button", { name: "Отключить анимации", exact: true })
    .click();
  await region(page, "hell");
  expect(
    await page
      .locator(".atlas-camera")
      .evaluate((e) => parseFloat(getComputedStyle(e).transitionDuration)),
  ).toBeLessThanOrEqual(0.001);
  await expect(page.locator("html")).toHaveAttribute("data-scene", "hell");
  await nav(page, "Главная");
  await expect(page.locator("html")).toHaveAttribute("data-scene", "home");
});

test("new world section resumes and is included in validated journal export", async ({
  page,
}) => {
  await open(page);
  const result = await page.evaluate(async () => {
    const j = await import("/src/journal.js");
    const r = JSON.parse(localStorage.getItem("terraria-resume"));
    return {
      resume: r,
      valid: j.validateJournal(JSON.stringify(j.exportJournal())).data?.[
        "terraria-resume"
      ],
    };
  });
  expect(result.resume.page).toBe("world");
  expect(result.valid.page).toBe("world");
  await page.reload();
  await page.locator(".resume-button").click();
  await expect(page.locator(".atlas-world-svg")).toBeVisible();
});

test("entire atlas, previously unseen phases, new sprites and modal camera work in a cold offline Pages navigation", async ({
  page,
  context,
}) => {
  test.setTimeout(90000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(url);
  await page
    .getByRole("button", { name: "Скачать для офлайна", exact: true })
    .click();
  await expect(page.locator(".offline-panel")).toContainText(
    "Полная офлайн-копия готова",
    { timeout: 30000 },
  );
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await page.close();
  await context.setOffline(true);
  const fresh = await context.newPage();
  await fresh.goto(url);
  await nav(fresh, "Мир экспедиций");
  await fresh
    .getByRole("button", { name: "После Плантеры", exact: true })
    .click();
  for (const r of atlasRegions) {
    await region(fresh, r.id);
    await fresh
      .locator(".exp-atlas-tabs button")
      .filter({ hasText: "Мобы" })
      .click();
    await fresh.waitForFunction(() =>
      [...document.images].every((i) => i.complete),
    );
    expect(
      await fresh
        .locator("img")
        .evaluateAll((a) => a.every((i) => i.naturalWidth > 0)),
    ).toBeTruthy();
  }
  expect(
    await fresh.locator("svg image").evaluateAll(async (a) =>
      (
        await Promise.all(
          a.map(async (e) => {
            const i = new Image();
            i.src = e.getAttribute("href");
            try {
              await i.decode();
              return true;
            } catch {
              return false;
            }
          }),
        )
      ).every(Boolean),
    ),
  ).toBeTruthy();
  await fresh
    .getByRole("button", { name: "Развернуть карту", exact: true })
    .click();
  await expect(
    fresh.getByRole("dialog", { name: "Карта на весь экран" }),
  ).toBeVisible();
});

// Both coastlines belong to the same reference biome, but must not teleport to each other.
test("east coast map click zooms into the east coast, while the biome picker returns to the west", async ({
  page,
}) => {
  await open(page);
  await page
    .getByRole("button", { name: "Приблизить: восточный океан", exact: true })
    .click();
  await expect(page.locator(".biome-title h3")).toHaveText("Океан");
  const east = await matrix(page);
  expect(east[2]).toBeLessThan(-2800);
  await region(page, "ocean");
  const west = await matrix(page);
  expect(west[2]).toBeGreaterThan(0);
  expect(east[2]).not.toEqual(west[2]);
});
