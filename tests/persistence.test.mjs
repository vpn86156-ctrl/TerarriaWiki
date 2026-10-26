import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { writeFileSync, unlinkSync } from "node:fs";
import { pathToFileURL } from "node:url";
const output = "/tmp/terra-persistence-" + process.pid + ".mjs";
const bundle = await build({
  entryPoints: ["src/state/persistence.js"],
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
});
writeFileSync(output, bundle.outputFiles[0].contents);
const { readSavedState, STORAGE_KEY } = await import(pathToFileURL(output));
unlinkSync(output);
const restore = (value) =>
  readSavedState({
    getItem(key) {
      assert.equal(key, STORAGE_KEY);
      return JSON.stringify(value);
    },
  });
test("A genuinely new world starts at day one, zero completed chapters and an empty backpack", () => {
  const state = restore(null);
  assert.equal(state.day, 1);
  assert.equal(state.completed, 0);
  assert.equal(state.progressReviewed, true);
  assert.deepEqual(state.inventory, {});
  assert.deepEqual(state.diary, []);
});
test("Legacy two-chapter demo asks for review without deleting any user data", () => {
  const old = {
    completed: 2,
    day: 24,
    world: "Дом",
    inventory: { Wood: 321 },
    favorites: ["item:Wood"],
    diary: [{ id: "1", title: "Моя запись", text: "Не удалять", tag: "Цель" }],
  };
  const state = restore(old);
  assert.equal(state.completed, 2);
  assert.equal(state.progressReviewed, false);
  assert.equal(state.day, 24);
  assert.equal(state.world, "Дом");
  assert.deepEqual(state.inventory, old.inventory);
  assert.deepEqual(state.favorites, old.favorites);
  assert.equal(state.diary[0].text, "Не удалять");
});
test("Real progress and an explicit migration choice survive restore", () => {
  for (const completed of [0, 1, 3, 8, 11]) {
    const s = restore({ completed });
    assert.equal(s.completed, completed);
    assert.equal(s.progressReviewed, true);
  }
  assert.equal(
    restore({ completed: 2, progressReviewed: true }).progressReviewed,
    true,
  );
  assert.equal(restore({ completed: 0, progressReviewed: true }).completed, 0);
});
test("Malformed storage never invents completed chapters", () => {
  assert.equal(
    readSavedState({
      getItem() {
        return "{broken";
      },
    }).completed,
    0,
  );
  assert.equal(restore([]).completed, 0);
  assert.equal(restore({ completed: "2", day: "12" }).completed, 0);
  assert.equal(restore({ completed: -2 }).completed, 0);
  assert.equal(restore({ completed: 999 }).completed, 11);
});
