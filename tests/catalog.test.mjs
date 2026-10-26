import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
const apkPath =
  process.env.TERRA_TEST_APK || "artifacts/TERRA-Letopis-0.2.0.apk";
const output = "/tmp/terra-data-test-" + process.pid + ".mjs";
const bundle = await build({
  entryPoints: ["src/data/index.js"],
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
});
writeFileSync(output, bundle.outputFiles[0].contents);
const d = await import(pathToFileURL(output));
unlinkSync(output);
const state = {
  completed: 2,
  spoilers: false,
  inventory: { Wood: 120, IronBar: 12, Gel: 18 },
  favorites: [],
};
test("Full real catalog and town population, no duplicate stable keys", () => {
  assert.equal(d.items.length, 6186);
  assert.equal(d.recipes.length, 3655);
  assert.equal(d.recipeMap.size, 3233);
  assert.equal(d.data.npcs.filter((n) => n.main).length, 26);
  assert.equal(d.data.npcs.filter((n) => !n.main).length, 14);
  assert.equal(new Set(d.items.map((i) => i.key)).size, 6186);
  assert.equal(new Set(d.recipes.map((r) => r.id)).size, 3655);
  assert.equal(d.items.filter((i) => i.localized).length, 5426);
});
test("Every recipe references existing ingredients/groups and every item has an authentic local atlas sprite", () => {
  for (const i of [...d.items, ...d.data.npcs])
    assert.ok(d.data.sprites.icons[i.icon.split("/").at(-1)], i.key || i.id);
  for (const r of d.recipes) {
    assert.ok(d.byKey.has(r.result));
    assert.ok(r.amount > 0);
    for (const g of r.ingredients) {
      assert.ok(g.amount > 0);
      if (g.item) assert.ok(d.byKey.has(g.item));
      else assert.ok(d.groups[g.group]?.items.length);
    }
  }
});
test("Resource max flow cannot spend overlapping exact/group stacks twice", () => {
  const group = Object.keys(d.groups).find(
    (k) =>
      d.groups[k].items.includes("IronBar") &&
      d.groups[k].items.includes("LeadBar"),
  );
  assert.ok(group);
  const r = {
    ingredients: [
      { group, amount: 5 },
      { item: "IronBar", amount: 5 },
    ],
  };
  assert.equal(d.availability(r, { IronBar: 5 }).enough, false);
  assert.equal(d.availability(r, { IronBar: 5, LeadBar: 5 }).enough, true);
  assert.equal(d.availability(r, { IronBar: 10 }).enough, true);
  assert.equal(
    d.availability(r, { IronBar: 9 }).lines.reduce((a, g) => a + g.missing, 0),
    1,
  );
});
test("Yield multiplication and missing amount are based on complete batches", () => {
  const r = d.recipeMap.get("Torch").find((r) => r.amount === 3);
  assert.ok(r);
  const batches = Math.ceil(7 / r.amount),
    result = d.availability(r, { Wood: 2, Gel: 3 }, batches);
  assert.equal(batches, 3);
  assert.equal(result.enough, false);
  assert.equal(result.lines.find((g) => g.options.includes("Wood")).missing, 1);
});
test("All crafts and acquisition can be found, NPC desert scenario and ingredient search", () => {
  assert.equal(d.filterCrafts({}, state).length, 3233);
  assert.equal(d.filterItems({}, state).length, 6186);
  assert.ok(d.filterCrafts({ query: "древесина" }, state).length > 20);
  assert.ok(d.filterCrafts({ query: "Work Bench" }, state).length > 20);
  assert.equal(d.filterNPCs("", "", false, state).length, 26);
  assert.equal(d.filterNPCs("", "desert", false, state).length, 3);
  assert.equal(
    d.filterNPCs("не бывает такого жителя", "desert", false, state).length,
    0,
  );
});
test("Future items and recipes cannot bypass spoiler mode", () => {
  const s = { ...state, spoilers: true };
  assert.ok(d.filterCrafts({}, s).every((i) => d.phase(i) <= 2));
  assert.ok(!d.filterItems({ query: "Лунный" }, s).some((i) => d.phase(i) > 2));
  assert.equal(
    d.phase(d.items.find((i) => i.milestone === "lunatic-cultist")),
    10,
  );
});
test("APK contains a native entry point, bundled assets and no network permission", () => {
  const badging = readFileSync("artifacts/apk-info.txt", "utf8");
  assert.match(badging, /minSdkVersion:'26'/);
  assert.match(badging, /targetSdkVersion:'35'/);
  assert.match(
    badging,
    /launchable-activity: name='io.github.vpn86156.terraletopis.MainActivity'/,
  );
  assert.doesNotMatch(badging, /uses-permission/);
  if (apkPath.includes("Design-")) {
    assert.match(
      badging,
      /package: name='io.github.vpn86156.terraletopis.design'/,
    );
    assert.match(badging, /application-label:'TERRA Дизайн'/);
  }
  const listing = execFileSync("unzip", ["-Z1", apkPath], { encoding: "utf8" });
  assert.match(listing, /classes.dex/);
  assert.match(listing, /assets\/images\/Eye_of_Cthulhu.gif/);
  assert.match(listing, /assets\/fonts\/manrope-cyrillic-400-normal.woff2/);
  assert.doesNotMatch(listing, /sw\.js|manifest\.webmanifest|\.zip$/m);
  const html = execFileSync("unzip", ["-p", apkPath, "assets/index.html"], {
    maxBuffer: 20 * 1024 * 1024,
    encoding: "utf8",
  });
  assert.ok(html.indexOf('<div id="root"') < html.indexOf("<script>"));
  assert.doesNotMatch(html, /<script[^>]+src=/);
  assert.match(html, /url\(\.\/fonts\//);
});
