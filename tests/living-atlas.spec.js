import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import {
  atlasBuildings,
  atlasDiscoveries,
  atlasDiscoveryIds,
} from "../src/atlasAdventureData.js";
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
async function open(page, reduced = true, url = "/") {
  await page.emulateMedia({
    reducedMotion: reduced ? "reduce" : "no-preference",
  });
  await page.goto(url);
  await nav(page, "Мир экспедиций");
  await expect(page.locator(".atlas-native-landscape")).toBeVisible();
}
async function region(page, id) {
  const names = {
    forest: "Лес",
    snow: "Снега",
    sky: "Небо и острова",
    cavern: "Пещеры",
    jungle: "Джунгли",
    hell: "Ад",
    desert: "Пустыня",
  };
  await page
    .locator(".world-map button")
    .getByText(names[id], { exact: true })
    .click();
}
async function close(page) {
  await page
    .getByRole("button", { name: "Закрыть осмотр", exact: true })
    .click();
  await expect(page.locator(".atlas-encounter-dialog")).toHaveCount(0);
}
async function discover(page, d) {
  await region(page, d.biome);
  await page.locator(".atlas-discovery-hotspot").click();
  await expect(page.getByRole("dialog")).toContainText(d.name);
}
async function decoded(page) {
  return page.evaluate(async () => {
    const urls = [
      ...new Set(
        [...document.images]
          .map((i) => i.src)
          .concat(
            [...document.querySelectorAll("svg image")].map((i) =>
              i.getAttribute("href"),
            ),
          ),
      ),
    ];
    return (
      await Promise.all(
        urls.map(async (src) => {
          const i = new Image();
          i.src = src;
          try {
            await i.decode();
            return true;
          } catch {
            return false;
          }
        }),
      )
    ).every(Boolean);
  });
}

test("native texture outputs, source hashes, four shared building geometries and six bounded discoveries are local", () => {
  const meta = JSON.parse(readFileSync("scripts/atlas-art-manifest.json"));
  expect(meta.revision).toBe("f238436b44c1a433f4d9e27c5d073637607c9107");
  expect(Object.keys(meta.blobs)).toHaveLength(95);
  expect(
    Object.values(meta.blobs).every((v) => /^[0-9a-f]{40}$/.test(v)),
  ).toBeTruthy();
  expect(atlasBuildings).toHaveLength(4);
  expect(atlasDiscoveries).toHaveLength(6);
  expect(new Set(atlasDiscoveryIds).size).toBe(6);
  for (const b of atlasBuildings) {
    for (const mode of ["room", "shell"])
      expect(
        existsSync(`public/assets/atlas/house-${b.id}-${mode}.webp`),
      ).toBeTruthy();
    expect(b.details).toHaveLength(3);
    expect(b.x).toBeGreaterThan(0);
    expect(b.x + b.w * 4).toBeLessThan(1200);
  }
  for (const d of atlasDiscoveries) {
    expect(existsSync(`public/assets/${d.sprite}.webp`)).toBeTruthy();
    expect(d.text.length).toBeGreaterThan(50);
    expect(d.x > 0 && d.x < 1200 && d.y > 0 && d.y < 800).toBeTruthy();
  }
  expect(existsSync("public/assets/atlas/world-early.webp")).toBeTruthy();
  expect(
    existsSync("public/assets/atlas/world-hard-overlay.webp"),
  ).toBeTruthy();
});

test("original-texture world is crisp, phase reuses the large base and layers only a small Hallow patch", async ({
  page,
}) => {
  await open(page);
  const href = await page
    .locator(".atlas-native-landscape")
    .getAttribute("href");
  expect(href).toContain("world-early.webp");
  expect(
    await page
      .locator(".atlas-native-landscape")
      .evaluate((e) => getComputedStyle(e).imageRendering),
  ).toBe("pixelated");
  await page.getByRole("button", { name: "Хардмод", exact: true }).click();
  await expect(page.locator(".atlas-native-landscape")).toHaveAttribute(
    "href",
    href,
  );
  await expect(page.locator(".atlas-hard-landscape")).toHaveCount(1);
  await expect(page.locator(".atlas-hard-landscape")).toHaveAttribute(
    "width",
    "156",
  );
  await page.getByRole("button", { name: "До хардмода", exact: true }).click();
  await expect(page.locator(".atlas-hard-landscape")).toHaveCount(0);
  expect(await decoded(page)).toBeTruthy();
});

