import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { placePanels, placeForSource } from "../src/data/places.js";
const data = JSON.parse(readFileSync("src/data/catalog.json", "utf8"));
test("Every mapped location has a real bundled panel image", () => {
  for (const [key, place] of Object.entries(placePanels)) {
    assert.equal(place.key, undefined, "panels are keyed by name");
    assert.ok(existsSync(`public/images/places/${place.image}.webp`), key);
    assert.ok(place.label.length > 2);
  }
  assert.ok(Object.keys(placePanels).length >= 16);
});
test("Chest, crate and bag sources resolve to a location, not to an unrelated biome", () => {
  const sources = data.drops.sources;
  for (const [id, source] of Object.entries(sources)) {
    if (!["container", "bag"].includes(source.kind)) continue;
    const place = placeForSource({ ...source, id });
    assert.ok(place, `no place for ${id}`);
  }
  assert.equal(placeForSource({ id: "lihzahrd-chest" }).image, "temple");
  assert.equal(placeForSource({ id: "shadow-chest" }).image, "underworld");
  assert.equal(placeForSource({ id: "skyware-chest" }).image, "space");
  assert.equal(placeForSource({ id: "gold-chest-dungeon" }).image, "dungeon");
  assert.equal(placeForSource({ id: "jungle-chest" }).image, "jungle");
});
test("Enemy sources follow their biome or event; unknown sources stay unknown", () => {
  assert.equal(placeForSource({ id: "wolf", biomes: ["snow"] }).image, "snow");
  assert.equal(
    placeForSource({ id: "drippler", events: ["blood-moon"] }).event,
    true,
  );
  assert.equal(placeForSource({ id: "town-npc", kind: "npc" }), null);
  assert.equal(placeForSource({ id: "weird-place", place: "atlantis" }), null);
});
test("No source is silently given a wrong generic location", () => {
  const unknown = Object.entries(data.drops.sources).filter(
    ([id, s]) => s.kind === "npc" && !s.biomes && !s.events,
  );
  for (const [id, s] of unknown)
    assert.equal(placeForSource({ ...s, id }), null, id);
});