test("clouds and fauna actually move; reduced, manual-off and float preference stop decorative movement", async ({
  page,
}) => {
  await open(page, false);
  const pose = () =>
    page
      .locator(".atlas-cloud-drift")
      .first()
      .evaluate((e) => getComputedStyle(e).transform);
  const first = await pose();
  await expect.poll(pose).not.toBe(first);
  expect(
    await page
      .locator(".atlas-slime-hop")
      .first()
      .evaluate((e) => getComputedStyle(e).animationName),
  ).toBe("atlas-slime-hop");
  await page
    .getByRole("button", { name: "Отключить анимации", exact: true })
    .click();
  expect(
    await page
      .locator(".atlas-cloud-drift")
      .first()
      .evaluate((e) => getComputedStyle(e).animationName),
  ).toBe("none");
  await page
    .getByRole("button", { name: "Включить анимации", exact: true })
    .click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await page
      .locator(".atlas-fauna-flight")
      .first()
      .evaluate((e) => getComputedStyle(e).animationName),
  ).toBe("none");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.evaluate(() => (document.documentElement.dataset.float = "off"));
  expect(
    await page
      .locator(".atlas-slime-hop")
      .first()
      .evaluate((e) => getComputedStyle(e).animationName),
  ).toBe("none");
  expect(
    await page
      .locator(".atlas-snowflake")
      .first()
      .evaluate((e) => getComputedStyle(e).animationName),
  ).not.toBe("none");
  await page.evaluate(
    () => (document.documentElement.dataset.particles = "off"),
  );
  expect(
    await page
      .locator(".atlas-weather")
      .first()
      .evaluate((e) => getComputedStyle(e).display),
  ).toBe("none");
});

test("all six in-world discoveries reveal a scene, persist once, can be replayed and never award inventory/bosses", async ({
  page,
}) => {
  await open(page);
  for (const d of atlasDiscoveries) {
    await discover(page, d);
    await expect(page.locator(".atlas-discovery-fact")).toHaveText(d.text);
    await expect(page.locator(".atlas-discovery-status")).toContainText(
      "Записано",
    );
    expect(await decoded(page)).toBeTruthy();
    await page
      .getByRole("button", { name: "Повторить сценку", exact: true })
      .click();
    await close(page);
  }
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("terraria-atlas-discoveries")),
    ),
  ).toEqual(atlasDiscoveryIds);
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("terraria-bosses")),
    ),
  ).toEqual([]);
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("terraria-treasures")),
    ),
  ).toEqual([]);
  await page.reload();
  await nav(page, "Мир экспедиций");
  await page.locator(".atlas-found-notes summary").click();
  await expect(page.locator(".atlas-found-notes button")).toHaveCount(6);
  await page.locator(".atlas-found-notes button").first().click();
  await expect(page.getByRole("dialog")).toContainText(
    atlasDiscoveries[0].name,
  );
  await close(page);
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("terraria-atlas-discoveries")),
    ),
  ).toHaveLength(6);
});

test("four houses open their exact native layer, toggle furniture, zoom without page overflow and explain hotspots", async ({
  page,
}) => {
  await open(page);
  for (const b of atlasBuildings) {
    await region(page, b.biome);
    await page
      .getByRole("button", {
        name: `Рассмотреть постройку: ${b.name}`,
        exact: true,
      })
      .click();
    const dlg = page.getByRole("dialog");
    await expect(dlg).toContainText(b.name);
    await expect(dlg.locator(".atlas-house-plane img")).toHaveAttribute(
      "src",
      `/assets/atlas/house-${b.id}-room.webp`,
    );
    await dlg
      .getByRole("button", { name: "Стены и каркас", exact: true })
      .click();
    await expect(dlg.locator(".atlas-house-plane img")).toHaveAttribute(
      "src",
      `/assets/atlas/house-${b.id}-shell.webp`,
    );
    await dlg
      .getByRole("button", { name: "Увеличить постройку", exact: true })
      .click();
    await expect(dlg.locator(".atlas-house-zoom output")).toHaveText("2×");
    await dlg
      .getByRole("button", { name: "Подсветить детали", exact: true })
      .click();
    await expect(dlg.locator(".atlas-house-detail-pin")).toHaveCount(3);
    await dlg
      .getByRole("button", { name: "Деталь: Мастерская", exact: true })
      .click();
    await expect(dlg.locator(".atlas-house-explanation")).toContainText(
      "Мастерская",
    );
    expect(await decoded(page)).toBeTruthy();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await close(page);
  }
});

test("modal inspect from expanded map closes the previous dialog and restores usable keyboard focus", async ({
  page,
}) => {
  await open(page);
  await region(page, "forest");
  await page
    .getByRole("button", { name: "Развернуть карту", exact: true })
    .click();
  const full = page.getByRole("dialog", { name: "Карта на весь экран" });
  await full
    .getByRole("button", { name: "Исследовать: Рукоять в камне", exact: true })
    .click();
  await expect(full).not.toBeVisible();
  await expect(page.locator(".atlas-encounter-dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".atlas-encounter-dialog")).toHaveCount(0);
  await expect(page.locator(".exp-atlas-frame").first()).toBeFocused();
  await page
    .getByRole("button", {
      name: "Рассмотреть постройку: Дом путешественника",
      exact: true,
    })
    .focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".atlas-encounter-dialog")).toBeVisible();
  await page.keyboard.press("Tab");
  expect(
    await page.evaluate(() =>
      document
        .querySelector(".atlas-encounter-dialog")
        .contains(document.activeElement),
    ),
  ).toBeTruthy();
  await page.keyboard.press("Escape");
  await expect(page.locator(".exp-atlas-frame").first()).toBeFocused();
});

test("320/390px phones keep discoveries, native housing zoom and controls reachable with no document overflow", async ({
  page,
}) => {
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await open(page);
    await region(page, "snow");
    await page.locator(".atlas-place-details button").first().click();
    await page
      .getByRole("button", { name: "Увеличить постройку", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Увеличить постройку", exact: true })
      .click();
    expect(
      await page
        .locator(".atlas-house-viewport")
        .evaluate((e) => e.scrollWidth > e.clientWidth),
    ).toBeTruthy();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await close(page);
    await discover(page, atlasDiscoveries[1]);
    await expect(page.locator(".atlas-discovery-object")).toBeVisible();
    await expect(page.locator(".atlas-discovery-disguise")).not.toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await close(page);
  }
});

test("new notes participate in guarded run switching, export, merge and strict whitelist validation", async ({
  page,
}) => {
  await open(page);
  await discover(page, atlasDiscoveries[0]);
  await close(page);
  const result = await page.evaluate(async () => {
    const j = await import("/src/journal.js");
    const { changeRun } = await import("/src/runs.js");
    const f = j.exportJournal();
    j.validateJournal(JSON.stringify(f));
    const m = new Map(Object.entries(localStorage)),
      store = {
        getItem: (k) => m.get(k) ?? null,
        setItem: (k, v) => m.set(k, v),
        removeItem: (k) => m.delete(k),
      };
    changeRun({ name: "Другой мир", classId: "mage" }, store);
    const empty = store.getItem("terraria-atlas-discoveries");
    changeRun({ id: "original" }, store);
    const restored = store.getItem("terraria-atlas-discoveries");
    let rejected = false;
    try {
      j.validateJournal(
        JSON.stringify({
          application: "terraria-guide",
          schemaVersion: 1,
          data: { "terraria-atlas-discoveries": ["made-up"] },
        }),
      );
    } catch {
      rejected = true;
    }
    return {
      data: f.data["terraria-atlas-discoveries"],
      empty,
      restored,
      rejected,
    };
  });
  expect(result.data).toEqual(["sword-stone"]);
  expect(result.empty === null || result.empty === "[]").toBeTruthy();
  expect(JSON.parse(result.restored)).toEqual(["sword-stone"]);
  expect(result.rejected).toBeTruthy();
});

test("storage quota and stale-run protection do not fake saved discovery state or overwrite unrelated progress", async ({
  page,
}) => {
  await open(page);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (k === "terraria-atlas-discoveries")
        throw new DOMException("quota", "QuotaExceededError");
      return original.call(this, k, v);
    };
  });
  await discover(page, atlasDiscoveries[0]);
  await expect(
    page.locator(".atlas-encounter-dialog [role=alert]"),
  ).toContainText("Не удалось сохранить");
  expect(
    await page.evaluate(() =>
      localStorage.getItem("terraria-atlas-discoveries"),
    ),
  ).toBeNull();
  await close(page);
  await page.reload();
  await nav(page, "Мир экспедиций");
  await page.locator(".atlas-native-landscape").waitFor();
  await page.evaluate(() =>
    localStorage.setItem("terraria-data-revision", "new-import"),
  );
  await discover(page, atlasDiscoveries[0]);
  await expect(
    page.locator(".atlas-encounter-dialog [role=alert]"),
  ).toContainText("Не удалось сохранить");
  expect(
    await page.evaluate(() =>
      localStorage.getItem("terraria-atlas-discoveries"),
    ),
  ).toBeNull();
});

test("cold offline Pages launch contains unseen discoveries, native scene textures, both house layers and phase overlay", async ({
  page,
  context,
}) => {
  test.setTimeout(90000);
  const url = "http://localhost:8111/TerarriaWiki/";
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
  const p = await context.newPage();
  await open(p, true, url);
  await p.getByRole("button", { name: "Хардмод", exact: true }).click();
  for (const b of atlasBuildings) {
    await region(p, b.biome);
    await p.locator(".atlas-place-details button").first().click();
    await p
      .getByRole("button", { name: "Стены и каркас", exact: true })
      .click();
    expect(await decoded(p)).toBeTruthy();
    await close(p);
  }
  for (const d of atlasDiscoveries) {
    await discover(p, d);
    expect(await decoded(p)).toBeTruthy();
    await close(p);
  }
});
